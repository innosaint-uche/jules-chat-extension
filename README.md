# Google Jules Chat for VS Code (Unofficial)

Transform Visual Studio Code into an autonomous engineering department.

This extension integrates Google Jules, the advanced asynchronous coding agent, directly into your IDE. It goes beyond simple "autocomplete" by offering a multi-agent system where specialized AI personas handle specific engineering domains—from security audits to performance optimization—all managed via a seamless chat interface.

![Jules Chat Extension](https://img.shields.io/badge/VS%20Code%20Extension-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)

## 🚀 Why Use Jules Chat?

Unlike standard AI coding assistants that simply predict the next line of code, Jules Chat acts as a project manager for autonomous cloud agents. You assign a high-level task, and specialized agents execute it asynchronously, managing their own files, running tests, and creating Pull Requests.

### Key Benefits

- **Context-Aware Automation**: Agents understand your entire repository structure
- **Asynchronous Execution**: Fire off a refactoring task and keep coding while Jules works in the background
- **Specialized Expertise**: Don't just "ask AI"—deploy a security expert or a UX designer specifically
- **Integrated Git Ops**: Manage local and remote repositories without touching the terminal

## 🧠 Meet Your New AI Team (Agent Skills)

This extension implements a Skill-Based Agent System. Instead of generic prompts, you interact with disciplined, single-responsibility agents.

| Agent | Name | Icon | Mission & Responsibility |
|-------|------|------|---------------------------|
| Performance | Bolt | ⚡ | Obsessed with speed. Implements measurable performance improvements. Runs benchmarks before and after changes. Never optimizes prematurely. |
| Design & UX | Palette | 🎨 | Guardian of usability. Delivers micro-UX improvements, ensures accessibility (ARIA), and polishes UI using existing design tokens. |
| Security | Sentinel | 🛡️ | Defender of the codebase. Audits for vulnerabilities, sanitizes inputs, and implements defense-in-depth strategies. |
| Testing | Probe | 🧪 | Breaker of assumptions. Writes comprehensive unit and integration tests. Focuses on edge cases and failure paths. |
| Debugging | Tracer | 🧯 | Root cause analyst. Reads logs and stack traces to identify bugs and suggest minimal, non-destructive fixes. |
| Refactoring | Refine | ♻️ | Code structure architect. Improves readability and modularity with zero behavior change. |
| Code Review | Lens | 👀 | The gatekeeper. Strict logic checks, style guide enforcement, and security smell detection before human review. |
| Code Gen | Forge | 🧑‍💻 | The builder. Generates boilerplate, components, and utilities following strict project patterns. |

## ✨ Features

### 1. Interactive Command Dashboard

No need to memorize CLI flags. The extension provides a visual dashboard to:

- Launch specific agents with one click
- Check the status of active sessions
- Manage local Git repositories

### 2. Built-in Git Operations (Git Ops)

Manage your version control directly from the chat window without context switching:

- **Init**: Initialize new repositories
- **Status**: View changed files and branch status
- **Pull/Push**: Sync with remote repositories seamlessly

### 3. Smart Context Detection

The chat interface is context-aware. Type "Hi" or "Help" to get suggested actions, or type "fix the login bug" to automatically dispatch the correct agent for the job.

## 🛠️ Installation & Setup

### Prerequisites

- **Node.js**: (v18 or higher recommended)
- **Google Jules CLI**: This extension wraps the official CLI

```bash
npm install -g @google/jules
```

> **Note**: Mac/Linux users may need to run with `sudo` if you encounter EACCES errors

### Authentication

Run this command in your terminal once to link your Google account:

```bash
jules login
```

If you're not signed in, the chat UI will prompt you with the exact command to run.
You can also click **Sign In** in the chat to launch the browser-based login flow.
If login ever gets stuck, click **Sign Out** (or run `jules logout`) and sign in again.

### First Run Prompts

When you open the Jules sidebar for the first time, you'll see a quick-start message
with install and login steps. If you ever see a message like "CLI not found" or
"Not signed in", run:

```bash
npm install -g @google/jules
jules login
```

### Install the Extension

1. Search for "Jules Chat" in the VS Code Marketplace
2. Click Install
3. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and type "Jules: Open Chat"
4. Or click the robot icon in the sidebar

### Packaging (VSIX)

If you want a local installable file, use the official packager:

```bash
npm install -g @vscode/vsce
vsce package
```

Or without a global install:

```bash
npx @vscode/vsce package
```

This creates a `.vsix` file you can install via "Install from VSIX" in VS Code.

## 📖 How to Use

### Starting a Task

1. Open the Jules sidebar
2. Click a Skill Card (e.g., "⚡ Speed" to invoke Bolt) OR type your task directly
3. Example: "Refactor the auth middleware to reduce cognitive complexity"
4. Jules will confirm the task and start a cloud session
5. Type `help` any time to see available commands

### Managing Code

- **Check Status**: Click the "Status" chip or type `status` to see a table of all active jobs
- **Download Changes**: When a job is marked "Completed," type `pull <session-id>` to apply the changes to your local files

## ❓ FAQ (Optimized for Search)

**Q: Is this an official Google product?**
A: No, this is an open-source, community-maintained wrapper for the Google Jules CLI. It is not officially endorsed by Google.

**Q: Does Jules read my code?**
A: Jules processes code within the context of the directory you invoke it in. Ensure you have the necessary permissions for the repositories you are working on.

**Q: Can I use this for local-only projects?**
A: Yes! While Jules uses cloud agents for heavy lifting, the Git Ops features and local file management work on any directory on your machine.

## 📄 License & Contributing

- **License**: MIT
- **Repository**: [GitHub Repository](https://github.com/innosaint-uche/jules-chat-extension)

We welcome contributions! Please submit Pull Requests to the GitHub repository to help improve the Jules Chat experience for everyone.

## Keywords

VS Code Extension, Google Jules, AI Coding Agent, Autonomous Developer, Code Refactoring, Automated Testing, Git Integration, Developer Productivity, DevOps, Generative AI for Code.

## Support

If you encounter issues or have questions, please [open an issue](https://github.com/innosaint-uche/jules-chat-extension/issues) on our GitHub repository.
