# Google Jules Chat for VS Code (Unofficial)

Transform Visual Studio Code into an autonomous engineering department with Google Jules.

This extension integrates Google Jules, the advanced asynchronous coding agent, directly into your IDE. It supports two modes of operation:
1.  **CLI Mode**: Wraps the official `jules` CLI for full local control and interactive sessions.
2.  **API Mode**: Connects directly to the Jules REST API, ideal for environments where installing the CLI is difficult or when you prefer a direct API connection.

![Jules Chat Extension](https://img.shields.io/badge/VS%20Code%20Extension-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 🚀 Features

### Dual Backend Modes
-   **CLI Mode**: Uses your local `jules` installation. Supports interactive login, local git operations, and the full power of the CLI.
-   **API Mode**: Uses your Google Jules API Key. No CLI installation required. perfect for remote environments or restricted machines.

### Interactive Command Center
In CLI mode, access a comprehensive dashboard of Jules commands directly from the sidebar:
-   **Session Management**: List sessions, create new tasks, pull changes.
-   **Repository Management**: List connected repositories.
-   **System Tools**: Check version, view help.

### Agent Skills
Dispatch specialized agents for specific tasks:
-   ⚡ **Bolt** (Performance)
-   🎨 **Palette** (Design/UX)
-   🛡️ **Sentinel** (Security)
-   🧪 **Probe** (Testing)
-   🧯 **Tracer** (Debugging)

## 🛠️ Installation & Setup

### Option 1: CLI Mode (Recommended)

1.  **Install Node.js** (v18 or higher).
2.  **Install the Jules CLI**:
    ```bash
    npm install -g @google/jules
    ```
3.  **Install this Extension**: Search for "Jules Chat" in VS Code.
4.  **Sign In**:
    -   Click the **Sign In** chip in the extension sidebar.
    -   Or click **Login** in the "CLI Tools" dashboard.
    -   Follow the browser prompt to authenticate with Google.

### Option 2: API Mode

1.  **Get your API Key**:
    -   Go to [jules.google/settings](https://jules.google/settings).
    -   Generate a new API Key.
2.  **Configure VS Code**:
    -   Open Settings (`Cmd+,`).
    -   Search for `jules.mode`.
    -   Set it to `api`.
3.  **Set your Key**:
    -   Open the Command Palette (`Cmd+Shift+P`).
    -   Run `Jules: Set API Key`.
    -   Paste your key when prompted.

## 📖 How to Use

### Starting a Task
1.  Open the Jules sidebar.
2.  Click **+ New Task**.
3.  Type your request (e.g., "Refactor the login page to use Material UI").
4.  Jules will start a session. In **CLI Mode**, you can see the command output streaming. In **API Mode**, the extension polls for updates.

### Using the CLI Command Center
When in **CLI Mode**, expand the **Jules CLI Tools** section at the top of the list view.
-   **List Sessions**: See all active and past sessions.
-   **Pull Session**: Download code changes from a completed session to your local files.
-   **Check Version**: Verify your CLI version.

### Git Operations
Click the **Git Ops** skill card to perform quick git actions:
-   Init, Pull, Push, Status.

## ❓ FAQ

**Q: Which mode should I use?**
A: Use **CLI Mode** if you have the CLI installed and want the most robust experience. Use **API Mode** if you cannot install the CLI or prefer managing authentication via an API Key.

**Q: Can I switch modes?**
A: Yes. Change the `jules.mode` setting in VS Code preferences.

**Q: Where is my API Key stored?**
A: It is stored securely in VS Code's native Secret Storage. It is never exposed in plain text files.

## 📄 License

MIT
