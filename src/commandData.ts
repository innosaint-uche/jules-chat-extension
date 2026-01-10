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
        command: 'jules auth check',
        description: 'Verify current authentication status.',
        category: 'auth',
        actionId: 'status'
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
        description: 'Download code changes from a session to your local files.',
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
        command: 'jules git diff',
        description: 'Show changes between commits, commit and working tree, etc.',
        usage: 'git diff',
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
