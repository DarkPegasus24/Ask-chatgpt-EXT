# Ask AI Chrome Extension (v1.2.0)

A powerful, friction-free browser extension that lets you highlight any text on a webpage, right-click it, and send tailored, formatted prompts directly to ChatGPT. It opens a tab, automatically pastes your prompt, and hits send for you.

## What it does

- **Right-Click Context Menu**: Highlights text on any webpage and presents smart AI presets.
- **Smart Prompt Presets**:
  - 💬 **Ask Directly**: Sends the raw highlighted text directly.
  - 📝 **Summarize**: Formats the prompt to extract key takeaways and concise bullet points.
  - 💡 **Explain Simply (ELI5)**: Formats the prompt to break down complex jargon with simple analogies.
  - 🛠️ **Fix / Explain Code**: Wraps code in markdown fences and prompts AI to identify bugs, bottlenecks, and fixes.
  - 🌐 **Translate to English**: Formats prompt for clear, natural English translation.
  - 🔍 **Fact-Check Claim**: Formats prompt to critically evaluate accuracy and detect biases.
  - 📌 **Include Page Context**: Prepends the current page's Title and Source URL so ChatGPT understands where the text came from.
- **Auto-Submit & Fallback**: Automatically clicks ChatGPT's send button or sends an Enter sequence, with a safety clipboard fallback if needed.
- **Interactive Test Suite**: Includes a dedicated testing lab (`test.html`) to test every single preset and inspect live storage changes.

## Files included

- `manifest.json`: Extension configuration file (Manifest V3).
- `background.js`: Background service worker managing context submenus, page metadata, and prompt dispatching.
- `chatgpt_injector.js`: Content script that detects ChatGPT input fields, injects text, and triggers submission.
- `test.html` & `test.js`: Interactive testing lab with live storage inspector and sample test cases.
- `icon16.png`, `icon48.png`, `icon128.png`, `icon.png`: Extension icons.

## How to install and test in Chrome

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle on the **"Developer mode"** switch in the top-right corner.
3. Click the **"Load unpacked"** button in the top-left area.
4. Select this project folder (`Ask AI`).
5. To test the features:
   - Right-click anywhere on any page and select **"🧪 Open Ask AI Test Suite"** (or load `chrome-extension://<id>/test.html`).
   - Use the sample cards on the test page, right-click, and try out each preset!
