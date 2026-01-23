
import os
from playwright.sync_api import sync_playwright

def verify_commands_render():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        file_path = os.path.abspath('verification/index.html')
        print(f"Loading {file_path}")
        page.goto('file://' + file_path)

        # Verify content
        assert "CLI COMMANDS" in page.content()
        assert "jules git stash pop" in page.content() # Verify one of the new commands

        page.screenshot(path='verification/commands_verification.png', full_page=True)
        print("Screenshot saved to verification/commands_verification.png")

if __name__ == "__main__":
    verify_commands_render()
