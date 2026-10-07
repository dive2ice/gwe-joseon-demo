/** Procedural Web Audio: wood / brass / latch SFX. No external assets. */

let ctx = null;
let unlockBound = false;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') {
    try { ctx.resume(); } catch (_) { /* ignore */ }
  }
  return ctx;
}

/** Unlock / resume AudioContext on a user gesture (탐구 시작 / first tap). iOS Safari requires this. */
export function resumeAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') {
    try { c.resume(); } catch (_) { /* ignore */ }
  }
  return c;
}

function unlockAudioFromGesture() {
  resumeAudio();
}

/** Bind once: any first pointer/touch/click resumes audio (Safari autoplay policy). */
export function bindAudioUnlock(target = typeof document !== 'undefined' ? document : null) {
  if (unlockBound || !target) return;
  unlockBound = true;
  const opts = { capture: true, passive: true };
  const once = () => {
    unlockAudioFromGesture();
    target.removeEventListener('pointerdown', once, opts);
    target.removeEventListener('touchstart', once, opts);
    target.removeEventListener('click', once, opts);
  };
  target.addEventListener('pointerdown', once, opts);
  target.addEventListener('touchstart', once, opts);
  target.addEventListener('click', once, opts);
}

function tone(freq, dur, type = 'sine', gain = 0.12, delay = 0, slideTo = null) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noiseBurst(dur = 0.06, gain = 0.08, cutoff = 900) {
  const c = getCtx();
  if (!c) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  g.gain.value = gain;
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start();
}

/** Soft wood thunk — joinery settle / lid */
export function playThunk() {
  noiseBurst(0.07, 0.1, 700);
  tone(120, 0.12, 'triangle', 0.1);
  tone(80, 0.18, 'sine', 0.06, 0.02);
}

/** Distinct joinery tongue slide into mortise */
export function playJoinerySlide() {
  noiseBurst(0.11, 0.07, 1400);
  tone(220, 0.14, 'sawtooth', 0.035, 0, 90);
  tone(160, 0.16, 'triangle', 0.05, 0.02, 70);
  setTimeout(() => playWoodThunk(), 120);
}

/** Deeper wood body thunk */
export function playWoodThunk() {
  noiseBurst(0.09, 0.12, 550);
  tone(95, 0.16, 'triangle', 0.11);
  tone(55, 0.22, 'sine', 0.07, 0.025);
}

/** Brass scrape — pin / fittings */
export function playBrassScrape() {
  noiseBurst(0.1, 0.06, 2800);
  tone(680, 0.1, 'sawtooth', 0.03, 0, 320);
  tone(440, 0.12, 'square', 0.025, 0.02, 200);
}

/** Sharp latch / bolt clack */
export function playLatchClack() {
  noiseBurst(0.035, 0.09, 3200);
  tone(520, 0.05, 'square', 0.06);
  tone(260, 0.08, 'triangle', 0.045, 0.015);
  tone(180, 0.1, 'sine', 0.03, 0.04);
}

/** Drawer rumble as it extends */
export function playDrawerRumble() {
  noiseBurst(0.28, 0.09, 480);
  tone(70, 0.32, 'sawtooth', 0.045, 0, 45);
  tone(110, 0.22, 'triangle', 0.04, 0.04);
  tone(90, 0.18, 'sine', 0.03, 0.12);
}

/** Sharp click — latch / handle (compat) */
export function playClick() {
  noiseBurst(0.04, 0.07, 1800);
  tone(420, 0.06, 'square', 0.05);
  tone(210, 0.09, 'triangle', 0.04, 0.01);
}

/** Soft unlock chime */
export function playUnlock() {
  playClick();
  tone(523.25, 0.2, 'sine', 0.08, 0.05);
  tone(659.25, 0.28, 'sine', 0.07, 0.12);
  tone(783.99, 0.35, 'sine', 0.05, 0.2);
}

/** Soft reset / wrong-order buzz */
export function playWrong() {
  tone(140, 0.15, 'sawtooth', 0.045);
  tone(90, 0.22, 'triangle', 0.055, 0.05);
  noiseBurst(0.08, 0.06, 600);
}


/** Mother-of-pearl tile tap — bright short click */
export function playNacreClick() {
  noiseBurst(0.03, 0.055, 2400);
  tone(620, 0.05, 'triangle', 0.045);
  tone(880, 0.04, 'sine', 0.03, 0.015);
}

/** Soft iridescent chime when a tile locks correct */
export function playNacreChime() {
  tone(523.25, 0.14, 'sine', 0.06);
  tone(659.25, 0.18, 'sine', 0.05, 0.06);
  tone(987.77, 0.22, 'sine', 0.035, 0.12);
}

/** Paper rub / 탁본 friction */
export function playRubPaper() {
  noiseBurst(0.12, 0.08, 1600);
  tone(180, 0.1, 'sawtooth', 0.025, 0, 90);
  noiseBurst(0.08, 0.05, 900);
}

export function vibrate(pattern = 30) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) { /* ignore */ }
}

/** Low, spacious story accents; they leave the mechanical feedback in the foreground. */
export function playStoryCue(kind = 'reveal') {
  const base = kind === 'stars' || kind === 'moon' ? 220 : kind === 'resonance' ? 110 : 146.83;
  if (kind === 'wind') noiseBurst(.65, .025, 460);
  tone(base, 1.25, 'sine', .032);
  tone(base * 1.5, 1.65, 'sine', .025, .18);
  tone(base * 2, 1.4, 'triangle', .012, .42);
}
