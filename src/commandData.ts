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
        description: 'Verify current authentication status.',
        category: 'auth',
        actionId: 'status'
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
        description: 'Show details of a specific session.',
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
        description: 'Delete a session permanently.',
        usage: 'jules remote delete <session-id>',
        category: 'session'
    },
    {
        command: 'jules remote logs',
        description: 'Fetch logs/history for a specific session.',
        usage: 'jules remote logs <session-id>',
        category: 'session'
    },

    // --- REPOSITORY SOURCES ---
    {
        command: 'jules remote list --repo',
        description: 'List available repositories (sources) for the agent.',
        usage: 'jules remote list --repo',
        category: 'session',
        actionId: 'remote-list-repo'
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
        description: 'Get the value of a configuration key.',
        usage: 'jules config get <key>',
        category: 'config'
    },
    {
        command: 'jules config set',
        description: 'Set a configuration value.',
        usage: 'jules config set <key> <value>',
        category: 'config'
    },

    // --- GIT INTEGRATION ---
    {
        command: 'jules git status',
        description: 'Show the working tree status.',
        usage: 'git status',
        category: 'git'
    },
    {
        command: 'jules git diff --staged',
        description: 'Show changes that are staged for the next commit.',
        usage: 'git diff --staged',
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
        command: 'jules git commit',
        description: 'Record changes to the repository with a message.',
        usage: 'git commit -m "message"',
        category: 'git'
    },
    {
        command: 'jules git diff',
        description: 'Show changes between commits, commit and working tree, etc.',
        usage: 'git diff',
        category: 'git'
    },

    // --- GIT OPERATIONS (Branching & Merging) ---
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
        command: 'jules git merge',
        description: 'Join two or more development histories together.',
        usage: 'git merge <branch>',
        category: 'git'
    },
    {
        command: 'jules git rebase',
        description: 'Reapply commits on top of another base tip.',
        usage: 'git rebase <upstream>',
        category: 'git'
    },
    {
        command: 'jules git log',
        description: 'Show commit logs.',
        usage: 'git log --oneline --graph',
        category: 'git'
    },
    {
        command: 'jules git grep',
        description: 'Print lines matching a pattern.',
        usage: 'git grep <pattern>',
        category: 'git'
    },

    // --- GIT OPERATIONS (Advanced) ---
    {
        command: 'jules git stash',
        description: 'Stash the changes in a dirty working directory away.',
        usage: 'git stash',
        category: 'git'
    },
    {
        command: 'jules git stash pop',
        description: 'Apply the changes from the stash and remove them from the stash list.',
        usage: 'git stash pop',
        category: 'git'
    },
    {
        command: 'jules git reset',
        description: 'Reset current HEAD to the specified state.',
        usage: 'git reset <commit>',
        category: 'git'
    },
    {
        command: 'jules git reset --hard',
        description: 'Reset current HEAD, index and working tree to specified state (DANGEROUS).',
        usage: 'git reset --hard <commit>',
        category: 'git'
    },
    {
        command: 'jules git remote -v',
        description: 'List remote repositories with URLs.',
        usage: 'git remote -v',
        category: 'git'
    },

    // --- GIT OPERATIONS (Sharing & Updating) ---
    {
        command: 'jules git fetch',
        description: 'Download objects and refs from another repository.',
        usage: 'git fetch --all',
        category: 'git'
    },
    {
        command: 'jules git clean',
        description: 'Remove untracked files from the working tree.',
        usage: 'git clean -fd',
        category: 'git'
    },
    {
        command: 'jules git rm',
        description: 'Remove files from the working tree and from the index.',
        usage: 'git rm <file>',
        category: 'git'
    },
    {
        command: 'jules git mv',
        description: 'Move or rename a file, a directory, or a symlink.',
        usage: 'git mv <source> <destination>',
        category: 'git'
    },
    {
        command: 'jules git cherry-pick',
        description: 'Apply the changes introduced by some existing commits.',
        usage: 'git cherry-pick <commit>',
        category: 'git'
    },
    {
        command: 'jules git config',
        description: 'Get and set repository or global options.',
        usage: 'git config --global user.name "John Doe"',
        category: 'git'
    },
    {
        command: 'jules git reset',
        description: 'Reset current HEAD to the specified state.',
        usage: 'git reset [--soft | --hard] <commit>',
        category: 'git'
    },
    {
        command: 'jules git rebase',
        description: 'Reapply commits on top of another base tip.',
        usage: 'git rebase <branch>',
        category: 'git'
    },
    {
        command: 'jules git cherry-pick',
        description: 'Apply the changes introduced by some existing commits.',
        usage: 'git cherry-pick <commit>',
        category: 'git'
    },
    {
        command: 'jules git tag',
        description: 'Create, list, delete or verify a tag object signed with GPG.',
        usage: 'git tag',
        category: 'git'
    },
    {
        command: 'jules git stash pop',
        description: 'Remove a single stashed state from the stash list and apply it on top of the current working tree state.',
        usage: 'git stash pop',
        category: 'git'
    },
    {
        command: 'jules git clean',
        description: 'Remove untracked files from the working tree.',
        usage: 'git clean -fd',
        category: 'git'
    },
    {
        command: 'jules git blame',
        description: 'Show what revision and author last modified each line of a file.',
        usage: 'git blame <file>',
        category: 'git'
    },
    {
        command: 'jules git show',
        description: 'Show various types of objects.',
        usage: 'git show <object>',
        category: 'git'
    },
    {
        command: 'jules git revert',
        description: 'Revert some existing commits.',
        usage: 'git revert <commit>',
        category: 'git'
    },
    {
        command: 'jules git rebase',
        description: 'Reapply commits on top of another base tip.',
        usage: 'git rebase <upstream>',
        category: 'git'
    },
    {
        command: 'jules git reset',
        description: 'Reset current HEAD to the specified state.',
        usage: 'git reset --hard <commit>',
        category: 'git'
    },
    {
        command: 'jules git revert',
        description: 'Create a new commit that undoes the changes of a previous commit.',
        usage: 'git revert <commit>',
        category: 'git'
    },
    {
        command: 'jules git cherry-pick',
        description: 'Apply the changes introduced by some existing commits.',
        usage: 'git cherry-pick <commit>',
        category: 'git'
    },
    {
        command: 'jules git tag',
        description: 'Create, list, delete or verify a tag object signed with GPG.',
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
        command: 'jules git show',
        description: 'Show various types of objects.',
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
        command: 'jules git config',
        description: 'Get and set repository or global options.',
        usage: 'git config --global user.name "Your Name"',
        category: 'git'
    },

    // --- MISC ---
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
