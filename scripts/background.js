const DEFAULTS = {
  text: "",
  cpmMin: 260,
  cpmMax: 320,
  typoPercent: 4
};

const FALLBACK_SHORTCUTS = {
  start: "Alt+Shift+.",
  stop: "Alt+Shift+,"
};

function prettyShortcut(shortcut) {
  if (!shortcut) return null;
  return shortcut
    .replace(/Command/g, "⌘")
    .replace(/Ctrl/g, "Ctrl")
    .replace(/Alt/g, "Alt")
    .replace(/Shift/g, "Shift")
    .replace(/Period/g, ".")
    .replace(/Comma/g, ",");
}

async function getShortcutLabels() {
  try {
    const commands = await chrome.commands.getAll();
    const start = commands.find((c) => c.name === "start-typing");
    const stop = commands.find((c) => c.name === "stop-typing");
    return {
      start: prettyShortcut(start?.shortcut) || FALLBACK_SHORTCUTS.start,
      stop: prettyShortcut(stop?.shortcut) || FALLBACK_SHORTCUTS.stop
    };
  } catch (_) {
    return { ...FALLBACK_SHORTCUTS };
  }
}

async function getFrameIds(tabId) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (frames?.length) return frames.map((f) => f.frameId);
  } catch (_) {
    // webNavigation unavailable
  }
  return [0];
}

async function relayToTab(tabId, payload) {
  const frameIds = await getFrameIds(tabId);
  const results = await Promise.all(
    frameIds.map(async (frameId) => {
      try {
        return await chrome.tabs.sendMessage(tabId, payload, { frameId });
      } catch (_) {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

async function ensureContentScript(tabId) {
  let results = [];
  try {
    results = await relayToTab(tabId, { type: "GET_STATE" });
  } catch (_) {
    results = [];
  }
  if (!results.length) {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["scripts/content.js"]
    });
    results = await relayToTab(tabId, { type: "GET_STATE" });
  }
  return results;
}

function isRestrictedUrl(url) {
  return !url || /^(chrome|chrome-extension|edge|about|devtools|https:\/\/chrome\.google\.com\/webstore)/i.test(url);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab.");
  if (isRestrictedUrl(tab.url)) {
    throw new Error("Open a normal web page first (not a browser internal page).");
  }
  return tab;
}

function normalizeSettings(data) {
  let cpmMin = Number(data.cpmMin);
  let cpmMax = Number(data.cpmMax);
  let typoPercent = Number(data.typoPercent);
  if (!Number.isFinite(cpmMin) || cpmMin < 260) cpmMin = Math.max(260, DEFAULTS.cpmMin);
  if (!Number.isFinite(cpmMax) || cpmMax < 1) cpmMax = DEFAULTS.cpmMax;
  if (cpmMax < cpmMin) [cpmMin, cpmMax] = [cpmMax, cpmMin];
  if (!Number.isFinite(typoPercent)) typoPercent = DEFAULTS.typoPercent;
  typoPercent = Math.min(100, Math.max(0, typoPercent));
  return { cpmMin, cpmMax, typoPercent };
}

async function startTypingFromShortcut() {
  const tab = await getActiveTab();
  await ensureContentScript(tab.id);
  const data = await chrome.storage.sync.get(DEFAULTS);
  const text = String(data.text ?? "");
  if (!text.trim()) {
    throw new Error("No text saved. Open the extension and enter text first.");
  }
  const settings = normalizeSettings(data);
  const results = await relayToTab(tab.id, {
    type: "START_TYPING",
    text,
    settings
  });
  const started = results.find((r) => r?.ok && r.started);
  if (started) return;
  const err = results.find((r) => r?.error && !r.skip);
  throw new Error(err?.error || "No text field selected. Use Pick field first, or focus one.");
}

async function stopTypingFromShortcut() {
  const tab = await getActiveTab();
  await ensureContentScript(tab.id);
  await relayToTab(tab.id, { type: "STOP_TYPING" });
}

chrome.commands.onCommand.addListener((command) => {
  (async () => {
    try {
      if (command === "start-typing") {
        await startTypingFromShortcut();
      } else if (command === "stop-typing") {
        await stopTypingFromShortcut();
      }
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "TYPING_STATUS",
        status: "error",
        error: err.message || String(err)
      }).catch(() => {});
    }
  })();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "TYPING_STATUS" || message?.type === "FIELD_SELECTED" || message?.type === "PICK_CANCELLED") {
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "GET_SHORTCUTS") {
    getShortcutLabels().then((shortcuts) => {
      sendResponse({ ok: true, shortcuts });
    });
    return true;
  }

  if (message?.type === "RELAY_TO_TAB") {
    (async () => {
      const { tabId, payload } = message;
      const results = await relayToTab(tabId, payload);
      sendResponse({ ok: true, results });
    })();
    return true;
  }

  return false;
});
