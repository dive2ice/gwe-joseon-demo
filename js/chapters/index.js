/** Chapter registry */
import * as ch1 from './ch1.js?v=ko-20261008';
import * as ch2 from './ch2.js?v=ko-20261008';
import * as ch3 from './ch3.js?v=ko-20261008';
import * as ch4 from './ch4.js?v=ko-20261008';
import * as ch5 from './ch5.js?v=ko-20261008';
import * as ch6 from './ch6.js?v=ko-20261008';
import * as ch7 from './ch7.js?v=ko-20261008';
import * as ch8 from './ch8.js?v=ko-20261008';
import * as ch9 from './ch9.js?v=ko-20261008';
import * as ch10 from './ch10.js?v=ko-20261008';
import * as ch11 from './ch11.js?v=ko-20261008';
import * as ch12 from './ch12.js?v=ko-20261008';
import * as ch13 from './ch13.js?v=ko-20261008';
import * as ch14 from './ch14.js?v=ko-20261008';
import * as ch15 from './ch15.js?v=ko-20261008';

export const CHAPTER_MODULES = [
  ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, ch9, ch10,
  ch11, ch12, ch13, ch14, ch15,
];

/** Main campaign chapters (hub primary list) */
export const MAIN_CHAPTER_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** DLC 「장인의 실측 서고」 */
export const DLC_CHAPTER_IDS = [11, 12, 13, 14, 15];

export const CHAPTER_META = CHAPTER_MODULES.map((m) => ({
  id: m.id,
  title: m.title,
  blurb: m.blurb,
  steps: m.steps,
  hint: m.hint,
}));

export function createChapter(id, api) {
  const mod = CHAPTER_MODULES.find((m) => m.id === id);
  if (!mod) throw new Error(`Unknown chapter ${id}`);
  return mod.create(api);
}
