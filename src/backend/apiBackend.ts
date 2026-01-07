import * as vscode from 'vscode';
import * as cp from 'child_process';
import { JulesBackend, JulesAuthStatus, ChatSession } from './types';

// API Configuration
const API_BASE = 'https://jules.googleapis.com/v1alpha';

export class ApiBackend implements JulesBackend {
    private _apiKey: string | undefined;
    private _activePollers = new Map<string, NodeJS.Timeout>();

    constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly _onOutput: (text: string, sender: 'jules' | 'system', session: ChatSession) => void,
        private readonly _onStatusChange: (status: JulesAuthStatus) => void
    ) {}

    async checkAuth(cwd: string): Promise<JulesAuthStatus> {
        this._apiKey = await this._context.secrets.get('jules.apiKey');
        return this._apiKey ? 'signed-in' : 'key-missing';
    }

    async login(cwd: string): Promise<void> {
        const key = await vscode.window.showInputBox({
            title: 'Enter Jules API Key',
            prompt: 'Paste your key from jules.google/settings',
            password: true,
            ignoreFocusOut: true
        });

        if (key) {
            await this._context.secrets.store('jules.apiKey', key);
            this._apiKey = key;
            this._onStatusChange('signed-in');
            vscode.window.showInformationMessage('Jules API Key saved successfully.');
        }
    }

    async logout(cwd: string): Promise<void> {
        await this._context.secrets.delete('jules.apiKey');
        this._apiKey = undefined;
        this._onStatusChange('signed-out');
        vscode.window.showInformationMessage('Jules API Key removed.');
    }

    async sendMessage(session: ChatSession, message: string, cwd: string): Promise<void> {
        if (!this._apiKey) {
            this._onOutput('❌ API Key missing. Please sign in.', 'system', session);
            return;
        }

        // Special commands handling (CLI emulation)
        const lower = message.toLowerCase().trim();
        if (lower === 'status') {
             await this._listSessions(session);
             return;
        }

        try {
            if (session.remoteId) {
                // Continued conversation
                this._onOutput('💬 Sending message to existing session...', 'jules', session);
                await this._sendMessageToSession(session.remoteId, message);

                // Ensure polling is active (restart it to extend timeout)
                this._pollActivities(session.remoteId, session);
            } else {
                // New Session
                this._onOutput('🚀 Dispatching to Jules API...', 'jules', session);

                // 1. Get Source (Repo)
                const repoSlug = await this._getGitHubRepoSlug(cwd);
                if (!repoSlug) {
                    this._onOutput('⚠️ Could not detect GitHub repo. Please ensure a remote is configured.', 'system', session);
                    return;
                }

                // 2. Resolve Source ID
                const sourceName = await this._resolveSource(repoSlug);
                if (!sourceName) {
                    this._onOutput(`⚠️ Source not found for repo: ${repoSlug}. Ensure you have installed the Jules GitHub app.`, 'system', session);
                    return;
                }

                const sessionData = await this._createSession(sourceName, message, cwd);
                const remoteName = sessionData.name; // sessions/12345...

                // Store remote ID for future messages
                session.remoteId = remoteName;
                if (sessionData.title) session.title = sessionData.title;

                this._onOutput(`✅ Session Created: ${sessionData.id}\nTitle: ${sessionData.title || 'Untitled'}`, 'jules', session);

                // 4. Poll for activities
                this._pollActivities(remoteName, session);
            }

        } catch (error: any) {
            this._onOutput(`❌ API Error: ${error.message}`, 'system', session);
        }
    }

    // --- API Methods ---

    private async _listSessions(session: ChatSession) {
        try {
            const res = await fetch(`${API_BASE}/sessions?pageSize=10`, {
                headers: { 'x-goog-api-key': this._apiKey! }
            });
            const data = await res.json() as any;
            if (data.error) throw new Error(data.error.message);

            const list = (data.sessions || []).map((s: any) => `- **${s.title}** (ID: ${s.id})`).join('\n');
            this._onOutput(`Recent Sessions:\n${list || 'No sessions found.'}`, 'jules', session);
        } catch (e: any) {
            this._onOutput(`Error listing sessions: ${e.message}`, 'system', session);
        }
    }

    private async _resolveSource(repoSlug: string): Promise<string | null> {
        // List sources and find the one matching the repo
        // TODO: Handle pagination if user has many sources
        try {
            const res = await fetch(`${API_BASE}/sources`, {
                headers: { 'x-goog-api-key': this._apiKey! }
            });
            const data = await res.json() as any;
            if (data.error) throw new Error(data.error.message);

            const source = data.sources?.find((s: any) => {
                return s.githubRepo && `${s.githubRepo.owner}/${s.githubRepo.repo}`.toLowerCase() === repoSlug.toLowerCase();
            });

            return source ? source.name : null;
        } catch (e) {
            console.error('Error resolving source', e);
            return null;
        }
    }

    private async _createSession(sourceName: string, prompt: string, cwd: string): Promise<any> {
        // Detect current branch
        let branch = 'main';
        try {
            branch = await this._getCurrentBranch(cwd) || 'main';
        } catch (e) {
            console.warn('Could not detect branch, defaulting to main');
        }

        const res = await fetch(`${API_BASE}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this._apiKey!
            },
            body: JSON.stringify({
                prompt,
                sourceContext: {
                    source: sourceName,
                    githubRepoContext: { startingBranch: branch }
                },
                automationMode: 'AUTO_CREATE_PR' // Assume we want action
            })
        });
        const data = await res.json() as any;
        if (data.error) throw new Error(data.error.message);
        return data;
    }

    private _getCurrentBranch(cwd: string): Promise<string | null> {
        return new Promise(resolve => {
            cp.exec('git rev-parse --abbrev-ref HEAD', { cwd }, (err, stdout) => {
                if (err) resolve(null);
                else resolve(stdout.trim());
            });
        });
    }

    private async _sendMessageToSession(remoteId: string, message: string): Promise<void> {
        const res = await fetch(`${API_BASE}/${remoteId}:sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this._apiKey!
            },
            body: JSON.stringify({
                message: { text: message }
            })
        });
        const data = await res.json() as any;
        if (data.error) throw new Error(data.error.message);
    }

    private async _pollActivities(sessionName: string, chatSession: ChatSession) {
        // Clear existing poller for this session if any
        if (this._activePollers.has(sessionName)) {
            clearInterval(this._activePollers.get(sessionName)!);
        }

        // Initialize from session state to avoid reprocessing old activities
        let lastActivityCount = chatSession.lastActivityCount || 0;
        const pollInterval = 3000;
        const maxPolls = 200; // Increased to 10 minutes (3s * 200 = 600s)
        let polls = 0;

        const interval = setInterval(async () => {
            polls++;
            if (polls > maxPolls) {
                clearInterval(interval);
                this._activePollers.delete(sessionName);
                this._onOutput('⚠️ Polling timed out. Check dashboard for updates.', 'system', chatSession);
                return;
            }

            try {
                // The sessionName is "sessions/{id}"
                const res = await fetch(`${API_BASE}/${sessionName}/activities?pageSize=50`, {
                    headers: { 'x-goog-api-key': this._apiKey! }
                });
                const data = await res.json() as any;

                let hasNewActivity = false;
                if (data.activities && data.activities.length > lastActivityCount) {
                    hasNewActivity = true;
                    const newActivities = data.activities.slice(lastActivityCount);
                    // Update local counter
                    lastActivityCount = data.activities.length;
                    // Persist to session object so next poll/message knows where to start
                    chatSession.lastActivityCount = lastActivityCount;

                    for (const act of newActivities) {
                        let text = '';
                        if (act.message) text = act.message.text || JSON.stringify(act.message);
                        else if (act.toolUse) text = `🛠️ Used Tool: ${act.toolUse.tool}`;
                        // Avoid raw dumping unknown activities unless essential
                        else if (act.type === 'PLAN_UPDATE') text = '📋 Plan updated';
                        else text = ''; // Skip noisy unknown events

                        if (text) {
                            this._onOutput(text, 'jules', chatSession);
                        }
                    }
                }

                // Adaptive Backoff:
                // If we found activity, reset delay to be snappy for follow-ups.
                // If silence, back off to save resources.
                if (hasNewActivity) {
                    currentDelay = 1000;
                } else {
                    currentDelay = Math.min(currentDelay * 1.5, maxDelay);
                }

                setTimeout(poll, currentDelay);

            } catch (e) {
                console.error('Polling error', e);
                // Retry with backoff even on error
                currentDelay = Math.min(currentDelay * 2, maxDelay);
                setTimeout(poll, currentDelay);
            }
        };

        // Start polling
        setTimeout(poll, currentDelay);
    }

    // --- Helpers (Duplicated from CliBackend/Extension - could be shared utils) ---
    private _getGitHubRepoSlug(cwd: string): Promise<string | null> {
        return new Promise(resolve => {
            cp.exec('git remote get-url origin', { cwd }, (err, stdout) => {
                const url = stdout.trim();
                if (url) {
                    const match = url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
                    if (match) resolve(match[1]);
                    else resolve(null);
                } else {
                    resolve(null);
                }
            });
        });
    }
}
