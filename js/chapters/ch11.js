/**
 * Chapter 11 — 뒤주 (DLC · 장인의 실측 서고)
 *
 * Latch: the hasp turns about its physical Z axis (pixel fallback for legacy samples). Weight phase starts only when
 * hasp.rotation.z reaches LATCH_OPEN (0.8 rad). LATCH_CLICKS is not the gate,
 * and the n/2 toast is gone. A short drag stays in latch.
 * Weight: one drag along the beam (+X, screen-right on the chapter camera)
 * moves one tick. Tick WEIGHT_TARGET shows the false bottom; leaving hides it.
 * Reaching the tick does not lift the floor. The bottom confirm does.
 * Soft-fail never advances hints. Hints: request-only observe → relate → FULL.
 * Phases: latch → weight → bottom → finale.
 */
import { bevelBoxMesh as boxMesh, invisibleHit } from '../materials.js';
import { bumpHintLevel, requestHint, softFailNoHint } from '../hint-policy.js';
import { disposeChapterResources } from '../chapter-resources.js';
import { archivePalette, mechanismFrame } from './archive-craft.js';

export const id = 11;
export const title = '뒤주';
export const blurb = '자물쇠와 뚜껑 균형으로 이중바닥의 비밀을 찾으시오.';
export const steps = [
  { id: 'A', label: '자물쇠' },
  { id: 'B', label: '균형' },
  { id: 'C', label: '이중바닥' },
];
/** Non-spoiler footer; FULL only via explicit revealHint ×3 */
export const hint = '걸쇠를 돌려 닳은 각에 맞춘 뒤, 균형보의 추를 눈금을 따라 옮기시오.';
export const HINT_PARTIAL = '걸쇠는 닳아 빛나는 각까지 돌리시오. 추는 보를 따라 한 칸씩 밀고, 닳은 추 눈금에 멈추시오.';
export const HINT_RELATION = '걸쇠가 닳은 각에 못 미치면 추는 열리지 않습니다. 추가 그 눈금에 머물러야 이중바닥이 보이고, 벗어나면 숨습니다. 눈금만으로는 바닥이 들리지 않습니다.';
/** Spoiler: open angle and weight index */
export const HINT_FULL = '정답: 걸쇠는 아래로 약 0.8라디안까지, 추는 다섯 칸 중 가운데 눈금까지 — 그다음 이중바닥';
const HINT_PACK = { base: hint, partial: HINT_PARTIAL, relation: HINT_RELATION, full: HINT_FULL };

/** Kept. Not the phase gate — two clicks must not open the weight. */
export const LATCH_CLICKS = 2;
/** Hasp rotation that opens the weight phase. 0.4 rad × LATCH_CLICKS. */
export const LATCH_OPEN = 0.8;
/** Downward CSS pixels to radians. 200 px lands on LATCH_OPEN. */
export const LATCH_RAD_PER_PX = 0.004;
/** Weight/balance dial target index 0–4 */
export const WEIGHT_TARGET = 2;
export const WEIGHT_STEPS = 5;
/** One drag at least this far, along beam +X, moves exactly one tick. */
export const WEIGHT_STEP_PX = 36;

/** Wrong weight clicks before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 4;

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch11_dwiju';

  let phase = 'latch'; // latch | weight | bottom | finale
  let weightIndex = 0;
  let softFailCount = 0;
  let badClicks = 0;
  let hintLevel = 0;
  const interactives = [];

  const palette = archivePalette(mats);
  const woodMat = palette.wood;
  const woodDark = palette.dark;
  const woodAcc = palette.wood;
  const lacquer = mats.lacquer || woodDark;
  const brass = palette.brass;
  const brassB = palette.bright;
  const iron = mats.iron;

  // ---- Tall grain chest carcass (뒤주) ----
  const BODY_W = 0.95;
  const BODY_H = 0.85;
  const BODY_D = 0.7;
  const bodyY0 = 0.1;
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  bodyGroup.add(boxMesh(THREE, BODY_W, BODY_H, BODY_D, woodDark, 0, bodyY0 + BODY_H / 2, 0));
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.025, BODY_H - 0.06, BODY_D - 0.06, woodMat,
      sx * (BODY_W / 2 - 0.012), bodyY0 + BODY_H / 2, 0));
  });
  // Front panel inset
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.1, BODY_H - 0.16, 0.02, woodMat,
    0, bodyY0 + BODY_H / 2, BODY_D / 2 - 0.004));
  // Vertical stiles
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.04, BODY_H - 0.1, 0.03, woodAcc,
      sx * (BODY_W / 2 - 0.06), bodyY0 + BODY_H / 2, BODY_D / 2 - 0.005));
  });
  // Horizontal rails
  [0.25, 0.55, 0.85].forEach((fy) => {
    bodyGroup.add(boxMesh(THREE, BODY_W - 0.12, 0.03, 0.025, woodAcc,
      0, bodyY0 + BODY_H * fy, BODY_D / 2 - 0.005));
  });
  // Top rim
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.04, 0.05, BODY_D + 0.04, woodMat, 0, bodyY0 + BODY_H + 0.02, 0));
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.08, 0.016, BODY_D - 0.08, lacquer, 0, bodyY0 + BODY_H + 0.04, 0));

  // Feet + brass shoes
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(boxMesh(THREE, 0.09, 0.12, 0.08, woodDark,
      sx * 0.4, 0.06, sz * 0.28));
    bodyGroup.add(boxMesh(THREE, 0.065, 0.014, 0.055, brass,
      sx * 0.4, 0.01, sz * 0.28));
  });
  bodyGroup.add(boxMesh(THREE, 0.16, 0.05, 0.055, woodDark, 0, 0.03, BODY_D / 2 - 0.05));

  // Corner brackets
  function cornerBracket(x, y, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.add(boxMesh(THREE, 0.09, 0.014, 0.032, brassB, 0.04, 0, 0));
    g.add(boxMesh(THREE, 0.032, 0.014, 0.09, brassB, 0, 0, 0.04));
    for (let i = 0; i < 2; i++) {
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), brass);
      riv.position.set(0.02 + i * 0.03, 0.01, 0.01);
      g.add(riv);
    }
    bodyGroup.add(g);
  }
  const frontZ = BODY_D / 2 - 0.01;
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.06, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.06, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + 0.1, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + 0.1, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H * 0.5, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H * 0.5, frontZ, -Math.PI / 2);

  // Side ring pulls
  [-1, 1].forEach((sx) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.005, 6, 14), brass);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(sx * (BODY_W / 2 + 0.01), bodyY0 + BODY_H * 0.55, 0);
    bodyGroup.add(ring);
    bodyGroup.add(boxMesh(THREE, 0.01, 0.045, 0.035, brass,
      sx * (BODY_W / 2 + 0.005), bodyY0 + BODY_H * 0.55, 0));
  });

  // Rivet strip front
  for (let i = 0; i < 6; i++) {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
    riv.position.set(-0.35 + i * 0.14, bodyY0 + BODY_H + 0.01, frontZ + 0.02);
    bodyGroup.add(riv);
  }

  // ---- Crafted front latch / lock ----
  // Plate stays fixed. The hasp (tongue, keyhole, drop ring) turns on Z.
  // Rz of a point (0, -r): (r*sin θ, -r*cos θ). Worn tick uses that at LATCH_OPEN.
  const latch = new THREE.Group();
  latch.position.set(0, 0.55, frontZ + 0.02);
  root.add(latch);
  latch.add(boxMesh(THREE, 0.16, 0.22, 0.02, brassB, 0, 0, 0));
  const hasp = new THREE.Group();
  latch.add(hasp);
  const haspMat = brassB.clone();
  haspMat.emissive = new THREE.Color(0xc9a24a);
  haspMat.emissiveIntensity = 0.45;
  const latchBody = boxMesh(THREE, 0.045, 0.24, 0.04, haspMat, 0, -0.02, 0.04);
  latchBody.userData = { id: 'LATCH', kind: 'latch' };
  hasp.add(latchBody);
  const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 8), iron);
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(0, 0.02, 0.055);
  hasp.add(keyhole);
  const dropRing = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 12), brass);
  dropRing.position.set(0, -0.06, 0.05);
  dropRing.userData = { kind: 'latchRing', role: 'ring' };
  hasp.add(dropRing);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.007, 5, 5), brass);
    riv.position.set(sx * 0.06, sy * 0.08, 0.015);
    latch.add(riv);
  });
  const latchTicks = [];
  [0, 0.4, LATCH_OPEN].forEach((angle) => {
    const worn = angle === LATCH_OPEN;
    const r = 0.1;
    const mat = (worn ? brassB : iron).clone();
    mat.emissive = new THREE.Color(worn ? 0xffe1a0 : 0x8a7050);
    mat.emissiveIntensity = worn ? 1 : 0.4;
    const tick = boxMesh(THREE, worn ? 0.028 : 0.016, worn ? 0.028 : 0.016, 0.012,
      mat, r * Math.sin(angle), -r * Math.cos(angle), 0.03);
    tick.userData = { kind: 'latchTick', role: worn ? 'worn' : 'tick', angle };
    latch.add(tick);
    latchTicks.push(tick);
  });
  const latchHit = invisibleHit(THREE, 0.22, 0.26, 0.15, { id: 'LATCH', kind: 'latch' });
  latch.add(latchHit);
  interactives.push(latchBody, latchHit, keyhole, dropRing);

  // ---- Lid with balance beam / weight ----
  const lid = new THREE.Group();
  lid.position.set(0, bodyY0 + BODY_H + 0.05, 0);
  root.add(lid);
  lid.add(boxMesh(THREE, BODY_W + 0.04, 0.06, BODY_D + 0.04, woodAcc, 0, 0, 0));
  lid.add(boxMesh(THREE, BODY_W - 0.1, 0.02, BODY_D - 0.1, lacquer, 0, 0.035, 0));
  // Lid edge brass rail
  lid.add(boxMesh(THREE, BODY_W + 0.02, 0.012, 0.02, brass, 0, 0.01, BODY_D / 2 + 0.01));
  // Lid corner brackets
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    lid.add(boxMesh(THREE, 0.06, 0.012, 0.025, brassB, sx * 0.42, 0.02, sz * 0.3));
  });

  // Balance beam track
  lid.add(boxMesh(THREE, 0.7, 0.02, 0.06, woodDark, 0, 0.06, 0));
  lid.add(boxMesh(THREE, 0.65, 0.01, 0.04, brass, 0, 0.07, 0.01));
  // Track end stops
  [-1, 1].forEach((sx) => {
    lid.add(boxMesh(THREE, 0.03, 0.04, 0.06, brassB, sx * 0.34, 0.07, 0));
  });
  // Track rivets
  for (let i = 0; i < 5; i++) {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), brass);
    riv.position.set(-0.25 + i * 0.125, 0.075, 0.03);
    lid.add(riv);
  }

  // ---- 균형보 / weight world-rule plaque + worn tick teaching ----
  function makeRulePlaque(label) {
    try {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 36;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(0, 0, 128, 36);
      ctx.strokeStyle = '#c9a84a';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 124, 32);
      ctx.fillStyle = '#e8d9b0';
      ctx.font = 'bold 12px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 64, 18);
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
  // Scale marks on balance beam — worn brighter tick at WEIGHT_TARGET.
  // +X is the next tick. On the chapter camera that reads as screen-right.
  function beamX(index) {
    return -0.3 + (index / (WEIGHT_STEPS - 1)) * 0.6;
  }
  const beamTicks = [];
  for (let s = 0; s < WEIGHT_STEPS; s++) {
    const isTarget = s === WEIGHT_TARGET;
    const mat = (isTarget ? brassB : iron).clone();
    mat.emissive = new THREE.Color(isTarget ? 0xffe1a0 : 0x8a7050);
    mat.emissiveIntensity = isTarget ? 1 : 0.45;
    const tick = boxMesh(THREE, isTarget ? 0.028 : 0.014, isTarget ? 0.07 : 0.045, 0.012,
      mat, beamX(s), 0.1, 0.045);
    tick.userData = { kind: 'beamTick', role: isTarget ? 'worn' : 'tick', index: s };
    lid.add(tick);
    beamTicks.push(tick);
  }
  const balPlaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.055),
    makeRulePlaque('균형 · 추'),
  );
  balPlaque.position.set(0, 0.14, 0.05);
  balPlaque.rotation.x = -0.4;
  lid.add(balPlaque);

  const weightPivot = new THREE.Group();
  weightPivot.position.set(0.25, 0.1, 0);
  lid.add(weightPivot);
  // Crafted weight (iron block + brass ring)
  const weight = boxMesh(THREE, 0.1, 0.12, 0.1, iron, 0, 0, 0);
  weight.material = iron.clone();
  weight.userData = { id: 'WEIGHT', kind: 'weight', role: 'weight' };
  weightPivot.add(weight);
  weightPivot.add(boxMesh(THREE, 0.08, 0.02, 0.08, brass, 0, 0.07, 0));
  const wRing = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 10), brassB);
  wRing.position.set(0, 0.09, 0);
  weightPivot.add(wRing);
  const wHit = invisibleHit(THREE, 0.18, 0.2, 0.18, { id: 'WEIGHT', kind: 'weight' });
  weightPivot.add(wHit);
  interactives.push(weight, wHit, wRing);
  // Rear bearing is the lid's real pivot, including the moving balance beam.
  for (const child of lid.children) child.position.z += BODY_D / 2;
  lid.position.z = -BODY_D / 2;

  // ---- False bottom (crafted panel) ----
  const falseBottom = new THREE.Group();
  falseBottom.position.set(0, 0.22, 0);
  falseBottom.visible = false;
  falseBottom.userData = { kind: 'falseBottom', role: 'bottom' };
  root.add(falseBottom);
  const bottomMat = woodMat.clone();
  bottomMat.color = new THREE.Color(0xf0ddb0);
  bottomMat.emissive = new THREE.Color(0x6a4a22);
  bottomMat.emissiveIntensity = 0.85;
  // Vertical face. A flat floor plank reads as an edge from this camera.
  const bottomPanel = boxMesh(THREE, 0.22, 0.12, 0.018, bottomMat, 0, 0, 0);
  bottomPanel.userData = { id: 'BOTTOM', kind: 'bottom' };
  falseBottom.add(bottomPanel);
  falseBottom.add(boxMesh(THREE, 0.25, 0.145, 0.008, woodDark, 0, 0, -0.012));
  falseBottom.add(boxMesh(THREE, 0.07, 0.012, 0.012, brassB, 0, 0.03, 0.012));
  const note = boxMesh(THREE, 0.12, 0.06, 0.006, mats.slicePaper || mats.paper, 0, -0.01, 0.014);
  note.visible = false;
  falseBottom.add(note);
  const bHit = invisibleHit(THREE, 0.26, 0.16, 0.06, { id: 'BOTTOM', kind: 'bottom' });
  falseBottom.add(bHit);
  interactives.push(bottomPanel, bHit);

  const BOTTOM_HIDDEN = new THREE.Vector3(0, 0.22, 0);
  // Lower front, under the latch, clear of the beam.
  const BOTTOM_SHOWN = new THREE.Vector3(0, 0.36, frontZ + 0.07);
  const BOTTOM_LIFTED = new THREE.Vector3(0, 0.5, frontZ + 0.16);

  function placeWeight(t) {
    weightPivot.position.x = beamX(t);
    weight.rotation.z = (t - WEIGHT_TARGET) * 0.12;
    weight.material.emissiveIntensity = Math.abs(t - WEIGHT_TARGET) < 0.01 ? 0.55 : 0.15;
  }

  function showBottom() {
    falseBottom.visible = true;
    falseBottom.position.copy(BOTTOM_SHOWN);
    animateTo(lid.rotation, 'x', -0.55, 450);
  }

  function hideBottom() {
    falseBottom.visible = false;
    falseBottom.position.copy(BOTTOM_HIDDEN);
    animateTo(lid.rotation, 'x', 0, 280);
  }

  function softFailShake() {
    if (shake) shake(bodyGroup, 0.03, 360);
    else {
      const bx = bodyGroup.position.x;
      bodyGroup.position.x = bx + 0.025;
      setTimeout(() => { bodyGroup.position.x = bx; }, 80);
    }
  }

  function weightHeld() {
    return weightIndex === WEIGHT_TARGET;
  }

  function onSoftFail() {
    softFailCount += 1;
    badClicks = 0;
    softFailNoHint(api, () => softFailShake());
  }

  function applyLatch(angle) {
    hasp.rotation.z = Math.max(0, Math.min(LATCH_OPEN, angle));
    if (phase === 'latch' && hasp.rotation.z >= LATCH_OPEN) {
      hasp.rotation.z = LATCH_OPEN;
      phase = 'weight';
      badClicks = 0;
      api.setObjective('균형보를 따라 추를 닳은 눈금까지 밀으시오.');
      api.setSteps('B', ['A']);
      api.playUnlock();
      api.toast('자물쇠가 풀렸습니다. 뚜껑 균형을 맞추시오.', true);
    }
  }

  function onLatch() {
    if (phase !== 'latch') {
      if (phase === 'weight' || phase === 'bottom') api.toast('자물쇠는 이미 풀렸습니다. 균형보 추 눈금을 살피시오.');
      return;
    }
    api.playClick();
    api.vibrate(12);
    api.toast('걸쇠를 아래로 돌려 닳은 각 눈금에 맞추시오.', true);
  }

  function onWeight(settledFrom) {
    if (phase === 'latch') {
      api.playWrong();
      api.vibrate(18);
      softFailShake();
      api.toast('먼저 자물쇠를 푸시오.');
      return;
    }
    if (phase === 'finale') return;
    placeWeight(weightIndex);
    api.playClick();
    api.vibrate(18);
    if (weightHeld()) {
      badClicks = 0;
      const first = phase === 'weight';
      phase = 'bottom';
      showBottom();
      if (first) {
        api.setObjective('드러난 이중바닥을 들어 올리시오. 추는 눈금에 머물러야 합니다.');
        api.setSteps('C', ['A', 'B']);
        api.playUnlock();
        api.toast('뚜껑이 균형을 찾았습니다. 바닥은 아직이오.', true);
      } else if (settledFrom !== weightIndex) {
        api.toast('균형이 돌아왔소. 이중바닥을 살피시오.', true);
      }
    } else if (phase === 'bottom') {
      hideBottom();
      api.toast('추가 어긋나 이중바닥이 숨습니다.');
    } else if (settledFrom !== weightIndex) {
      badClicks += 1;
      if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
      else api.toast('추를 옮기시오. 닳아 빛나는 균형 눈금을 본보기로…', true);
    }
  }

  function onBottom() {
    if (phase === 'finale') return;
    if (phase !== 'bottom' || !weightHeld()) {
      if (phase === 'bottom' && !weightHeld()) {
        api.playWrong();
        api.vibrate(18);
        badClicks += 1;
        if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
        else api.toast('추가 어긋나 이중바닥이 숨습니다.');
        return;
      }
      if (phase === 'latch' || phase === 'weight') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('먼저 자물쇠와 균형을 맞추시오.');
      }
      return;
    }
    phase = 'finale';
    animateVec3(falseBottom.position, BOTTOM_LIFTED, 400, () => {
      note.visible = true;
      api.setSteps('C', ['A', 'B']);
      api.setObjective('실측 쪽지를 확인하시오.');
      api.playUnlock();
      api.vibrate([40, 25, 70]);
      api.showFinale({
        title: '뒤주 · 이중바닥',
        body: '자물쇠와 뚜껑의 추가 균형을 이루자 이중바닥이 들렸다. 쪽지에는 「혼수함의 보자기 겹을 기억하라」는 실측 메모가 적혀 있다.',
        footer: '— 장인의 실측 서고 · 뒤주',
        epilogue: '제11장 뒤주 — 해제 완료',
      });
      api.markCleared(id);
    });
    api.playThunk();
  }

  placeWeight(weightIndex);

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives.filter(m => phase === 'latch' ? m.userData.kind === 'latch' :
      phase === 'weight' ? m.userData.kind === 'weight' : phase === 'bottom' ? ['weight', 'bottom'].includes(m.userData.kind) : false),
    getMarkMeshes: () => [...beamTicks, ...latchTicks, dropRing, weight, falseBottom],
    build(scene) { scene.add(root); },
    start() { this.reset(); },
    reset() {
      phase = 'latch';
      weightIndex = 0;
      softFailCount = 0;
      badClicks = 0;
      hintLevel = 0;
      hasp.rotation.z = 0;
      lid.rotation.x = 0;
      bodyGroup.position.x = 0;
      falseBottom.visible = false;
      falseBottom.position.copy(BOTTOM_HIDDEN);
      note.visible = false;
      placeWeight(weightIndex);
      api.setObjective('전면 놋쇠 걸쇠를 닳은 각까지 돌리시오. 그 뒤 균형보의 추를…');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      api.toast('뒤주 — 걸쇠의 각과 균형보를 살피시오.', true);
    },
    getGestureFrame(kind) {
      if (kind === 'latch') return mechanismFrame(THREE, hasp, 'rotate', [0, 0, 1]);
      if (kind === 'weight') return mechanismFrame(THREE, weightPivot, 'linear', [1, 0, 0]);
      if (kind === 'bottom') return mechanismFrame(THREE, falseBottom, 'linear', [0, 1, 0]);
    },
    getDragInteraction(kind) {
      if (kind === 'latch') {
        if (phase !== 'latch') return null;
        let origin = 0;
        return {
          start() { origin = hasp.rotation.z; },
          move(s) { hasp.rotation.z = Math.max(0, Math.min(LATCH_OPEN, origin + (s.turn ?? (s.dy || 0) * LATCH_RAD_PER_PX))); },
          end(s) { applyLatch(origin + (s?.turn ?? (s?.dy || 0) * LATCH_RAD_PER_PX)); },
          cancel() { hasp.rotation.z = origin; },
        };
      }
      if (kind === 'weight') {
        if (phase !== 'weight' && phase !== 'bottom') return null;
        let origin = 0;
        let along = 0;
        return {
          start() { origin = weightIndex; along = 0; },
          move(s) {
            along = s.travel === undefined ? s.dx || 0 : s.travel * WEIGHT_STEP_PX / .15;
            const steps = Math.max(-1, Math.min(1, along / WEIGHT_STEP_PX));
            placeWeight(Math.max(0, Math.min(WEIGHT_STEPS - 1, origin + steps)));
          },
          end(s) {
            along = s?.travel === undefined ? s?.dx ?? along : s.travel * WEIGHT_STEP_PX / .15;
            const prev = origin;
            if (Math.abs(along) >= WEIGHT_STEP_PX) {
              const dir = along > 0 ? 1 : -1;
              weightIndex = Math.max(0, Math.min(WEIGHT_STEPS - 1, origin + dir));
            } else {
              weightIndex = origin;
            }
            onWeight(prev);
          },
          cancel() { placeWeight(origin); },
        };
      }
      if (kind === 'bottom' && phase === 'bottom' && weightHeld()) {
        return {
          move(s) { falseBottom.position.y = BOTTOM_SHOWN.y + Math.max(0, Math.min(.14, s.travel || 0)); },
          end(s) { falseBottom.position.copy(BOTTOM_SHOWN); if ((s?.travel || 0) >= .09) onBottom(); },
          cancel() { falseBottom.position.copy(BOTTOM_SHOWN); },
        };
      }
      return null;
    },
    handleInteract(kind) {
      if (phase === 'finale') return;
      if (kind === 'latch') onLatch();
      else if (kind === 'weight') {
        if (phase === 'latch') onWeight();
        else api.toast('추는 보를 따라 밀어야 합니다.', true);
      } else if (kind === 'bottom') onBottom();
    },
    revealHint() {
      hintLevel = bumpHintLevel(hintLevel);
      requestHint(api, hintLevel, HINT_PACK);
    },
    get mistook() { return softFailCount > 0; },
    getState() {
      return {
        phase,
        hintLevel,
        latchAngle: hasp.rotation.z,
        weightIndex,
        weightHeld: weightHeld(),
        falseBottomVisible: falseBottom.visible,
      };
    },
    solve() {
      applyLatch(LATCH_OPEN);
      weightIndex = WEIGHT_TARGET;
      onWeight(-1);
      onBottom();
    },
    dispose(scene) { scene.remove(root); disposeChapterResources(root, mats); interactives.length = 0; },
  };
}
