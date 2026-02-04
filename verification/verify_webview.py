import os
import re
from playwright.sync_api import sync_playwright, expect

def verify_webview():
    # 1. Read Source
    try:
        with open('src/extension.ts', 'r') as f:
            content = f.read()
    except FileNotFoundError:
        print("Error: src/extension.ts not found")
        return

    # 2. Extract Template
    start_marker = "return `<!DOCTYPE html>"
    start_idx = content.find(start_marker)
    if start_idx == -1:
        print("Error: Could not find start of HTML template")
        return

    start_idx += len("return `")

    # Find the end of the template
    html_end_marker = "</html>"
    html_end_idx = content.find(html_end_marker, start_idx)
    if html_end_idx == -1:
         print("Error: Could not find </html>")
         return

    # The backtick should be shortly after
    end_idx = content.find("`;", html_end_idx)

    html_template = content[start_idx:end_idx]

    # 3. Unescape
    # The source has `\` ` for nested backticks. We need `` ` ``.
    html_template = html_template.replace(r"\`", "`")
    html_template = html_template.replace(r"\${", "${")

    # 4. Inject Data & Mock
    cmd_list = '''[
        {"command": "jules git status", "description": "Show the working tree status.", "usage": "git status", "category": "git"},
        {"command": "jules login", "description": "Authenticate the CLI.", "category": "auth", "actionId": "login"},
        {"command": "jules git stash pop", "description": "Apply stash.", "usage": "git stash pop", "category": "git"}
    ]'''

    html_template = html_template.replace("${cmdList}", cmd_list)
    html_template = html_template.replace("const vscode = acquireVsCodeApi();", "const vscode = { postMessage: (msg) => console.log('VSCode Msg:', msg) };")

    # 5. Write HTML
    out_path = os.path.join(os.getcwd(), 'verification', 'index.html')
    with open(out_path, 'w') as f:
        f.write(html_template)

    print(f"Generated test HTML at {out_path}")

    # 6. Playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"file://{out_path}")

        # Verify
        print("Verifying page content...")

        # Check if tab exists and click it (to ensure view is active)
        # Note: The CSS sets #commands-view display:none by default until tab switch?
        # Let's check the CSS in the extracted HTML.
        # .view { display: none; } .view.active { display: flex; }
        # #session-list-view is active by default.
        # We need to click "CLI COMMANDS".

        page.locator("#tab-commands").click()

        # Check commands
        # We expect 3 cards
        count = page.locator(".cmd-card").count()
        print(f"Found {count} command cards.")
        if count != 3:
            print("FAILED: Expected 3 command cards.")
            browser.close()
            exit(1)

        # Check specific text
        expect(page.get_by_text("jules git status")).to_be_visible()
        expect(page.get_by_text("Show the working tree status.")).to_be_visible()

        # Screenshot
        screenshot_path = os.path.join(os.getcwd(), 'verification', 'webview.png')
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")
        browser.close()

if __name__ == "__main__":
    verify_webview()
