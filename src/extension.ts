import * as vscode from 'vscode';
import * as cp from 'child_process';

type JulesAuthStatus = 'signed-in' | 'signed-out' | 'cli-missing' | 'unknown';

// --- Interfaces ---
interface ChatMessage {
    sender: 'user' | 'jules' | 'system';
    text: string;
    buttons?: { label: string, cmd: string }[];
}

interface ChatSession {
    id: string;
    title: string;
    timestamp: number;
    messages: ChatMessage[];
}

export function activate(context: vscode.ExtensionContext) {
    const provider = new JulesChatProvider(context.extensionUri, context);

    // 1. Register Chat View
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(JulesChatProvider.viewType, provider)
    );

    // 2. Register Commands
    const register = (cmd: string, handler: () => void) => {
        context.subscriptions.push(vscode.commands.registerCommand(cmd, handler));
    };

    register('jules.openChat', () => vscode.commands.executeCommand('jules.chatView.focus'));
    
    register('jules.checkStatus', async () => {
        await vscode.commands.executeCommand('jules.chatView.focus');
        provider.handleExternalCommand('status');
    });

    register('jules.gitOps', async () => {
        await vscode.commands.executeCommand('jules.chatView.focus');
        provider.handleExternalCommand('skill:git');
    });

    register('jules.generateCode', async () => {
        await vscode.commands.executeCommand('jules.chatView.focus');
        provider.handleExternalCommand('skill:codegen');
    });
}

class JulesChatProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'jules.chatView';
    private _view?: vscode.WebviewView;
    
    // MEMORY: Store multiple sessions
    private _sessions: ChatSession[] = [];
    private _activeSessionId: string | null = null;
    private _authStatus: JulesAuthStatus = 'unknown';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        const stored = this._context.globalState.get<JulesAuthStatus>('jules.authStatus');
        this._authStatus = stored ?? 'unknown';
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Initialize View State
        this._updateView();
        this._postAuthStatus();
        void this._refreshAuthStatus();

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'newSession':
                    this._createNewSession();
                    break;
                case 'switchSession':
                    this._activeSessionId = data.id;
                    this._updateView();
                    break;
                case 'backToList':
                    this._activeSessionId = null;
                    this._updateView();
                    break;
                case 'sendMessage':
                    await this._handleUserMessage(data.value);
                    break;
                case 'command':
                    if (data.value === 'status') await this._handleUserMessage('status');
                    else if (data.value === 'help') this._showHelp();
                    else if (data.value === 'login') await this._startLoginFlow();
                    else if (data.value === 'logout') await this._startLogoutFlow();
                    else if (data.value.startsWith('git:')) await this._handleGitCommand(data.value);
                    break;
                case 'skill':
                    await this._handleSkillAction(data.value);
                    break;
            }
        });
    }

    private _createNewSession() {
        const id = Date.now().toString();
        const newSession: ChatSession = {
            id,
            title: 'New Task',
            timestamp: Date.now(),
            messages: []
        };
        this._sessions.unshift(newSession); // Add to top
        this._activeSessionId = id;
        this._updateView();
        
        // Welcome message for new session
        this._checkWorkspaceConnection();
    }

    private _updateView() {
        if (!this._view) return;

        // Prepare data payload
        const payload = {
            type: 'stateUpdate',
            activeSessionId: this._activeSessionId,
            sessions: this._sessions.map(s => ({ 
                id: s.id, 
                title: s.title, 
                timestamp: s.timestamp,
                preview: s.messages.length > 0 ? s.messages[s.messages.length - 1].text.substring(0, 50) : 'Empty session'
            })),
            activeMessages: this._activeSessionId 
                ? this._sessions.find(s => s.id === this._activeSessionId)?.messages 
                : []
        };

        this._view.webview.postMessage(payload);
        this._postAuthStatus();
    }

    private _postAuthStatus() {
        this._view?.webview.postMessage({ type: 'setAuthStatus', value: this._authStatus });
    }

    private _setAuthStatus(status: JulesAuthStatus) {
        this._authStatus = status;
        void this._context.globalState.update('jules.authStatus', status);
        this._postAuthStatus();
    }

    private _setLoading(isLoading: boolean) {
        this._view?.webview.postMessage({ type: 'setLoading', value: isLoading });
    }

    private async _refreshAuthStatus() {
        const status = await this._checkJulesAuthStatus(this._getCwd());
        this._setAuthStatus(status);
    }

    private _checkJulesAuthStatus(cwd: string): Promise<JulesAuthStatus> {
        return new Promise((resolve) => {
            cp.exec('jules remote list --session', { cwd }, (err, stdout, stderr) => {
                const combined = `${stderr || ''}\n${err?.message || ''}\n${stdout || ''}`.toLowerCase();
                if (combined.includes('enoent') || combined.includes('not found')) {
                    resolve('cli-missing');
                    return;
                }
                if (combined.includes('not logged in') || combined.includes('login') || combined.includes('auth') || combined.includes('unauthorized')) {
                    resolve('signed-out');
                    return;
                }
                if (err) {
                    resolve('unknown');
                    return;
                }
                resolve('signed-in');
            });
        });
    }

    private _checkWorkspaceConnection() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this._addHistory('system', '⚠️ No workspace folder open. Jules is running in detached mode.');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const rootName = workspaceFolders[0].name;
        
        // Simple Git check
        cp.exec('git rev-parse --is-inside-work-tree', { cwd: rootPath }, (err) => {
            if (err) {
                this._addHistory('system', `📂 Connected to: **${rootName}**\n(Not a git repository yet. Click "Git Ops" to init.)`);
            } else {
                this._addHistory('system', `✅ Connected to Project: **${rootName}**\n(Git Repository Detected)`);
            }
        });
    }

    private _showHelp() {
        this._addHistory('jules', "Quick help:\n\n- Sign in: click **Sign In** or run `jules login`\n- Sign out: click **Sign Out** or run `jules logout`\n- Status: type `status`\n- Pull changes: `pull <session-id>`\n- Start a task: describe it in plain English\n- Git Ops: click Git Ops, then choose an action");
    }

    private async _startLoginFlow() {
        this._setLoading(true);
        const status = await this._checkJulesAuthStatus(this._getCwd());
        this._setLoading(false);
        this._setAuthStatus(status);

        if (status === 'cli-missing') {
            this._addHistory('jules', "❌ Jules CLI not found. Install it with `npm install -g @google/jules` and try again.");
            return;
        }
        if (status === 'signed-in') {
            this._addHistory('jules', "✅ You're already signed in.");
            return;
        }

        this._addHistory('jules', '🔐 Opening your browser to sign in...');
        this._setLoading(true);
        const child = this._spawnCli('jules', ['login'], this._getCwd());
        child.on('close', () => {
            this._setLoading(false);
            void this._refreshAuthStatus();
        });
    }

    private async _startLogoutFlow() {
        this._setLoading(true);
        const status = await this._checkJulesAuthStatus(this._getCwd());
        this._setLoading(false);
        this._setAuthStatus(status);

        if (status === 'cli-missing') {
            this._addHistory('jules', "❌ Jules CLI not found. Install it with `npm install -g @google/jules` and try again.");
            return;
        }
        if (status === 'signed-out') {
            this._addHistory('jules', "✅ You're already signed out.");
            return;
        }

        this._addHistory('jules', '🔓 Signing out...');
        this._setLoading(true);
        const child = this._spawnCli('jules', ['logout'], this._getCwd());
        child.on('close', () => {
            this._setLoading(false);
            this._setAuthStatus('signed-out');
        });
    }

    public handleExternalCommand(cmd: string) {
        // Force create session if none exists
        if (!this._activeSessionId) {
            this._createNewSession();
        }
        
        setTimeout(() => {
            if (cmd === 'status') this._handleUserMessage('status');
            else if (cmd.startsWith('skill:')) this._handleSkillAction(cmd.split(':')[1]);
        }, 500);
    }

    private async _handleGitCommand(cmd: string) {
        const action = cmd.split(':')[1];
        const cwd = this._getCwd();

        switch (action) {
            case 'init': this._runSpawn('git', ['init'], cwd, '📦 Initializing git...'); break;
            case 'pull': this._runSpawn('git', ['pull'], cwd, '⬇️ Pulling from remote...'); break;
            case 'push': this._runSpawn('git', ['push'], cwd, '⬆️ Pushing to remote...'); break;
            case 'status': this._runSpawn('git', ['status'], cwd, '📈 Checking status...'); break;
        }
    }

    private async _handleSkillAction(skill: string) {
        if (!this._view) return;

        if (skill === 'git') {
            this._addHistory('jules', "📂 **Git Operations**", [
                { label: '✨ Init Repo', cmd: 'git:init' },
                { label: '⬇️ Pull', cmd: 'git:pull' },
                { label: '⬆️ Push', cmd: 'git:push' },
                { label: '📈 Status', cmd: 'git:status' }
            ]);
            return;
        }

        const skillPrompts: { [key: string]: string } = {
            'performance': `You are "Bolt" ⚡, a performance-obsessed agent.\nMission: Implement ONE measurable performance improvement.\nProcess: profile baseline, identify the hot path, apply a targeted change, re-measure, and report the delta.\nBoundaries: keep scope tight, avoid premature optimization, run lint/tests.`,
            'design': `You are "Palette" 🎨, guardian of usability.\nMission: Deliver ONE micro-UX improvement users feel immediately.\nProcess: identify a friction point, improve clarity or flow, verify keyboard nav and ARIA.\nBoundaries: use existing design tokens; no full redesigns.`,
            'security': `You are "Sentinel" 🛡️, defender of the codebase.\nMission: Fix ONE real security issue or add ONE defense-in-depth improvement.\nProcess: identify risk, apply a minimal fix, add validation or safe defaults.\nPriorities: Critical > High > Medium.`,
            'test': `You are "Probe" 🧪, breaker of assumptions.\nMission: Add tests to catch real regressions.\nProcess: target failure paths and edge cases, assert expected behavior.\nBoundaries: do not refactor production code; keep tests focused.`,
            'debug': `You are "Tracer" 🧯, debugging specialist.\nMission: Find root cause and propose the minimal fix.\nProcess: reproduce, isolate, explain the cause, then patch.\nBoundaries: avoid broad refactors; keep changes surgical.`,
            'refactor': `You are "Refine" ♻️, refactoring agent.\nMission: Improve readability and structure with ZERO behavior change.\nProcess: clarify naming, reduce duplication, simplify control flow.\nBoundaries: no feature changes or performance work.`,
            'review': `You are "Lens" 👀, code review agent.\nMission: Flag logic errors, style violations, and security smells.\nProcess: scan diffs, call out risks, and suggest fixes.\nBoundaries: do not approve your own code.`
        };

        if (skill === 'codegen') {
            this._view.webview.postMessage({ type: 'setInput', value: 'You are "Forge" 🧑‍💻. Generate code for: ' });
        } else if (skillPrompts[skill]) {
            await this._handleUserMessage(skillPrompts[skill]);
        }
    }

    private async _handleUserMessage(message: string) {
        // Auto-create session if needed
        if (!this._activeSessionId) {
            this._createNewSession();
            // Wait a tick for session to establish
            await new Promise(r => setTimeout(r, 50));
        }

        this._addHistory('user', message);

        const lower = message.toLowerCase().trim();
        const greetings = ['hi', 'hello', 'hey', 'menu'];

        if (lower === 'help' || lower.startsWith('help ') || lower === '?') {
            this._showHelp();
            return;
        }

        if (lower === 'login' || lower === 'sign in' || lower === 'signin') {
            await this._startLoginFlow();
            return;
        }

        if (lower === 'logout' || lower === 'sign out' || lower === 'signout') {
            await this._startLogoutFlow();
            return;
        }

        if (greetings.some(g => lower === g)) {
            this._addHistory('jules', "👋 **Hi! I'm Jules.**\nI'm connected to your local CLI. What shall we do?", [
                { label: '📊 Status', cmd: 'status' },
                { label: '📂 Git Ops', cmd: 'skill:git' },
                { label: '✨ Code Gen', cmd: 'skill:codegen' }
            ]);
            return;
        }

        const cwd = this._getCwd();

        if (lower === 'status') {
            this._runSpawn('jules', ['remote', 'list', '--session'], cwd, '🔍 Checking sessions...');
        } else if (lower.startsWith('pull ')) {
            const id = lower.split(' ')[1];
            this._runSpawn('jules', ['remote', 'pull', '--session', id], cwd, `⬇️ Pulling session ${id}...`);
        } else {
            // Smart Check: Ensure we are in a git repo before starting a task
            const isGit = await this._isGitRepo(cwd);
            if (!isGit) {
                this._addHistory('jules', this._getRepoHelpMessage('missing-git'));
                return;
            }

            const repoSlug = await this._getGitHubRepoSlug(cwd);
            if (!repoSlug) {
                this._addHistory('jules', this._getRepoHelpMessage('missing-remote'));
                return;
            }

            // Task Execution
            this._runSpawn('jules', ['remote', 'new', '--repo', repoSlug, '--session', message], cwd, '🚀 Dispatching Agent...');
        }
    }

    // --- CORE LOGIC: SPAWN (Streaming) ---
    private _runSpawn(command: string, args: string[], cwd: string, intro: string) {
        this._addHistory('jules', intro);
        this._setLoading(true);

        // FIX: Use shell: false to prevent multiline prompts from being interpreted as shell commands.
        // This fixes the "/bin/sh: line 1: Mission:: command not found" error.
        const child = this._spawnCli(command, args, cwd);
        let repoHelpShown = false;

        child.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) this._appendStreamOutput(output);
        });

        child.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (!output) return;
            this._appendStreamOutput(`Checking: ${output}`);
            if (!repoHelpShown && command === 'jules' && this._looksLikeRepoMissing(output)) {
                repoHelpShown = true;
                this._addHistory('jules', this._getRepoHelpMessage('missing-remote'));
            }
        });

        child.on('error', (err) => {
            this._setLoading(false);
            this._addHistory('system', `❌ Execution Error: ${err.message}`);
        });

        child.on('close', (code) => {
            this._setLoading(false);
            if (code !== 0) {
                this._appendStreamOutput(`\n[Process exited with code ${code}]`);
            }
            if (command === 'jules') {
                void this._refreshAuthStatus();
            }
        });
    }

    private _getCwd(): string {
        return vscode.workspace.workspaceFolders?.[0].uri.fsPath || '.';
    }

    private _isGitRepo(cwd: string): Promise<boolean> {
        return new Promise(resolve => {
            cp.exec('git rev-parse --is-inside-work-tree', { cwd }, (err) => resolve(!err));
        });
    }

    private _spawnCli(command: string, args: string[], cwd: string) {
        const isWin = process.platform === 'win32';
        return cp.spawn(isWin ? `${command}.cmd` : command, args, { cwd, shell: false });
    }

    private _getGitRemoteUrl(cwd: string): Promise<string | null> {
        return new Promise(resolve => {
            cp.exec('git remote get-url origin', { cwd }, (err, stdout) => {
                const originUrl = stdout.trim();
                if (!err && originUrl) {
                    resolve(originUrl);
                    return;
                }

                cp.exec('git remote', { cwd }, (remoteErr, remoteStdout) => {
                    if (remoteErr) {
                        resolve(null);
                        return;
                    }
                    const remotes = remoteStdout
                        .split(/\r?\n/)
                        .map(r => r.trim())
                        .filter(Boolean);
                    if (remotes.length === 0) {
                        resolve(null);
                        return;
                    }
                    cp.exec(`git remote get-url ${remotes[0]}`, { cwd }, (urlErr, urlStdout) => {
                        const url = urlStdout.trim();
                        resolve(!urlErr && url ? url : null);
                    });
                });
            });
        });
    }

    private _getGitHubRepoSlug(cwd: string): Promise<string | null> {
        return this._getGitRemoteUrl(cwd).then((remoteUrl) => {
            if (!remoteUrl) return null;
            return this._extractGitHubRepoSlug(remoteUrl);
        });
    }

    private _extractGitHubRepoSlug(remoteUrl: string): string | null {
        const url = remoteUrl.trim();
        const patterns = [
            /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i,
            /^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i,
            /^ssh:\/\/git@github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    private _looksLikeRepoMissing(output: string): boolean {
        const text = output.toLowerCase();
        return text.includes('repo unknown/unknown')
            || (text.includes('not connected') && text.includes('jules'))
            || text.includes('doesn\'t exist on github')
            || text.includes('does not exist on github');
    }

    private _getRepoHelpMessage(context: 'missing-git' | 'missing-remote'): string {
        const header = context === 'missing-git'
            ? '⚠️ Git Missing: This folder is not a git repository.'
            : '⚠️ Repo Not Connected: Jules could not determine a GitHub repo for this folder.';

        const steps = context === 'missing-git'
            ? [
                'Initialize git in this folder:',
                'git init',
                'Add a GitHub remote:',
                'git remote add origin https://github.com/<owner>/<repo>.git'
            ]
            : [
                'Make sure your repo has a GitHub remote:',
                'git remote -v',
                'git remote add origin https://github.com/<owner>/<repo>.git'
            ];

        const reference = [
            '',
            'Jules Tools Reference',
            'Install: npm install -g @google/jules',
            'Login: jules login',
            'Logout: jules logout',
            'List repos: jules remote list --repo',
            'List sessions: jules remote list --session',
            'New session: jules remote new --repo owner/repo --session "your task"',
            'Pull results: jules remote pull --session <id>',
            'Docs: https://jules.google/docs'
        ];

        return [
            header,
            '',
            ...steps,
            '',
            'Then retry your request.',
            ...reference
        ].join('\n');
    }

    // --- HELPER: History Management ---
    private _addHistory(sender: 'user' | 'jules' | 'system', text: string, buttons?: { label: string, cmd: string }[]) {
        if (!this._activeSessionId) return;

        const session = this._sessions.find(s => s.id === this._activeSessionId);
        if (session) {
            // Auto-rename session on first user message
            if (sender === 'user' && session.title === 'New Task') {
                session.title = text.length > 25 ? text.substring(0, 25) + '...' : text;
                // Force view update to show new title in list
                this._updateView();
            }

            const msg: ChatMessage = { sender, text, buttons };
            session.messages.push(msg);
            
            // Send to UI immediately if active
            this._view?.webview.postMessage({ type: 'addMessage', message: msg, sessionId: this._activeSessionId });
        }
    }

    private _appendStreamOutput(text: string) {
        if (!this._activeSessionId) return;

        const session = this._sessions.find(s => s.id === this._activeSessionId);
        if (!session) return;

        const last = session.messages[session.messages.length - 1];
        if (last && last.sender === 'jules') {
            last.text += `\n${text}`;
            this._view?.webview.postMessage({ type: 'updateLastMessage', text: last.text, sessionId: this._activeSessionId });
        } else {
            this._addHistory('jules', text);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                :root {
                    --bg: var(--vscode-editor-background);
                    --text: var(--vscode-editor-foreground);
                    --user-bg: var(--vscode-button-background);
                    --user-text: var(--vscode-button-foreground);
                    --jules-bg: var(--vscode-editor-inactiveSelectionBackground);
                    --input-bg: var(--vscode-input-background);
                    --border: var(--vscode-widget-border);
                }
                body { font-family: var(--vscode-font-family); padding: 0; margin: 0; background: var(--bg); color: var(--text); display: flex; flex-direction: column; height: 100vh; }
                
                /* VIEWS */
                .view { display: none; flex-direction: column; height: 100%; }
                .view.active { display: flex; }

                /* SESSION LIST */
                #session-list-view { padding: 10px; }
                .session-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
                .session-header h2 { margin: 0; font-size: 14px; text-transform: uppercase; color: var(--vscode-descriptionForeground); }
                .btn-new { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
                
                .session-item { padding: 10px; border: 1px solid var(--border); margin-bottom: 8px; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
                .session-item:hover { background: var(--vscode-list-hoverBackground); }
                .session-title { font-weight: bold; font-size: 13px; display: block; margin-bottom: 4px; }
                .session-preview { font-size: 11px; color: var(--vscode-descriptionForeground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                /* CHAT VIEW */
                .chat-header { padding: 10px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; background: var(--bg); }
                .btn-back { background: transparent; border: none; color: var(--vscode-textLink-foreground); cursor: pointer; font-size: 16px; font-weight: bold; }
                #active-session-title { font-weight: 600; font-size: 13px; }

                .chat-container { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 12px; }
                
                .message { padding: 10px 14px; border-radius: 8px; max-width: 90%; word-wrap: break-word; line-height: 1.5; font-size: 13px; }
                .user { align-self: flex-end; background: var(--user-bg); color: var(--user-text); }
                .jules { align-self: flex-start; background: var(--jules-bg); border: 1px solid var(--border); white-space: pre-wrap; font-family: monospace; }
                .system { align-self: center; font-style: italic; color: var(--vscode-descriptionForeground); font-size: 12px; text-align: center; margin: 10px 0; }

                .msg-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
                .msg-btn { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; }

                .skills-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; padding: 10px; border-bottom: 1px solid var(--border); }
                .skill-card { background: var(--jules-bg); padding: 6px; border-radius: 4px; cursor: pointer; text-align: center; font-size: 11px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
                .skill-card:hover { background: var(--vscode-list-hoverBackground); }
                .skill-icon { font-size: 16px; margin-bottom: 2px; }

                .controls { padding: 10px; border-top: 1px solid var(--border); }
                .quick-actions { display: flex; gap: 8px; margin-bottom: 8px; justify-content: flex-end; flex-wrap: wrap; }
                .chip { font-size: 11px; color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: none; }
                .chip:hover { text-decoration: underline; }
                .auth-chip { display: inline-flex; align-items: center; gap: 6px; }
                .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--vscode-descriptionForeground); opacity: 0.8; }
                .auth-chip.connected .status-dot { background: var(--vscode-terminal-ansiGreen, #2da44e); opacity: 1; }
                .auth-chip.missing .status-dot { background: var(--vscode-terminal-ansiRed, #d73a49); opacity: 1; }
                .auth-chip.unknown .status-dot { background: var(--vscode-terminal-ansiYellow, #f7b731); opacity: 1; }
                #input-box { width: 100%; padding: 10px; background: var(--input-bg); border: 1px solid var(--vscode-input-border); color: var(--text); outline: none; border-radius: 2px; }
                
                .loader { display: none; margin: 0 auto 10px; font-size: 11px; color: var(--vscode-descriptionForeground); }
                .loader.active { display: block; }
            </style>
        </head>
        <body>
            
            <!-- SESSION LIST VIEW -->
            <div id="session-list-view" class="view active">
                <div class="session-header">
                    <h2>My Tasks</h2>
                    <button class="btn-new" onclick="createNewSession()">+ New Task</button>
                </div>
                <div id="session-list">
                    <!-- Session items injected here -->
                </div>
            </div>

            <!-- CHAT VIEW -->
            <div id="chat-view" class="view">
                <div class="chat-header">
                    <button class="btn-back" onclick="backToList()">‹</button>
                    <span id="active-session-title">New Task</span>
                </div>
                
                <div class="skills-grid">
                    <div class="skill-card" onclick="sendSkill('codegen')"><span class="skill-icon">✨</span>Forge</div>
                    <div class="skill-card" onclick="sendSkill('performance')"><span class="skill-icon">⚡</span>Bolt</div>
                    <div class="skill-card" onclick="sendSkill('design')"><span class="skill-icon">🎨</span>Palette</div>
                    <div class="skill-card" onclick="sendSkill('security')"><span class="skill-icon">🛡️</span>Sentinel</div>
                    <div class="skill-card" onclick="sendSkill('test')"><span class="skill-icon">🧪</span>Probe</div>
                    <div class="skill-card" onclick="sendSkill('debug')"><span class="skill-icon">🧯</span>Tracer</div>
                    <div class="skill-card" onclick="sendSkill('refactor')"><span class="skill-icon">♻️</span>Refine</div>
                    <div class="skill-card" onclick="sendSkill('review')"><span class="skill-icon">👀</span>Lens</div>
                    <div class="skill-card" onclick="sendSkill('git')"><span class="skill-icon">📂</span>Git Ops</div>
                </div>

                <div class="chat-container" id="chat"></div>
                <div class="loader" id="loader">⚡ Jules is working...</div>

                <div class="controls">
                    <div class="quick-actions">
                        <div class="chip" onclick="sendCmd('status')">Status</div>
                        <div class="chip auth-chip" id="auth-chip" onclick="sendCmd('login')">
                            <span class="status-dot"></span>
                            <span id="auth-label">Sign In</span>
                        </div>
                        <div class="chip" id="signout-chip" onclick="sendCmd('logout')" style="display: none;">Sign Out</div>
                        <div class="chip" onclick="sendCmd('help')">Help</div>
                    </div>
                    <input type="text" id="input-box" placeholder="Ask Jules..." />
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const sessionListEl = document.getElementById('session-list');
                const sessionView = document.getElementById('session-list-view');
                const chatView = document.getElementById('chat-view');
                const chatContainer = document.getElementById('chat');
                const sessionTitleEl = document.getElementById('active-session-title');
                const inp = document.getElementById('input-box');
                const loader = document.getElementById('loader');
                const authChip = document.getElementById('auth-chip');
                const authLabel = document.getElementById('auth-label');
                const signOutChip = document.getElementById('signout-chip');

                let currentSessionId = null;

                // --- NAVIGATION ---
                function createNewSession() {
                    vscode.postMessage({ type: 'newSession' });
                }

                function switchSession(id) {
                    vscode.postMessage({ type: 'switchSession', id: id });
                }

                function backToList() {
                    vscode.postMessage({ type: 'backToList' });
                }

                function renderSessionList(sessions) {
                    sessionListEl.innerHTML = '';
                    if (sessions.length === 0) {
                        sessionListEl.innerHTML = '<div style="text-align:center; margin-top:20px; color:var(--vscode-descriptionForeground)">No active tasks.<br>Click "+ New Task" to start.</div>';
                        return;
                    }
                    
                    sessions.forEach(s => {
                        const div = document.createElement('div');
                        div.className = 'session-item';
                        div.onclick = () => switchSession(s.id);
                        div.innerHTML = \`
                            <span class="session-title">\${escapeHtml(s.title)}</span>
                            <div class="session-preview">\${escapeHtml(s.preview)}</div>
                        \`;
                        sessionListEl.appendChild(div);
                    });
                }

                function showView(viewName) {
                    if (viewName === 'list') {
                        sessionView.classList.add('active');
                        chatView.classList.remove('active');
                    } else {
                        sessionView.classList.remove('active');
                        chatView.classList.add('active');
                    }
                }

                // --- CHAT RENDERING ---
                function renderChat(messages) {
                    chatContainer.innerHTML = '';
                    messages.forEach(addMessageToDom);
                }

                function addMessageToDom(msg) {
                    const div = document.createElement('div');
                    div.className = 'message ' + msg.sender;
                    div.innerText = msg.text;
                    
                    if (msg.buttons) {
                        const btns = document.createElement('div');
                        btns.className = 'msg-buttons';
                        msg.buttons.forEach(b => {
                            const btn = document.createElement('button');
                            btn.className = 'msg-btn';
                            btn.innerText = b.label;
                            btn.onclick = () => {
                                if(b.cmd.startsWith('skill:')) sendSkill(b.cmd.split(':')[1]);
                                else sendCmd(b.cmd);
                            };
                            btns.appendChild(btn);
                        });
                        div.appendChild(btns);
                    }
                    chatContainer.appendChild(div);
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }

                // --- INPUT HANDLING ---
                inp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && inp.value) {
                        vscode.postMessage({ type: 'sendMessage', value: inp.value });
                        inp.value = '';
                    }
                });

                function sendSkill(skill) { vscode.postMessage({ type: 'skill', value: skill }); }
                function sendCmd(cmd) { vscode.postMessage({ type: 'command', value: cmd }); }
                function escapeHtml(text) { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

                // --- EVENT LISTENER ---
                window.addEventListener('message', event => {
                    const { type, activeSessionId, sessions, activeMessages, message, text, value, sessionId } = event.data;

                    if (type === 'stateUpdate') {
                        currentSessionId = activeSessionId;
                        renderSessionList(sessions);
                        
                        if (activeSessionId) {
                            showView('chat');
                            renderChat(activeMessages);
                            // Update title
                            const active = sessions.find(s => s.id === activeSessionId);
                            if (active) sessionTitleEl.innerText = active.title;
                        } else {
                            showView('list');
                        }
                    }
                    else if (type === 'addMessage') {
                        // Only append if it belongs to current view
                        if (sessionId === currentSessionId) {
                            addMessageToDom(message);
                        }
                    }
                    else if (type === 'updateLastMessage') {
                         if (sessionId === currentSessionId) {
                            const lastMsg = chatContainer.lastElementChild;
                            if (lastMsg) {
                                lastMsg.innerText = text;
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                            }
                         }
                    }
                    else if (type === 'setLoading') {
                        loader.classList.toggle('active', value);
                    }
                    else if (type === 'setAuthStatus') {
                        if (!authChip || !authLabel || !signOutChip) return;
                        const status = value || 'unknown';
                        authChip.classList.remove('connected', 'missing', 'unknown', 'signed-out');
                        if (status === 'signed-in') {
                            authChip.classList.add('connected');
                            authLabel.textContent = 'Connected';
                            signOutChip.style.display = 'inline-flex';
                        } else if (status === 'cli-missing') {
                            authChip.classList.add('missing');
                            authLabel.textContent = 'Install CLI';
                            signOutChip.style.display = 'none';
                        } else if (status === 'unknown') {
                            authChip.classList.add('unknown');
                            authLabel.textContent = 'Checking...';
                            signOutChip.style.display = 'none';
                        } else {
                            authChip.classList.add('signed-out');
                            authLabel.textContent = 'Sign In';
                            signOutChip.style.display = 'none';
                        }
                    }
                    else if (type === 'setInput') {
                        inp.value = value;
                        inp.focus();
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
