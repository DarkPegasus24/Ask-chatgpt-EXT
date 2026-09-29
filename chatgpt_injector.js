/**
 * Ask AI Chrome Extension - ChatGPT Injector Script
 * 
 * Runs on https://chatgpt.com/ and https://chat.openai.com/
 * Automatically inputs the formatted prompt into the ChatGPT chatbox and submits it.
 */

(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const askId = urlParams.get("ask_id");
  let promptText = null;

  // 1. First attempt: check for session-specific prompt using ask_id
  if (askId) {
    const storageKey = `pendingPrompt_${askId}`;
    const storageItem = await chrome.storage.local.get([storageKey]);
    if (storageItem && storageItem[storageKey]) {
      const data = storageItem[storageKey];
      if (data.timestamp && Date.now() - data.timestamp < 120000) {
        promptText = data.text;
      }
      await chrome.storage.local.remove([storageKey]);
    }
  }

  // 2. Fallback: check standard pendingPrompt storage key
  if (!promptText) {
    const data = await chrome.storage.local.get(["pendingPrompt", "timestamp"]);
    if (data && data.pendingPrompt) {
      const isRecent = data.timestamp && (Date.now() - data.timestamp < 120000);
      if (isRecent) {
        promptText = data.pendingPrompt;
      }
      await chrome.storage.local.remove(["pendingPrompt", "timestamp"]);
    }
  }

  // If no valid recent prompt, exit silently
  if (!promptText) return;

  // Clean URL query parameters so page reloads don't re-trigger injection
  if (window.location.search.includes("auto_ask")) {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState(null, "", cleanUrl);
  }

  console.log("[Ask AI Extension] Auto-filling prompt:", promptText.substring(0, 50) + "...");

  /**
   * Helper to find the ChatGPT prompt input element
   */
  function findPromptElement() {
    return (
      document.querySelector("#prompt-textarea") ||
      document.querySelector('div[contenteditable="true"][data-placeholder]') ||
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector("textarea[data-id='root']") ||
      document.querySelector("textarea")
    );
  }

  /**
   * Helper to find the ChatGPT send/submit button.
   */
  function findSendButton() {
    const candidates = [
      document.querySelector('button[data-testid="send-button"]'),
      document.querySelector('button[data-testid="fruitjuice-send-button"]'),
      document.querySelector('button[aria-label="Send prompt"]'),
      document.querySelector('button[aria-label="Send message"]'),
      document.querySelector('button[aria-label*="Send" i]'),
      document.querySelector('button[data-testid*="send" i]')
    ];
    return candidates.find(Boolean) || null;
  }

  /**
   * Inserts text into the prompt box and triggers React/DOM events
   */
  function insertPrompt(element, text) {
    element.focus();

    if (element.tagName.toLowerCase() === "textarea") {
      element.value = text;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // ContentEditable div (modern ChatGPT)
      element.innerHTML = "";

      const success = document.execCommand("insertText", false, text);

      if (!success || !element.textContent.trim()) {
        element.textContent = text;
        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }

  /**
   * Shows a small toast in the corner of the screen
   */
  function showFallbackToast(message) {
    const toast = document.createElement("div");
    toast.textContent = message;
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      background: "#1f2937",
      color: "#fff",
      padding: "12px 18px",
      borderRadius: "8px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "14px",
      fontWeight: "500",
      zIndex: 2147483647,
      boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
      maxWidth: "340px",
      border: "1px solid #374151"
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }

  /**
   * Copies text to clipboard as a last-resort fallback.
   */
  async function copyToClipboardFallback(text) {
    try {
      await navigator.clipboard.writeText(text);
      showFallbackToast("Couldn't auto-fill ChatGPT. Your text is copied — press Ctrl+V to paste it.");
    } catch (e) {
      console.warn("[Ask AI Extension] Clipboard fallback failed:", e);
    }
  }

  /**
   * Waits until the Send button exists AND is enabled
   */
  function waitForSendButtonEnabled(timeoutMs = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const btn = findSendButton();
        if (btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
          resolve(btn);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          resolve(btn || null);
          return;
        }
        setTimeout(check, 150);
      };
      check();
    });
  }

  /**
   * Returns true if the prompt box is now empty
   */
  function isInputCleared(element) {
    const text =
      element.tagName.toLowerCase() === "textarea"
        ? element.value
        : element.textContent;
    return text.trim().length === 0;
  }

  /**
   * Dispatches Enter key sequence
   */
  function dispatchRealEnterKey(element) {
    const eventInit = {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true
    };
    element.dispatchEvent(new KeyboardEvent("keydown", eventInit));
    element.dispatchEvent(new KeyboardEvent("keypress", eventInit));
    element.dispatchEvent(new KeyboardEvent("keyup", eventInit));
  }

  /**
   * Submits the prompt
   */
  async function submitPrompt(element, originalText) {
    // Attempt 1: click the (verified) send button
    const sendButton = await waitForSendButtonEnabled(5000);
    if (sendButton && !sendButton.disabled) {
      sendButton.click();
      console.log("[Ask AI Extension] Clicked send button!");
    }

    await new Promise((r) => setTimeout(r, 500));
    if (isInputCleared(element)) {
      console.log("[Ask AI Extension] Message sent successfully (click).");
      return true;
    }

    // Attempt 2: real Enter keypress sequence
    dispatchRealEnterKey(element);
    console.log("[Ask AI Extension] Dispatched Enter key sequence (fallback).");

    await new Promise((r) => setTimeout(r, 500));
    if (isInputCleared(element)) {
      console.log("[Ask AI Extension] Message sent successfully (Enter key).");
      return true;
    }

    // Attempt 3: retry send button click
    const retryButton = await waitForSendButtonEnabled(3000);
    if (retryButton && !retryButton.disabled) {
      retryButton.click();
      await new Promise((r) => setTimeout(r, 500));
      if (isInputCleared(element)) {
        console.log("[Ask AI Extension] Message sent successfully (retry click).");
        return true;
      }
    }

    // Fallback: leave text typed and inform user
    console.warn("[Ask AI Extension] Prompt typed into box. Press Enter to submit.");
    showFallbackToast("Prompt ready in box! Press Enter to send.");
    return false;
  }

  /**
   * Waits for the ChatGPT prompt input box to mount
   */
  function waitForPromptElement(timeoutMs = 30000) {
    return new Promise((resolve) => {
      const existing = findPromptElement();
      if (existing) {
        resolve(existing);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = findPromptElement();
        if (el) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      });

      observer.observe(document.documentElement, { childList: true, subtree: true });

      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeoutMs);
    });
  }

  const promptElement = await waitForPromptElement(30000);

  if (!promptElement) {
    console.warn("[Ask AI Extension] Timeout waiting for ChatGPT prompt box.");
    await copyToClipboardFallback(promptText);
    return;
  }

  // Small delay to let React fully hydrate before typing
  await new Promise((r) => setTimeout(r, 400));

  insertPrompt(promptElement, promptText);

  // Verify insertion
  const textLanded =
    promptElement.tagName.toLowerCase() === "textarea"
      ? promptElement.value.trim().length > 0
      : promptElement.textContent.trim().length > 0;

  if (!textLanded) {
    console.warn("[Ask AI Extension] Insert failed, falling back to clipboard.");
    await copyToClipboardFallback(promptText);
    return;
  }

  await submitPrompt(promptElement, promptText);
})();
