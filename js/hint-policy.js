/**
 * Request-only hint policy (GW-001), shared by main-campaign chapters.
 * hintLevel advances only through revealHint. Soft-fail never dumps FULL.
 */

export const SOFT_FAIL_GUIDE = '막힌 까닭을 살펴보시오. 도움이 필요하면 힌트를 요청할 수 있소.';

export function applyOrderHint(api, text) {
  if (api.setOrderHint) api.setOrderHint(text);
  else if (api.orderHintEl) api.orderHintEl.innerHTML = text;
}

export function bumpHintLevel(level) {
  return Math.min(3, (level || 0) + 1);
}

export function hintTextAt(level, pack) {
  if (level >= 3) return pack.full;
  if (level === 2) return pack.relation;
  if (level === 1) return pack.partial;
  return pack.base;
}

export function requestHint(api, level, pack) {
  const text = hintTextAt(level, pack);
  applyOrderHint(api, text);
  api.toast(level >= 3 ? ('힌트: ' + pack.full) : ('힌트: ' + text), true);
  if (api.playClick) api.playClick();
  return text;
}

export function softFailNoHint(api, shakeFn) {
  if (shakeFn) shakeFn();
  if (api.playWrong) api.playWrong();
  if (api.vibrate) api.vibrate([30, 40, 30, 40, 60]);
  api.toast(SOFT_FAIL_GUIDE);
}
