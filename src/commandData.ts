export interface CommandDefinition {
    command: string;
    description: string;
    usage?: string;
    category: 'auth' | 'session' | 'git' | 'misc';
    actionId?: string; // If we can trigger it directly
}

export const CLI_COMMANDS: CommandDefinition[] = [
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
        command: 'jules remote pull',
        description: 'Download code changes from a session to your local files.',
        usage: 'jules remote pull --session <session-id>',
        category: 'session'
    },
    {
        command: 'jules remote list --repo',
        description: 'List available repositories (sources) for the agent.',
        usage: 'jules remote list --repo',
        category: 'session',
        actionId: 'remote-list-repo'
    },
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
        command: 'jules version',
        description: 'Display the installed version of the Jules CLI.',
        category: 'misc'
    },
    {
        command: 'jules help',
        description: 'Show help information for the CLI.',
        category: 'misc'
    },
    {
        command: 'Configure API Key',
        description: 'Manually enter your Jules API Key for direct API mode.',
        category: 'auth',
        actionId: 'apiKey'
    }
];
