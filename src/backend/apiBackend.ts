import * as vscode from 'vscode';
import * as cp from 'child_process';
import { JulesBackend, JulesAuthStatus, ChatSession } from './types';

// API Configuration
const API_BASE = 'https://jules.googleapis.com/v1alpha';

export class ApiBackend implements JulesBackend {
    private _apiKey: string | undefined;

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

        // 3. Create Session or Send Message?
        // In the current CLI model, every "task" is a new session if passed via `remote new`.
        // However, the chat interface implies a conversation.
        // If the session ID in `session.id` is purely local (timestamp), we need to create a remote session first.

        // Check if we already have a remote session ID mapped to this local session
        // For simplicity in this v1, let's assume we create a NEW session for the first message,
        // and subsequent messages might be supported if we stored the remote ID.
        // BUT: The current extension UI creates a new "ChatSession" object for every task.
        // So we treat this message as the prompt for a NEW session.

        try {
            const sessionData = await this._createSession(sourceName, message, cwd);
            const remoteId = sessionData.id;
            const remoteName = sessionData.name; // sessions/12345...

            this._onOutput(`✅ Session Created: ${remoteId}\nTitle: ${sessionData.title}`, 'jules', session);

            // 4. Poll for activities
            this._pollActivities(remoteName, session);

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

    private async _pollActivities(sessionName: string, chatSession: ChatSession) {
        let lastActivityCount = 0;
        let currentDelay = 1000; // Start fast (1s)
        const maxDelay = 10000; // Cap at 10s
        const startTime = Date.now();
        const timeoutMs = 5 * 60 * 1000; // 5 minutes timeout

        // Optimization: Use exponential backoff to reduce API load while maintaining responsiveness
        const poll = async () => {
            if (Date.now() - startTime > timeoutMs) {
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
                    lastActivityCount = data.activities.length;

                    for (const act of newActivities) {
                        // We only care about Agent activities or interesting status updates
                        // The structure of Activity needs to be inspected.
                        // Assuming simple text output for now based on common API patterns.
                        // Real schema might have 'message', 'toolUse', etc.

                        // Based on docs: "To see the agent’s response, list the activities again."
                        // We'll dump the activity content.
                        let text = '';
                        if (act.message) text = act.message.text || JSON.stringify(act.message);
                        else if (act.toolUse) text = `🛠️ Used Tool: ${act.toolUse.tool}`;
                        else text = JSON.stringify(act); // Fallback

                        // Filter out user's own messages to avoid duplication if API echoes them
                        // (Simple heuristic: if text equals original prompt, skip)

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
