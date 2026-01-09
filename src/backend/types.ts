export interface ChatMessage {
    sender: 'user' | 'jules' | 'system';
    text: string;
    buttons?: { label: string, cmd: string }[];
}

export interface ChatSession {
    id: string;
    title: string;
    timestamp: number;
    messages: ChatMessage[];
    /** The remote session ID from the Jules API (e.g., 'sessions/1234') */
    remoteId?: string;
    /** The number of activities already processed for this session */
    lastActivityCount?: number;
    /** The IDs of activities already processed to prevent duplicates */
    processedActivityIds?: string[];
}

export type JulesAuthStatus = 'signed-in' | 'signed-out' | 'cli-missing' | 'key-missing' | 'unknown';

export interface JulesBackend {
    /**
     * Checks the current authentication status.
     * CLI: Checks `jules remote list` or login status.
     * API: Checks if API key is present in secrets.
     */
    checkAuth(cwd: string): Promise<JulesAuthStatus>;

    /**
     * Initiates the login flow.
     * CLI: Runs `jules login`.
     * API: Prompts user to input API Key.
     */
    login(cwd: string): Promise<void>;

    /**
     * Initiates the logout flow.
     * CLI: Runs `jules logout`.
     * API: Clears the stored API Key.
     */
    logout(cwd: string): Promise<void>;

    /**
     * Sends a message to the backend.
     * CLI: Spawns `jules remote new` or similar process.
     * API: Sends HTTP request.
     */
    sendMessage(session: ChatSession, message: string, cwd: string): Promise<void>;

    /**
     * Retrieves status or history.
     * CLI: Can be used to run `jules remote list`.
     * API: Polls for activities.
     */
    refreshSession?(session: ChatSession): Promise<void>;
}
