export interface CommandDefinition {
    command: string;
    description: string;
    usage?: string;
    category: 'auth' | 'session' | 'git' | 'misc' | 'config' | 'advanced-git';
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
        command: 'Configure API Key',
        description: 'Manually enter your Jules API Key for direct API mode.',
        category: 'auth',
        actionId: 'jules.setApiKey'
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

    // --- GIT BASICS ---
    {
        command: 'jules git init',
        description: 'Create an empty Git repository or reinitialize an existing one.',
        usage: 'git init',
        category: 'git'
    },
    {
        command: 'jules git status',
        description: 'Show the working tree status.',
        usage: 'git status',
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
        description: 'Amend the previous commit (change message or add forgotten files).',
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
    {
        command: 'jules git diff --stat',
        description: 'Show a summary of changes (files changed, insertions, deletions).',
        usage: 'git diff --stat',
        category: 'git'
    },

    // --- BRANCHING & MERGING ---
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
        description: 'Delete a branch (prevents deletion if unmerged).',
        usage: 'git branch -d <branch>',
        category: 'git'
    },
    {
        command: 'jules git branch -D',
        description: 'Force delete a branch.',
        usage: 'git branch -D <branch>',
        category: 'advanced-git'
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
        description: 'Switch branches (modern alternative to checkout).',
        usage: 'git switch <branch>',
        category: 'git'
    },
    {
        command: 'jules git switch -c',
        description: 'Create and switch to a new branch.',
        usage: 'git switch -c <new-branch>',
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
        description: 'Abort the current conflict resolution process.',
        usage: 'git merge --abort',
        category: 'git'
    },

    // --- REBASE ---
    {
        command: 'jules git rebase',
        description: 'Reapply commits on top of another base tip.',
        usage: 'git rebase <upstream>',
        category: 'advanced-git'
    },
    {
        command: 'jules git rebase -i',
        description: 'Interactive rebase to edit, squash, or reorder commits.',
        usage: 'git rebase -i <commit>',
        category: 'advanced-git'
    },
    {
        command: 'jules git rebase --continue',
        description: 'Continue the rebase process after resolving conflicts.',
        usage: 'git rebase --continue',
        category: 'advanced-git'
    },
    {
        command: 'jules git rebase --abort',
        description: 'Abort the rebase process and return to original state.',
        usage: 'git rebase --abort',
        category: 'advanced-git'
    },

    // --- CHERRY-PICK ---
    {
        command: 'jules git cherry-pick',
        description: 'Apply the changes introduced by some existing commits.',
        usage: 'git cherry-pick <commit>',
        category: 'advanced-git'
    },
    {
        command: 'jules git cherry-pick --continue',
        description: 'Continue cherry-pick after resolving conflicts.',
        usage: 'git cherry-pick --continue',
        category: 'advanced-git'
    },
    {
        command: 'jules git cherry-pick --abort',
        description: 'Cancel the cherry-pick operation.',
        usage: 'git cherry-pick --abort',
        category: 'advanced-git'
    },

    // --- LOGS & HISTORY ---
    {
        command: 'jules git log',
        description: 'Show commit logs.',
        usage: 'git log --oneline --graph --all',
        category: 'git'
    },
    {
        command: 'jules git log -p',
        description: 'Show changes over time (patches) for each commit.',
        usage: 'git log -p <file>',
        category: 'git'
    },
    {
        command: 'jules git reflog',
        description: 'Manage reflog information (show local history of HEAD).',
        usage: 'git reflog',
        category: 'advanced-git'
    },
    {
        command: 'jules git blame',
        description: 'Show what revision and author last modified each line of a file.',
        usage: 'git blame <file>',
        category: 'git'
    },
    {
        command: 'jules git show',
        description: 'Show various types of objects (commits, tags, trees).',
        usage: 'git show <object>',
        category: 'git'
    },
    {
        command: 'jules git shortlog',
        description: 'Summarize git log output.',
        usage: 'git shortlog -sn',
        category: 'git'
    },

    // --- REMOTE OPS ---
    {
        command: 'jules git remote -v',
        description: 'List remote repositories.',
        usage: 'git remote -v',
        category: 'git'
    },
    {
        command: 'jules git remote add',
        description: 'Add a new remote repository.',
        usage: 'git remote add <name> <url>',
        category: 'git'
    },
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
        command: 'jules git push -u',
        description: 'Push and set upstream.',
        usage: 'git push -u origin <branch>',
        category: 'git'
    },
    {
        command: 'jules git push --force',
        description: 'Force update remote refs (use with caution).',
        usage: 'git push --force',
        category: 'advanced-git'
    },

    // --- UNDOING & CLEANING ---
    {
        command: 'jules git restore',
        description: 'Restore working tree files (discard local changes).',
        usage: 'git restore <file>',
        category: 'git'
    },
    {
        command: 'jules git restore --staged',
        description: 'Unstage files (remove from index).',
        usage: 'git restore --staged <file>',
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
        description: 'Reset index and working tree (discard all changes).',
        usage: 'git reset --hard <commit>',
        category: 'advanced-git'
    },
    {
        command: 'jules git revert',
        description: 'Create a new commit that undoes the changes of a previous commit.',
        usage: 'git revert <commit>',
        category: 'git'
    },
    {
        command: 'jules git clean -n',
        description: 'Show what files would be removed (dry run).',
        usage: 'git clean -n',
        category: 'advanced-git'
    },
    {
        command: 'jules git clean -fd',
        description: 'Remove untracked files and directories.',
        usage: 'git clean -fd',
        category: 'advanced-git'
    },

    // --- STASH ---
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
        command: 'jules git stash list',
        description: 'List the stash entries that you currently have.',
        usage: 'git stash list',
        category: 'git'
    },
    {
        command: 'jules git stash drop',
        description: 'Remove a single stashed state from the stash list.',
        usage: 'git stash drop <stash@{n}>',
        category: 'git'
    },
    {
        command: 'jules git stash clear',
        description: 'Remove all the stash entries.',
        usage: 'git stash clear',
        category: 'advanced-git'
    },

    // --- BISECT ---
    {
        command: 'jules git bisect start',
        description: 'Start binary search to find the commit that introduced a bug.',
        usage: 'git bisect start',
        category: 'advanced-git'
    },
    {
        command: 'jules git bisect bad',
        description: 'Mark the current commit as bad.',
        usage: 'git bisect bad',
        category: 'advanced-git'
    },
    {
        command: 'jules git bisect good',
        description: 'Mark the current commit as good.',
        usage: 'git bisect good',
        category: 'advanced-git'
    },
    {
        command: 'jules git bisect reset',
        description: 'Finish bisecting and return to the original branch.',
        usage: 'git bisect reset',
        category: 'advanced-git'
    },

    // --- SUBMODULES ---
    {
        command: 'jules git submodule add',
        description: 'Add a new submodule.',
        usage: 'git submodule add <repository> <path>',
        category: 'advanced-git'
    },
    {
        command: 'jules git submodule update',
        description: 'Update the registered submodules.',
        usage: 'git submodule update --init --recursive',
        category: 'advanced-git'
    },
    {
        command: 'jules git submodule status',
        description: 'Show the status of the submodules.',
        usage: 'git submodule status',
        category: 'advanced-git'
    },

    // --- MISC ---
    {
        command: 'jules git tag',
        description: 'Create, list, delete or verify a tag object.',
        usage: 'git tag',
        category: 'git'
    },
    {
        command: 'jules git describe',
        description: 'Give an object a human readable name based on an available ref.',
        usage: 'git describe',
        category: 'git'
    },
    {
        command: 'jules git grep',
        description: 'Print lines matching a pattern.',
        usage: 'git grep <pattern>',
        category: 'git'
    },
    {
        command: 'jules git worktree list',
        description: 'List details of each worktree.',
        usage: 'git worktree list',
        category: 'advanced-git'
    },
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
    }
];
