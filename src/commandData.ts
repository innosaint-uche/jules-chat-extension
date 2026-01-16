export interface CommandDefinition {
    command: string;
    description: string;
    usage?: string;
    category: 'auth' | 'session' | 'git' | 'config' | 'misc';
    actionId?: string; // If we can trigger it directly
}

export const CLI_COMMANDS: CommandDefinition[] = [
    // --- AUTHENTICATION ---
    {
        command: 'jules login',
        description: 'Authenticate the CLI with your Google account.',
        category: 'auth',
        actionId: 'login'
    },
    {
        command: 'jules logout',
        description: 'Sign out and remove local credentials.',
        category: 'auth',
        actionId: 'logout'
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
        description: 'Start a new chat session with the agent.',
        usage: 'jules remote new --repo <owner/repo> --session "Your prompt"',
        category: 'session'
    },
    {
        command: 'jules remote list',
        description: 'List active sessions and their status.',
        usage: 'jules remote list --session',
        category: 'session',
        actionId: 'status'
    },
    {
        command: 'jules remote list --repo',
        description: 'List configured repository sources.',
        usage: 'jules remote list --repo',
        category: 'session',
        actionId: 'remote-list-repo'
    },
    {
        command: 'jules remote pull',
        description: 'Download code changes from a session to your local files.',
        usage: 'jules remote pull --session <session-id>',
        category: 'session',
        actionId: 'remote-pull'
    },
    {
        command: 'jules remote delete',
        description: 'Delete a specific session.',
        usage: 'jules remote delete --session <session-id>',
        category: 'session'
    },
    {
        command: 'jules remote resume',
        description: 'Resume an existing session context.',
        usage: 'jules remote resume --session <session-id>',
        category: 'session'
    },

    // --- CONFIGURATION ---
    {
        command: 'jules config list',
        description: 'List all current configuration settings.',
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

    // --- GIT OPERATIONS (Core) ---
    {
        command: 'jules git init',
        description: 'Initialize a new git repository.',
        usage: 'git init',
        category: 'git'
    },
    {
        command: 'jules git clone',
        description: 'Clone a repository into a new directory.',
        usage: 'git clone <repository>',
        category: 'git'
    },
    {
        command: 'jules git config',
        description: 'Get and set repository or global options.',
        usage: 'git config --list',
        category: 'git'
    },
    {
        command: 'jules git remote',
        description: 'Manage set of tracked repositories.',
        usage: 'git remote -v',
        category: 'git'
    },

    // --- GIT OPERATIONS (Basic Snapshotting) ---
    {
        command: 'jules git status',
        description: 'Show the working tree status.',
        usage: 'git status',
        category: 'git'
    },
    {
        command: 'jules git add',
        description: 'Add file contents to the index.',
        usage: 'git add <pathspec>',
        category: 'git'
    },
    {
        command: 'jules git commit',
        description: 'Record changes to the repository.',
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
        description: 'List, create, or delete branches.',
        usage: 'git branch',
        category: 'git'
    },
    {
        command: 'jules git checkout',
        description: 'Switch branches or restore working tree files.',
        usage: 'git checkout <branch>',
        category: 'git'
    },
    {
        command: 'jules git switch',
        description: 'Switch branches (newer alternative to checkout).',
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
        command: 'jules git show',
        description: 'Show various types of objects.',
        usage: 'git show <commit>',
        category: 'git'
    },
    {
        command: 'jules git blame',
        description: 'Show what revision and author last modified each line of a file.',
        usage: 'git blame <file>',
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
        description: 'Apply the stashed changes and remove from stash list.',
        usage: 'git stash pop',
        category: 'git'
    },

    // --- GIT OPERATIONS (Sharing & Updating) ---
    {
        command: 'jules git fetch',
        description: 'Download objects and refs from another repository.',
        usage: 'git fetch',
        category: 'git'
    },
    {
        command: 'jules git config',
        description: 'Get and set repository or global options.',
        usage: 'git config --global user.name "John Doe"',
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
    }
];
