// Authored location and story beats. Events describe discoveries, never puzzle answers.
const beat = (title, text, effect = 'reveal') => ({ title, text, effect });
export const INTRO_BEATS = [
  { label: '조선 후기 · 비가 그친 밤', title: '동궁의 불이 꺼졌다', text: '세자가 죽은 뒤, 침전은 봉해졌다. 그 안에서 열 목가구가 발견되었다.', art: 'palace' },
  { label: '사천장에게 남긴 서신', title: '나무는 거짓을 기억한다', text: '“글은 지울 수 있어도, 장부에 남은 힘과 놋쇠에 밴 손자국은 지울 수 없다.” 봉인된 함에서 당신의 가문 이름이 나왔다.', art: 'letter' },
  { label: '열 궤 · 하나의 사건', title: '당신의 손으로 밝혀라', text: '당신은 사천장의 후예. 가구를 열어 흩어진 증거를 잇고, 마지막 궤 앞에서 그 비밀의 행방을 결정해야 한다.', art: 'chest' },
];

export const STAGE_SCENES = {
  1: { location: '사천장의 작업방', time: '초경 · 등잔불', motif: 'workshop', intro: '봉인된 반닫이. 오래된 결구에는 누군가 급히 닫은 흔적이 남아 있다.', events: {
    B: beat('안에서 들려온 울림', '장부가 풀리자, 빈 함에서는 나올 수 없는 낮은 울림이 돌아왔다.', 'resonance'),
    D: beat('두 겹의 바닥', '앞판 뒤에 또 하나의 서랍이 있었다. 오래된 나무 사이로 종이의 가장자리가 보인다.', 'reveal'),
  } },
  2: { location: '달빛 드는 서재', time: '이경 · 창호 너머 달', motif: 'study', intro: '흑칠 위의 자개만 차갑게 빛난다. 책상 위에는 쓰지 않은 한지가 놓여 있다.', events: {
    B: beat('흑칠 아래의 글', '자개의 빛이 모이자, 칠 아래 묻혀 있던 획이 천천히 떠올랐다.', 'moon'),
  } },
  3: { location: '어보 봉안실', time: '봉안 · 붉은 비단', motif: 'royal', intro: '왕실의 인장이 잠든 방. 궤를 감싼 붉은 비단에는 먼지가 쌓여 있다.', events: {
    B: beat('봉인 속의 기계', '왕실 문양 아래에서 톱니가 움직였다. 장식이라고 여긴 부분이 장치였다.', 'resonance'),
  } },
  4: { location: '동궁의 약방', time: '새벽 전 · 남은 처방', motif: 'herbs', intro: '약향이 가시지 않은 약방. 서랍마다 다른 손이 남긴 낡은 표가 달려 있다.', events: {
    B: beat('덧새긴 처방', '서랍이 비켜난 자리에 지워진 글이 남아 있다. 누군가 같은 기록을 두 번 새겼다.', 'reveal'),
  } },
  5: { location: '침전 안쪽 화장방', time: '여명 · 접힌 도안', motif: 'mirror', intro: '비어 있는 자리 앞에 경대만 남았다. 거울은 등잔불을 벽으로 돌려보낸다.', events: {
    B: beat('빛에 걸린 종이', '거울에서 돌아온 빛이 접힌 도안을 드러냈다. 종이에 남은 그림자가 흔들린다.', 'moon'),
    C: beat('고쳐 쓴 한 줄', '종이를 통과한 빛 속에서 다른 먹색이 드러났다. 처음부터 같은 글은 아니었다.', 'reveal'),
  } },
  6: { location: '관상감의 밤 관측실', time: '삼경 · 북쪽 하늘', motif: 'stars', intro: '열린 창 너머에 별이 걸려 있다. 혼천의 고리는 멈췄지만, 관측 기록은 남았다.', events: {
    B: beat('멈춘 밤의 좌표', '고리가 맞물리자 별판이 살아났다. 관측자는 이 밤을 기계 안에 남겨 두었다.', 'stars'),
  } },
  7: { location: '봉쇄된 회랑', time: '바람 · 문 앞의 부적', motif: 'ward', intro: '닫힌 문마다 부적이 붙었다. 바람에 흔들리는 종이와 함의 인장은 같은 모양이다.', events: {
    B: beat('두 인장의 흔적', '찍힌 먹 아래에서 다른 획이 보인다. 같은 문양을 남긴 손은 하나가 아니었다.', 'wind'),
  } },
  8: { location: '수문장 대기청', time: '비 갠 뒤 · 겹친 산수', motif: 'landscape', intro: '병풍이 길을 가리고 있다. 산과 물을 그린 먹선이 접힌 면을 따라 끊어진다.', events: {
    B: beat('이어지는 산수', '펼친 폭 사이로 물길이 이어진다. 평면으로 보았던 그림에 깊이가 있었다.', 'wind'),
    C: beat('먹선 너머의 길', '먹선이 맞물리는 순간, 병풍 뒤 그림자가 달라졌다. 접힌 면이 길을 숨기고 있다.', 'reveal'),
  } },
  9: { location: '규표 관측 마루', time: '동틀 무렵 · 긴 그림자', motif: 'clock', intro: '마루에 해가 들기 시작했다. 멈춘 시계와 규표의 그림자는 서로 다른 때를 가리킨다.', events: {
    B: beat('다시 흐르는 시간', '진주가 자리에 앉자 마른 톱니 소리가 돌아왔다. 멈춘 밤의 시간이 움직인다.', 'dawn'),
  } },
  10: { location: '태극 옥좌의 밀실', time: '마지막 봉인 · 아홉 흔적', motif: 'throne', intro: '모든 궤에서 온 놋쇠가 이곳을 가리킨다. 옥좌 뒤에는 아직 열리지 않은 방이 있다.', events: {
    B: beat('열 궤가 잇는 하나', '아홉 놋쇠가 제자리를 찾았다. 서로 다른 가구의 흔적이 같은 장치에 닿아 있다.', 'resonance'),
    D: beat('기록의 행방', '마지막 봉인이 풀렸다. 이제 당신이 밝혀낸 증거를 누구에게 맡길지 결정해야 한다.', 'reveal'),
  } },
  11: { location: '장인의 곡물 창고', time: '실측 서고 · 뒤주', motif: 'grain', intro: '쌀겨 냄새가 남은 창고. 뒤주의 보와 추에는 손으로 고친 눈금이 있다.', events: {
    B: beat('무게가 남긴 기록', '걸쇠가 풀리자 뚜껑의 무게가 보에 실렸다. 사용한 사람의 습관이 눈금에 남았다.', 'resonance'),
  } },
  12: { location: '혼례 준비방', time: '실측 서고 · 혼수함', motif: 'wedding', intro: '붉은 천과 푸른 천 사이에 혼수함이 놓였다. 겹마다 서로 다른 접힘 자국이 남아 있다.', events: {
    B: beat('옷감 아래의 봉인', '마지막 겹이 걷히자 오래된 자물쇠가 보였다. 선물 안에 봉인이 더 있었다.', 'wind'),
  } },
  13: { location: '필사의 문방', time: '실측 서고 · 문갑', motif: 'scribe', intro: '먹과 붓, 묶어 둔 장부. 낮은 문갑에는 한 사람이 오래 쓴 손자국이 있다.', events: {
    B: beat('서랍 뒤의 장부못', '맞물린 서랍 뒤로 작은 못이 드러났다. 짜맞춤 한가운데 편지가 감추어져 있다.', 'reveal'),
  } },
  14: { location: '비단 보관방', time: '실측 서고 · 이층농', motif: 'silk', intro: '층층이 접어 둔 비단 곁에 이층농이 서 있다. 아래 문에는 오래 눌린 흔적이 있다.', events: {
    B: beat('두 층을 잇는 힘', '층문이 열리자 눌려 있던 다리의 핀이 보인다. 가구 전체가 하나의 결구였다.', 'resonance'),
  } },
  15: { location: '의궤 기록고', time: '실측 서고 · 마지막 기록', motif: 'archive', intro: '한지 묶음과 봉인 끈이 가득한 기록고. 마지막 함에는 장인이 남긴 기록이 잠들어 있다.', events: {
    B: beat('봉인 끈에 남은 손', '트레이 뒤의 끈마다 매듭이 다르다. 닫은 사람은 여는 법도 함께 남겼다.', 'reveal'),
  } },
};

/** Track confirmed discoveries for one attempt; reversible puzzle phases do not replay them. */
export function createBeatTracker() {
  let chapterId = 0;
  const seen = new Set();
  return {
    reset(id = 0) { chapterId = id; seen.clear(); },
    advance(step, done = []) {
      if (!step || !done.length || seen.has(step)) return null;
      const event = STAGE_SCENES[chapterId]?.events[step];
      if (!event) return null;
      seen.add(step);
      return { ...event, chapterId, step };
    },
    snapshot: () => ({ chapterId, seen: [...seen] }),
  };
}
