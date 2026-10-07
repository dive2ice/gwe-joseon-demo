/** Shared tween helpers — chapter modules push into the shared `anims` array. */

export function prefersReducedMotion(win = globalThis) {
  try {
    const mq = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)');
    return !!(mq && mq.matches);
  } catch {
    return false;
  }
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

const EASINGS = {
  inOut: easeInOut,
  inOutCubic: easeInOutCubic,
  outCubic: easeOutCubic,
  outQuint: easeOutQuint,
  outExpo: easeOutExpo,
  outBack: easeOutBack,
};

export function createAnimSystem() {
  const anims = [];

  function animateTo(obj, prop, end, duration, onDone, easing = 'inOut') {
    if (prefersReducedMotion()) {
      obj[prop] = end;
      if (onDone) onDone();
      return;
    }
    const start = obj[prop];
    const t0 = performance.now();
    const ease = EASINGS[easing] || easeInOut;
    anims.push({
      update(now) {
        const t = Math.min(1, (now - t0) / duration);
        const e = ease(t);
        obj[prop] = start + (end - start) * e;
        if (t >= 1) {
          if (onDone) onDone();
          return false;
        }
        return true;
      },
    });
  }

  function animateVec3(vec, end, duration, onDone, easing = 'inOut') {
    if (prefersReducedMotion()) {
      vec.x = end.x; vec.y = end.y; vec.z = end.z;
      if (onDone) onDone();
      return;
    }
    const sx = vec.x; const sy = vec.y; const sz = vec.z;
    const t0 = performance.now();
    const ease = EASINGS[easing] || easeInOut;
    anims.push({
      update(now) {
        const t = Math.min(1, (now - t0) / duration);
        const e = ease(t);
        vec.x = sx + (end.x - sx) * e;
        vec.y = sy + (end.y - sy) * e;
        vec.z = sz + (end.z - sz) * e;
        if (t >= 1) {
          if (onDone) onDone();
          return false;
        }
        return true;
      },
    });
  }

  /** Horizontal shake for soft-fail feedback (dual-frequency damp) */
  function shake(obj, amplitude = 0.04, duration = 320, onDone) {
    if (prefersReducedMotion()) {
      if (onDone) onDone();
      return;
    }
    const baseX = obj.position ? obj.position.x : obj.x;
    const isVec = !!obj.position;
    const t0 = performance.now();
    anims.push({
      update(now) {
        const t = Math.min(1, (now - t0) / duration);
        const damp = (1 - t) * (1 - t);
        const offset = (Math.sin(t * Math.PI * 10) * 0.7 + Math.sin(t * Math.PI * 18) * 0.3) * amplitude * damp;
        if (isVec) obj.position.x = baseX + offset;
        else obj.x = baseX + offset;
        if (t >= 1) {
          if (isVec) obj.position.x = baseX;
          else obj.x = baseX;
          if (onDone) onDone();
          return false;
        }
        return true;
      },
    });
  }

  /** Part bounce along one axis, then return to the start. */
  function recoil(obj, axis = 'z', amplitude = 0.02, duration = 240, onDone) {
    if (prefersReducedMotion()) {
      if (onDone) onDone();
      return;
    }
    const pos = obj.position || obj;
    if (pos[axis] == null) {
      if (onDone) onDone();
      return;
    }
    const base = pos[axis];
    const t0 = performance.now();
    anims.push({
      update(now) {
        const t = Math.min(1, (now - t0) / duration);
        pos[axis] = base + Math.sin(t * Math.PI) * (1 - t) * amplitude;
        if (t >= 1) {
          pos[axis] = base;
          if (onDone) onDone();
          return false;
        }
        return true;
      },
    });
  }

  function tick(now) {
    for (let i = anims.length - 1; i >= 0; i--) {
      if (!anims[i].update(now)) anims.splice(i, 1);
    }
  }

  function clear() {
    anims.length = 0;
  }

  return { anims, animateTo, animateVec3, shake, recoil, tick, clear };
}
