/**
 * Chapter 13 — 문갑 (DLC · 장인의 실측 서고)
 *
 * Discoverable rule: 서랍은 필순(筆順) 좌→우 (DRAWER_ORDER LEFT→RIGHT);
 * 우 서랍은 좌가 열린 뒤에야 풀린다 — readable on the 필순 plaque.
 * Teaching: LEFT starts slightly ajar.
 * Soft-fail never advances hints. Hints: request-only observe → relate → FULL.
 * Phases: drawers → peg → letter → finale.
 * Visual: Joseon stationery chest — shallow yakjang-adjacent grid, brass ring pulls, densified peg/letter.
 */
import { boxMesh, invisibleHit } from '../materials.js';
import { bumpHintLevel, requestHint, softFailNoHint } from '../hint-policy.js';

export const id = 13;
export const title = '문갑';
export const blurb = '가벼운 서랍 인터락과 문 장부못으로 편지를 찾으시오.';
export const steps = [
  { id: 'A', label: 'A 서랍' },
  { id: 'B', label: 'B 장부' },
  { id: 'C', label: '편지' },
];
/** Non-spoiler footer; FULL only via explicit revealHint ×3 */
export const hint = '문갑 필순 패를 살피시오. · 좌 서랍은 이미 조금 열려 있소.';
export const HINT_PARTIAL = '서랍은 필순대로 좌 → 우. 그다음 닳은 장부못 눈금에…';
export const HINT_RELATION = '좌가 열린 뒤에야 우가 산다. 필순 패가 그 순서를 이른다.';
/** Spoiler: drawer ids + peg index */
export const HINT_FULL = '서랍 순서: 좌 → 우 (LEFT→RIGHT) · 장부못 칸 1';
const HINT_PACK = { base: hint, partial: HINT_PARTIAL, relation: HINT_RELATION, full: HINT_FULL };

/** Light drawer interlock order */
export const DRAWER_ORDER = ['LEFT', 'RIGHT'];
/** Peg click target index 0–3 */
export const PEG_TARGET = 1;
export const PEG_STEPS = 4;

/** Teaching drawer that starts slightly ajar */
export const TEACHING_DRAWER = 'LEFT';

/** Wrong / locked pulls before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 3;

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch13_mungap';

  let phase = 'drawers'; // drawers | peg | letter | finale
  let progress = [];
  let openSet = new Set();
  let pegIndex = 0;
  let softFailCount = 0;
  let badClicks = 0;
  let hintLevel = 0;
  const interactives = [];
  const drawers = {};

  const woodMat = mats.woodRich || mats.wood;
  const woodDark = mats.woodDark;
  const woodAcc = mats.woodAccent || woodMat;
  const lacquer = mats.lacquer || woodDark;
  const brass = mats.brass;
  const brassB = mats.brassBright || brass;
  const iron = mats.iron;

  // ---- Shallow stationery chest (문갑) — yakjang-adjacent ----
  const BODY_W = 1.0;
  const BODY_H = 0.7;
  const BODY_D = 0.38; // shallow
  const bodyY0 = 0.08;
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  bodyGroup.add(boxMesh(THREE, BODY_W, BODY_H, BODY_D, woodDark, 0, bodyY0 + BODY_H / 2, 0));
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.022, BODY_H - 0.04, BODY_D - 0.04, woodMat,
      sx * (BODY_W / 2 - 0.01), bodyY0 + BODY_H / 2, 0));
  });
  // Back panel
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.06, BODY_H - 0.08, 0.02, woodDark,
    0, bodyY0 + BODY_H / 2, -BODY_D / 2 + 0.01));
  // Top frame
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.05, 0.045, BODY_D + 0.04, woodMat, 0, bodyY0 + BODY_H + 0.02, 0));
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.01, 0.016, BODY_D + 0.01, woodAcc, 0, bodyY0 + BODY_H + 0.045, 0.005));

  // Mid rail separating drawers from door
  const drawerTop = bodyY0 + 0.38;
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.04, 0.025, BODY_D + 0.01, woodMat,
    0, drawerTop, 0.01));

  // Feet
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(boxMesh(THREE, 0.07, 0.08, 0.055, woodDark,
      sx * (BODY_W / 2 - 0.1), 0.04, sz * (BODY_D / 2 - 0.05)));
    bodyGroup.add(boxMesh(THREE, 0.05, 0.012, 0.04, brass,
      sx * (BODY_W / 2 - 0.1), 0.01, sz * (BODY_D / 2 - 0.05)));
  });
  bodyGroup.add(boxMesh(THREE, 0.12, 0.04, 0.045, woodDark, 0, 0.025, BODY_D / 2 - 0.03));

  // Corner brackets
  function cornerBracket(x, y, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.add(boxMesh(THREE, 0.08, 0.012, 0.028, brassB, 0.035, 0, 0));
    g.add(boxMesh(THREE, 0.028, 0.012, 0.08, brassB, 0, 0, 0.035));
    for (let i = 0; i < 2; i++) {
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
      riv.position.set(0.018 + i * 0.028, 0.008, 0.008);
      g.add(riv);
    }
    bodyGroup.add(g);
  }
  const frontZ = BODY_D / 2 - 0.01;
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.06, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.06, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, drawerTop + 0.02, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, drawerTop + 0.02, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + 0.1, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + 0.1, frontZ, -Math.PI / 2);

  // Decorative quiet drawer grid above (non-interactive) — yakjang feel
  function ringPull(mat, scale = 1) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012 * scale, 0.003 * scale, 6, 14), mat);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    g.add(boxMesh(THREE, 0.024 * scale, 0.016 * scale, 0.005 * scale, mat, 0, 0, -0.003));
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.0035 * scale, 5, 5), mat);
    riv.position.set(0, 0, 0.004);
    g.add(riv);
    return g;
  }

  // Quiet upper small-drawer row (decorative)
  for (let c = 0; c < 4; c++) {
    const cx = -0.36 + c * 0.24;
    const cy = bodyY0 + BODY_H - 0.12;
    bodyGroup.add(boxMesh(THREE, 0.2, 0.1, 0.04, woodMat, cx, cy, frontZ - 0.01));
    const pull = ringPull(brass, 0.7);
    pull.position.set(cx, cy - 0.02, frontZ + 0.015);
    bodyGroup.add(pull);
  }
  // Vertical stile separators
  for (let c = 1; c < 4; c++) {
    bodyGroup.add(boxMesh(THREE, 0.01, 0.12, 0.03, woodDark,
      -0.36 + c * 0.24 - 0.12, bodyY0 + BODY_H - 0.12, frontZ - 0.02));
  }

  // ---- Two interactive drawers (LEFT / RIGHT) with brass ring pulls ----
  [
    { id: 'LEFT', x: -0.22, label: '좌' },
    { id: 'RIGHT', x: 0.22, label: '우' },
  ].forEach((d) => {
    const g = new THREE.Group();
    g.position.set(d.x, 0.28, 0.1);
    const face = boxMesh(THREE, 0.38, 0.16, 0.28, woodAcc, 0, 0, 0);
    face.userData = { id: d.id, kind: 'drawer' };
    g.add(face);
    // Face lip
    g.add(boxMesh(THREE, 0.36, 0.008, 0.29, woodMat, 0, 0.07, 0));
    // Stronger brass ring pull
    const pull = ringPull(brassB, 1.3);
    pull.position.set(0, -0.02, 0.15);
    pull.traverse((m) => {
      if (m.isMesh) m.userData = { id: d.id, kind: 'drawer' };
    });
    g.add(pull);
    // Small label plate
    g.add(boxMesh(THREE, 0.05, 0.022, 0.006, brass, 0, 0.04, 0.145));
    const hit = invisibleHit(THREE, 0.42, 0.2, 0.35, { id: d.id, kind: 'drawer' });
    g.add(hit);
    root.add(g);
    interactives.push(face, hit);
    pull.traverse((m) => { if (m.isMesh) interactives.push(m); });
    drawers[d.id] = { group: g, baseZ: 0.1, openZ: 0.32, label: d.label };
  });

  // Center stile between drawers
  bodyGroup.add(boxMesh(THREE, 0.02, 0.18, 0.04, woodDark, 0, 0.28, frontZ - 0.02));

  // ---- 필순 / LEFT→RIGHT reason plaque (readable world rule) ----
  function makeRulePlaque(label, w = 140, h = 36) {
    try {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#c9a84a';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = '#e8d9b0';
      ctx.font = 'bold 12px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, w / 2, h / 2);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.55, metalness: 0.12,
        emissive: 0x1a1008, emissiveIntensity: 0.15,
      });
    } catch (_) {
      return brassB;
    }
  }
  const orderPlaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.06),
    makeRulePlaque('필순 · 좌→우'),
  );
  orderPlaque.position.set(0, 0.4, frontZ + 0.025);
  bodyGroup.add(orderPlaque);

  // ---- Door panel with densified joinery peg ----
  const door = new THREE.Group();
  door.position.set(0, 0.55, 0.12);
  root.add(door);
  const doorFace = boxMesh(THREE, 0.85, 0.28, 0.06, woodDark, 0, 0, 0);
  door.add(doorFace);
  // Panel inset
  door.add(boxMesh(THREE, 0.72, 0.2, 0.015, woodMat, 0, 0, 0.03));
  // Swallowtail hinges
  [-1, 1].forEach((sx) => {
    const hinge = new THREE.Group();
    hinge.position.set(sx * 0.4, 0, 0.04);
    hinge.add(boxMesh(THREE, 0.05, 0.02, 0.01, brassB, 0, 0.06, 0));
    hinge.add(boxMesh(THREE, 0.035, 0.015, 0.01, brassB, sx * -0.01, 0.06, 0));
    hinge.add(boxMesh(THREE, 0.05, 0.02, 0.01, brassB, 0, -0.06, 0));
    hinge.add(boxMesh(THREE, 0.035, 0.015, 0.01, brassB, sx * -0.01, -0.06, 0));
    const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8), brass);
    knuckle.rotation.z = Math.PI / 2;
    hinge.add(knuckle);
    door.add(hinge);
  });

  // Crafted joinery peg (장부못)
  const peg = new THREE.Group();
  peg.position.set(0.3, 0, 0.05);
  door.add(peg);
  const pegShaft = boxMesh(THREE, 0.05, 0.07, 0.05, brassB, 0, 0, 0);
  pegShaft.userData = { id: 'PEG', kind: 'peg' };
  peg.add(pegShaft);
  // Peg head / collar
  peg.add(boxMesh(THREE, 0.07, 0.02, 0.07, brass, 0, 0.04, 0));
  const pegKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10), brassB);
  pegKnob.position.set(0, 0.06, 0);
  pegKnob.userData = { id: 'PEG', kind: 'peg' };
  peg.add(pegKnob);
  // Mount plate
  door.add(boxMesh(THREE, 0.1, 0.1, 0.015, brass, 0.3, 0, 0.03));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), brass);
    riv.position.set(0.3 + sx * 0.035, sy * 0.035, 0.04);
    door.add(riv);
  });
  const pegHit = invisibleHit(THREE, 0.14, 0.14, 0.14, { id: 'PEG', kind: 'peg' });
  peg.add(pegHit);
  interactives.push(pegShaft, pegHit, pegKnob);
  // Worn peg scale ticks — brighter at PEG_TARGET
  for (let s = 0; s < PEG_STEPS; s++) {
    const isTarget = s === PEG_TARGET;
    door.add(boxMesh(THREE, isTarget ? 0.035 : 0.022, isTarget ? 0.008 : 0.005, 0.006,
      isTarget ? brassB : iron, 0.18, -0.1 + s * 0.05, 0.04));
  }
  const pegLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, 0.032),
    makeRulePlaque('장부', 64, 32),
  );
  pegLabel.position.set(0.18, -0.12, 0.05);
  door.add(pegLabel);

  // ---- Letter (revealed after peg) ----
  const letter = new THREE.Group();
  letter.position.set(0, 0.55, 0.05);
  letter.visible = false;
  root.add(letter);
  letter.add(boxMesh(THREE, 0.28, 0.01, 0.2, mats.paper, 0, 0, 0));
  // Folded edge / seal
  letter.add(boxMesh(THREE, 0.08, 0.008, 0.06, brassB, 0.08, 0.01, 0.05));
  const lHit = invisibleHit(THREE, 0.32, 0.08, 0.24, { id: 'LETTER', kind: 'letter' });
  letter.add(lHit);
  interactives.push(lHit);

  const AJAR_Z = 0.18;

  function softFailShake() {
    if (shake) shake(bodyGroup, 0.03, 360);
    else {
      const bx = bodyGroup.position.x;
      bodyGroup.position.x = bx + 0.025;
      setTimeout(() => { bodyGroup.position.x = bx; }, 80);
    }
  }

  function onSoftFail() {
    softFailCount += 1;
    badClicks = 0;
    softFailNoHint(api, () => softFailShake());
  }

  function seedTeachingDrawer() {
    progress = [];
    openSet.clear();
    Object.values(drawers).forEach((d) => { d.group.position.z = d.baseZ; });
    // LEFT ajar teaching cue (not counted in progress until fully pulled)
    drawers.LEFT.group.position.z = AJAR_Z;
  }

  function onDrawer(did) {
    if (phase !== 'drawers') {
      if (phase === 'peg') api.toast('서랍은 이미 열렸소. 장부못 눈금을 살피시오.');
      return;
    }
    if (openSet.has(did)) {
      api.toast(did === TEACHING_DRAWER
        ? '좌 서랍은 이미 열려 있소. 필순의 다음을…'
        : '이미 열린 서랍입니다.');
      return;
    }
    // Light interlock: RIGHT locked until LEFT open
    if (did === 'RIGHT' && progress.length === 0) {
      api.playWrong();
      api.vibrate(18);
      badClicks += 1;
      softFailShake();
      if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
      else api.toast('우 서랍은 잠겨 있습니다. 필순 패 — 좌부터.');
      return;
    }
    if (did !== DRAWER_ORDER[progress.length]) {
      api.playWrong();
      api.vibrate(22);
      badClicks += 1;
      seedTeachingDrawer();
      softFailShake();
      if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
      else api.toast('서랍 순서가 틀렸습니다. 필순 패를 다시 살피시오.');
      return;
    }
    progress.push(did);
    openSet.add(did);
    badClicks = 0;
    animateVec3(drawers[did].group.position,
      new THREE.Vector3(drawers[did].group.position.x, drawers[did].group.position.y, drawers[did].openZ), 280);
    api.playThunk();
    api.vibrate(22);
    if (progress.length === DRAWER_ORDER.length) {
      phase = 'peg';
      badClicks = 0;
      api.setObjective('닳은 장부못 눈금에 맞춰 돌리시오.');
      api.setSteps('B', ['A']);
      api.playUnlock();
      api.toast('서랍 필순 인터락이 풀렸습니다.', true);
    } else {
      api.toast(`${drawers[did].label} 서랍 개방 (${progress.length}/2) · 필순을 따르시오`, true);
    }
  }

  function onPeg() {
    if (phase !== 'peg') {
      if (phase === 'drawers') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('먼저 서랍을 필순대로 당기시오.');
      }
      return;
    }
    pegIndex = (pegIndex + 1) % PEG_STEPS;
    animateTo(peg.rotation, 'z', pegIndex * (Math.PI / 2), 160);
    api.playClick();
    api.vibrate(16);
    if (pegIndex === PEG_TARGET) {
      badClicks = 0;
      phase = 'letter';
      letter.visible = true;
      animateTo(door.rotation, 'y', -0.7, 400);
      api.setObjective('드러난 편지를 확인하시오.');
      api.setSteps('C', ['A', 'B']);
      api.playUnlock();
      api.toast('장부못이 닳은 눈금에 맞춰졌습니다.', true);
    } else {
      badClicks += 1;
      if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
      else api.toast('장부못을 돌리시오. 닳아 빛나는 눈금을 본보기로…', true);
    }
  }

  function onLetter() {
    if (phase !== 'letter') {
      if (phase !== 'finale') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('먼저 서랍과 장부못을 맞추시오.');
      }
      return;
    }
    phase = 'finale';
    api.setObjective('실측 편지를 읽으시오.');
    api.playUnlock();
    api.vibrate([40, 25, 70]);
    api.showFinale({
      title: '문갑 · 편지',
      body: '가벼운 서랍 인터락과 문 장부못이 풀리자 편지가 나왔다. 「이층농은 위·아래 순서를 지키라. 다리 속을 살필 것」.',
      footer: '— 장인의 실측 서고 · 문갑',
      epilogue: '제13장 문갑 — 해제 완료',
    });
    api.markCleared(id);
  }

  seedTeachingDrawer();

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives,
    build(scene) { scene.add(root); },
    start() { this.reset(); },
    reset() {
      phase = 'drawers';
      pegIndex = 0;
      softFailCount = 0;
      badClicks = 0;
      hintLevel = 0;
      peg.rotation.z = 0;
      door.rotation.y = 0;
      letter.visible = false;
      bodyGroup.position.x = 0;
      drawers.LEFT.group.position.x = -0.22;
      drawers.RIGHT.group.position.x = 0.22;
      seedTeachingDrawer();
      api.setObjective('필순 패를 따라 서랍을 당기시오. 좌는 이미 조금 열려 있소.');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      api.toast('문갑 — 필순 패와 서랍을 살피시오.', true);
    },
    handleInteract(kind, iid) {
      if (phase === 'finale') return;
      if (kind === 'drawer') onDrawer(iid);
      else if (kind === 'peg') onPeg();
      else if (kind === 'letter') onLetter();
    },
    revealHint() {
      hintLevel = bumpHintLevel(hintLevel);
      requestHint(api, hintLevel, HINT_PACK);
    },
    get mistook() { return softFailCount > 0; },
    getState() {
      return { phase, hintLevel };
    },
    solve() {
      DRAWER_ORDER.forEach((did) => {
        if (!openSet.has(did)) {
          progress.push(did);
          openSet.add(did);
          drawers[did].group.position.z = drawers[did].openZ;
        }
      });
      pegIndex = PEG_TARGET;
      peg.rotation.z = pegIndex * (Math.PI / 2);
      letter.visible = true;
      door.rotation.y = -0.7;
      phase = 'letter';
      onLetter();
    },
    dispose(scene) { scene.remove(root); interactives.length = 0; },
  };
}
