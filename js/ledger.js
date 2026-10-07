/**
 * Evidence ledger. Cross-chapter clues are re-readable so memory is not
 * the puzzle. Ch10 endings require collected ids (or Ch10 field copies
 * that record the same ids).
 */

export const LEDGER_KEY = 'gwe-evidence';

export const EVIDENCE_CATALOG = [
  {
    id: 'ch2-letter',
    chapter: 2,
    title: '탁본에 드러난 글',
    body: '빛이 모이는 곳에 뜻이 모인다. 동궁 서고의 세 번째 궤를 찾으라.',
  },
  {
    id: 'ch4-floor',
    chapter: 4,
    title: '약장 바닥 덧새김',
    body: '걸쇠는 연 칸을 조금 밀어 하중을 푼 뒤에야 옆칸이 산다. 약성패의 둘째·셋째 글씨는 덧씌운 흔적이다.',
  },
  {
    id: 'ch4-contradiction',
    chapter: 4,
    title: '약성패와 덧새김의 모순',
    body: '약성패는 중-상-하를 처방으로 적었으나, 바닥 덧새김은 같은 이치를 걸쇠와 하중으로 설명한다. 패의 둘째·셋째 글씨는 덧씌운 흔적이다.',
  },
  {
    id: 'ch4-gyeongdae-note',
    chapter: 4,
    title: '약재함 쪽지 — 경대',
    body: '경대의 거울은 빛을 품는다. 빗을 감춘 함을 살피라.',
  },
  {
    id: 'ch5-replica',
    chapter: 5,
    fieldChapter: 5,
    title: '경대 탁자 쪽지 (현장 복제)',
    body: '등잔을 옮기고 거울을 돌려 접힌 도안을 비추라. 펼친 도안은 가림판이 된다.',
  },
  {
    id: 'ch5-letter',
    chapter: 5,
    title: '빗함 · 거울의 편지',
    body: '가림판을 지난 빛이 고친 글을 비추자 빗장이 풀렸다. 쪽지에는 별자리가 그려져 있다. 「비천궤의 혼천의를 하늘을 향해 맞추라」.',
  },
  {
    id: 'ch6-letter',
    chapter: 6,
    title: '세자의 유언',
    body: '사천장이어, 네 손이 열어 준 결구는 곧 진실의 열쇠다. 이 글을 조정에 올리되, 궤에 남은 증거를 함께 하라.',
  },
  {
    id: 'ch7-stamp',
    chapter: 7,
    title: '벽사 인장의 진위',
    body: '부적 인장은 사천장 가문의 결구이나, 찍힌 방향은 덧씌운 흔적이다. 공개 심문이면 위조 시비가 인다.',
  },
  {
    id: 'ch8-fold',
    chapter: 8,
    title: '병풍의 남은 겹',
    body: '문은 접힘으로 숨는다. 먹선이 이은 길 너머에 아직 열리지 않은 겹이 있다.',
  },
  {
    id: 'ch9-time',
    chapter: 9,
    title: '규표의 어긋난 시각',
    body: '시계가 가리킨 시각은 공식 변사 시각과 어긋난다. 아직 때가 아니라 읽을 수 있다.',
  },
  {
    id: 'ch10-brief-direct',
    chapter: 10,
    fieldChapter: 10,
    title: '직소 쪽지 (현장 복제)',
    body: '약성패는 덧씌워졌고, 세자의 유언은 이 증거를 조정에 올리라 이른다.',
  },
  {
    id: 'ch10-brief-envoy',
    chapter: 10,
    fieldChapter: 10,
    title: '밀사 쪽지 (현장 복제)',
    body: '경대의 고친 글과 위조 인장은 조정 안이 안전하지 않음을 이른다.',
  },
  {
    id: 'ch10-brief-seal',
    chapter: 10,
    fieldChapter: 10,
    title: '봉인 쪽지 (현장 복제)',
    body: '병풍에 남은 겹과 어긋난 시각은 아직 때가 아니라 이른다.',
  },
];

/** Ending id → ledger ids that must be present before the choice locks in. */
export const ENDING_REQUIREMENTS = {
  direct: ['ch4-contradiction', 'ch6-letter'],
  envoy: ['ch5-letter', 'ch7-stamp'],
  seal: ['ch8-fold', 'ch9-time'],
};

/** In-world / finale field copies. Tapping records the requirement ids. */
export const ENDING_BRIEFS = {
  direct: {
    id: 'direct',
    title: '직소 쪽지 (현장 복제)',
    body: '약성패는 덧씌워졌고, 세자의 유언은 이 증거를 조정에 올리라 이른다.',
    records: ['ch4-contradiction', 'ch6-letter', 'ch10-brief-direct'],
  },
  envoy: {
    id: 'envoy',
    title: '밀사 쪽지 (현장 복제)',
    body: '경대의 고친 글과 위조 인장은 조정 안이 안전하지 않음을 이른다.',
    records: ['ch5-letter', 'ch7-stamp', 'ch10-brief-envoy'],
  },
  seal: {
    id: 'seal',
    title: '봉인 쪽지 (현장 복제)',
    body: '병풍에 남은 겹과 어긋난 시각은 아직 때가 아니라 이른다.',
    records: ['ch8-fold', 'ch9-time', 'ch10-brief-seal'],
  },
};

export const MISSING_EVIDENCE_GUIDE = '증거가 모자랍니다. 장부나 옥좌 쪽지를 살피시오.';

export function evaluateEnding(endingId, foundIds) {
  const need = ENDING_REQUIREMENTS[endingId] || [];
  const found = new Set(foundIds || []);
  const have = need.filter((id) => found.has(id));
  const missing = need.filter((id) => !found.has(id));
  return { ok: missing.length === 0, need, have, missing };
}

export function citeEndingBody(ending, foundIds) {
  const ready = evaluateEnding(ending.id, foundIds);
  const cites = ready.have.map((id) => {
    const e = evidenceById(id);
    return e ? e.title : id;
  });
  if (!cites.length) return ending.body;
  return ending.body + ' 근거: ' + cites.join(' · ') + '.';
}

export const EVIDENCE_IDS = Object.fromEntries(
  EVIDENCE_CATALOG.map((e) => [e.id.replace(/-/g, '_').toUpperCase(), e.id]),
);

function storeOf(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* ignore */ }
  return null;
}

export function loadEvidence(storage) {
  const s = storeOf(storage);
  if (!s) return [];
  try {
    const raw = s.getItem(LEDGER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => EVIDENCE_CATALOG.some((e) => e.id === id));
  } catch {
    return [];
  }
}

export function saveEvidence(ids, storage) {
  const s = storeOf(storage);
  if (!s) return ids;
  s.setItem(LEDGER_KEY, JSON.stringify(ids));
  return ids;
}

export function recordEvidence(id, storage) {
  if (!EVIDENCE_CATALOG.some((e) => e.id === id)) return loadEvidence(storage);
  const found = loadEvidence(storage);
  if (!found.includes(id)) {
    found.push(id);
    saveEvidence(found, storage);
  }
  return found;
}

export function listEvidence(foundIds, chapterId) {
  const found = new Set(foundIds || []);
  return EVIDENCE_CATALOG.filter((e) => found.has(e.id) || e.fieldChapter === chapterId);
}

export function clearEvidence(storage) {
  const s = storeOf(storage);
  if (s) {
    try { s.removeItem(LEDGER_KEY); } catch { /* ignore */ }
  }
  return [];
}

export function evidenceById(id) {
  return EVIDENCE_CATALOG.find((e) => e.id === id) || null;
}
