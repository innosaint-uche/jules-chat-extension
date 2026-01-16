import * as vscode from 'vscode';
import * as cp from 'child_process';
import { JulesBackend, JulesAuthStatus, ChatSession } from './types';

// API Configuration
const API_BASE = 'https://jules.googleapis.com/v1alpha';

// Polyfill for fetch if needed (Node 18+ has it, but Types might miss it)
const fetch = (global as any).fetch;

export class ApiBackend implements JulesBackend {
    private _apiKey: string | undefined;
    private _activePollers = new Map<string, any>(); // Use any to avoid NodeJS.Timeout vs number issues
    private _pollerStates = new Map<string, { active: boolean }>();
    private _repoSlugCache = new Map<string, string>(); // Cache for repo slug per CWD

    // Performance optimization: Local Set for fast deduplication of activities per session
    // This avoids O(N*M) checks where N is new activities and M is total history.
    private _processedActivitySets = new Map<string, Set<string>>();

    // Optimization: Cache resolved source names for repo slugs to avoid frequent lookups
    private _sourceNameCache = new Map<string, string>();

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
            prompt: 'Enter your API Key from jules.google/settings to enable the chat interface.',
            password: true,
            ignoreFocusOut: true
        });

        if (key && key.trim().length > 0) {
            await this._context.secrets.store('jules.apiKey', key.trim());
            this._apiKey = key.trim();
            this._onStatusChange('signed-in');
            vscode.window.showInformationMessage('Jules API Key saved successfully. Flexible chat is now enabled.');
        } else {
             // If user cancels or enters empty, do nothing or warn
        }
    }

    async logout(cwd: string): Promise<void> {
        await this._context.secrets.delete('jules.apiKey');
        this._apiKey = undefined;
        this._sourceNameCache.clear();
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

                // 2. Resolve Source ID (Cached)
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

    /**
     * Cleans up resources for a specific session or all sessions if no ID provided.
     * Use this when a session is closed or the extension is deactivated.
     */
    public cleanup(sessionRemoteId?: string) {
        if (sessionRemoteId) {
            // Stop poller
            if (this._pollerStates.has(sessionRemoteId)) {
                this._pollerStates.get(sessionRemoteId)!.active = false;
                this._pollerStates.delete(sessionRemoteId);
            }
            if (this._activePollers.has(sessionRemoteId)) {
                clearTimeout(this._activePollers.get(sessionRemoteId));
                this._activePollers.delete(sessionRemoteId);
            }
            // Clear cache
            this._processedActivitySets.delete(sessionRemoteId);
        } else {
            // Cleanup all
            this._pollerStates.forEach(state => state.active = false);
            this._activePollers.forEach(timer => clearTimeout(timer));
            this._pollerStates.clear();
            this._activePollers.clear();
            this._processedActivitySets.clear();
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
        const normalizedSlug = repoSlug.toLowerCase();
        // Optimization: Check cache first
        if (this._sourceNameCache.has(normalizedSlug)) {
            return this._sourceNameCache.get(normalizedSlug)!;
        }

        try {
            const res = await fetch(`${API_BASE}/sources`, {
                headers: { 'x-goog-api-key': this._apiKey! }
            });
            const data = await res.json() as any;
            if (data.error) throw new Error(data.error.message);

            const source = data.sources?.find((s: any) => {
                return s.githubRepo && `${s.githubRepo.owner}/${s.githubRepo.repo}`.toLowerCase() === normalizedSlug;
            });

            if (source) {
                this._sourceNameCache.set(normalizedSlug, source.name);
                return source.name;
            }
            return null;
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
        // Stop any existing poller for this session
        if (this._pollerStates.has(sessionName)) {
            this._pollerStates.get(sessionName)!.active = false;
        }
        if (this._activePollers.has(sessionName)) {
            clearTimeout(this._activePollers.get(sessionName));
        }

        // Initialize state for new poller
        const state = { active: true };
        this._pollerStates.set(sessionName, state);

        // Initialize processed set for this session if not exists
        if (!this._processedActivitySets.has(sessionName)) {
            this._processedActivitySets.set(sessionName, new Set(chatSession.processedActivityIds || []));
        }
        const processedSet = this._processedActivitySets.get(sessionName)!;

        let polls = 0;
        const maxPolls = 600; // ~10 minutes
        const maxDelay = 30000;
        let currentDelay = 1000;

        const poll = async () => {
            if (!state.active) return; // Stop if cancelled

            polls++;
            if (polls > maxPolls) {
                // Auto-cleanup on timeout
                this._pollerStates.delete(sessionName);
                this._activePollers.delete(sessionName);
                this._processedActivitySets.delete(sessionName); // Cleanup cache on timeout
                this._onOutput('⚠️ Polling timed out. Check dashboard for updates.', 'system', chatSession);
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/${sessionName}/activities?pageSize=50`, {
                    headers: { 'x-goog-api-key': this._apiKey! }
                });
                const data = await res.json() as any;

                if (!state.active) return; // Check again after await

                let hasNewActivity = false;
                const activities = data.activities || [];

                for (const act of activities) {
                    // Check if already processed using Set (O(1))
                    if (processedSet.has(act.name)) {
                        continue;
                    }

                    // Mark as seen immediately
                    processedSet.add(act.name);
                    chatSession.processedActivityIds!.push(act.name);
                    hasNewActivity = true;

                    // Skip user's own messages (we show them optimistically)
                    if (act.actor === 'user' || (act.message && act.message.author === 'user')) {
                        continue;
                    }

                    let text = '';
                    if (act.message) text = act.message.text || JSON.stringify(act.message);
                    else if (act.toolUse) text = `🛠️ Used Tool: ${act.toolUse.tool}`;
                    else if (act.type === 'PLAN_UPDATE') text = '📋 Plan updated';

                    // Fallback for unknown types but potentially useful info
                    if (!text && act.type) {
                        text = `[Activity: ${act.type}]`;
                    }

                    if (text) this._onOutput(text, 'jules', chatSession);
                }

                if (hasNewActivity) {
                    currentDelay = 1000;
                } else {
                    currentDelay = Math.min(currentDelay * 1.5, maxDelay);
                }

            } catch (e) {
                console.error('Polling error', e);
                // Retry with backoff even on error
                currentDelay = Math.min(currentDelay * 2, maxDelay);
            }

            // Schedule next poll
            if (state.active) {
                const timer = setTimeout(poll, currentDelay);
                this._activePollers.set(sessionName, timer);
            }
        };

        // Start polling
        const timer = setTimeout(poll, currentDelay);
        this._activePollers.set(sessionName, timer);
    }

    // --- Helpers (Duplicated from CliBackend/Extension - could be shared utils) ---
    private _getGitHubRepoSlug(cwd: string): Promise<string | null> {
        if (this._repoSlugCache.has(cwd)) return Promise.resolve(this._repoSlugCache.get(cwd)!);

        return new Promise(resolve => {
            cp.exec('git remote get-url origin', { cwd }, (err, stdout) => {
                const url = stdout.trim();
                if (url) {
                    const match = url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
                    if (match) {
                        this._repoSlugCache.set(cwd, match[1]);
                        resolve(match[1]);
                    }
                    else resolve(null);
                } else {
                    resolve(null);
                }
            });
        });

        this._sourceNameCache.set(cwd, slug);
        return slug;
    }
}
