import * as vscode from 'vscode';
import { CliBackend } from './backend/cliBackend';
import { ApiBackend } from './backend/apiBackend';
import { JulesBackend, JulesAuthStatus, ChatSession, ChatMessage } from './backend/types';
import { CLI_COMMANDS } from './commandData';

// Cache the stringified commands to avoid re-serialization on every view render
let _cachedCmdList: string | undefined;

export function activate(context: vscode.ExtensionContext) {
    const provider = new JulesChatProvider(context.extensionUri, context);

    // 1. Register Chat View
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(JulesChatProvider.viewType, provider)
    );

    // Ensure cleanup on deactivation
    context.subscriptions.push({ dispose: () => provider.cleanup() });

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

    // API Key Management Commands
    register('jules.setApiKey', async () => {
        await provider.switchBackend('api');
        await provider.login();
    });

    register('jules.clearApiKey', async () => {
        await provider.switchBackend('api');
        await provider.logout();
    });
}

class JulesChatProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'jules.chatView';
    private _view?: vscode.WebviewView;
    private _backend: JulesBackend;
    
    private _sessions: ChatSession[] = [];
    private _activeSessionId: string | null = null;
    private _authStatus: JulesAuthStatus = 'unknown';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        this._backend = this._createBackend();

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('jules.mode')) {
                this._backend = this._createBackend();
                this._refreshAuthStatus();
                this._updateView(); // Re-render to show/hide CLI tools
            }
        });
    }

    private _createBackend(): JulesBackend {
        const mode = vscode.workspace.getConfiguration('jules').get<string>('mode');
        const outputHandler = (text: string, sender: 'jules' | 'system', session: ChatSession) => {
            this._appendMessageToSession(session.id, sender, text);
        };
        const statusHandler = (status: JulesAuthStatus) => {
            this._setAuthStatus(status);
        };

        if (mode === 'api') {
            return new ApiBackend(this._context, outputHandler, statusHandler);
        } else {
            return new CliBackend(outputHandler, statusHandler);
        }
    }

    public async switchBackend(mode: 'cli' | 'api') {
        await vscode.workspace.getConfiguration('jules').update('mode', mode, vscode.ConfigurationTarget.Global);
    }

    public cleanup() {
        if (this._backend.cleanup) {
            this._backend.cleanup();
        }
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

        this._updateView();
        this._postAuthStatus();
        void this._refreshAuthStatus();

        webviewView.webview.onDidReceiveMessage(async (data: any) => {
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
                    await this._handleCommand(data.value);
                    break;
                case 'skill':
                    await this._handleSkillAction(data.value);
                    break;
            }
        });
    }

    // --- Command Handling ---
    private async _handleCommand(cmd: string) {
        // If it looks like a VSCode command (e.g. jules.setApiKey), execute it.
        if (cmd.startsWith('jules.') && cmd !== 'jules login' && cmd !== 'jules logout') {
             await vscode.commands.executeCommand(cmd);
             return;
        }

        const cwd = this._getCwd();

        switch (cmd) {
            case 'login': await this.login(); break;
            case 'logout': await this.logout(); break;
            case 'status': await this._handleUserMessage('status'); break;
            case 'help': this._showHelp(); break;
            case 'version':
                if (this._isCliMode()) await this._runCliCommand('version');
                else this._addHistory('system', 'Version check not available in API mode.');
                break;
            case 'remote-list-session':
                // Shared logic if possible, or force text command
                await this._handleUserMessage('status');
                break;
            case 'remote-list-repo':
                if (this._isCliMode()) await this._runCliCommand('remote', ['list', '--repo']);
                else this._addHistory('system', 'Repo listing not available in API mode.');
                break;
            case 'remote-pull':
                this._view?.webview.postMessage({ type: 'setInput', value: 'pull <session-id>' });
                break;
            default:
                if (cmd.startsWith('git:')) await this._handleGitCommand(cmd);
                break;
        }
    }

    private _isCliMode(): boolean {
        return vscode.workspace.getConfiguration('jules').get<string>('mode') !== 'api';
    }

    private async _runCliCommand(command: string, args: string[] = []) {
        // Quick helper to run a one-off CLI command and dump to chat
        // This is a bit of a hack, strictly we should go through backend, but backend is interface-bound.
        // We'll trust the backend implementation for now or just cast it if we know it's CLI.
        // But cleaner is to use the `sendMessage` flow which CliBackend interprets.

        // Actually, CliBackend interprets "status" as "remote list --session".
        // Let's just spawn directly for these "Toolbox" commands if we are in CLI mode.
        // Or better, add a method to backend? No, let's keep it simple.

        const cp = require('child_process');
        const cmdString = `jules ${command} ${args.join(' ')}`;
        this._addHistory('user', `Executing: ${cmdString}`);
        this._setLoading(true);

        cp.exec(cmdString, { cwd: this._getCwd() }, (err: any, stdout: string, stderr: string) => {
            this._setLoading(false);
            const output = (stdout + stderr).trim();
            this._addHistory('jules', output || 'Done.');
        });
    }

    public async login() {
        this._setLoading(true);
        await this._backend.login(this._getCwd());
        this._setLoading(false);
    }

    public async logout() {
        this._setLoading(true);
        await this._backend.logout(this._getCwd());
        this._setLoading(false);
    }

    private _createNewSession() {
        const id = Date.now().toString();
        const newSession: ChatSession = {
            id,
            title: 'New Task',
            timestamp: Date.now(),
            messages: []
        };
        this._sessions.unshift(newSession);
        this._activeSessionId = id;
        this._updateView();
    }

    private _updateView() {
        if (!this._view) return;

        const mode = vscode.workspace.getConfiguration('jules').get<string>('mode');

        const payload = {
            type: 'stateUpdate',
            mode,
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
        this._postAuthStatus();
    }

    private _setLoading(isLoading: boolean) {
        this._view?.webview.postMessage({ type: 'setLoading', value: isLoading });
    }

    private async _refreshAuthStatus() {
        const status = await this._backend.checkAuth(this._getCwd());
        this._setAuthStatus(status);
    }

    private _showHelp() {
        this._addHistory('jules', "Quick help:\n\n- Sign in: click **Sign In** or run `jules login`\n- Sign out: click **Sign Out** or run `jules logout`\n- Status: type `status`\n- Pull changes: `pull <session-id>`\n- Start a task: describe it in plain English\n- Git Ops: click Git Ops, then choose an action");
    }

    public handleExternalCommand(cmd: string) {
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
        // Simple visual confirmation
        this._addHistory('user', `Git Action: ${action}`);

        // In a real implementation, we would call git here.
        // Reusing existing simple spawn logic from previous version implicitly via CliBackend logic
        // or just simple exec.
        const cp = require('child_process');
        cp.exec(`git ${action}`, { cwd: this._getCwd() }, (err: any, stdout: string, stderr: string) => {
             this._addHistory('jules', (stdout + stderr).trim() || 'Done.');
        });
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
            'performance': `You are "Bolt" ⚡, a performance-obsessed agent.\nMission: Implement ONE measurable performance improvement.`,
            'design': `You are "Palette" 🎨, guardian of usability.\nMission: Deliver ONE micro-UX improvement users feel immediately.`,
            'security': `You are "Sentinel" 🛡️, defender of the codebase.\nMission: Fix ONE real security issue or add ONE defense-in-depth improvement.`,
            'test': `You are "Probe" 🧪, breaker of assumptions.\nMission: Add tests to catch real regressions.`,
            'debug': `You are "Tracer" 🧯, debugging specialist.\nMission: Find root cause and propose the minimal fix.`,
            'refactor': `You are "Refine" ♻️, refactoring agent.\nMission: Improve readability and structure with ZERO behavior change.`,
            'review': `You are "Lens" 👀, code review agent.\nMission: Flag logic errors, style violations, and security smells.`
        };

        if (skill === 'codegen') {
            this._view.webview.postMessage({ type: 'setInput', value: 'You are "Forge" 🧑‍💻. Generate code for: ' });
        } else if (skillPrompts[skill]) {
            await this._handleUserMessage(skillPrompts[skill]);
        }
    }

    private async _handleUserMessage(message: string) {
        if (!this._activeSessionId) {
            this._createNewSession();
            await new Promise(r => setTimeout(r, 50));
        }

        this._addHistory('user', message);

        // ... (Greetings logic could go here)

        this._setLoading(true);
        const session = this._sessions.find(s => s.id === this._activeSessionId)!;
        await this._backend.sendMessage(session, message, this._getCwd());
        this._setLoading(false);
    }

    private _getCwd(): string {
        return vscode.workspace.workspaceFolders?.[0].uri.fsPath || '.';
    }

    private _addHistory(sender: 'user' | 'jules' | 'system', text: string, buttons?: { label: string, cmd: string }[]) {
        if (!this._activeSessionId) return;
        this._appendMessageToSession(this._activeSessionId, sender, text, buttons);
    }

    private _appendMessageToSession(sessionId: string, sender: 'user' | 'jules' | 'system', text: string, buttons?: { label: string, cmd: string }[]) {
        const session = this._sessions.find(s => s.id === sessionId);
        if (session) {
            if (sender === 'user' && session.title === 'New Task') {
                session.title = text.length > 25 ? text.substring(0, 25) + '...' : text;
                this._updateView();
            }

            const last = session.messages[session.messages.length - 1];
            if (sender === 'jules' && last && last.sender === 'jules') {
                last.text += `\n${text}`;
                this._view?.webview.postMessage({ type: 'updateLastMessage', text: last.text, sessionId });
            } else {
                const msg: ChatMessage = { sender, text, buttons };
                session.messages.push(msg);
                this._view?.webview.postMessage({ type: 'addMessage', message: msg, sessionId });
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        if (!_cachedCmdList) {
            _cachedCmdList = JSON.stringify(CLI_COMMANDS);
        }
        const cmdList = _cachedCmdList;
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

                /* TABS */
                .tab-bar { display: flex; border-bottom: 1px solid var(--border); background: var(--jules-bg); }
                .tab { flex: 1; padding: 10px; text-align: center; cursor: pointer; border-bottom: 2px solid transparent; font-size: 12px; font-weight: 600; opacity: 0.7; }
                .tab.active { border-bottom-color: var(--user-bg); opacity: 1; }
                .tab:hover { opacity: 1; }

                /* COMMANDS LIST VIEW */
                #commands-view { padding: 10px; overflow-y: auto; }
                .cmd-card { background: var(--jules-bg); border-radius: 6px; padding: 10px; margin-bottom: 8px; border: 1px solid var(--border); }
                .cmd-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
                .cmd-name { font-family: monospace; font-weight: bold; color: var(--vscode-textLink-foreground); }
                .cmd-desc { font-size: 12px; color: var(--text); margin-bottom: 6px; }
                .cmd-usage { font-family: monospace; font-size: 10px; background: var(--input-bg); padding: 4px; border-radius: 4px; color: var(--vscode-descriptionForeground); word-break: break-all; }
                .cmd-actions { display: flex; gap: 8px; margin-top: 8px; }
                .cmd-btn { padding: 2px 8px; font-size: 11px; cursor: pointer; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 2px; }
                /* CLI COMMAND CENTER */
                .cli-toolbox { background: var(--jules-bg); padding: 8px; border-bottom: 1px solid var(--border); display: none; }
                .cli-toolbox.visible { display: block; }
                .cli-toolbox h3 { margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: var(--vscode-descriptionForeground); }

                .toolbox-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
                .tool-btn {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: 1px solid var(--border);
                    padding: 4px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                    text-align: center;
                }
                .tool-btn:hover { background: var(--vscode-list-hoverBackground); }
                .tool-section { margin-bottom: 8px; }
                .tool-section:last-child { margin-bottom: 0; }

                /* SESSION LIST */
                #session-list-view { padding: 10px; overflow-y: auto; }
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
            <!-- TAB BAR (Only shown when not in chat) -->
            <div id="tab-bar" class="tab-bar">
                <div class="tab active" onclick="switchTab('sessions')">TASKS</div>
                <div id="tab-commands" class="tab" onclick="switchTab('commands')">CLI COMMANDS</div>
            </div>
            
            <!-- SESSION LIST VIEW -->
            <div id="session-list-view" class="view active">

                <!-- CLI COMMAND CENTER -->
                <div id="cli-toolbox" class="cli-toolbox">
                    <details open>
                    <summary><strong>Jules CLI Tools</strong></summary>
                    <div style="margin-top: 8px;">
                        <div class="tool-section">
                            <h3>Session Management</h3>
                            <div class="toolbox-grid">
                                <div class="tool-btn" onclick="sendCmd('remote-list-session')">List Sessions</div>
                                <div class="tool-btn" onclick="createNewSession()">New Session</div>
                                <div class="tool-btn" onclick="sendCmd('remote-pull')">Pull Session</div>
                                <div class="tool-btn" onclick="sendCmd('remote-list-repo')">List Repos</div>
                            </div>
                        </div>
                        <div class="tool-section">
                            <h3>Authentication</h3>
                            <div class="toolbox-grid">
                                <div class="tool-btn" onclick="sendCmd('login')">Login</div>
                                <div class="tool-btn" onclick="sendCmd('logout')">Logout</div>
                            </div>
                        </div>
                         <div class="tool-section">
                            <h3>System</h3>
                            <div class="toolbox-grid">
                                <div class="tool-btn" onclick="sendCmd('version')">Check Version</div>
                                <div class="tool-btn" onclick="sendCmd('help')">Show Help</div>
                            </div>
                        </div>
                    </div>
                    </details>
                </div>

                <div class="session-header">
                    <h2>My Tasks</h2>
                    <button class="btn-new" onclick="createNewSession()">+ New Task</button>
                </div>
                <div id="session-list"></div>
            </div>

            <!-- COMMANDS VIEW -->
            <div id="commands-view" class="view">
                <!-- Commands injected here -->
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
                const commandsView = document.getElementById('commands-view');
                const tabBar = document.getElementById('tab-bar');
                const chatContainer = document.getElementById('chat');
                const sessionTitleEl = document.getElementById('active-session-title');
                const inp = document.getElementById('input-box');
                const loader = document.getElementById('loader');
                const authChip = document.getElementById('auth-chip');
                const authLabel = document.getElementById('auth-label');
                const signOutChip = document.getElementById('signout-chip');
                const cliToolbox = document.getElementById('cli-toolbox');

                const commands = ${cmdList};
                let currentSessionId = null;

                // --- INITIALIZATION ---
                renderCommands();

                // --- NAVIGATION ---
                function switchTab(tab) {
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.querySelector(\`.tab[onclick="switchTab('\${tab}')"]\`).classList.add('active');

                    if (tab === 'sessions') {
                        sessionView.classList.add('active');
                        commandsView.classList.remove('active');
                    } else {
                        sessionView.classList.remove('active');
                        commandsView.classList.add('active');
                    }
                }

                function renderCommands() {
                    commandsView.innerHTML = '';
                    commands.forEach(c => {
                        const div = document.createElement('div');
                        div.className = 'cmd-card';
                        let actionHtml = '';
                        if (c.actionId) {
                            actionHtml += \`<button class="cmd-btn" onclick="sendCmd('\${c.actionId}')">Run</button>\`;
                        }
                        actionHtml += \`<button class="cmd-btn" onclick="copyToClipboard('\${c.usage || c.command}')">Copy</button>\`;

                        div.innerHTML = \`
                            <div class="cmd-header">
                                <span class="cmd-name">\${c.command}</span>
                                <div class="cmd-actions">\${actionHtml}</div>
                            </div>
                            <div class="cmd-desc">\${c.description}</div>
                            \${c.usage ? \`<div class="cmd-usage">\${c.usage}</div>\` : ''}
                        \`;
                        commandsView.appendChild(div);
                    });
                }

                function copyToClipboard(text) {
                    // Creating a dummy input to copy text - standard way in webview if navigator.clipboard is restricted
                    const el = document.createElement('textarea');
                    el.value = text;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand('copy');
                    document.body.removeChild(el);
                    vscode.postMessage({ type: 'command', value: 'notify:Copied to clipboard' });
                }

                function createNewSession() {
                    vscode.postMessage({ type: 'newSession' });
                }

                function switchSession(id) {
                    vscode.postMessage({ type: 'switchSession', id: id });
                }

                function backToList() {
                    vscode.postMessage({ type: 'backToList' });
                }
                function createNewSession() { vscode.postMessage({ type: 'newSession' }); }
                function switchSession(id) { vscode.postMessage({ type: 'switchSession', id: id }); }
                function backToList() { vscode.postMessage({ type: 'backToList' }); }

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
                        div.innerHTML = \`<span class="session-title">\${escapeHtml(s.title)}</span><div class="session-preview">\${escapeHtml(s.preview)}</div>\`;
                        sessionListEl.appendChild(div);
                    });
                }

                function showView(viewName) {
                    if (viewName === 'list') {
                        sessionView.classList.add('active');
                        tabBar.style.display = 'flex';
                        chatView.classList.remove('active');
                        commandsView.classList.remove('active');
                        switchTab('sessions'); // Default back to sessions
                    } else {
                        sessionView.classList.remove('active');
                        commandsView.classList.remove('active');
                        tabBar.style.display = 'none';
                        chatView.classList.add('active');
                    }
                }

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

                inp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && inp.value) {
                        vscode.postMessage({ type: 'sendMessage', value: inp.value });
                        inp.value = '';
                    }
                });

                function sendSkill(skill) { vscode.postMessage({ type: 'skill', value: skill }); }
                function sendCmd(cmd) { vscode.postMessage({ type: 'command', value: cmd }); }
                function escapeHtml(text) { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

                window.addEventListener('message', event => {
                    const { type, activeSessionId, sessions, activeMessages, message, text, value, sessionId, mode } = event.data;

                    if (type === 'stateUpdate') {
                        currentSessionId = activeSessionId;
                        renderSessionList(sessions);
                        
                        // Toggle CLI Toolbox and Commands Tab
                        const cmdTab = document.getElementById('tab-commands');
                        if (mode === 'api') {
                            cliToolbox.classList.remove('visible');
                            if (cmdTab) cmdTab.style.display = 'none';
                        } else {
                            cliToolbox.classList.add('visible');
                            if (cmdTab) cmdTab.style.display = '';
                        }

                        if (activeSessionId) {
                            showView('chat');
                            renderChat(activeMessages);
                            const active = sessions.find(s => s.id === activeSessionId);
                            if (active) sessionTitleEl.innerText = active.title;
                        } else {
                            showView('list');
                        }
                    }
                    else if (type === 'addMessage' && sessionId === currentSessionId) {
                        addMessageToDom(message);
                    }
                    else if (type === 'updateLastMessage' && sessionId === currentSessionId) {
                        const lastMsg = chatContainer.lastElementChild;
                        if (lastMsg) {
                            lastMsg.innerText = text;
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        }
                    }
                    else if (type === 'setLoading') {
                        loader.classList.toggle('active', value);
                    }
                    else if (type === 'setAuthStatus') {
                        const status = value || 'unknown';
                        authChip.classList.remove('connected', 'missing', 'unknown', 'signed-out', 'key-missing');
                        if (status === 'signed-in') {
                            authChip.classList.add('connected');
                            authLabel.textContent = 'Connected';
                            signOutChip.style.display = 'inline-flex';
                        } else if (status === 'cli-missing') {
                            authChip.classList.add('missing');
                            authLabel.textContent = 'Install CLI';
                            signOutChip.style.display = 'none';
                        } else if (status === 'key-missing') {
                            authChip.classList.add('missing');
                            authLabel.textContent = 'Set API Key';
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
