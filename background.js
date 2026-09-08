/**
 * Ask ChatGPT Chrome Extension - Background Service Worker (Manifest V3)
 * 
 * Handles right-click menu selection and opens ChatGPT tab with auto-submit instructions.
 */

// Register the context menu on install or update
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ask-chatgpt-menu-item",
    title: "Ask ChatGPT",
    contexts: ["selection"]
  });
});

// When user clicks "Ask ChatGPT" in the right-click menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "ask-chatgpt-menu-item" && info.selectionText) {
    const selectedText = info.selectionText.trim();
    if (!selectedText) return;

    // Save prompt to storage so the injector script can read it securely
    await chrome.storage.local.set({
      pendingPrompt: selectedText,
      timestamp: Date.now()
    });

    // Open ChatGPT tab with query param indicator
    chrome.tabs.create({
      url: `https://chatgpt.com/?auto_ask=1`
    });
  }
});
