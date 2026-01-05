import * as cp from 'child_process';
import * as vscode from 'vscode';
import { JulesBackend, JulesAuthStatus, ChatSession, ChatMessage } from './types';

export class CliBackend implements JulesBackend {
    constructor(
        private readonly _onOutput: (text: string, sender: 'jules' | 'system', session: ChatSession) => void,
        private readonly _onStatusChange: (status: JulesAuthStatus) => void
    ) {}

    async checkAuth(cwd: string): Promise<JulesAuthStatus> {
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

    async login(cwd: string): Promise<void> {
        this._onOutput('🔐 Opening your browser to sign in...', 'jules', { messages: [] } as any); // Dummy session for global log
        const child = this._spawnCli('jules', ['login'], cwd);
        return new Promise((resolve) => {
            child.on('close', async () => {
                const status = await this.checkAuth(cwd);
                this._onStatusChange(status);
                resolve();
            });
        });
    }

    async logout(cwd: string): Promise<void> {
        this._onOutput('🔓 Signing out...', 'jules', { messages: [] } as any);
        const child = this._spawnCli('jules', ['logout'], cwd);
        return new Promise((resolve) => {
            child.on('close', () => {
                this._onStatusChange('signed-out');
                resolve();
            });
        });
    }

    async sendMessage(session: ChatSession, message: string, cwd: string): Promise<void> {
        const lower = message.toLowerCase().trim();

        // Handle special "local" commands that the CLI wrapper implemented
        if (lower === 'status') {
            this._runSpawn('jules', ['remote', 'list', '--session'], cwd, '🔍 Checking sessions...', session);
            return;
        }
        if (lower.startsWith('pull ')) {
            const id = lower.split(' ')[1];
            this._runSpawn('jules', ['remote', 'pull', '--session', id], cwd, `⬇️ Pulling session ${id}...`, session);
            return;
        }

        // Standard Task Execution
        // We first need to determine the repo context if possible
        const repoSlug = await this._getGitHubRepoSlug(cwd);

        if (!repoSlug) {
             this._onOutput(this._getRepoHelpMessage('missing-remote'), 'jules', session);
             return;
        }

        this._runSpawn('jules', ['remote', 'new', '--repo', repoSlug, '--session', message], cwd, '🚀 Dispatching Agent...', session);
    }

    private _runSpawn(command: string, args: string[], cwd: string, intro: string, session: ChatSession) {
        this._onOutput(intro, 'jules', session);

        const child = this._spawnCli(command, args, cwd);
        let repoHelpShown = false;

        child.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) this._onOutput(output, 'jules', session);
        });

        child.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (!output) return;
            this._onOutput(`Checking: ${output}`, 'jules', session);

            if (!repoHelpShown && command === 'jules' && this._looksLikeRepoMissing(output)) {
                repoHelpShown = true;
                this._onOutput(this._getRepoHelpMessage('missing-remote'), 'jules', session);
            }
        });

        child.on('error', (err) => {
            this._onOutput(`❌ Execution Error: ${err.message}`, 'system', session);
        });

        child.on('close', (code) => {
            if (code !== 0) {
                this._onOutput(`\n[Process exited with code ${code}]`, 'jules', session);
            }
        });
    }

    private _spawnCli(command: string, args: string[], cwd: string) {
        const isWin = process.platform === 'win32';
        return cp.spawn(isWin ? `${command}.cmd` : command, args, { cwd, shell: false });
    }

    // --- Git Helper Methods (Moved from extension.ts) ---
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

        return [
            header,
            '',
            ...steps,
            '',
            'Then retry your request.'
        ].join('\n');
    }
}
