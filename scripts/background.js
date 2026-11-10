async function getFrameIds(tabId) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (frames?.length) return frames.map((f) => f.frameId);
  } catch (_) {
    // webNavigation unavailable
  }
  return [0];
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "TYPING_STATUS" || message?.type === "FIELD_SELECTED" || message?.type === "PICK_CANCELLED") {
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "RELAY_TO_TAB") {
    (async () => {
      const { tabId, payload } = message;
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
      sendResponse({ ok: true, results: results.filter(Boolean) });
    })();
    return true;
  }

  return false;
});
