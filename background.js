/**
 * Ask AI Chrome Extension - Background Service Worker (Manifest V3)
 * 
 * Manages context menu prompt presets, page context extraction,
 * and dispatching formatted prompts to ChatGPT.
 */



// Prompt preset formatters
const PROMPT_PRESETS = {
  "ask-ai-direct": (text) => text,
  "ask-ai-summarize": (text) => 
    `Summarize the following text clearly and concisely, highlighting key takeaways and bullet points:\n\n"${text}"`,
  "ask-ai-explain": (text) => 
    `Explain the following concept in simple, easy-to-understand terms (like I'm 5 years old) using intuitive analogies:\n\n"${text}"`,
  "ask-ai-debug": (text) => 
    `Analyze the following code snippet. Identify any bugs, performance bottlenecks, or best practice issues, and provide the corrected code with a clear explanation:\n\n\`\`\`\n${text}\n\`\`\``,
  "ask-ai-translate": (text) => 
    `Translate the following text into clear, natural English:\n\n"${text}"`,
  "ask-ai-factcheck": (text) => 
    `Fact-check and critically evaluate the following claim. Outline verified facts, potential inaccuracies, and provide balanced context:\n\n"${text}"`,
  "ask-ai-context": (text, tab, pageUrl) => {
    const title = tab?.title ? `Page: ${tab.title}\n` : "";
    const url = (pageUrl || tab?.url) ? `Source: ${pageUrl || tab.url}\n` : "";
    return `${title}${url}\nSelected Excerpt:\n"${text}"\n\nPlease analyze and explain this excerpt in relation to its context.`;
  }
};

/**
 * Registers all context menu entries and submenus cleanly.
 */
function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // 1. Parent Menu for highlighted text
    chrome.contextMenus.create({
      id: "ask-ai-parent",
      title: "Ask AI",
      contexts: ["selection"]
    });

    // 2. Direct Ask (raw text)
    chrome.contextMenus.create({
      id: "ask-ai-direct",
      parentId: "ask-ai-parent",
      title: "💬 Ask Directly",
      contexts: ["selection"]
    });

    // Separator
    chrome.contextMenus.create({
      id: "ask-ai-sep-1",
      parentId: "ask-ai-parent",
      type: "separator",
      contexts: ["selection"]
    });

    // 3. Preset Actions
    chrome.contextMenus.create({
      id: "ask-ai-summarize",
      parentId: "ask-ai-parent",
      title: "📝 Summarize",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "ask-ai-explain",
      parentId: "ask-ai-parent",
      title: "💡 Explain Simply (ELI5)",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "ask-ai-debug",
      parentId: "ask-ai-parent",
      title: "🛠️ Fix / Explain Code",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "ask-ai-translate",
      parentId: "ask-ai-parent",
      title: "🌐 Translate to English",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "ask-ai-factcheck",
      parentId: "ask-ai-parent",
      title: "🔍 Fact-Check Claim",
      contexts: ["selection"]
    });

    // Separator
    chrome.contextMenus.create({
      id: "ask-ai-sep-2",
      parentId: "ask-ai-parent",
      type: "separator",
      contexts: ["selection"]
    });

    // 4. Page Context Aware
    chrome.contextMenus.create({
      id: "ask-ai-context",
      parentId: "ask-ai-parent",
      title: "📌 Include Page Context (Title & URL)",
      contexts: ["selection"]
    });

    // 5. Test Suite Launcher (available when right-clicking anywhere on page)
    chrome.contextMenus.create({
      id: "ask-ai-open-test",
      title: "🧪 Open Ask AI Test Suite",
      contexts: ["page", "action"]
    });
  });
}

// Ensure menus are created on install or startup
chrome.runtime.onInstalled.addListener(setupContextMenus);
chrome.runtime.onStartup.addListener(setupContextMenus);

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Launch Test Suite
  if (info.menuItemId === "ask-ai-open-test") {
    chrome.tabs.create({ url: chrome.runtime.getURL("test.html") });
    return;
  }

  // Handle Prompt Submenu Clicks
  if (info.selectionText) {
    const selectedText = info.selectionText.trim();
    if (!selectedText) return;

    let formattedPrompt = selectedText;
    const presetFormatter = PROMPT_PRESETS[info.menuItemId];

    if (presetFormatter) {
      formattedPrompt = presetFormatter(selectedText, tab, info.pageUrl);
    } else if (info.menuItemId === "ask-ai-parent") {
      formattedPrompt = selectedText;
    }

    // Generate unique session identifier to avoid multi-tab race conditions
    const askId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

    // Save prompt to storage
    const promptPayload = {
      text: formattedPrompt,
      preset: info.menuItemId,
      timestamp: Date.now()
    };

    await chrome.storage.local.set({
      [`pendingPrompt_${askId}`]: promptPayload,
      pendingPrompt: formattedPrompt, // backward compatibility
      timestamp: Date.now(),
      lastPromptInfo: {
        preset: info.menuItemId,
        originalText: selectedText,
        formattedPrompt: formattedPrompt,
        timestamp: Date.now()
      }
    });

    // Open ChatGPT tab with query param indicator and unique session ID
    chrome.tabs.create({
      url: `https://chatgpt.com/?auto_ask=1&ask_id=${askId}`
    });
  }
});
