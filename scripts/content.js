(() => {
  if (window.__humanTypePasteInstalled) return;
  window.__humanTypePasteInstalled = true;

  const NEIGHBORS = {
    a: "sqwz",
    b: "vghn",
    c: "xdfv",
    d: "sfcxe",
    e: "wrsd",
    f: "dgcrt",
    g: "fhtvy",
    h: "gjybu",
    i: "uojk",
    j: "hkuni",
    k: "jliom",
    l: "kop;",
    m: "njk,",
    n: "bhjm",
    o: "iplk",
    p: "ol;[",
    q: "wa",
    r: "edft",
    s: "adwxz",
    t: "rfgy",
    u: "yihj",
    v: "cfgb",
    w: "qase",
    x: "zsdc",
    y: "tghu",
    z: "asx",
    "1": "2q",
    "2": "13w",
    "3": "24e",
    "4": "35r",
    "5": "46t",
    "6": "57y",
    "7": "68u",
    "8": "79i",
    "9": "80o",
    "0": "9p",
    " ": " "
  };

  let selectedEl = null;
  let pickMode = false;
  let typing = false;
  let abortTyping = false;
  let overlay = null;
  let highlightEl = null;

  function isEditable(el) {
    if (!el || !(el instanceof Element)) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return !el.disabled && !el.readOnly;
    if (tag === "INPUT") {
      const type = (el.type || "text").toLowerCase();
      const allowed = [
        "text",
        "search",
        "email",
        "url",
        "tel",
        "password",
        "number",
        ""
      ];
      return allowed.includes(type) && !el.disabled && !el.readOnly;
    }
    return false;
  }

  function deepestEditable(node) {
    let el = node;
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    while (el) {
      if (isEditable(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function ensureHighlight() {
    if (highlightEl) return highlightEl;
    highlightEl = document.createElement("div");
    highlightEl.id = "htp-field-highlight";
    Object.assign(highlightEl.style, {
      position: "fixed",
      pointerEvents: "none",
      zIndex: "2147483646",
      border: "2px solid #1e7864",
      borderRadius: "4px",
      boxShadow: "0 0 0 3px rgba(30,120,100,0.25)",
      transition: "all 0.08s ease",
      display: "none"
    });
    document.documentElement.appendChild(highlightEl);
    return highlightEl;
  }

  function positionHighlight(el) {
    const box = ensureHighlight();
    if (!el) {
      box.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    box.style.display = "block";
    box.style.top = `${Math.max(0, r.top - 2)}px`;
    box.style.left = `${Math.max(0, r.left - 2)}px`;
    box.style.width = `${r.width + 4}px`;
    box.style.height = `${r.height + 4}px`;
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "htp-pick-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483645",
      cursor: "crosshair",
      background: "rgba(15, 40, 35, 0.08)"
    });

    const banner = document.createElement("div");
    Object.assign(banner.style, {
      position: "fixed",
      top: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#12352e",
      color: "#e8f5f1",
      padding: "10px 16px",
      borderRadius: "8px",
      font: "600 13px/1.3 Segoe UI, system-ui, sans-serif",
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      pointerEvents: "none",
      zIndex: "2147483647"
    });
    banner.textContent = "Click a text field to select it  ·  Esc to cancel";
    overlay.appendChild(banner);

    overlay.addEventListener(
      "mousemove",
      (e) => {
        overlay.style.pointerEvents = "none";
        const under = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = "auto";
        const editable = deepestEditable(under);
        positionHighlight(editable);
      },
      true
    );

    overlay.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        overlay.style.pointerEvents = "none";
        const under = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = "auto";
        const editable = deepestEditable(under);
        if (editable) {
          selectedEl = editable;
          exitPickMode(true);
          chrome.runtime.sendMessage({
            type: "FIELD_SELECTED",
            label: describeField(editable)
          }).catch(() => {});
        }
      },
      true
    );

    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function describeField(el) {
    const name = el.getAttribute("name") || el.id || el.getAttribute("aria-label") || el.placeholder || el.tagName.toLowerCase();
    return String(name).slice(0, 60);
  }

  function enterPickMode() {
    pickMode = true;
    ensureOverlay().style.display = "block";
    ensureHighlight();
  }

  function exitPickMode(keepHighlight) {
    pickMode = false;
    if (overlay) overlay.style.display = "none";
    if (!keepHighlight || !selectedEl) {
      positionHighlight(null);
    } else {
      positionHighlight(selectedEl);
      setTimeout(() => positionHighlight(null), 1200);
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickTypoChar(ch) {
    const lower = ch.toLowerCase();
    const opts = NEIGHBORS[lower];
    if (!opts || !opts.trim()) {
      const fallback = "abcdefghijklmnopqrstuvwxyz";
      return fallback[Math.floor(Math.random() * fallback.length)];
    }
    let wrong = opts[Math.floor(Math.random() * opts.length)];
    if (ch === ch.toUpperCase() && /[a-z]/.test(wrong)) wrong = wrong.toUpperCase();
    return wrong === ch ? (opts[0] || "x") : wrong;
  }

  function getValue(el) {
    if (el.isContentEditable) return el.textContent || "";
    return el.value || "";
  }

  function setValue(el, value) {
    if (el.isContentEditable) {
      el.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      // Prefer execCommand for contenteditable compatibility with frameworks
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, value);
      if (getValue(el) !== value) {
        el.textContent = value;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      }
      return;
    }

    const proto =
      el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;

    el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: value.slice(-1) }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function appendChar(el, ch) {
    if (el.isContentEditable) {
      el.focus();
      const ok = document.execCommand("insertText", false, ch);
      if (!ok) {
        setValue(el, getValue(el) + ch);
      } else {
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ch }));
      }
      return;
    }

    el.focus();
    const start = el.selectionStart ?? getValue(el).length;
    const end = el.selectionEnd ?? start;
    const cur = getValue(el);
    const next = cur.slice(0, start) + ch + cur.slice(end);
    const proto =
      el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, next);
    else el.value = next;
    const caret = start + ch.length;
    try {
      el.setSelectionRange(caret, caret);
    } catch (_) {}
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: ch
      })
    );
  }

  function deleteLastChar(el) {
    if (el.isContentEditable) {
      el.focus();
      const ok = document.execCommand("delete", false, null);
      if (!ok) {
        const v = getValue(el);
        setValue(el, v.slice(0, -1));
      } else {
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
      }
      return;
    }

    el.focus();
    const start = el.selectionStart ?? getValue(el).length;
    const end = el.selectionEnd ?? start;
    const cur = getValue(el);
    let next;
    let caret;
    if (start !== end) {
      next = cur.slice(0, start) + cur.slice(end);
      caret = start;
    } else if (start > 0) {
      next = cur.slice(0, start - 1) + cur.slice(start);
      caret = start - 1;
    } else {
      return;
    }
    const proto =
      el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, next);
    else el.value = next;
    try {
      el.setSelectionRange(caret, caret);
    } catch (_) {}
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "deleteContentBackward"
      })
    );
  }

  function dispatchKey(el, key, code) {
    const opts = {
      key,
      code,
      bubbles: true,
      cancelable: true,
      composed: true
    };
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    el.dispatchEvent(new KeyboardEvent("keypress", opts));
    el.dispatchEvent(new KeyboardEvent("keyup", opts));
  }

  async function typeHuman(text, settings) {
    const el = selectedEl && document.contains(selectedEl) ? selectedEl : deepestEditable(document.activeElement);
    if (!el || !isEditable(el)) {
      throw new Error("No text field selected. Use “Pick field” first, or focus one.");
    }

    selectedEl = el;
    el.focus();

    const cpmMin = Math.max(1, Number(settings.cpmMin) || 120);
    const cpmMax = Math.max(cpmMin, Number(settings.cpmMax) || 280);
    const typoPercent = Math.min(100, Math.max(0, Number(settings.typoPercent) || 0));

    let currentCpm = randomBetween(cpmMin, cpmMax);
    let minuteStarted = Date.now();
    let charsThisMinute = 0;

    typing = true;
    abortTyping = false;

    chrome.runtime.sendMessage({
      type: "TYPING_STATUS",
      status: "started",
      cpm: Math.round(currentCpm),
      index: 0,
      total: text.length
    }).catch(() => {});

    for (let i = 0; i < text.length; i++) {
      if (abortTyping) break;

      const now = Date.now();
      if (now - minuteStarted >= 60_000) {
        currentCpm = randomBetween(cpmMin, cpmMax);
        minuteStarted = now;
        charsThisMinute = 0;
        chrome.runtime.sendMessage({
          type: "TYPING_STATUS",
          status: "cpm_refresh",
          cpm: Math.round(currentCpm),
          index: i,
          total: text.length
        }).catch(() => {});
      }

      const ch = text[i];
      const baseDelay = 60_000 / currentCpm;
      // Small human jitter ±25%
      const delay = baseDelay * randomBetween(0.75, 1.25);

      const shouldTypo =
        typoPercent > 0 &&
        /[A-Za-z0-9]/.test(ch) &&
        Math.random() * 100 < typoPercent;

      if (shouldTypo) {
        const wrong = pickTypoChar(ch);
        dispatchKey(el, wrong, `Key${wrong.toUpperCase()}`);
        appendChar(el, wrong);
        await sleep(delay * randomBetween(0.4, 0.9));
        if (abortTyping) break;
        // notice pause then backspace
        await sleep(randomBetween(80, 280));
        if (abortTyping) break;
        dispatchKey(el, "Backspace", "Backspace");
        deleteLastChar(el);
        await sleep(randomBetween(40, 160));
        if (abortTyping) break;
      }

      dispatchKey(el, ch, ch === " " ? "Space" : `Key${ch.toUpperCase()}`);
      appendChar(el, ch);
      charsThisMinute += 1;

      chrome.runtime.sendMessage({
        type: "TYPING_STATUS",
        status: "progress",
        cpm: Math.round(currentCpm),
        index: i + 1,
        total: text.length,
        charsThisMinute
      }).catch(() => {});

      // Slightly longer pause after punctuation / newlines
      let pause = delay;
      if (/[.,!?;:]/.test(ch)) pause += randomBetween(80, 220);
      if (ch === "\n") pause += randomBetween(150, 400);
      if (ch === " ") pause += randomBetween(20, 80);

      await sleep(pause);
    }

    typing = false;
    const finished = !abortTyping;
    abortTyping = false;
    chrome.runtime.sendMessage({
      type: "TYPING_STATUS",
      status: finished ? "done" : "stopped",
      index: finished ? text.length : undefined,
      total: text.length
    }).catch(() => {});
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && pickMode) {
        e.preventDefault();
        exitPickMode(false);
        chrome.runtime.sendMessage({ type: "PICK_CANCELLED" }).catch(() => {});
      }
      if (e.key === "Escape" && typing) {
        abortTyping = true;
      }
    },
    true
  );

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      try {
        if (message?.type === "PICK_FIELD") {
          if (typing) throw new Error("Stop typing before picking a field.");
          enterPickMode();
          sendResponse({ ok: true });
          return;
        }

        if (message?.type === "GET_STATE") {
          sendResponse({
            ok: true,
            typing,
            pickMode,
            selected: selectedEl ? describeField(selectedEl) : null
          });
          return;
        }

        if (message?.type === "STOP_TYPING") {
          abortTyping = true;
          sendResponse({ ok: true });
          return;
        }

        if (message?.type === "START_TYPING") {
          if (typing) {
            sendResponse({ ok: false, error: "Already typing." });
            return;
          }
          const text = String(message.text ?? "");
          if (!text) {
            sendResponse({ ok: false, error: "Text is empty." });
            return;
          }
          const el =
            selectedEl && document.contains(selectedEl)
              ? selectedEl
              : deepestEditable(document.activeElement);
          if (!el || !isEditable(el)) {
            sendResponse({ ok: false, skip: true });
            return;
          }
          selectedEl = el;
          sendResponse({ ok: true, started: true });
          typeHuman(text, message.settings || {}).catch((err) => {
            typing = false;
            chrome.runtime.sendMessage({
              type: "TYPING_STATUS",
              status: "error",
              error: err.message || String(err)
            }).catch(() => {});
          });
          return;
        }

        sendResponse({ ok: false, error: "Unknown message" });
      } catch (err) {
        sendResponse({ ok: false, error: err.message || String(err) });
      }
    })();
    return true;
  });
})();
