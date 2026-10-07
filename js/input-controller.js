/** Shared part gestures. Coordinates are CSS pixels; durations are milliseconds. */
export function createInputController({
  canvas, getChapter, hitTest, controls, isPlaying = () => true,
  wakeAudio = () => {}, windowTarget = globalThis.window,
  adaptDragSample = (_owner, _hit, s) => s,
  onGestureChange = () => {},
  documentTarget = globalThis.document, now = () => performance.now(),
  requestFrame = (fn) => requestAnimationFrame(fn),
  cancelFrame = (id) => cancelAnimationFrame(id),
}) {
  const TAP_MOVE_PX = 10;
  let active = null;
  let disposed = false;
  const listeners = [];

  function listen(target, type, fn) {
    target.addEventListener(type, fn, true);
    listeners.push(() => target.removeEventListener(type, fn, true));
  }
  function stopHold(g) {
    const raf = g.raf;
    g.raf = null;
    if (raf !== null) cancelFrame(raf);
  }
  function sample(g, e = g.last, reason) {
    const s = {
      pointerId: g.pointerId, pointerType: g.pointerType,
      startX: g.x, startY: g.y, clientX: e.clientX, clientY: e.clientY,
      dx: e.clientX - g.x, dy: e.clientY - g.y,
      deltaX: e.clientX - g.last.clientX, deltaY: e.clientY - g.last.clientY,
      elapsedMs: now() - g.time,
    };
    if (reason !== undefined) s.reason = reason;
    g.last = { clientX: e.clientX, clientY: e.clientY };
    g.maxDistance = Math.max(g.maxDistance, Math.hypot(s.dx, s.dy));
    return s;
  }
  // Adapters receive a copy: projection cannot change tap distance or hold timing.
  function dragSample(g, s) {
    return adaptDragSample(g.owner, g.hit, { ...s }) ?? s;
  }
  // UI samples stay in CSS pixels. A null state always releases the selection.
  function notifyGesture(g, phase, s) {
    g.notified = true;
    onGestureChange({ owner: g.owner, hit: g.hit, phase, sample: { ...s } });
  }
  function cleanup(g) {
    try { stopHold(g); } finally {
      try {
        if (canvas.hasPointerCapture(g.pointerId)) canvas.releasePointerCapture(g.pointerId);
      } finally {
        // A release callback can open a modal or leave play; never reactivate orbit then.
        controls.enabled = false;
        canvas.style.cursor = 'default';
        try {
          if (isPlaying()) {
            controls.enabled = g.cameraEnabled;
            canvas.style.cursor = 'grab';
          }
        } finally {
          if (g.notified) { g.notified = false; onGestureChange(null); }
        }
      }
    }
  }
  function legacyCancel(g) {
    if (g.started || g.legacyEnded) return;
    g.legacyEnded = true;
    stopHold(g);
    g.owner.onPointerUp?.(g.hit.kind, g.hit.id, { dt: 0, dist: 99 });
  }
  function cancel(reason = 'cancel') {
    const g = active;
    if (!g) return;
    active = null; // releasePointerCapture may synchronously dispatch lostcapture.
    try {
      if (g.started) g.drag.cancel?.(dragSample(g, sample(g, g.last, reason)));
      else legacyCancel(g);
    } finally { cleanup(g); }
  }
  function guarded(fn) {
    return (e) => {
      if (disposed) return;
      try { fn(e); } catch (error) {
        try { cancel('error'); } catch (cancelError) {
          throw new AggregateError([error, cancelError], 'Input callback and cancellation failed');
        }
        throw error;
      }
    };
  }
  function ownerValid(g) {
    if (!isPlaying() || getChapter() !== g.owner) {
      cancel('chapter-change');
      return false;
    }
    return true;
  }
  function hold(g) {
    g.raf = requestFrame(guarded(() => {
      g.raf = null;
      if (active !== g || !ownerValid(g) || g.legacyEnded) return;
      g.owner.onPointerHold(g.hit.kind, g.hit.id, now() - g.time);
      if (active === g && !g.legacyEnded) hold(g);
    }));
  }
  function down(e) {
    if (!isPlaying()) return;
    if (active) { e.stopImmediatePropagation(); return; }
    if (e.isPrimary === false || (e.button !== undefined && e.button !== 0)) return;
    const owner = getChapter();
    if (!owner) return;
    wakeAudio();
    const hit = hitTest(e);
    if (!hit) return; // Background gestures, including pinch, belong to OrbitControls.
    e.stopImmediatePropagation(); // Capture phase precedes OrbitControls' down listener.
    const g = active = {
      owner, hit, pointerId: e.pointerId, pointerType: e.pointerType,
      x: e.clientX, y: e.clientY, time: now(), last: e,
      maxDistance: 0, started: false, legacyEnded: false, notified: false, raf: null,
      cameraEnabled: controls.enabled, drag: null,
    };
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    g.drag = owner.getDragInteraction?.(hit.kind, hit.id, hit) || null;
    // Always start hold feedback; if the pointer travels, drag takes over (stopHold below).
    owner.onPointerDown?.(hit.kind, hit.id);
    if (active === g) notifyGesture(g, 'press', sample(g, e));
    if (active === g && owner.onPointerHold) hold(g);
  }
  function move(e) {
    const g = active;
    if (!g) {
      if (!isPlaying()) { canvas.style.cursor = 'default'; return; }
      const hit = hitTest(e);
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      getChapter()?.onHover?.(hit?.kind ?? null, hit?.id ?? null);
      return;
    }
    if (e.pointerId !== g.pointerId) return;
    e.stopImmediatePropagation();
    if (!ownerValid(g)) return;
    const s = sample(g, e);
    if (g.maxDistance > TAP_MOVE_PX) {
      if (!g.drag) { legacyCancel(g); return; }
      const adapted = dragSample(g, s);
      if (active !== g) return;
      if (!g.started) {
        g.started = true;
        stopHold(g);
        g.legacyEnded = true; // drag owns the gesture; skip hold onPointerUp
        canvas.style.cursor = 'grabbing';
        g.drag.start?.(adapted);
      }
      if (active === g && ownerValid(g)) {
        g.drag.move?.(adapted);
        if (active === g) notifyGesture(g, 'drag', s);
      }
    }
  }
  function up(e) {
    const g = active;
    if (!g || e.pointerId !== g.pointerId) return;
    e.stopImmediatePropagation();
    if (!ownerValid(g)) return;
    const s = sample(g, e);
    active = null;
    try {
      if (g.started) { g.drag.end?.(dragSample(g, s)); return; }
      const hit = hitTest(e);
      const same = hit?.kind === g.hit.kind && hit?.id === g.hit.id;
      if (!g.legacyEnded) {
        if (!same || g.maxDistance > TAP_MOVE_PX) legacyCancel(g);
        else {
          g.legacyEnded = true;
          g.owner.onPointerUp?.(g.hit.kind, g.hit.id, { dt: s.elapsedMs, dist: g.maxDistance });
        }
      }
      if (same && g.maxDistance <= TAP_MOVE_PX && s.elapsedMs <= 550 &&
          getChapter() === g.owner && isPlaying()) {
        if (g.owner.id === 1 && g.hit.kind === 'handle') return;
        g.owner.handleInteract?.(g.hit.kind, g.hit.id, hit);
      }
    } finally { cleanup(g); }
  }
  listen(canvas, 'pointerdown', guarded(down));
  listen(canvas, 'pointermove', guarded(move));
  listen(canvas, 'pointerup', guarded(up));
  for (const [event, reason] of [['pointercancel', 'pointercancel'], ['lostpointercapture', 'lostcapture']]) {
    listen(canvas, event, guarded((e) => {
      if (active?.pointerId !== e.pointerId) return;
      e.stopImmediatePropagation();
      cancel(reason);
    }));
  }
  listen(windowTarget, 'blur', guarded(() => {
    // A HUD control losing focus to the page fires window blur while the document
    // stays focused. That is not leaving the window, and it was cancelling the press.
    if (globalThis.document?.hasFocus?.()) return;
    cancel('blur');
  }));
  listen(documentTarget, 'visibilitychange', guarded(() => {
    if (documentTarget.hidden) cancel('hidden');
  }));
  return {
    cancel,
    dispose() {
      if (disposed) return;
      disposed = true;
      try { cancel('dispose'); } finally { listeners.forEach((remove) => remove()); }
    },
  };
}
