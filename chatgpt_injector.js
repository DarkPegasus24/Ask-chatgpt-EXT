/**
 * Ask ChatGPT Chrome Extension - ChatGPT Injector Script
 * 
 * Runs on https://chatgpt.com/ and https://chat.openai.com/
 * Automatically inputs the prompt into the ChatGPT chatbox and submits it (simulates Enter/Click Send).
 *
 * FIX (v1.2): Old version used a fixed setInterval (max ~15s) to wait for the
 * ChatGPT input box to appear, and a fixed 300ms delay before clicking Send.
 * On slow connections / cold page loads this caused the paste to silently
 * fail or take too long. This version:
 *   - Uses a MutationObserver so it reacts the instant the input box mounts,
 *     with a much longer safety timeout (30s) as backup.
 *   - Polls for the Send button to actually become enabled before clicking,
 *     instead of guessing a fixed delay.
 *   - Falls back to copying the text to clipboard + showing an on-screen
 *     toast ("Paste manually with Ctrl+V") if auto-fill still fails, so the
 *     user is never left stuck with nothing happening.
 */

(async () => {
  // Check if there is a pending prompt in storage
  const data = await chrome.storage.local.get(["pendingPrompt", "timestamp"]);
  if (!data || !data.pendingPrompt) return;

  // Ignore prompts older than 2 minutes to prevent stale submissions
  const isRecent = data.timestamp && (Date.now() - data.timestamp < 120000);
  if (!isRecent) {
    chrome.storage.local.remove(["pendingPrompt", "timestamp"]);
    return;
  }

  const promptText = data.pendingPrompt;

  // Clear storage immediately so future reloads won't trigger re-submission
  await chrome.storage.local.remove(["pendingPrompt", "timestamp"]);

  // Clean URL if it has auto_ask query param
  if (window.location.search.includes("auto_ask")) {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState(null, "", cleanUrl);
  }

  console.log("[Ask ChatGPT Extension] Auto-filling prompt:", promptText.substring(0, 40) + "...");

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
   *
   * IMPORTANT: This must ONLY ever match the actual send/submit button.
   * The old version had a broad fallback (`form button:not([disabled])`)
   * that could accidentally match the mic/voice-mode button (which sits
   * where the send button will appear, and is enabled even when the send
   * button is still disabled). Clicking that button "succeeds" silently
   * but never sends the message - which is why Enter/submit appeared to
   * do nothing. So we now ONLY match buttons that clearly identify
   * themselves as the send button, via data-testid or aria-label.
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
   * Shows a small toast in the corner of the screen (used only for the
   * clipboard-fallback path, when auto-fill/auto-submit couldn't complete).
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
      padding: "12px 16px",
      borderRadius: "8px",
      fontFamily: "sans-serif",
      fontSize: "14px",
      zIndex: 2147483647,
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      maxWidth: "300px"
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
      console.warn("[Ask ChatGPT Extension] Clipboard fallback also failed:", e);
    }
  }

  /**
   * Waits until the Send button exists AND is enabled (not disabled),
   * polling instead of guessing a fixed delay. Resolves with the button,
   * or null if it times out.
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
          resolve(btn || null); // return whatever we have, even if still disabled
          return;
        }
        setTimeout(check, 150);
      };
      check();
    });
  }

  /**
   * Returns true if the prompt box is now empty (a good signal that the
   * message was actually sent, since ChatGPT clears the input on submit).
   */
  function isInputCleared(element) {
    const text =
      element.tagName.toLowerCase() === "textarea"
        ? element.value
        : element.textContent;
    return text.trim().length === 0;
  }

  /**
   * Dispatches a full, realistic Enter keypress (keydown + keypress + keyup)
   * on the given element. ChatGPT's submit-on-Enter handler listens for
   * keydown, but sending all three makes this behave like a real keystroke
   * and is more reliable across UI versions.
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
   * Submits the prompt by clicking the Send button (after waiting for it to
   * be enabled), then VERIFIES the message actually went through by
   * checking whether the input box got cleared. If not, it retries with a
   * real Enter keypress. If that also fails, it falls back to copying the
   * text to the clipboard so the user can paste + hit Enter manually.
   */
  async function submitPrompt(element, originalText) {
    // Attempt 1: click the (verified) send button
    const sendButton = await waitForSendButtonEnabled(5000);
    if (sendButton && !sendButton.disabled) {
      sendButton.click();
      console.log("[Ask ChatGPT Extension] Clicked send button!");
    }

    await new Promise((r) => setTimeout(r, 500));
    if (isInputCleared(element)) {
      console.log("[Ask ChatGPT Extension] Message sent successfully (click).");
      return true;
    }

    // Attempt 2: real Enter keypress sequence
    dispatchRealEnterKey(element);
    console.log("[Ask ChatGPT Extension] Dispatched Enter key sequence (fallback).");

    await new Promise((r) => setTimeout(r, 500));
    if (isInputCleared(element)) {
      console.log("[Ask ChatGPT Extension] Message sent successfully (Enter key).");
      return true;
    }

    // Attempt 3: give it one more short window in case send button was
    // still finishing enabling, then try clicking again.
    const retryButton = await waitForSendButtonEnabled(3000);
    if (retryButton && !retryButton.disabled) {
      retryButton.click();
      await new Promise((r) => setTimeout(r, 500));
      if (isInputCleared(element)) {
        console.log("[Ask ChatGPT Extension] Message sent successfully (retry click).");
        return true;
      }
    }

    // Everything failed - text is still typed in the box, but not sent.
    // Let the user know they just need to press Enter themselves.
    console.warn("[Ask ChatGPT Extension] Could not auto-submit. Text is in the box, waiting for manual Enter.");
    showFallbackToast("Text is ready in the box - press Enter to send it.");
    return false;
  }

  /**
   * Waits for the ChatGPT prompt input box to mount in the DOM.
   * Uses MutationObserver (reacts instantly) with a generous 30s safety
   * timeout as backup for very slow page loads.
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
    console.warn("[Ask ChatGPT Extension] Timeout waiting for ChatGPT prompt box.");
    await copyToClipboardFallback(promptText);
    return;
  }

  // Small delay to let React fully mount/hydrate the element before typing
  await new Promise((r) => setTimeout(r, 400));

  insertPrompt(promptElement, promptText);

  // Verify the text actually landed; if not, use clipboard fallback
  const textLanded =
    promptElement.tagName.toLowerCase() === "textarea"
      ? promptElement.value.trim().length > 0
      : promptElement.textContent.trim().length > 0;

  if (!textLanded) {
    console.warn("[Ask ChatGPT Extension] Insert failed, falling back to clipboard.");
    await copyToClipboardFallback(promptText);
    return;
  }

  await submitPrompt(promptElement, promptText);
})();
