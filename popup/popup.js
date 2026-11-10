const DEFAULTS = {
  text: "",
  cpmMin: 140,
  cpmMax: 260,
  typoPercent: 4
};

const els = {
  text: document.getElementById("text"),
  cpmMin: document.getElementById("cpmMin"),
  cpmMax: document.getElementById("cpmMax"),
  typoPercent: document.getElementById("typoPercent"),
  targetLabel: document.getElementById("targetLabel"),
  pickBtn: document.getElementById("pickBtn"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  status: document.getElementById("status")
};

function setStatus(msg, kind = "") {
  els.status.textContent = msg || "";
  els.status.className = `status${kind ? ` ${kind}` : ""}`;
}

function setTargetLabel(label) {
  if (label) {
    els.targetLabel.textContent = label;
    els.targetLabel.classList.add("set");
  } else {
    els.targetLabel.textContent = "None selected — click Pick field";
    els.targetLabel.classList.remove("set");
  }
}

function readSettings() {
  let cpmMin = Number(els.cpmMin.value);
  let cpmMax = Number(els.cpmMax.value);
  let typoPercent = Number(els.typoPercent.value);

  if (!Number.isFinite(cpmMin) || cpmMin < 1) cpmMin = DEFAULTS.cpmMin;
  if (!Number.isFinite(cpmMax) || cpmMax < 1) cpmMax = DEFAULTS.cpmMax;
  if (cpmMax < cpmMin) [cpmMin, cpmMax] = [cpmMax, cpmMin];
  if (!Number.isFinite(typoPercent)) typoPercent = DEFAULTS.typoPercent;
  typoPercent = Math.min(100, Math.max(0, typoPercent));

  els.cpmMin.value = String(Math.round(cpmMin));
  els.cpmMax.value = String(Math.round(cpmMax));
  els.typoPercent.value = String(typoPercent);

  return { cpmMin, cpmMax, typoPercent };
}

async function saveState() {
  const settings = readSettings();
  await chrome.storage.sync.set({
    text: els.text.value,
    ...settings
  });
}

async function loadState() {
  const data = await chrome.storage.sync.get(DEFAULTS);
  els.text.value = data.text ?? "";
  els.cpmMin.value = data.cpmMin ?? DEFAULTS.cpmMin;
  els.cpmMax.value = data.cpmMax ?? DEFAULTS.cpmMax;
  els.typoPercent.value = data.typoPercent ?? DEFAULTS.typoPercent;
}

function setTypingUi(isTyping) {
  els.startBtn.disabled = isTyping;
  els.pickBtn.disabled = isTyping;
  els.stopBtn.disabled = !isTyping;
  els.text.disabled = isTyping;
  els.cpmMin.disabled = isTyping;
  els.cpmMax.disabled = isTyping;
  els.typoPercent.disabled = isTyping;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab.");
  if (!tab.url || /^(chrome|chrome-extension|edge|about|devtools):/i.test(tab.url)) {
    throw new Error("Open a normal web page first (not a browser internal page).");
  }
  return tab;
}

async function queryAllFrames(tabId, payload) {
  const relay = await chrome.runtime.sendMessage({
    type: "RELAY_TO_TAB",
    tabId,
    payload
  });
  return relay?.results || [];
}

async function ensureContentScript(tabId) {
  let results = [];
  try {
    results = await queryAllFrames(tabId, { type: "GET_STATE" });
  } catch (_) {
    results = [];
  }
  if (!results.length) {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["scripts/content.js"]
    });
    results = await queryAllFrames(tabId, { type: "GET_STATE" });
  }
  const typing = results.find((r) => r?.typing);
  const selected = results.find((r) => r?.selected);
  return {
    ok: true,
    typing: Boolean(typing),
    selected: selected?.selected || null
  };
}

async function sendToTab(message) {
  const tab = await getActiveTab();
  await ensureContentScript(tab.id);
  const relay = await chrome.runtime.sendMessage({
    type: "RELAY_TO_TAB",
    tabId: tab.id,
    payload: message
  });
  const results = relay?.results || [];
  if (message.type === "START_TYPING") {
    const started = results.find((r) => r?.ok && r.started);
    if (started) return started;
    const err = results.find((r) => r?.error && !r.skip);
    throw new Error(err?.error || "No text field selected. Use Pick field first, or focus one.");
  }
  if (message.type === "PICK_FIELD") {
    const ok = results.find((r) => r?.ok);
    if (ok) return ok;
    throw new Error("Could not start pick mode on this page.");
  }
  return results[0] || { ok: true };
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "FIELD_SELECTED") {
    setTargetLabel(message.label);
    setStatus("Field selected. Close this popup if needed, then Start typing.", "ok");
  }
  if (message?.type === "PICK_CANCELLED") {
    setStatus("Field pick cancelled.");
  }
  if (message?.type === "TYPING_STATUS") {
    const { status, cpm, index, total, error } = message;
    if (status === "started") {
      setTypingUi(true);
      setStatus(`Typing… ${cpm} chars/min`);
    } else if (status === "cpm_refresh") {
      setStatus(`New minute rate: ${cpm} chars/min · ${index}/${total}`);
    } else if (status === "progress") {
      setStatus(`Typing… ${index}/${total} · ${cpm} chars/min`);
    } else if (status === "done") {
      setTypingUi(false);
      setStatus("Finished typing.", "ok");
    } else if (status === "stopped") {
      setTypingUi(false);
      setStatus("Stopped.");
    } else if (status === "error") {
      setTypingUi(false);
      setStatus(error || "Typing failed.", "error");
    }
  }
});

els.pickBtn.addEventListener("click", async () => {
  try {
    await saveState();
    const res = await sendToTab({ type: "PICK_FIELD" });
    if (!res?.ok) throw new Error(res?.error || "Could not start pick mode.");
    setStatus("Click a text field on the page…");
    window.close();
  } catch (err) {
    setStatus(err.message || String(err), "error");
  }
});

els.startBtn.addEventListener("click", async () => {
  try {
    const settings = readSettings();
    const text = els.text.value;
    if (!text.trim()) {
      setStatus("Enter some text to type.", "error");
      return;
    }
    await saveState();
    setTypingUi(true);
    setStatus("Starting…");
    const res = await sendToTab({ type: "START_TYPING", text, settings });
    if (!res?.ok) throw new Error(res?.error || "Could not start typing.");
  } catch (err) {
    setTypingUi(false);
    setStatus(err.message || String(err), "error");
  }
});

els.stopBtn.addEventListener("click", async () => {
  try {
    await sendToTab({ type: "STOP_TYPING" });
    setStatus("Stopping…");
  } catch (err) {
    setStatus(err.message || String(err), "error");
  }
});

["input", "change"].forEach((evt) => {
  els.text.addEventListener(evt, () => saveState());
  els.cpmMin.addEventListener(evt, () => saveState());
  els.cpmMax.addEventListener(evt, () => saveState());
  els.typoPercent.addEventListener(evt, () => saveState());
});

(async () => {
  await loadState();
  try {
    const tab = await getActiveTab();
    const state = await ensureContentScript(tab.id);
    if (state?.selected) setTargetLabel(state.selected);
    if (state?.typing) {
      setTypingUi(true);
      setStatus("Typing in progress…");
    }
  } catch (_) {
    // Tab may be restricted; user will see error on action
  }
})();
