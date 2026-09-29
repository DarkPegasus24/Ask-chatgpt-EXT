/**
 * Ask AI - Test Suite Logic (test.js)
 */

document.addEventListener("DOMContentLoaded", () => {
  const inspectorContent = document.getElementById("inspectorContent");
  const refreshStorageBtn = document.getElementById("refreshStorageBtn");
  const clearStorageBtn = document.getElementById("clearStorageBtn");

  /**
   * Helper to select / highlight text inside a node
   */
  function highlightText(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Hook up all "Select Sample Text" buttons
  document.querySelectorAll(".test-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        highlightText(targetEl);
      }
    });
  });

  // Clicking directly on any sample box also highlights it
  document.querySelectorAll(".sample-box").forEach((box) => {
    box.addEventListener("click", () => {
      highlightText(box);
    });
  });

  /**
   * Renders the latest prompt data in the Inspector
   */
  async function updateInspector() {
    if (!chrome?.storage?.local) {
      inspectorContent.innerHTML = `<span style="color:#ef4444;">Storage API not detected. Open this page via Chrome Extension URL.</span>`;
      return;
    }

    try {
      const data = await chrome.storage.local.get(null);
      const lastInfo = data.lastPromptInfo;

      if (!lastInfo && !data.pendingPrompt) {
        inspectorContent.innerHTML = `<span class="empty-state">No prompts dispatched yet. Highlight sample text above, right-click, and select a preset!</span>`;
        return;
      }

      const formatted = {
        preset: lastInfo?.preset || "ask-ai-direct",
        timestamp: lastInfo ? new Date(lastInfo.timestamp).toLocaleTimeString() : "N/A",
        formattedPrompt: lastInfo?.formattedPrompt || data.pendingPrompt,
        allStorageKeys: Object.keys(data)
      };

      inspectorContent.textContent = JSON.stringify(formatted, null, 2);
    } catch (err) {
      inspectorContent.textContent = "Error reading storage: " + err.message;
    }
  }

  // Initial load
  updateInspector();

  // Listen for storage changes in real-time
  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        updateInspector();
      }
    });
  }

  // Manual refresh
  refreshStorageBtn.addEventListener("click", updateInspector);

  // Clear storage
  clearStorageBtn.addEventListener("click", async () => {
    if (chrome?.storage?.local) {
      await chrome.storage.local.clear();
      updateInspector();
    }
  });

  // Persist checkbox test states in localStorage
  const checkboxes = document.querySelectorAll(".checklist-label input[type='checkbox']");
  checkboxes.forEach((cb) => {
    const saved = localStorage.getItem("tested_" + cb.id);
    if (saved === "true") cb.checked = true;

    cb.addEventListener("change", () => {
      localStorage.setItem("tested_" + cb.id, cb.checked);
    });
  });
});
