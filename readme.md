# Ask ChatGPT Chrome Extension

A simple browser extension that lets you highlight any text on a webpage, right-click it, and send it directly to ChatGPT. It opens a new tab, pastes your highlighted text into the input field, and automatically hits send for you.

## What it does

- Adds an "Ask ChatGPT" option to your browser's right-click menu whenever you highlight text.
- Opens ChatGPT in a new tab with your text ready to go.
- Automatically submits the prompt so you do not have to press Enter or click the send button manually.
- Works entirely in the background without injecting unnecessary floating buttons into pages.

## Files included

- manifest.json: Extension configuration file (Manifest V3).
- background.js: Background service worker that sets up the right-click menu and handles tab opening.
- chatgpt_injector.js: Small content script that pastes the text into ChatGPT and triggers the submit action.
- icon16.png, icon48.png, icon128.png, icon.png: Extension icons.

## How to install and use it in Chrome

1. Open Google Chrome and go to chrome://extensions in your address bar.
2. Turn on the "Developer mode" toggle switch in the top-right corner.
3. Click the "Load unpacked" button in the top-left area.
4. Select this project folder (Ask-chatgpt-EXT).
5. Open any website, select a sentence or phrase, right-click, and choose "Ask ChatGPT".
