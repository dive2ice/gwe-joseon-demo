/**
 * Campaign progress: cleared chapters, last ending, wipe.
 * DLC (11–15) shares cleared storage and never grants Ch10 brass parts.
 */

import {
  loadInventory, saveInventory, clearInventory, grantPartForChapter, syncFromCleared,
} from './inventory.js';
import { clearEvidence } from './ledger.js';

export const CLEARED_KEY = 'gwe-cleared-chapters';
export const ENDING_KEY = 'gwe-ending';
export const ENDING_IDS = ['direct', 'envoy', 'seal'];
export const ENDING_LABELS = {
  direct: '직소',
  envoy: '밀사',
  seal: '봉인',
};

function storeOf(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* ignore */ }
  return null;
}

export function createMemoryStore(init = {}) {
  const map = new Map(Object.entries(init));
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
  };
}

export function loadCleared(storage) {
  const s = storeOf(storage);
  if (!s) return new Set();
  try {
    const raw = s.getItem(CLEARED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map(Number).filter((n) => n >= 1 && n <= 15));
  } catch {
    return new Set();
  }
}

export function saveCleared(set, storage) {
  const s = storeOf(storage);
  if (!s) return;
  try {
    s.setItem(CLEARED_KEY, JSON.stringify([...set]));
  } catch { /* quota */ }
}

export function loadEnding(storage) {
  const s = storeOf(storage);
  if (!s) return null;
  try {
    const raw = s.getItem(ENDING_KEY);
    return ENDING_IDS.includes(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveEnding(id, storage) {
  const s = storeOf(storage);
  if (!s) return null;
  if (!ENDING_IDS.includes(id)) return loadEnding(storage);
  try {
    s.setItem(ENDING_KEY, id);
  } catch { /* quota */ }
  return id;
}

export function clearEnding(storage) {
  const s = storeOf(storage);
  if (s) {
    try { s.removeItem(ENDING_KEY); } catch { /* ignore */ }
  }
  return null;
}

export function grantsBrassPart(chapterId) {
  const id = Number(chapterId);
  return id >= 1 && id <= 9;
}

export function applyClearedChapter(chapterId, clearedSet, invSet, storage) {
  const id = Number(chapterId);
  clearedSet.add(id);
  saveCleared(clearedSet, storage);
  let part = null;
  if (grantsBrassPart(id)) {
    part = grantPartForChapter(id, invSet, storage);
  } else {
    saveInventory(invSet, storage);
  }
  return { part, granted: !!part };
}

export function bootProgress(storage) {
  const cleared = loadCleared(storage);
  const inventory = loadInventory(storage);
  syncFromCleared(cleared, inventory, storage);
  const ending = loadEnding(storage);
  return { cleared, inventory, ending };
}

export function clearCampaign(clearedSet, invSet, storage) {
  clearedSet.clear();
  saveCleared(clearedSet, storage);
  clearInventory(invSet, storage);
  clearEvidence(storage);
  clearEnding(storage);
  return { cleared: clearedSet, inventory: invSet, ending: null };
}
