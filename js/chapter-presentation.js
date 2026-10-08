// Framing is authored around the physical clue planes. Values do not alter puzzle rules.
const view = (aim, width, height, direction, fillX = .84, fillY = .72) => ({aim,width,height,direction,fillX,fillY});
const mood = (background=0x10191b, key=0xffe0b8, fill=0xafc7d2, paper=0x526569, mat=0x343a35) => ({background,key,fill,paper,mat});
export const chapterPresentation = {
  1: {...mood(), overview:view([0,.48,.02],1.65,1.2,[.85,.5,1]), detail:view([0,.47,.30],1.08,.72,[.45,.22,1])},
  2: {...mood(0x11191a,0xffe4c1,0xb4d7dc,0x486267,0x323b3b), overview:view([0,.44,0],1.35,.9,[.12,.9,.62],.72,.55), detail:view([0,.52,.02],.86,.58,[.12,.9,.62],.78,.70)},
  3: {...mood(0x1b1719,0xffd4a4,0xc5c6dc,0x65585d,0x413530), overview:view([0,.46,.10],1.20,.95,[.04,.28,1],.82,.78), detail:view([0,.43,.30],.20,.20,[.04,.12,1],.82,.78)},
  4: {...mood(0x171c16,0xffdfb0,0xc6d5b3,0x63705a,0x3f4230), overview:view([0,.72,0],1.05,1.54,[.48,.22,1]), detail:view([0,.94,.10],1.05*.64,1.54*.64,[.48,.22,1])},
  5: {...mood(0x211b20,0xffddcb,0xd4c0d6,0x766169,0x46343d), overview:view([0,.59,0],1.65,1.26,[.55,.36,1]), detail:view([0,.81,.10],1.65*.64,1.26*.64,[.55,.36,1])},
  6: {...mood(0x101820,0xffe1af,0xacc9ef,0x3b5267,0x293842), overview:view([0,.74,.12],.9,1.15,[.06,.72,1],.78,.72), detail:view([0,.80,.14],.72,.85,[.06,.72,1],.78,.76)},
  7: {...mood(0x1c1716,0xffd5af,0xbccbd1,0x61554c,0x40352e), overview:view([-.06,.66,.06],1.12,.92,[.04,1.25,.62],.78,.70), detail:view([-.06,.66,.08],.79,.66,[.04,1.25,.62],.78,.74)},
  8: {...mood(0x19201d,0xffe7c9,0xbcd6c8,0x586960,0x384237), overview:view([0,.58,.04],1.45,1.25,[.18,.35,1]), detail:view([0,.76,.06],.99,.84,[.12,.25,1])},
  9: {...mood(0x1b1b19,0xffd6a0,0xc4d6de,0x5d625c,0x3f3c32), overview:view([0,.55,.04],1.15,1.1,[.32,.68,1]), detail:view([0,.53,.10],.78,.74,[.20,.78,1])},
  10: {...mood(0x191723,0xffdcaf,0xc2c8e8,0x514b66,0x3c3442), overview:view([0,.72,.04],1.65,1.6,[.38,.55,1]), detail:view([0,.77,.14],1.14,1.14,[.16,.48,1])},
  11: {...mood(0x201b13,0xffdda8,0xd3c3a4,0x71664b,0x4b4230), overview:view([0,.65,0],1.4,1.4,[.7,.4,1]), detail:view([0,.65,.1],.95,.92,[.45,.4,1])},
  12: {...mood(0x24171c,0xffd2b9,0xc7bdd8,0x715366,0x4c303b), overview:view([0,.50,0],1.55,1.1,[.45,.65,1]), detail:view([0,.5,.1],1.0,.72,[.25,.7,1])},
  13: {...mood(0x151e1d,0xffe2ba,0xbcd4ce,0x516c66,0x35443d), overview:view([0,.5,0],1.65,1.05,[.45,.42,1]), detail:view([0,.48,.15],1.08,.7,[.3,.38,1])},
  14: {...mood(0x1a1922,0xffdfb8,0xbfc5e1,0x615e77,0x3d3848), overview:view([0,.78,0],1.35,1.8,[.5,.3,1]), detail:view([0,.94,.1],.9,1.1,[.4,.22,1])},
  15: {...mood(0x1d1915,0xffd7a9,0xd0cdbb,0x6f675a,0x453e33), overview:view([0,.6,0],1.6,1.25,[.5,.55,1]), detail:view([0,.64,.1],1.0,.8,[.3,.5,1])},
};

const gestures = {
  joinery:'장부 · 맞물린 틈을 따라 밀기', nacre:'자개 · 테두리를 잡고 돌리기', char:'목판 · 테두리를 잡고 돌리기', sword:'검 · 칼집을 따라 당기기', wire:'먹선 마디 · 홈을 따라 당기기', bead:'구슬 · 홈을 따라 밀기',
  drawer:'서랍 · 손잡이 방향으로 당기거나 밀기',
  lamp:'등잔 · 받침을 따라 옮기기', mirror:'거울 · 좌우로 천천히 돌리기', mask:'가림판 · 받침 위로 옮기기',
  rub:'한지 · 먹선 위를 따라 문지르기', handle:'들쇠 · 잡고 원을 그리며 돌리기',
  ring:'고리 · 테두리를 잡고 돌리기', dial:'다이얼 · 테두리를 잡고 돌리기',
  star:'별판 · 돌려서 홈의 겹침 살피기', stamp:'인장 · 축을 따라 눌러 보기',
  seal:'인장 · 먹이 흐르는 방향 살피기', fold:'병풍 · 접힌 면의 먹선 살피기',
  pend:'추 · 축을 중심으로 흔들기', lantern:'등롱 · 테두리를 잡고 돌리기',
  slot:'방위 홈 · 선택한 부품의 문양과 견주기', pin:'핀 · 축을 따라 밀거나 당기기',
  latch:'빗장 · 홈을 따라 밀거나 당기기',
  weight:'추 · 균형보를 따라 한 눈금씩 밀기', bottom:'이중바닥 · 드러난 들쇠를 들어 올리기',
  bojagi:'보자기 · 가장자리를 잡고 접힘 축으로 들기', lock:'자물쇠 · 걸쇠를 잡고 돌리기',
  secret:'비밀칸 · 손잡이를 바깥으로 당기기', peg:'장부못 · 닳은 눈금까지 돌리기',
  tier:'층문 · 손잡이를 잡고 경첩을 따라 열기', tray:'문서 트레이 · 손잡이를 앞으로 당기기',
  cord:'봉인 끈 · 매듭 끝을 잡고 앞으로 풀기', letter:'편지 · 펼쳐 읽기', note:'쪽지 · 펼쳐 읽기', slip:'기록 쪽지 · 펼쳐 읽기',
};
export function gestureDescription(chapterId, kind) {
  if (chapterId === 11 && kind === 'latch') return '걸쇠 · 들쇠를 잡고 닳은 각까지 돌리기';
  return gestures[kind] || '흔적과 맞물림 살피기';
}
