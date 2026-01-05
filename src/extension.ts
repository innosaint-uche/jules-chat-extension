import * as vscode from 'vscode';
import * as cp from 'child_process';

type JulesAuthStatus = 'signed-in' | 'signed-out' | 'cli-missing' | 'unknown';

export function activate(context: vscode.ExtensionContext) {
    const provider = new JulesChatProvider(context.extensionUri);

    // 1. Register the Chat View
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(JulesChatProvider.viewType, provider)
    );

    // 2. Register Public Commands (Linked to package.json)
    
    // Command: Open Chat
    context.subscriptions.push(
        vscode.commands.registerCommand('jules.openChat', () => {
            vscode.commands.executeCommand('jules.chatView.focus');
        })
    );

    // Command: Check Status
    context.subscriptions.push(
        vscode.commands.registerCommand('jules.checkStatus', async () => {
            await vscode.commands.executeCommand('jules.chatView.focus');
            provider.handleExternalCommand('status');
        })
    );

    // Command: Git Ops
    context.subscriptions.push(
        vscode.commands.registerCommand('jules.gitOps', async () => {
            await vscode.commands.executeCommand('jules.chatView.focus');
            provider.handleExternalCommand('skill:git');
        })
    );

    // Command: Generate Code
    context.subscriptions.push(
        vscode.commands.registerCommand('jules.generateCode', async () => {
            await vscode.commands.executeCommand('jules.chatView.focus');
            provider.handleExternalCommand('skill:codegen');
        })
    );
}

class JulesChatProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'jules.chatView';
    private _view?: vscode.WebviewView;
    private _hasShownOnboarding = false;
    private _authStatus: JulesAuthStatus = 'unknown';

    constructor(private readonly _extensionUri: vscode.Uri) {}

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

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    await this._handleUserMessage(data.value);
                    break;
                case 'command':
                    if (data.value === 'status') {
                        await this._handleUserMessage('status');
                    } else if (data.value === 'help') {
                        await this._handleUserMessage('help');
                    } else if (data.value === 'login') {
                        await this._handleUserMessage('login');
                    } else if (data.value === 'logout') {
                        await this._handleUserMessage('logout');
                    } else if (data.value.startsWith('git:')) {
                        await this._handleGitCommand(data.value);
                    }
                    break;
                case 'skill':
                    await this._handleSkillAction(data.value);
                    break;
            }
        });

        this._maybeShowOnboarding();
        void this._refreshAuthStatus();
    }

    // Public method to handle commands from the VS Code Command Palette
    public async handleExternalCommand(cmd: string) {
        // Wait briefly for view to focus
        setTimeout(() => {
            if (cmd === 'status') {
                this._handleUserMessage('status');
            } else if (cmd.startsWith('skill:')) {
                this._handleSkillAction(cmd.split(':')[1]);
            }
        }, 500);
    }

    private async _handleGitCommand(cmd: string) {
        const action = cmd.split(':')[1];
        const cwd = this._requireWorkspace();
        if (!cwd) {
            return;
        }

        switch (action) {
            case 'init':
                this._runShellCommand('git init', cwd, '📦 Initializing new git repository...');
                break;
            case 'pull':
                this._runShellCommand('git pull', cwd, '⬇️ Pulling changes from remote...');
                break;
            case 'push':
                this._runShellCommand('git push', cwd, '⬆️ Pushing changes to remote...');
                break;
            case 'status':
                this._runShellCommand('git status', cwd, '📈 Checking git status...');
                break;
        }
    }

    private async _handleSkillAction(skill: string) {
        if (!this._view) { return; }

        if (skill === 'git') {
            this._view.webview.postMessage({
                type: 'addMessage',
                value: "📂 **Git Operations**\n\nManage your local repository directly from here.",
                sender: 'jules',
                buttons: [
                    { label: '✨ Init Repo', cmd: 'git:init' },
                    { label: '⬇️ Pull', cmd: 'git:pull' },
                    { label: '⬆️ Push', cmd: 'git:push' },
                    { label: '📈 Status', cmd: 'git:status' }
                ]
            });
            return;
        }

        const skillPrompts: { [key: string]: string } = {
            'performance': `You are "Bolt" ⚡, a performance-obsessed agent. Mission: Implement ONE measurable performance improvement. Boundaries: Measure before/after, run lint+tests. Never: Premature optimization.`,
            'design': `You are "Palette" 🎨, guardian of usability. Mission: Deliver ONE micro-UX improvement users feel immediately. Boundaries: Ensure keyboard nav, use existing tokens. Never: Redesign entire pages.`,
            'security': `You are "Sentinel" 🛡️, defender of the codebase. Mission: Fix ONE real security issue or add ONE defense-in-depth enhancement. Priorities: Critical > High > Medium. Boundaries: Validate inputs, fail securely.`,
            'test': `You are "Probe" 🧪, breaker of assumptions. Mission: Add or improve tests to catch real regressions. Focus on failure paths and edge cases. Do not refactor production code.`,
            'debug': `You are "Tracer" 🧯, debugging specialist. Mission: Analyze logs/behavior, suggest root cause and minimal fix. Do not refactor broadly.`,
            'refactor': `You are "Refine" ♻️, refactoring agent. Mission: Improve readability and structure with ZERO behavior change. No performance or security scope.`,
            'review': `You are "Lens" 👀, code review agent. Mission: Flag logic errors, style violations, and security smells in the latest changes. Do not approve your own code.`
        };

        if (skill === 'codegen') {
            this._view.webview.postMessage({ type: 'setInput', value: 'You are "Forge" 🧑‍💻. Generate code for: ' });
        } else if (skillPrompts[skill]) {
            await this._handleUserMessage(skillPrompts[skill]);
        }
    }

    private async _handleUserMessage(message: string) {
        if (!this._view) { return; }

        this._view.webview.postMessage({ type: 'addMessage', value: message, sender: 'user' });

        const lowerMsg = message.toLowerCase().trim();

        if (lowerMsg === 'help' || lowerMsg.startsWith('help ') || lowerMsg === '?' || lowerMsg === 'commands') {
            this._showHelp();
            return;
        }

        if (lowerMsg === 'login' || lowerMsg === 'sign in' || lowerMsg === 'signin') {
            await this._startLoginFlow();
            return;
        }

        if (lowerMsg === 'logout' || lowerMsg === 'sign out' || lowerMsg === 'signout') {
            await this._startLogoutFlow();
            return;
        }

        // Greetings / Ambiguous -> Show Options
        const greetings = ['hi', 'hello', 'hey', 'yo', 'sup', 'menu', 'options'];
        const isGreeting = greetings.includes(lowerMsg) || 
                          (greetings.some(g => lowerMsg.startsWith(g + ' ')) && lowerMsg.split(' ').length < 4);

        if (isGreeting) {
            this._view.webview.postMessage({
                type: 'addMessage',
                value: "👋 **Hi there!** I'm Jules, your async coding agent.\n\nI can run tasks in the cloud or help manage your local repo. Select a **Skill Agent** above or describe a task.",
                sender: 'jules',
                buttons: [
                    { label: '📊 Check Status', cmd: 'status' },
                    { label: '📂 Git Ops', cmd: 'skill:git' },
                    { label: '✨ Generate Code', cmd: 'skill:codegen' }
                ]
            });
            return;
        }

        const cwd = this._requireWorkspace();
        if (!cwd) {
            return;
        }

        // Status Commands
        if (lowerMsg === 'status' || lowerMsg === 'list' || lowerMsg.includes('show status') || lowerMsg.includes('list sessions')) {
            this._runShellCommand('jules remote list --session', cwd, '🔍 Fetching session list...');
            return;
        }

        // Pull Command
        if (lowerMsg.startsWith('pull') && !lowerMsg.includes('git')) {
            const sessionId = lowerMsg.split(' ')[1];
            if (!sessionId) {
                this._reply("⚠️ Please provide a session ID. Usage: 'pull <id>'");
            } else {
                this._runShellCommand(`jules remote pull --session ${sessionId}`, cwd, `⬇️ Pulling session ${sessionId}...`);
            }
            return;
        }

        // Default: Task Execution
        const isCodeGen = lowerMsg.includes('forge') || lowerMsg.startsWith('generate');
        const introText = isCodeGen 
            ? `🏗️ Dispatching **Forge** Agent...` 
            : `🚀 Dispatching new task: "${message.substring(0, 40)}${message.length > 40 ? '...' : ''}"...`;

        this._runShellCommand(`jules remote new --repo . --session "${message}"`, cwd, introText);
    }

    private _runShellCommand(command: string, cwd: string, introText: string) {
        this._reply(introText);
        this._setLoading(true);
        
        cp.exec(command, { cwd }, (err, stdout, stderr) => {
            this._setLoading(false);
            
            if (err) {
                this._reply(this._formatCliError(command, err, stderr));
                return;
            }
            const output = stdout.trim() || "✅ Done.";
            this._reply(output);
        });
    }

    private _reply(text: string, buttons?: Array<{ label: string; cmd: string }>) {
        this._view?.webview.postMessage({ type: 'addMessage', value: text, sender: 'jules', buttons });
    }

    private _setLoading(isLoading: boolean) {
        this._view?.webview.postMessage({ type: 'setLoading', value: isLoading });
    }

    private _setAuthStatus(status: JulesAuthStatus) {
        this._authStatus = status;
        this._view?.webview.postMessage({ type: 'setAuthStatus', value: status });
    }

    private _maybeShowOnboarding() {
        if (!this._view || this._hasShownOnboarding) {
            return;
        }
        this._hasShownOnboarding = true;
        this._reply(
            "👋 Welcome! To use Jules, install the CLI and sign in:\n\n- Install: `npm install -g @google/jules`\n- Sign in: click **Sign In** or run `jules login`\n- Try: type `status` to list sessions",
            [
                { label: '🔐 Sign In', cmd: 'login' },
                { label: '❓ Help / Commands', cmd: 'help' },
                { label: '🔍 Status', cmd: 'status' }
            ]
        );
    }

    private _showHelp() {
        this._reply(
            "Quick help:\n\n- Sign in: click **Sign In** or run `jules login`\n- Sign out: click **Sign Out** or run `jules logout`\n- Install CLI: `npm install -g @google/jules`\n- Status: type `status`\n- Pull changes: `pull <session-id>`\n- Start a task: describe it in plain English\n- Git Ops: click Git Ops, then choose an action"
        );
    }

    private async _startLoginFlow() {
        const cwd = this._getWorkspaceRoot() || process.cwd();
        this._setLoading(true);
        const status = await this._checkJulesAuthStatus(cwd);
        this._setLoading(false);
        this._setAuthStatus(status);

        if (status === 'cli-missing') {
            this._reply("❌ Jules CLI not found. Install it with `npm install -g @google/jules` and try again.");
            return;
        }
        if (status === 'signed-in') {
            this._reply("✅ You're already signed in.");
            return;
        }

        if (status === 'unknown') {
            this._reply("⚠️ Couldn't verify sign-in status. Starting login anyway...");
        }

        this._reply('🔐 Opening your browser to sign in...');
        this._setLoading(true);
        cp.exec('jules login', { cwd }, (err, stdout, stderr) => {
            this._setLoading(false);
            if (err) {
                this._reply(this._formatCliError('jules login', err, stderr));
                return;
            }
            const output = stdout.trim() || "✅ Signed in.";
            this._reply(output);
            void this._refreshAuthStatus();
        });
    }

    private async _startLogoutFlow() {
        const cwd = this._getWorkspaceRoot() || process.cwd();
        this._setLoading(true);
        const status = await this._checkJulesAuthStatus(cwd);
        this._setLoading(false);
        this._setAuthStatus(status);

        if (status === 'cli-missing') {
            this._reply("❌ Jules CLI not found. Install it with `npm install -g @google/jules` and try again.");
            return;
        }
        if (status === 'signed-out') {
            this._reply("✅ You're already signed out.");
            return;
        }

        this._reply('🔓 Signing out...');
        this._setLoading(true);
        cp.exec('jules logout', { cwd }, (err, stdout, stderr) => {
            this._setLoading(false);
            if (err) {
                this._reply(this._formatCliError('jules logout', err, stderr));
                return;
            }
            const output = stdout.trim() || "✅ Signed out.";
            this._reply(output);
            this._setAuthStatus('signed-out');
        });
    }

    private _checkJulesAuthStatus(cwd: string): Promise<'signed-in' | 'signed-out' | 'cli-missing' | 'unknown'> {
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

    private async _refreshAuthStatus() {
        const cwd = this._getWorkspaceRoot() || process.cwd();
        const status = await this._checkJulesAuthStatus(cwd);
        this._setAuthStatus(status);
    }

    private _getWorkspaceRoot() {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    private _requireWorkspace() {
        const root = this._getWorkspaceRoot();
        if (!root) {
            this._reply("📁 Open a folder/workspace to use Jules commands.");
            return undefined;
        }
        return root;
    }

    private _isJulesCommand(command: string) {
        return command.trim().startsWith('jules ');
    }

    private _formatCliError(command: string, err: Error, stderr: string) {
        const combined = `${stderr || ''}\n${err.message || ''}`.toLowerCase();
        if (this._isJulesCommand(command)) {
            if (combined.includes('not found') || combined.includes('enoent')) {
                this._setAuthStatus('cli-missing');
                return "❌ Jules CLI not found. Install it with `npm install -g @google/jules` and try again.";
            }
            if (combined.includes('login') || combined.includes('auth') || combined.includes('unauthorized')) {
                this._setAuthStatus('signed-out');
                return "🔐 You're not signed in. Click **Sign In** or run `jules login` and retry your command.";
            }
        }
        const details = stderr?.trim() || err.message || 'Unknown error.';
        return `❌ Error/Info: ${details}`;
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                :root {
                    --bg-color: var(--vscode-editor-background);
                    --text-color: var(--vscode-editor-foreground);
                    --user-bg: var(--vscode-button-background);
                    --user-text: var(--vscode-button-foreground);
                    --jules-bg: var(--vscode-editor-inactiveSelectionBackground);
                    --input-bg: var(--vscode-input-background);
                    --input-border: var(--vscode-input-border);
                    --accent: var(--vscode-textLink-foreground);
                    --btn-bg: var(--vscode-button-secondaryBackground);
                    --btn-fg: var(--vscode-button-secondaryForeground);
                    --btn-hover: var(--vscode-button-secondaryHoverBackground);
                }
                body { font-family: var(--vscode-font-family); padding: 0; margin: 0; color: var(--text-color); background-color: var(--bg-color); display: flex; flex-direction: column; height: 100vh; }
                
                .chat-container { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 12px; }
                
                .message { padding: 10px 14px; border-radius: 8px; max-width: 90%; word-wrap: break-word; line-height: 1.4; animation: fadeIn 0.3s ease; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

                .user { align-self: flex-end; background: var(--user-bg); color: var(--user-text); border-bottom-right-radius: 2px; }
                .jules { align-self: flex-start; background: var(--jules-bg); border-bottom-left-radius: 2px; font-size: 0.9em; border: 1px solid var(--vscode-widget-border); overflow-x: auto; }
                
                /* Handle Monospace output (like 'status' tables) */
                .jules { white-space: pre-wrap; } 

                /* Inline Buttons */
                .msg-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
                .msg-btn { 
                    background: var(--btn-bg); 
                    color: var(--btn-fg); 
                    border: none; 
                    padding: 6px 12px; 
                    border-radius: 15px; 
                    cursor: pointer; 
                    font-size: 0.85em;
                    transition: background 0.2s;
                    font-family: var(--vscode-font-family);
                }
                .msg-btn:hover { background: var(--btn-hover); }

                /* Skills Grid */
                .skills-section { padding: 10px 15px 0 15px; border-bottom: 1px solid var(--vscode-widget-border); background: var(--bg-color); }
                .section-title { font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; color: var(--vscode-descriptionForeground); font-weight: 600; }
                
                .skills-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 10px; }
                .skill-card { 
                    background: var(--jules-bg); 
                    border: 1px solid transparent; 
                    padding: 8px; 
                    border-radius: 4px; 
                    cursor: pointer; 
                    text-align: center; 
                    font-size: 0.85em; 
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                .skill-card:hover { background: var(--vscode-list-hoverBackground); border-color: var(--accent); }

                .controls { padding: 15px; border-top: 1px solid var(--vscode-widget-border); background: var(--bg-color); }
                
                .quick-actions { display: flex; gap: 8px; margin-bottom: 10px; justify-content: flex-end; }
                .chip { font-size: 0.8em; color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: none; }
                .chip:hover { text-decoration: underline; }
                .auth-chip { display: inline-flex; align-items: center; gap: 6px; }
                .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--vscode-descriptionForeground); opacity: 0.8; }
                .auth-chip.connected .status-dot { background: var(--vscode-terminal-ansiGreen, #2da44e); opacity: 1; }
                .auth-chip.missing .status-dot { background: var(--vscode-terminal-ansiRed, #d73a49); opacity: 1; }
                .auth-chip.unknown .status-dot { background: var(--vscode-terminal-ansiYellow, #f7b731); opacity: 1; }

                #input-box { width: 100%; padding: 10px; box-sizing: border-box; background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text-color); border-radius: 4px; outline: none; }
                #input-box:focus { border-color: var(--vscode-focusBorder); }

                .loader { display: none; align-self: flex-start; color: var(--vscode-descriptionForeground); font-size: 0.8em; margin-left: 15px; margin-bottom: 5px; }
                .loader.active { display: block; }
                
                .welcome-text { text-align: center; color: var(--vscode-descriptionForeground); margin-top: 20px; font-style: italic; }
            </style>
        </head>
        <body>
            <div class="skills-section">
                <div class="section-title">Agent Skills</div>
                <div class="skills-grid">
                    <div class="skill-card" onclick="sendSkill('codegen')">✨ Gen Code</div>
                    <div class="skill-card" onclick="sendSkill('test')">🧪 Testing</div>
                    <div class="skill-card" onclick="sendSkill('debug')">🐞 Debug</div>
                    <div class="skill-card" onclick="sendSkill('refactor')">🔨 Refactor</div>
                    <div class="skill-card" onclick="sendSkill('security')">🔒 Security</div>
                    <div class="skill-card" onclick="sendSkill('performance')">⚡ Speed</div>
                    <div class="skill-card" onclick="sendSkill('design')">🎨 Design</div>
                    <div class="skill-card" onclick="sendSkill('review')">👀 Review</div>
                    <div class="skill-card" onclick="sendSkill('git')">📂 Git Ops</div>
                </div>
            </div>

            <div class="chat-container" id="chat">
                <div class="welcome-text">
                    <h3>👋 Jules Agent Ready</h3>
                    <p>Select a skill above or type a task below.</p>
                </div>
            </div>
            
            <div class="loader" id="loader">⚡ Jules is working...</div>

            <div class="controls">
                <div class="quick-actions">
                    <div class="chip" onclick="sendCmd('status')">Status</div>
                    <div class="chip auth-chip" id="auth-chip" onclick="sendCmd('login')">
                        <span class="status-dot" id="auth-dot"></span>
                        <span id="auth-label">Sign In</span>
                    </div>
                    <div class="chip" id="signout-chip" onclick="sendCmd('logout')" style="display: none;">Sign Out</div>
                    <div class="chip" onclick="sendCmd('help')">Help</div>
                </div>
                <input type="text" id="input-box" placeholder="Describe a task..." />
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const chat = document.getElementById('chat');
                const loader = document.getElementById('loader');
                const inp = document.getElementById('input-box');
                const authChip = document.getElementById('auth-chip');
                const authLabel = document.getElementById('auth-label');
                const signOutChip = document.getElementById('signout-chip');

                inp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && inp.value) {
                        vscode.postMessage({ type: 'sendMessage', value: inp.value });
                        inp.value = '';
                    }
                });

                function sendCmd(cmd) {
                    vscode.postMessage({ type: 'command', value: cmd });
                }

                function sendSkill(skill) {
                    vscode.postMessage({ type: 'skill', value: skill });
                }

                window.addEventListener('message', event => {
                    const { type, value, sender, buttons } = event.data;
                    
                    if (type === 'setLoading') {
                        if (value) loader.classList.add('active');
                        else loader.classList.remove('active');
                        chat.scrollTop = chat.scrollHeight;
                        return;
                    }

                    if (type === 'setInput') {
                        inp.value = value;
                        inp.focus();
                        return;
                    }

                    if (type === 'setAuthStatus') {
                        const status = value || 'unknown';
                        authChip.classList.remove('connected', 'signed-out', 'unknown', 'missing');
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
                            authLabel.textContent = 'Sign In';
                            signOutChip.style.display = 'none';
                        } else {
                            authChip.classList.add('signed-out');
                            authLabel.textContent = 'Sign In';
                            signOutChip.style.display = 'none';
                        }
                        return;
                    }

                    if (type === 'addMessage') {
                        const div = document.createElement('div');
                        div.className = 'message ' + sender;
                        div.innerText = value;
                        
                        // Render Inline Buttons if present
                        if (buttons && buttons.length > 0) {
                            const btnContainer = document.createElement('div');
                            btnContainer.className = 'msg-buttons';
                            buttons.forEach(btn => {
                                const b = document.createElement('button');
                                b.className = 'msg-btn';
                                b.innerText = btn.label;
                                b.onclick = () => {
                                    if (btn.cmd.startsWith('skill:')) {
                                        sendSkill(btn.cmd.split(':')[1]);
                                    } else {
                                        sendCmd(btn.cmd);
                                    }
                                };
                                btnContainer.appendChild(b);
                            });
                            div.appendChild(btnContainer);
                        }

                        chat.appendChild(div);
                        chat.scrollTop = chat.scrollHeight;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
