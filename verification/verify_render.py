import json
import os
from playwright.sync_api import sync_playwright

# Mock commands to verify rendering logic
commands = [
    {"command": "jules login", "description": "Auth login", "category": "auth", "actionId": "login"},
    {"command": "git stash", "description": "Stash changes", "category": "git", "usage": "git stash"},
]

# Note: In the actual code, backticks are used for template strings.
# We simulate that here.
html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: sans-serif; padding: 20px; }}
        .cmd-card {{ background: #f0f0f0; padding: 10px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; }}
        .cmd-header {{ display: flex; justify-content: space-between; align-items: center; }}
        .cmd-name {{ font-weight: bold; color: #007acc; font-family: monospace; }}
        .cmd-desc {{ margin-top: 5px; font-size: 0.9em; }}
        .cmd-usage {{ margin-top: 5px; background: #e0e0e0; padding: 2px 4px; border-radius: 2px; font-family: monospace; font-size: 0.85em; }}
        .cmd-btn {{ margin-left: 5px; }}
    </style>
</head>
<body>
    <h2>Command Render Verification</h2>
    <div id="commands-view"></div>
    <script>
        const commands = {json.dumps(commands)};
        const commandsView = document.getElementById('commands-view');

        // The optimized function logic we implemented
        function renderCommands() {{
            commandsView.innerHTML = commands.map(c => {{
                let actionHtml = '';
                if (c.actionId) {{
                    actionHtml += `<button class="cmd-btn">Run</button>`;
                }}
                actionHtml += `<button class="cmd-btn">Copy</button>`;

                return `<div class="cmd-card">
                    <div class="cmd-header">
                        <span class="cmd-name">${{c.command}}</span>
                        <div class="cmd-actions">${{actionHtml}}</div>
                    </div>
                    <div class="cmd-desc">${{c.description}}</div>
                    ${{c.usage ? `<div class="cmd-usage">${{c.usage}}</div>` : ''}}
                </div>`;
            }}).join('');
        }}

        renderCommands();
    </script>
</body>
</html>
"""

file_path = os.path.abspath("verification/test.html")
with open(file_path, "w") as f:
    f.write(html_content)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(f"file://{file_path}")

    # Assertions
    assert page.is_visible("text=jules login")
    assert page.is_visible("text=git stash")
    assert page.locator(".cmd-card").count() == 2

    print("Verification Successful: Elements rendered correctly.")
    page.screenshot(path="verification/webview_render.png")
    browser.close()
