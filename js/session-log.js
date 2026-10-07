/**
 * Representative-segment session log (GW-006).
 * Dwell, unique attempts, repeats, hint stage, misses, last rule.
 * Never raises hintLevel. A 3-minute same-action stall only arms the
 * help-button reminder.
 */

export const SESSION_KEY = 'gwe-session-log';
export const EVAL_KEY = 'gwe-eval-sheets';
export const STALL_MS = 180000;
export const STALL_GUIDE = '같은 시도를 반복하고 있소. 다른 부분을 살피거나 힌트를 요청할 수 있소.';
export const MAX_EVENTS = 2000;

export const EVAL_RUBRIC = {
  cohortTarget: { experienced: 4, beginner: 4 },
  hintStageMax: 2,
  hintPassCount: 6,
  ahaMin: 2,
  ahaPassCount: 5,
  funMedianMin: 4,
  discomfortMedianMax: 2,
  stallMs: STALL_MS,
  spoilerLeaksMax: 0,
  hardLocksMax: 0,
  progressLossMax: 0,
};

function storeOf(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* ignore */ }
  return null;
}

function loadJson(key, fallback, storage) {
  const s = storeOf(storage);
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function createSessionLog(opts = {}) {
  const now = opts.now || (() => (
    typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
  ));
  const stallMs = opts.stallMs ?? STALL_MS;
  const storage = opts.storage;
  let events = [];
  let chapterId = null;
  let lastActionKey = null;
  let streakStart = 0;
  let lastObservationAt = 0;
  let stallArmed = false;
  const stallFlaggedKeys = new Set();

  function persist() {
    const s = storeOf(storage);
    if (!s) return;
    try {
      s.setItem(SESSION_KEY, JSON.stringify({ chapterId, events: events.slice(-MAX_EVENTS) }));
    } catch { /* quota */ }
  }

  function push(rec) {
    events.push(rec);
    if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
    persist();
    return rec;
  }

  function event(type, payload = {}) {
    return push({ t: now(), type, chapter: chapterId, ...payload });
  }

  function noteAction(key, { observation = false } = {}) {
    const t = now();
    if (observation) {
      lastObservationAt = t;
      lastActionKey = key;
      streakStart = t;
      return null;
    }
    if (key !== lastActionKey) {
      lastActionKey = key;
      streakStart = t;
    }
    if ((t - lastObservationAt) >= stallMs && (t - streakStart) >= stallMs) {
      const stallKey = `${chapterId}:${key}`;
      if (!stallFlaggedKeys.has(stallKey)) {
        stallFlaggedKeys.add(stallKey);
        stallArmed = true;
        return event('stall', { action: key, idleMs: t - lastObservationAt });
      }
    }
    return null;
  }

  function consumeStallGuide() {
    if (!stallArmed) return null;
    stallArmed = false;
    event('stall-guide', { text: STALL_GUIDE });
    return STALL_GUIDE;
  }

  function beginChapter(id) {
    chapterId = id;
    lastActionKey = null;
    const t = now();
    streakStart = t;
    lastObservationAt = t;
    stallArmed = false;
    event('chapter-start', { chapter: id });
  }

  function endChapter(extra = {}) {
    event('chapter-end', extra);
  }

  function reset() {
    events = [];
    chapterId = null;
    lastActionKey = null;
    stallArmed = false;
    stallFlaggedKeys.clear();
    persist();
  }

  function snapshot() {
    return { chapterId, events: events.map((e) => ({ ...e })) };
  }

  function summary() {
    return summarizeSession(events);
  }

  return {
    event, noteAction, consumeStallGuide, beginChapter, endChapter,
    reset, snapshot, summary, stallMs, STALL_GUIDE,
  };
}

export function summarizeSession(events) {
  const byCh = {};
  for (const e of events) {
    const c = e.chapter;
    if (c == null) continue;
    if (!byCh[c]) {
      byCh[c] = {
        chapter: c,
        start: null,
        end: null,
        dwellMs: 0,
        uniqueAttempts: [],
        uniqueSet: new Set(),
        repeats: {},
        hintLevel: 0,
        wrongs: 0,
        lastRule: null,
        lastFeel: null,
        stalls: [],
        phases: [],
        evidence: [],
      };
    }
    const row = byCh[c];
    if (e.type === 'chapter-start') row.start = e.t;
    if (e.type === 'chapter-end') row.end = e.t;
    if (row.start != null) row.dwellMs = (row.end ?? e.t) - row.start;
    if (e.type === 'interact' || e.type === 'blocked' || e.type === 'drag-end') {
      const key = `${e.type}:${e.kind || ''}:${e.iid || ''}`;
      if (!row.uniqueSet.has(key)) {
        row.uniqueSet.add(key);
        row.uniqueAttempts.push(key);
      } else {
        row.repeats[key] = (row.repeats[key] || 1) + 1;
      }
    }
    if (e.hintLevel != null) row.hintLevel = Math.max(row.hintLevel, Number(e.hintLevel) || 0);
    if (e.type === 'blocked' || e.type === 'wrong') row.wrongs += 1;
    if (e.type === 'feel') {
      row.lastFeel = { kind: e.kind, text: e.text };
      if (e.text) row.lastRule = e.text;
    }
    if (e.type === 'toast' && e.msg && /걸쇠|하중|빛|가림판|빗장/.test(e.msg)) {
      row.lastRule = e.msg;
    }
    if (e.type === 'stall') row.stalls.push({ action: e.action, idleMs: e.idleMs });
    if (e.type === 'phase' && e.to) row.phases.push(e.to);
    if (e.type === 'evidence' && e.id) row.evidence.push(e.id);
  }
  return Object.values(byCh).map((row) => {
    const copy = { ...row };
    delete copy.uniqueSet;
    return copy;
  });
}

export function loadEvalSheets(storage) {
  const raw = loadJson(EVAL_KEY, [], storage);
  return Array.isArray(raw) ? raw : [];
}

function clampScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(1, Math.min(5, Math.round(v)));
}

export function saveEvalSheet(sheet, storage) {
  const sheets = loadEvalSheets(storage);
  const row = {
    id: sheet.id || ('eval-' + Date.now()),
    at: sheet.at || Date.now(),
    cohort: sheet.cohort === 'experienced' ? 'experienced' : 'beginner',
    fun: clampScore(sheet.fun),
    discomfort: clampScore(sheet.discomfort),
    aha: Array.isArray(sheet.aha) ? sheet.aha.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 4) : [],
    causation: String(sheet.causation || '').trim(),
    nextIntent: clampScore(sheet.nextIntent),
    hintStage: Number(sheet.hintStage) || 0,
    notes: String(sheet.notes || '').trim(),
  };
  sheets.push(row);
  const s = storeOf(storage);
  if (s) s.setItem(EVAL_KEY, JSON.stringify(sheets));
  return sheets;
}

export function clearEvalSheets(storage) {
  const s = storeOf(storage);
  if (s) s.removeItem(EVAL_KEY);
  return [];
}

function median(nums) {
  const a = nums.filter((n) => n != null).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function attachChapterLog(ch, session, { onStall } = {}) {
  const hi = ch.handleInteract && ch.handleInteract.bind(ch);
  if (hi) {
    ch.handleInteract = (kind, iid, userData) => {
      const before = ch.getState ? ch.getState() : null;
      hi(kind, iid, userData);
      const after = ch.getState ? ch.getState() : null;
      session.event('interact', {
        kind, iid, phase: after && after.phase, hintLevel: after && after.hintLevel,
      });
      const feel = after && after.lastFeel;
      const beforeFeel = before && before.lastFeel;
      const feelChanged = !!(feel && JSON.stringify(feel) !== JSON.stringify(beforeFeel));
      if (feel && feel.kind === 'blocked') {
        session.event('blocked', { kind, iid, text: feel.text });
        session.noteAction('blocked:' + kind + ':' + (iid || ''), { observation: feelChanged });
      } else {
        session.noteAction('interact:' + kind + ':' + (iid || ''), { observation: true });
      }
      if (before && after && before.phase !== after.phase) {
        session.event('phase', { from: before.phase, to: after.phase });
        session.noteAction('phase:' + after.phase, { observation: true });
      }
      if (onStall) onStall(session.consumeStallGuide());
    };
  }
  const gd = ch.getDragInteraction && ch.getDragInteraction.bind(ch);
  if (gd) {
    ch.getDragInteraction = (kind, iid) => {
      const inner = gd(kind, iid);
      if (!inner) return null;
      return {
        start(s) { session.event('drag-start', { kind, iid }); if (inner.start) inner.start(s); },
        move(s) { if (inner.move) inner.move(s); },
        end(s) {
          if (inner.end) inner.end(s);
          session.event('drag-end', { kind, iid });
          session.noteAction('drag:' + kind + ':' + (iid || ''), { observation: true });
        },
        cancel(s) { if (inner.cancel) inner.cancel(s); session.event('drag-cancel', { kind, iid }); },
      };
    };
  }
  const rh = ch.revealHint && ch.revealHint.bind(ch);
  if (rh) {
    ch.revealHint = () => {
      rh();
      const st = ch.getState ? ch.getState() : {};
      session.event('hint', { hintLevel: st.hintLevel });
      session.noteAction('hint', { observation: true });
    };
  }
  const ce = ch.toggleCraftEye && ch.toggleCraftEye.bind(ch);
  if (ce) {
    ch.toggleCraftEye = () => {
      ce();
      session.event('craft-eye');
      session.noteAction('craft-eye', { observation: true });
    };
  }
  return ch;
}

export function scoreSheets(sheets) {
  const list = Array.isArray(sheets) ? sheets : [];
  const n = list.length;
  const experienced = list.filter((s) => s.cohort === 'experienced').length;
  const beginner = list.filter((s) => s.cohort === 'beginner').length;
  const hintPass = list.filter((s) => (s.hintStage ?? 99) <= EVAL_RUBRIC.hintStageMax && s.causation).length;
  const ahaPass = list.filter((s) => (s.aha || []).length >= EVAL_RUBRIC.ahaMin).length;
  const funMedian = median(list.map((s) => s.fun));
  const discomfortMedian = median(list.map((s) => s.discomfort));
  const humanVerified = n >= 8 && experienced >= 4 && beginner >= 4;
  const unmet = [];
  if (!humanVerified) unmet.push('human-n<8');
  if (humanVerified && hintPass < EVAL_RUBRIC.hintPassCount) unmet.push('hint-pass<6/8');
  if (humanVerified && ahaPass < EVAL_RUBRIC.ahaPassCount) unmet.push('aha-pass<5/8');
  if (humanVerified && (funMedian == null || funMedian < EVAL_RUBRIC.funMedianMin)) unmet.push('fun-median<4');
  if (humanVerified && (discomfortMedian == null || discomfortMedian > EVAL_RUBRIC.discomfortMedianMax)) {
    unmet.push('discomfort-median>2');
  }
  return {
    n, experienced, beginner, hintPass, ahaPass, funMedian, discomfortMedian, humanVerified, unmet,
  };
}
