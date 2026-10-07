/**
 * 9 brass parts unlocked by clearing chapters 1–9.
 * Persisted in localStorage; Ch10 reads this inventory.
 */
export const PARTS = [
  { id: 1, key: 'part1', name: '반닫이 장부쇠', from: 1 },
  { id: 2, key: 'part2', name: '자개 단추', from: 2 },
  { id: 3, key: 'part3', name: '어보 인뉴', from: 3 },
  { id: 4, key: 'part4', name: '약장 약숟가락', from: 4 },
  { id: 5, key: 'part5', name: '경대 경쇠', from: 5 },
  { id: 6, key: 'part6', name: '혼천 고리쇠', from: 6 },
  { id: 7, key: 'part7', name: '벽사 부적판', from: 7 },
  { id: 8, key: 'part8', name: '수문 먹선고리', from: 8 },
  { id: 9, key: 'part9', name: '규표 진주축', from: 9 },
];

// Keyway profiles are shared by the carried pieces and the carved socket faces.
// They identify shapes, never placement numbers or an ordered answer list.
export const PART_MARKS = Object.freeze({1:'┬',2:'◇',3:'⊞',4:'┤',5:'◒',6:'◎',7:'╳',8:'⌁',9:'⊙'});

/** Correct Ch10 directional slot for each part id (1–9) */
export const PART_SLOT = {
  1: 'N',
  2: 'NE',
  3: 'E',
  4: 'SE',
  5: 'S',
  6: 'SW',
  7: 'W',
  8: 'NW',
  9: 'C',
};

export const SLOT_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'C'];

export const INV_KEY = 'gwe-inventory-parts';

function storeOf(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* ignore */ }
  return null;
}

export function loadInventory(storage) {
  const s = storeOf(storage);
  if (!s) return new Set();
  try {
    const raw = s.getItem(INV_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map(Number).filter((n) => n >= 1 && n <= 9));
  } catch {
    return new Set();
  }
}

export function saveInventory(set, storage) {
  const s = storeOf(storage);
  if (!s) return;
  try {
    s.setItem(INV_KEY, JSON.stringify([...set]));
  } catch { /* quota */ }
}

/** Grant part for a cleared chapter (1–9). Returns part meta or null. */
export function grantPartForChapter(chapterId, invSet, storage) {
  const part = PARTS.find((p) => p.from === chapterId);
  if (!part) return null;
  invSet.add(part.id);
  saveInventory(invSet, storage);
  return part;
}

/** Sync inventory from cleared chapter ids (backfill). DLC ids never match PARTS.from. */
export function syncFromCleared(clearedSet, invSet, storage) {
  let changed = false;
  for (const p of PARTS) {
    if (clearedSet.has(p.from) && !invSet.has(p.id)) {
      invSet.add(p.id);
      changed = true;
    }
  }
  if (changed) saveInventory(invSet, storage);
  return invSet;
}

export function grantAllParts(invSet, storage) {
  PARTS.forEach((p) => invSet.add(p.id));
  saveInventory(invSet, storage);
  return invSet;
}

export function clearInventory(invSet, storage) {
  invSet.clear();
  saveInventory(invSet, storage);
}

export function getOwnedParts(invSet) {
  return PARTS.filter((p) => invSet.has(p.id));
}
