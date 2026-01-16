import subprocess
import json
import re
import os
from playwright.sync_api import sync_playwright

def get_commands():
    result = subprocess.run(['node', 'verification/get_commands.js'], capture_output=True, text=True)
    return result.stdout.strip()

def get_html_template():
    with open('src/extension.ts', 'r') as f:
        content = f.read()
    match = re.search(r'return `(<!DOCTYPE html>[\s\S]*?)`;', content)
    return match.group(1)

def create_html(commands_json, template):
    html = template.replace('${cmdList}', commands_json)

    # Mock acquireVsCodeApi
    mock_api = """
    <script>
    function acquireVsCodeApi() {
        return {
            postMessage: function(msg) { console.log('postMessage:', msg); },
            setState: function(state) { console.log('setState:', state); },
            getState: function() { return {}; }
        };
    }
    </script>
    """
    html = html.replace('<head>', '<head>\n' + mock_api)
    return html

def main():
    print("Getting commands...")
    commands_json = get_commands()
    template = get_html_template()
    html = create_html(commands_json, template)

    with open('verification/index.html', 'w') as f:
        f.write(html)

    print("Verifying with Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto('file://' + os.path.abspath('verification/index.html'))

        print("Page loaded.")

        # Check if tab exists
        if page.is_visible("text=CLI COMMANDS"):
            print("Tab found, clicking...")
            page.click("text=CLI COMMANDS")
            page.wait_for_timeout(1000) # Wait for animation/render
        else:
            print("Tab NOT found!")

        # Check content
        content = page.content()
        if "jules git rebase" in content:
            print("Verified: 'jules git rebase' is in DOM.")
        else:
            print("Error: 'jules git rebase' NOT in DOM.")

        # Take screenshot
        page.screenshot(path='verification/commands.png', full_page=True)
        print("Screenshot saved to verification/commands.png")
        browser.close()

if __name__ == "__main__":
    main()
