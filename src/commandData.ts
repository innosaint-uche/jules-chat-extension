export interface CommandDefinition {
    command: string;
    description: string;
    usage?: string;
    category: 'auth' | 'session' | 'git' | 'misc' | 'config';
    actionId?: string; // If we can trigger it directly
}

export const CLI_COMMANDS: CommandDefinition[] = [
    // --- AUTHENTICATION ---
    {
        command: 'jules login',
        description: 'Authenticate the CLI with your Google account. Opens a browser window for OAuth flow.',
        category: 'auth',
        actionId: 'login'
    },
    {
        command: 'jules logout',
        description: 'Sign out and remove local credentials from the machine.',
        category: 'auth',
        actionId: 'logout'
    },
    {
        command: 'jules auth check',
        description: 'Verify current authentication status and token validity.',
        category: 'auth',
        actionId: 'status'
    },
    {
        command: 'jules auth refresh',
        description: 'Force refresh of the authentication token.',
        category: 'auth'
    },

    // --- SESSION MANAGEMENT ---
    {
        command: 'jules remote new',
        description: 'Start a new chat session with the agent for a specific repository.',
        usage: 'jules remote new --repo <owner/repo> --session "Your prompt"',
        category: 'session'
    },
    {
        command: 'jules remote list',
        description: 'List active sessions and their current status (e.g., RUNNING, PAUSED).',
        usage: 'jules remote list --session',
        category: 'session',
        actionId: 'remote-list-session'
    },
    {
        command: 'jules remote show',
        description: 'Show detailed metadata for a specific session.',
        usage: 'jules remote show <session-id>',
        category: 'session'
    },
    {
        command: 'jules remote pull',
        description: 'Download code changes (patches) from a remote session to your local working directory.',
        usage: 'jules remote pull --session <session-id>',
        category: 'session',
        actionId: 'remote-pull'
    },
    {
        command: 'jules remote delete',
        description: 'Delete a session permanently. This cannot be undone.',
        usage: 'jules remote delete <session-id>',
        category: 'session'
    },
    {
        command: 'jules remote logs',
        description: 'Fetch logs and conversation history for a specific session.',
        usage: 'jules remote logs <session-id>',
        category: 'session'
    },
    {
        command: 'jules remote resume',
        description: 'Resume a paused session.',
        usage: 'jules remote resume <session-id>',
        category: 'session'
    },
    {
        command: 'jules remote pause',
        description: 'Pause a running session.',
        usage: 'jules remote pause <session-id>',
        category: 'session'
    },

    // --- REPOSITORY SOURCES ---
    {
        command: 'jules remote list --repo',
        description: 'List available repositories (sources) linked to your account.',
        usage: 'jules remote list --repo',
        category: 'session',
        actionId: 'remote-list-repo'
    },
    {
        command: 'jules source link',
        description: 'Link a new GitHub repository to Jules.',
        usage: 'jules source link <owner/repo>',
        category: 'session'
    },
    {
        command: 'jules source unlink',
        description: 'Unlink a repository from Jules.',
        usage: 'jules source unlink <owner/repo>',
        category: 'session'
    },

    // --- CONFIGURATION ---
    {
        command: 'jules config list',
        description: 'List all current configuration settings.',
        usage: 'jules config list',
        category: 'config'
    },
    {
        command: 'jules config get',
        description: 'Get the value of a specific configuration key.',
        usage: 'jules config get <key>',
        category: 'config'
    },
    {
        command: 'jules config set',
        description: 'Set a configuration value.',
        usage: 'jules config set <key> <value>',
        category: 'config'
    },
    {
        command: 'jules config unset',
        description: 'Remove a configuration value.',
        usage: 'jules config unset <key>',
        category: 'config'
    },

    // --- GIT INTEGRATION: BASICS ---
    {
        command: 'jules git init',
        description: 'Initialize a new git repository.',
        usage: 'git init',
        category: 'git'
    },
    {
        command: 'jules git clone',
        description: 'Clone a repository into a new directory.',
        usage: 'git clone <url>',
        category: 'git'
    },
    {
        command: 'jules git status',
        description: 'Show the working tree status.',
        usage: 'git status',
        category: 'git'
    },
    {
        command: 'jules git status -s',
        description: 'Show the working tree status in short format.',
        usage: 'git status -s',
        category: 'git'
    },
    {
        command: 'jules git add',
        description: 'Add file contents to the index (stage files).',
        usage: 'git add <pathspec>',
        category: 'git'
    },
    {
        command: 'jules git add .',
        description: 'Add all changed files in the current directory to the index.',
        usage: 'git add .',
        category: 'git'
    },
    {
        command: 'jules git add -p',
        description: 'Interactively choose hunks of patch between the index and the work tree.',
        usage: 'git add -p',
        category: 'git'
    },
    {
        command: 'jules git commit',
        description: 'Record changes to the repository with a message.',
        usage: 'git commit -m "message"',
        category: 'git'
    },
    {
        command: 'jules git commit --amend',
        description: 'Amend the previous commit.',
        usage: 'git commit --amend',
        category: 'git'
    },
    {
        command: 'jules git diff',
        description: 'Show changes between commits, commit and working tree, etc.',
        usage: 'git diff',
        category: 'git'
    },
    {
        command: 'jules git diff --staged',
        description: 'Show changes that are staged for the next commit.',
        usage: 'git diff --staged',
        category: 'git'
    },

    // --- GIT INTEGRATION: BRANCHING ---
    {
        command: 'jules git branch',
        description: 'List local branches.',
        usage: 'git branch',
        category: 'git'
    },
    {
        command: 'jules git branch -a',
        description: 'List all branches (local and remote).',
        usage: 'git branch -a',
        category: 'git'
    },
    {
        command: 'jules git branch -d',
        description: 'Delete a branch.',
        usage: 'git branch -d <branch>',
        category: 'git'
    },
    {
        command: 'jules git checkout',
        description: 'Switch branches or restore working tree files.',
        usage: 'git checkout <branch>',
        category: 'git'
    },
    {
        command: 'jules git checkout -b',
        description: 'Create a new branch and switch to it immediately.',
        usage: 'git checkout -b <new-branch>',
        category: 'git'
    },
    {
        command: 'jules git switch',
        description: 'Switch branches.',
        usage: 'git switch <branch>',
        category: 'git'
    },
    {
        command: 'jules git merge',
        description: 'Join two or more development histories together.',
        usage: 'git merge <branch>',
        category: 'git'
    },
    {
        command: 'jules git merge --abort',
        description: 'Abort the current conflict resolution process, and try to reconstruct the pre-merge state.',
        usage: 'git merge --abort',
        category: 'git'
    },

    // --- GIT INTEGRATION: LOGS & HISTORY ---
    {
        command: 'jules git log',
        description: 'Show commit logs.',
        usage: 'git log',
        category: 'git'
    },
    {
        command: 'jules git log --oneline --graph',
        description: 'Show commit logs as a graph.',
        usage: 'git log --oneline --graph',
        category: 'git'
    },
    {
        command: 'jules git show',
        description: 'Show various types of objects (commits, tags, etc.).',
        usage: 'git show <object>',
        category: 'git'
    },
    {
        command: 'jules git blame',
        description: 'Show what revision and author last modified each line of a file.',
        usage: 'git blame <file>',
        category: 'git'
    },
    {
        command: 'jules git reflog',
        description: 'Manage reflog information.',
        usage: 'git reflog',
        category: 'git'
    },

    // --- GIT INTEGRATION: REMOTE SYNC ---
    {
        command: 'jules git fetch',
        description: 'Download objects and refs from another repository.',
        usage: 'git fetch --all',
        category: 'git'
    },
    {
        command: 'jules git pull',
        description: 'Fetch from and integrate with another repository or a local branch.',
        usage: 'git pull origin main',
        category: 'git'
    },
    {
        command: 'jules git push',
        description: 'Update remote refs along with associated objects.',
        usage: 'git push origin main',
        category: 'git'
    },
    {
        command: 'jules git push --force',
        description: 'Force update remote refs.',
        usage: 'git push --force',
        category: 'git'
    },
    {
        command: 'jules git push -u',
        description: 'Push and set upstream.',
        usage: 'git push -u origin <branch>',
        category: 'git'
    },
    {
        command: 'jules git remote -v',
        description: 'List remote repositories with URLs.',
        usage: 'git remote -v',
        category: 'git'
    },
    {
        command: 'jules git remote add',
        description: 'Add a new remote.',
        usage: 'git remote add <name> <url>',
        category: 'git'
    },

    // --- GIT INTEGRATION: ADVANCED ---
    {
        command: 'jules git stash',
        description: 'Stash the changes in a dirty working directory away.',
        usage: 'git stash',
        category: 'git'
    },
    {
        command: 'jules git stash list',
        description: 'List the stash entries that you currently have.',
        usage: 'git stash list',
        category: 'git'
    },
    {
        command: 'jules git stash pop',
        description: 'Apply the changes from the stash and remove them from the stash list.',
        usage: 'git stash pop',
        category: 'git'
    },
    {
        command: 'jules git stash drop',
        description: 'Remove a single stashed state from the stash list.',
        usage: 'git stash drop',
        category: 'git'
    },
    {
        command: 'jules git reset',
        description: 'Reset current HEAD to the specified state.',
        usage: 'git reset <commit>',
        category: 'git'
    },
    {
        command: 'jules git reset --soft',
        description: 'Reset HEAD to <commit>, but leave the index and working tree untouched.',
        usage: 'git reset --soft <commit>',
        category: 'git'
    },
    {
        command: 'jules git reset --hard',
        description: 'Reset current HEAD, index and working tree to specified state (DANGEROUS).',
        usage: 'git reset --hard <commit>',
        category: 'git'
    },
    {
        command: 'jules git rebase',
        description: 'Reapply commits on top of another base tip.',
        usage: 'git rebase <upstream>',
        category: 'git'
    },
    {
        command: 'jules git rebase -i',
        description: 'Interactive rebase.',
        usage: 'git rebase -i <upstream>',
        category: 'git'
    },
    {
        command: 'jules git rebase --continue',
        description: 'Continue the rebase process after resolving conflicts.',
        usage: 'git rebase --continue',
        category: 'git'
    },
    {
        command: 'jules git rebase --abort',
        description: 'Abort the rebase process.',
        usage: 'git rebase --abort',
        category: 'git'
    },
    {
        command: 'jules git cherry-pick',
        description: 'Apply the changes introduced by some existing commits.',
        usage: 'git cherry-pick <commit>',
        category: 'git'
    },
    {
        command: 'jules git revert',
        description: 'Create a new commit that undoes the changes of a previous commit.',
        usage: 'git revert <commit>',
        category: 'git'
    },
    {
        command: 'jules git tag',
        description: 'List tags.',
        usage: 'git tag',
        category: 'git'
    },
    {
        command: 'jules git tag -a',
        description: 'Create an annotated tag.',
        usage: 'git tag -a v1.0 -m "Version 1.0"',
        category: 'git'
    },
    {
        command: 'jules git clean',
        description: 'Remove untracked files from the working tree.',
        usage: 'git clean -fd',
        category: 'git'
    },
    {
        command: 'jules git grep',
        description: 'Print lines matching a pattern.',
        usage: 'git grep <pattern>',
        category: 'git'
    },
    {
        command: 'jules git config',
        description: 'Get and set repository or global options.',
        usage: 'git config --global user.name "Your Name"',
        category: 'git'
    },

    // --- MISC ---
    {
        command: 'jules version',
        description: 'Display the installed version of the Jules CLI.',
        category: 'misc',
        actionId: 'version'
    },
    {
        command: 'jules help',
        description: 'Show help information for the CLI.',
        category: 'misc',
        actionId: 'help'
    },
    {
        command: 'jules update',
        description: 'Update the Jules CLI to the latest version.',
        category: 'misc'
    },
    {
        command: 'Configure API Key',
        description: 'Manually enter your Jules API Key for direct API mode.',
        category: 'auth',
        actionId: 'jules.setApiKey' // This is a VSCode command ID
    }
];
