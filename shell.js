/* WebRPG Game Shell v1 — classic synchronous script, no dependencies. */
(() => {
  "use strict";
  const shell = document.getElementById("webrpg-shell");
  if (!shell || shell.dataset.wrInitialized === "true") return;
  const summary = shell.querySelector(":scope > summary");
  const label = shell.querySelector(".wr-label");
  const logo = shell.querySelector(".wr-logo img");
  const controls = document.getElementById("webrpg-touch-controls");
  if (!summary || !label || !logo) return;
  shell.dataset.wrInitialized = "true";
  const fullscreenButton = shell.querySelector('[data-wr-action="fullscreen"]');
  const rotationButton = shell.querySelector('[data-wr-action="rotation"]');
  const padButton = shell.querySelector('[data-wr-action="gamepad"]');
  const notice = shell.querySelector(".wr-notice");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer:coarse)");
  const margin = 16, size = 46;
  let phase = "intro", side = "left", pos = { x: margin, y: margin };
  let timer = 0, animation = null, animations = [], drag = null;
  let suppressClickUntil = 0, padEnabled = false, notifyTimer = 0;
  let requestedOrientation = null;

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const isMobile = () => coarsePointer.matches && Math.min(screen.width, screen.height) <= 900;
  // RPG Maker's legacy viewport ("user-scalable=no" without width=device-width)
  // uses a 980px layout viewport that Safari shrinks to fit the device.
  // Correct only our overlay: never alter the game's viewport or Canvas.
  let uiScale = 1;
  const physicalViewportWidth = () =>
    Math.max(1, (window.visualViewport?.width || innerWidth) *
      (window.visualViewport?.scale || 1));
  const viewportSize = () => ({ width: innerWidth / uiScale, height: innerHeight / uiScale });
  function updateUiScale() {
    const next = isMobile() ? clamp(innerWidth / physicalViewportWidth(), 1, 3.5) : 1;
    if (Math.abs(next - uiScale) < .01) return;
    uiScale = next;
    shell.style.zoom = next === 1 ? "" : String(next);
    if (controls) controls.style.zoom = next === 1 ? "" : String(next);
  }
  const target = (edge = side, y = margin) => {
    const { width, height } = viewportSize();
    return {
      x: edge === "right" ? Math.max(margin, width - size - margin) : margin,
      y: clamp(y, margin, Math.max(margin, height - size - margin)),
    };
  };
  const rect = () => {
    const r = shell.getBoundingClientRect();
    return { left: r.left / uiScale, top: r.top / uiScale,
      width: r.width / uiScale, height: r.height / uiScale };
  };
  const setRect = (r) => {
    for (const key of ["left", "top", "width", "height"]) shell.style[key] = r[key] + "px";
  };
  const resetRect = () => {
    for (const key of ["left", "top", "width", "height"]) shell.style[key] = "";
    label.style.maxWidth = ""; label.style.opacity = "";
    summary.style.gap = ""; summary.style.padding = "";
  };
  const updateMenuDirection = () => {
    shell.dataset.menuDirection = (phase === "intro" ||
      (phase === "paused" && shell.dataset.wrWasIntro === "yes"))
      ? "down" : side === "right" ? "left" : "right";
  };
  const setPhase = (next) => {
    phase = next; shell.dataset.phase = next; updateMenuDirection();
  };
  const put = (x, y) => {
    const { width, height } = viewportSize();
    pos = { x: clamp(x, margin, Math.max(margin, width - size - margin)),
      y: clamp(y, margin, Math.max(margin, height - size - margin)) };
    shell.style.setProperty("--wr-x", pos.x + "px");
    shell.style.setProperty("--wr-y", pos.y + "px");
    updateMenuDirection();
  };
  function stopAnimations(freeze = false) {
    const r = freeze ? rect() : null;
    const ls = freeze ? getComputedStyle(label) : null;
    const ss = freeze ? getComputedStyle(summary) : null;
    const snapshot = freeze ? {
      maxWidth: ls.maxWidth, opacity: ls.opacity, gap: ss.gap, padding: ss.padding,
    } : null;
    clearTimeout(timer); timer = 0;
    for (const a of animations) a.cancel();
    animations = []; animation = null;
    if (r) {
      setRect(r);
      label.style.maxWidth = snapshot.maxWidth;
      label.style.opacity = snapshot.opacity;
      summary.style.gap = snapshot.gap;
      summary.style.padding = snapshot.padding;
    }
  }
  function dock(edge = side, y = margin, keepOpen = false) {
    stopAnimations();
    if (!keepOpen) shell.open = false;
    side = edge;
    const point = target(edge, y);
    put(point.x, point.y);
    resetRect();
    shell.dataset.wrWasIntro = "no";
    setPhase("docked");
  }
  function animateDock(duration = 680) {
    if (shell.open) return;
    // Keep layout stable; pseudo-element glass, logo opacity and geometry
    // all reach their docked values within the SAME animation duration.
    stopAnimations(true);
    const from = rect();
    const targetRect = { ...target(side, pos.y), width: size, height: size };
    const l = getComputedStyle(label);
    const sm = getComputedStyle(summary);
    const lg = getComputedStyle(logo.parentElement);
    shell.dataset.wrWasIntro = from.width > size + 30 ? "yes" : "no";
    setPhase("moving"); setRect(from);
    const motion = { duration, easing: "cubic-bezier(.25,.7,.2,1)", fill: "forwards" };
    const root = shell.animate([
      { left: from.left + "px", top: from.top + "px", width: from.width + "px", height: from.height + "px" },
      { left: targetRect.x + "px", top: targetRect.y + "px", width: size + "px", height: size + "px" },
    ], motion);
    const text = label.animate([
      { maxWidth: l.maxWidth, opacity: l.opacity, offset: 0 },
      { maxWidth: l.maxWidth, opacity: l.opacity, offset: .12 },
      { maxWidth: "0px", opacity: 0, offset: .75 },
      { maxWidth: "0px", opacity: 0, offset: 1 },
    ], { duration, easing: "ease-in-out", fill: "forwards" });
    // 3px left padding balances a 40px logo in a 46px circle *before*
    // switching to justify-content:center; avoids the final 1px jump.
    const contents = summary.animate([
      { gap: sm.gap, padding: sm.padding },
      { gap: "0px", padding: "2px 2px 2px 3px" },
    ], motion);
    const mark = logo.parentElement.animate([
      { width: lg.width, height: lg.height, minWidth: lg.minWidth, flexBasis: lg.flexBasis },
      { width: "40px", height: "40px", minWidth: "40px", flexBasis: "40px" },
    ], motion);
    const alpha = logo.animate([{ opacity: getComputedStyle(logo).opacity }, { opacity: .73 }], motion);
    animations = [root, text, contents, mark, alpha]; animation = root;
    try {
      const before = getComputedStyle(shell, "::before");
      const glass = shell.animate([
        { backgroundColor: before.backgroundColor, borderColor: before.borderColor, boxShadow: before.boxShadow },
        { backgroundColor: "rgba(100,100,100,.11)", borderColor: "rgba(255,255,255,.06)", boxShadow: "0 0 0 rgba(0,0,0,0)" },
      ], { ...motion, pseudoElement: "::before" });
      animations.push(glass);
    } catch { /* CSS transition is the fallback. */ }
    root.onfinish = () => {
      if (animation !== root) return;
      animation = null;
      const p = target(side, pos.y);
      put(p.x, p.y);
      // Set the final state before cancelling the fill animations.
      shell.dataset.phase = "docked";
      label.style.maxWidth = "0px"; label.style.opacity = "0";
      summary.style.gap = "0px"; summary.style.padding = "2px 2px 2px 3px";
      for (const a of animations) a.cancel();
      animations = [];
      resetRect(); setPhase("docked"); shell.dataset.wrWasIntro = "no";
    };
  }
  function playIntro() {
    stopAnimations();
    shell.open = false; side = "left"; resetRect();
    shell.dataset.wrWasIntro = "yes"; setPhase("intro");
    if (reducedMotion.matches || sessionStorage.getItem("webrpg-shell-intro") === "done") {
      dock("left"); return;
    }
    timer = setTimeout(() => {
      if (shell.open || phase !== "intro") return;
      sessionStorage.setItem("webrpg-shell-intro", "done");
      animateDock();
    }, 640);
  }
  function pauseForMenu() {
    if (phase !== "moving") return;
    const wasIntro = shell.dataset.wrWasIntro;
    stopAnimations(true);
    shell.dataset.wrWasIntro = wasIntro;
    setPhase("paused");
  }
  shell.addEventListener("toggle", () => {
    if (shell.open) {
      clearTimeout(timer);
      if (phase === "moving") pauseForMenu();
    } else if (phase === "paused") {
      animateDock(reducedMotion.matches ? 1 : 420);
    }
    updateMenuDirection();
  });
  document.addEventListener("pointerdown", (e) => {
    if (shell.open && !shell.contains(e.target)) shell.open = false;
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && shell.open) { shell.open = false; summary.focus(); }
  });
  summary.addEventListener("click", (e) => {
    if (performance.now() < suppressClickUntil) {
      e.preventDefault(); e.stopImmediatePropagation(); suppressClickUntil = 0;
    }
  }, true);
  summary.addEventListener("pointerdown", (e) => {
    if (phase !== "docked" || shell.open || e.button !== 0) return;
    drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY,
      x: pos.x, y: pos.y, moved: false };
    try { summary.setPointerCapture(e.pointerId); } catch {}
  });
  summary.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = (e.clientX - drag.startX) / uiScale;
    const dy = (e.clientY - drag.startY) / uiScale;
    if (!drag.moved && Math.hypot(dx, dy) > 7) {
      drag.moved = true; setPhase("dragging");
    }
    if (drag.moved) { e.preventDefault(); put(drag.x + dx, drag.y + dy); }
  });
  function releaseDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const moved = drag.moved; drag = null;
    if (!moved) return;
    suppressClickUntil = performance.now() + 400;
    side = pos.x + size / 2 >= viewportSize().width / 2 ? "right" : "left";
    const to = target(side, pos.y), from = rect();
    setPhase("snapping"); setRect(from);
    const snap = shell.animate([
      { left: from.left + "px", top: from.top + "px" },
      { left: to.x + "px", top: to.y + "px" },
    ], { duration: reducedMotion.matches ? 1 : 260,
      easing: "cubic-bezier(.2,.8,.25,1)", fill: "forwards" });
    animation = snap; animations.push(snap);
    snap.onfinish = () => {
      if (animation !== snap) return;
      animation = null; put(to.x, to.y);
      shell.dataset.phase = "docked";
      for (const a of animations) a.cancel();
      animations = []; resetRect(); setPhase("docked");
    };
  }
  summary.addEventListener("pointerup", releaseDrag);
  summary.addEventListener("pointercancel", releaseDrag);
  if (logo.complete && !logo.naturalWidth) shell.dataset.logoError = "true";
  logo.addEventListener("error", () => { shell.dataset.logoError = "true"; });

  // Basic tool: fullscreen the DOCUMENT, not the canvas alone, so the shell
  // and virtual controls remain inside the browser's fullscreen element.
  function fullScreenActive() { return document.fullscreenElement === document.documentElement; }
  function updateFullscreen() {
    if (!fullscreenButton) return;
    const active = fullScreenActive();
    const caption = active ? "Exit fullscreen" : "Enter fullscreen";
    fullscreenButton.setAttribute("aria-pressed", String(active));
    fullscreenButton.setAttribute("aria-label", caption);
    fullscreenButton.title = caption;
    const text = fullscreenButton.querySelector(".wr-sr-only");
    if (text) text.textContent = caption;
  }
  if (fullscreenButton) {
    fullscreenButton.hidden = false;
    fullscreenButton.addEventListener("click", async () => {
      shell.open = false;
      try {
        if (fullScreenActive()) await document.exitFullscreen();
        else if (!document.fullscreenElement && document.documentElement.requestFullscreen)
          await document.documentElement.requestFullscreen();
      } catch { notify("Fullscreen unavailable in this browser"); }
      updateFullscreen();
    });
    document.addEventListener("fullscreenchange", updateFullscreen);
    updateFullscreen();
  }

  function notify(text) {
    if (!notice) return;
    clearTimeout(notifyTimer);
    notice.textContent = text;
    notice.hidden = false;
    notifyTimer = setTimeout(() => { notice.hidden = true; }, 3000);
  }

  // Input: standard RPG Maker MV/MZ mappings. Untrusted key events work for
  // the base keyboard listeners; engine plugins may require adapters.
  const padKeys = {
    up: ["ArrowUp","ArrowUp",38], down: ["ArrowDown","ArrowDown",40],
    left: ["ArrowLeft","ArrowLeft",37], right: ["ArrowRight","ArrowRight",39],
    ok: ["Enter","Enter",13], cancel: ["Escape","Escape",27],
    shift: ["Shift","ShiftLeft",16], pageup: ["q","KeyQ",81],
    pagedown: ["w","KeyW",87],
  };
  const keys = new Map();
  const pressed = new Map(), pointers = new Map();
  if (controls) for (const button of controls.querySelectorAll("[data-wr-key]"))
    keys.set(button.dataset.wrKey, button);
  function emitKey(name, down) {
    const val = padKeys[name];
    if (!val) return;
    const e = new KeyboardEvent(down ? "keydown" : "keyup", {
      key: val[0], code: val[1], bubbles: true, cancelable: true, composed: true,
      shiftKey: name === "shift",
    });
    Object.defineProperty(e, "keyCode", { configurable: true, get: () => val[2] });
    Object.defineProperty(e, "which", { configurable: true, get: () => val[2] });
    document.dispatchEvent(e);
  }
  function hold(name) {
    const n = pressed.get(name) || 0;
    pressed.set(name, n + 1);
    if (!n) { keys.get(name)?.setAttribute("aria-pressed","true"); emitKey(name,true); }
  }
  function release(name) {
    const n = pressed.get(name) || 0;
    if (!n) return;
    if (n === 1) {
      pressed.delete(name); keys.get(name)?.setAttribute("aria-pressed","false");
      emitKey(name,false);
    } else pressed.set(name,n-1);
  }
  function releaseAll() {
    for (const name of [...pressed.keys()]) {
      pressed.delete(name); keys.get(name)?.setAttribute("aria-pressed","false");
      emitKey(name,false);
    }
    for (const id of pointers.keys()) {
      try { if (controls.hasPointerCapture(id)) controls.releasePointerCapture(id); } catch {}
    }
    pointers.clear();
  }
  function setPad(on) {
    padEnabled = Boolean(controls && on && isMobile());
    if (!padEnabled) releaseAll();
    if (controls) controls.hidden = !padEnabled;
    if (padButton) {
      padButton.setAttribute("aria-pressed",String(padEnabled));
      const label = padEnabled ? "Hide virtual controls" : "Show virtual controls";
      padButton.setAttribute("aria-label",label); padButton.title = label;
      const text=padButton.querySelector(".wr-sr-only");
      if (text) text.textContent=label;
    }
  }
  if (controls) {
    controls.addEventListener("pointerdown", (e) => {
      if (!padEnabled || (e.pointerType === "mouse" && e.button !== 0)) return;
      const key = e.target.closest("[data-wr-key]");
      if (!key) return;
      e.preventDefault();
      pointers.set(e.pointerId,key.dataset.wrKey);
      hold(key.dataset.wrKey);
      try { controls.setPointerCapture(e.pointerId); } catch {}
    });
    controls.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      e.preventDefault();
      const prev = pointers.get(e.pointerId);
      const nextButton = document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-wr-key]");
      const next = nextButton && controls.contains(nextButton) ? nextButton.dataset.wrKey : null;
      if (prev === next) return;
      if (prev) release(prev);
      if (next) hold(next);
      pointers.set(e.pointerId,next);
    });
    function finishPointer(e) {
      if (!pointers.has(e.pointerId)) return;
      e.preventDefault();
      const key = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (key) release(key);
      try { if (controls.hasPointerCapture(e.pointerId)) controls.releasePointerCapture(e.pointerId); } catch {}
    }
    controls.addEventListener("pointerup",finishPointer);
    controls.addEventListener("pointercancel",finishPointer);
    controls.addEventListener("lostpointercapture", (e) => {
      if (!pointers.has(e.pointerId)) return;
      const name = pointers.get(e.pointerId); pointers.delete(e.pointerId);
      if (name) release(name);
    });
    controls.addEventListener("contextmenu", e => e.preventDefault());
    padButton?.addEventListener("click", () => {
      setPad(!padEnabled); shell.open = false;
    });
    window.addEventListener("blur",releaseAll);
    window.addEventListener("pagehide",releaseAll);
    document.addEventListener("visibilitychange",() => { if (document.hidden) releaseAll(); });
    document.addEventListener("fullscreenchange",releaseAll);
  }
  function updateMobile() {
    const mobile = isMobile();
    updateUiScale();
    if (controls) controls.dataset.wrCompact =
      String(mobile && physicalViewportWidth() < 390);
    shell.dataset.mobileMode = String(mobile);
    if (padButton) padButton.hidden = !mobile;
    if (rotationButton) rotationButton.hidden = !mobile;
    if (!mobile && padEnabled) setPad(false);
  }
  function updateRotation() {
    if (!rotationButton) return;
    const landscape = (screen.orientation?.type || "").startsWith("landscape");
    const text = landscape ? "Request portrait" : "Request landscape";
    rotationButton.setAttribute("aria-pressed",String(landscape));
    rotationButton.setAttribute("aria-label",text);
    rotationButton.title = text;
    const sr=rotationButton.querySelector(".wr-sr-only");
    if (sr) sr.textContent=text;
  }
  rotationButton?.addEventListener("click", async () => {
    shell.open=false;
    if (!isMobile()) return;
    if (typeof screen.orientation?.lock !== "function") {
      notify("Rotate your device manually"); return;
    }
    const landscape = (screen.orientation?.type || "").startsWith("landscape");
    requestedOrientation = landscape ? "portrait" : "landscape";
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      await screen.orientation.lock(requestedOrientation);
    } catch { notify("Screen orientation lock unavailable"); }
    updateRotation();
  });
  screen.orientation?.addEventListener?.("change",updateRotation);
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && screen.orientation?.unlock) {
      try { screen.orientation.unlock(); } catch {}
    }
  });
  function syncViewport() {
    updateMobile();
    if (phase === "docked") {
      const p = target(side,pos.y);
      put(p.x,p.y);
    }
  }
  window.addEventListener("resize", syncViewport);
  window.visualViewport?.addEventListener?.("resize", syncViewport);
  updateMobile(); updateRotation();
  try { playIntro(); } catch (err) {
    // Never block the original game if a browser API behaves unexpectedly.
    console.warn("[WebRPG] Game Shell init failed:",err);
    dock("left");
  }
})();
