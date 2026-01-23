
const fs = require('fs');
const path = require('path');
const { CLI_COMMANDS } = require('../out/commandData');

const commands = CLI_COMMANDS;
const cmdList = JSON.stringify(commands);

// Copied and adapted from src/extension.ts
const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            --bg: #1e1e1e;
            --text: #cccccc;
            --user-bg: #0e639c;
            --user-text: #ffffff;
            --jules-bg: #252526;
            --input-bg: #3c3c3c;
            --border: #454545;
            --vscode-button-secondaryBackground: #3a3d41;
            --vscode-button-secondaryForeground: #ffffff;
            --vscode-descriptionForeground: #8b949e;
            --vscode-textLink-foreground: #3794ff;
        }
        body { font-family: sans-serif; padding: 0; margin: 0; background: var(--bg); color: var(--text); display: flex; flex-direction: column; height: 100vh; }

        /* VIEWS */
        .view { display: none; flex-direction: column; height: 100%; }
        .view.active { display: flex; }

        /* TABS */
        .tab-bar { display: flex; border-bottom: 1px solid var(--border); background: var(--jules-bg); }
        .tab { flex: 1; padding: 10px; text-align: center; cursor: pointer; border-bottom: 2px solid transparent; font-size: 12px; font-weight: 600; opacity: 0.7; }
        .tab.active { border-bottom-color: var(--user-bg); opacity: 1; }
        .tab:hover { opacity: 1; }

        /* COMMANDS LIST VIEW */
        #commands-view { padding: 10px; overflow-y: auto; }
        .cmd-card { background: var(--jules-bg); border-radius: 6px; padding: 10px; margin-bottom: 8px; border: 1px solid var(--border); }
        .cmd-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .cmd-name { font-family: monospace; font-weight: bold; color: var(--vscode-textLink-foreground); }
        .cmd-desc { font-size: 12px; color: var(--text); margin-bottom: 6px; }
        .cmd-usage { font-family: monospace; font-size: 10px; background: var(--input-bg); padding: 4px; border-radius: 4px; color: var(--vscode-descriptionForeground); word-break: break-all; }
        .cmd-actions { display: flex; gap: 8px; margin-top: 8px; }
        .cmd-btn { padding: 2px 8px; font-size: 11px; cursor: pointer; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 2px; }
    </style>
</head>
<body>
    <div id="tab-bar" class="tab-bar">
        <div class="tab" onclick="switchTab('sessions')">TASKS</div>
        <div class="tab active" onclick="switchTab('commands')">CLI COMMANDS</div>
    </div>

    <div id="commands-view" class="view active">
        <!-- Commands injected here -->
    </div>

    <script>
        const commands = ${cmdList};
        const commandsView = document.getElementById('commands-view');

        function renderCommands() {
            commandsView.innerHTML = '';
            commands.forEach(c => {
                const div = document.createElement('div');
                div.className = 'cmd-card';
                let actionHtml = '';
                if (c.actionId) {
                    actionHtml += \`<button class="cmd-btn">Run</button>\`;
                }
                actionHtml += \`<button class="cmd-btn">Copy</button>\`;

                div.innerHTML = \`
                    <div class="cmd-header">
                        <span class="cmd-name">\${c.command}</span>
                        <div class="cmd-actions">\${actionHtml}</div>
                    </div>
                    <div class="cmd-desc">\${c.description}</div>
                    \${c.usage ? \`<div class="cmd-usage">\${c.usage}</div>\` : ''}
                \`;
                commandsView.appendChild(div);
            });
        }
        renderCommands();
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('HTML generated at verification/index.html');
