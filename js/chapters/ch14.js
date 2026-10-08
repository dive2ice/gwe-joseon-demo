/**
 * Chapter 14 — 이층농 (DLC · 장인의 실측 서고)
 *
 * Discoverable rule: 적층 농은 위→아래 (TIER_ORDER UPPER→LOWER) —
 * unload the upper first so the lower can open; readable on 적층 plaque.
 * Teaching: UPPER starts slightly ajar.
 * Soft-fail never advances hints. Hints: request-only observe → relate → FULL.
 * Phases: tiers → pin → note → finale.
 * Visual: stacked Joseon nong — densified UPPER/LOWER doors with ring pulls,
 * carcass brackets/feet, crafted leg pin.
 */
import { bevelBoxMesh as boxMesh, invisibleHit } from '../materials.js';
import { bumpHintLevel, requestHint, softFailNoHint } from '../hint-policy.js';
import { disposeChapterResources } from '../chapter-resources.js';
import { archivePalette, mechanismFrame } from './archive-craft.js';

export const id = 14;
export const title = '이층농';
export const blurb = '상·하층을 순서대로 열고 다리 속 숨은 핀으로 쪽지를 찾으시오.';
export const steps = [
  { id: 'A', label: 'A 층문' },
  { id: 'B', label: 'B 핀' },
  { id: 'C', label: '쪽지' },
];
/** Non-spoiler footer; FULL only via explicit revealHint ×3 */
export const hint = '이층농 적층 패를 살피시오. · 상층 문은 이미 조금 열려 있소.';
export const HINT_PARTIAL = '적층 순서로 위 → 아래. 상층을 먼저 연 뒤 하층을…';
export const HINT_RELATION = '위가 열린 뒤에야 아래가 산다. 적층 패가 그 순서를 이른다.';
/** Spoiler: tier ids */
export const HINT_FULL = '층문 순서: 상 → 하 (UPPER→LOWER) — 그다음 다리 핀·쪽지';
const HINT_PACK = { base: hint, partial: HINT_PARTIAL, relation: HINT_RELATION, full: HINT_FULL };

/** Correct open order of tiers */
export const TIER_ORDER = ['UPPER', 'LOWER'];

/** Teaching tier that starts slightly ajar */
export const TEACHING_TIER = 'UPPER';

/** Wrong tier clicks before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 3;

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch14_icheongnong';

  let phase = 'tiers'; // tiers | pin | note | finale
  let progress = [];
  let openSet = new Set();
  let softFailCount = 0;
  let badClicks = 0;
  let hintLevel = 0;
  const interactives = [];
  const tiers = {};

  const palette = archivePalette(mats);
  const woodMat = palette.wood;
  const woodDark = palette.dark;
  const woodAcc = palette.wood;
  const lacquer = mats.lacquer || woodDark;
  const brass = palette.brass;
  const brassB = palette.bright;
  const brassPin = mats.brassPin || brassB;

  // ---- Stacked two-tier nong carcass ----
  const BODY_W = 0.92;
  const BODY_D = 0.52;
  const TIER_H = 0.38;
  const midY = 0.5;
  const upperY = 0.72;
  const lowerY = 0.28;
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Lower carcass
  bodyGroup.add(boxMesh(THREE, BODY_W, TIER_H, BODY_D, woodDark, 0, lowerY, 0));
  // Upper carcass
  bodyGroup.add(boxMesh(THREE, BODY_W, TIER_H, BODY_D, woodDark, 0, upperY, 0));
  // Side stiles (both tiers)
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.028, TIER_H - 0.04, BODY_D - 0.06, woodMat,
      sx * (BODY_W / 2 - 0.012), lowerY, 0));
    bodyGroup.add(boxMesh(THREE, 0.028, TIER_H - 0.04, BODY_D - 0.06, woodMat,
      sx * (BODY_W / 2 - 0.012), upperY, 0));
  });
  // Back panels
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.08, TIER_H - 0.08, 0.02, woodDark,
    0, lowerY, -BODY_D / 2 + 0.01));
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.08, TIER_H - 0.08, 0.02, woodDark,
    0, upperY, -BODY_D / 2 + 0.01));

  // Mid stacking shelf / rail (where upper sits on lower)
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.04, 0.05, BODY_D + 0.04, woodMat, 0, midY, 0));
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.06, 0.014, BODY_D - 0.06, lacquer, 0, midY + 0.028, 0));
  // Mid rail brass strip
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.1, 0.01, 0.02, brass, 0, midY + 0.01, BODY_D / 2 + 0.005));

  // Top crown
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.06, 0.055, BODY_D + 0.05, woodMat, 0, 0.95, 0));
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.02, 0.018, BODY_D + 0.02, woodAcc, 0, 0.985, 0.005));
  // Top lacquer inset
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.1, 0.012, BODY_D - 0.1, lacquer, 0, 0.99, 0));

  // Base plinth
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.04, 0.06, BODY_D + 0.04, woodDark, 0, 0.08, 0));
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.08, 0.012, BODY_D - 0.08, woodAcc, 0, 0.11, 0.01));

  // Legs + brass shoes (shaped feet)
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const lx = sx * 0.38;
    const lz = sz * 0.22;
    bodyGroup.add(boxMesh(THREE, 0.08, 0.14, 0.075, woodDark, lx, 0.0, lz));
    // Ankle taper
    bodyGroup.add(boxMesh(THREE, 0.06, 0.04, 0.055, woodMat, lx, -0.05, lz));
    // Brass shoe
    bodyGroup.add(boxMesh(THREE, 0.055, 0.014, 0.05, brass, lx, -0.07, lz));
  });
  // Center front foot
  bodyGroup.add(boxMesh(THREE, 0.14, 0.05, 0.05, woodDark, 0, 0.02, BODY_D / 2 - 0.04));
  bodyGroup.add(boxMesh(THREE, 0.1, 0.012, 0.035, brass, 0, 0.0, BODY_D / 2 - 0.04));

  // Corner brackets on both tiers
  function cornerBracket(x, y, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.add(boxMesh(THREE, 0.09, 0.014, 0.03, brassB, 0.04, 0, 0));
    g.add(boxMesh(THREE, 0.03, 0.014, 0.09, brassB, 0, 0, 0.04));
    for (let i = 0; i < 2; i++) {
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), brass);
      riv.position.set(0.02 + i * 0.03, 0.01, 0.01);
      g.add(riv);
    }
    bodyGroup.add(g);
  }
  const frontZ = BODY_D / 2 - 0.01;
  // Upper corners
  cornerBracket(-BODY_W / 2 + 0.02, upperY + TIER_H / 2 - 0.06, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, upperY + TIER_H / 2 - 0.06, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, upperY - TIER_H / 2 + 0.06, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, upperY - TIER_H / 2 + 0.06, frontZ, -Math.PI / 2);
  // Lower corners
  cornerBracket(-BODY_W / 2 + 0.02, lowerY + TIER_H / 2 - 0.06, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, lowerY + TIER_H / 2 - 0.06, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, lowerY - TIER_H / 2 + 0.08, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, lowerY - TIER_H / 2 + 0.08, frontZ, -Math.PI / 2);
  // Mid shelf brackets
  cornerBracket(-BODY_W / 2 + 0.02, midY + 0.01, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, midY + 0.01, frontZ, -Math.PI / 2);

  // Side ring pulls (non-interactive carry handles)
  [-1, 1].forEach((sx) => {
    [upperY, lowerY].forEach((ty) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 14), brass);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(sx * (BODY_W / 2 + 0.01), ty, 0);
      bodyGroup.add(ring);
      bodyGroup.add(boxMesh(THREE, 0.01, 0.04, 0.03, brass,
        sx * (BODY_W / 2 + 0.005), ty, 0));
    });
  });

  // Top rim rivets
  for (let i = 0; i < 7; i++) {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
    riv.position.set(-0.36 + i * 0.12, 0.96, frontZ + 0.02);
    bodyGroup.add(riv);
  }

  // Decorative quiet drawer faces on each tier flanks (non-interactive)
  function ringPull(mat, scale = 1) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014 * scale, 0.0035 * scale, 6, 14), mat);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    g.add(boxMesh(THREE, 0.026 * scale, 0.018 * scale, 0.006 * scale, mat, 0, 0, -0.003));
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.004 * scale, 5, 5), mat);
    riv.position.set(0, 0, 0.005);
    g.add(riv);
    return g;
  }

  // Quiet side compartments (visual density)
  [-1, 1].forEach((sx) => {
    [upperY, lowerY].forEach((ty) => {
      bodyGroup.add(boxMesh(THREE, 0.18, 0.22, 0.035, woodMat,
        sx * 0.32, ty, frontZ + 0.003));
      const quiet = ringPull(brass, 0.65);
      quiet.position.set(sx * 0.32, ty - 0.04, frontZ + 0.01);
      bodyGroup.add(quiet);
    });
  });

  // ---- Tier doors (UPPER / LOWER) with densified brass ring pulls ----
  [
    { id: 'UPPER', y: upperY, label: '상' },
    { id: 'LOWER', y: lowerY, label: '하' },
  ].forEach((t) => {
    const g = new THREE.Group();
    g.position.set(0.22, t.y, 0.28);
    // Door face
    const door = boxMesh(THREE, 0.42, 0.32, 0.045, woodAcc, 0, 0, 0);
    door.userData = { id: t.id, kind: 'tier' };
    g.add(door);
    // Face lip / frame
    g.add(boxMesh(THREE, 0.4, 0.01, 0.05, woodMat, 0, 0.145, 0));
    g.add(boxMesh(THREE, 0.4, 0.01, 0.05, woodMat, 0, -0.145, 0));
    g.add(boxMesh(THREE, 0.01, 0.3, 0.05, woodMat, 0.195, 0, 0));
    g.add(boxMesh(THREE, 0.01, 0.3, 0.05, woodMat, -0.195, 0, 0));
    // Panel inset
    g.add(boxMesh(THREE, 0.32, 0.22, 0.012, woodMat, 0, 0, 0.025));
    // Stronger brass ring pull
    const pull = ringPull(brassB, 1.35);
    pull.position.set(-0.12, 0, 0.04);
    pull.traverse((m) => {
      if (m.isMesh) m.userData = { id: t.id, kind: 'tier' };
    });
    g.add(pull);
    // Label plate
    g.add(boxMesh(THREE, 0.055, 0.025, 0.008, brass, 0.08, 0.05, 0.028));
    // Door hinge knuckles (visual)
    const hinge = new THREE.Group();
    hinge.position.set(0.2, 0, 0);
    [-0.1, 0.1].forEach((hy) => {
      hinge.add(boxMesh(THREE, 0.04, 0.018, 0.012, brassB, 0, hy, 0.02));
      const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.03, 8), brass);
      knuckle.position.set(0.015, hy, 0.02);
      hinge.add(knuckle);
    });
    g.add(hinge);
    // Door corner rivets
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), brass);
      riv.position.set(sx * 0.18, sy * 0.13, 0.03);
      g.add(riv);
    });
    const hit = invisibleHit(THREE, 0.48, 0.36, 0.14, { id: t.id, kind: 'tier' });
    g.add(hit);
    // Put the pivot on the right hinge while preserving the closed-door envelope.
    for (const child of g.children) child.position.x -= .215;
    g.position.x += .215;
    root.add(g);
    interactives.push(door, hit);
    pull.traverse((m) => { if (m.isMesh) interactives.push(m); });
    tiers[t.id] = { group: g, label: t.label, open: false };
  });

  // ---- 적층 / UPPER→LOWER reason plaque (readable world rule) ----
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
  const tierPlaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.06),
    makeRulePlaque('적층 · 위→아래'),
  );
  tierPlaque.position.set(0, midY + 0.06, frontZ + 0.03);
  bodyGroup.add(tierPlaque);

  // ---- Crafted hidden pin in front-left leg ----
  const pinGroup = new THREE.Group();
  pinGroup.position.set(-0.38, 0.08, 0.22);
  pinGroup.visible = false;
  root.add(pinGroup);
  // Mount plate on leg
  pinGroup.add(boxMesh(THREE, 0.07, 0.08, 0.015, brass, 0, 0, -0.02));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), brass);
    riv.position.set(sx * 0.022, sy * 0.028, -0.01);
    pinGroup.add(riv);
  });
  // Pin shaft
  const pin = boxMesh(THREE, 0.035, 0.1, 0.035, brassPin, 0, 0, 0.01);
  pin.userData = { id: 'PIN', kind: 'pin' };
  pinGroup.add(pin);
  // Collar
  pinGroup.add(boxMesh(THREE, 0.05, 0.018, 0.05, brassB, 0, 0.045, 0.01));
  // Knob / head
  const pinKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.028, 10), brassB);
  pinKnob.position.set(0, 0.07, 0.01);
  pinKnob.userData = { id: 'PIN', kind: 'pin' };
  pinGroup.add(pinKnob);
  // Tip ring
  const tipRing = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 5, 10), brass);
  tipRing.rotation.x = Math.PI / 2;
  tipRing.position.set(0, -0.04, 0.01);
  pinGroup.add(tipRing);
  const pinHit = invisibleHit(THREE, 0.14, 0.18, 0.14, { id: 'PIN', kind: 'pin' });
  pinGroup.add(pinHit);
  interactives.push(pin, pinHit, pinKnob);

  // ---- Crafted note ----
  const noteGroup = new THREE.Group();
  noteGroup.position.set(-.12, .55, .46);
  noteGroup.rotation.x = .65;
  noteGroup.visible = false;
  root.add(noteGroup);
  noteGroup.add(boxMesh(THREE, 0.22, 0.01, 0.15, mats.paper, 0, 0, 0));
  // Folded corner
  noteGroup.add(boxMesh(THREE, 0.05, 0.008, 0.04, mats.paper, 0.08, 0.008, 0.05));
  // Seal blot
  noteGroup.add(boxMesh(THREE, 0.04, 0.008, 0.035, brassB, -0.06, 0.01, -0.03));
  const noteHit = invisibleHit(THREE, 0.26, 0.08, 0.2, { id: 'NOTE', kind: 'note' });
  noteGroup.add(noteHit);
  interactives.push(noteHit);

  const AJAR_Y = 0.35; // right hinge swings the left edge toward the player

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

  function seedTeachingTier() {
    progress = [];
    openSet.clear();
    Object.values(tiers).forEach((t) => {
      t.group.rotation.y = 0;
      t.open = false;
    });
    // UPPER ajar teaching cue
    tiers.UPPER.group.rotation.y = AJAR_Y;
  }

  function onTier(tid) {
    if (phase !== 'tiers') {
      if (phase === 'pin') api.toast('층문은 이미 열렸소. 다리 핀을 살피시오.');
      return;
    }
    if (openSet.has(tid)) {
      api.toast(tid === TEACHING_TIER
        ? '상층은 이미 열려 있소. 적층 패의 다음을…'
        : '이미 열린 층입니다.');
      return;
    }
    if (tid !== TIER_ORDER[progress.length]) {
      api.playWrong();
      api.vibrate(22);
      badClicks += 1;
      seedTeachingTier();
      softFailShake();
      if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
      else api.toast('층문 순서가 틀렸습니다. 적층 패 — 위부터.');
      return;
    }
    progress.push(tid);
    openSet.add(tid);
    tiers[tid].open = true;
    badClicks = 0;
    animateTo(tiers[tid].group.rotation, 'y', 1.1, 320);
    api.playThunk();
    api.vibrate(26);
    if (progress.length === TIER_ORDER.length) {
      phase = 'pin';
      badClicks = 0;
      pinGroup.visible = true;
      api.setObjective('다리·받침에 숨은 핀을 뽑으시오.');
      api.setSteps('B', ['A']);
      api.playUnlock();
      api.toast('상·하층이 적층 순서로 열렸습니다. 다리 속을 살피시오.', true);
    } else {
      api.toast(`${tiers[tid].label}층 개방 (${progress.length}/2) · 적층을 따르시오`, true);
    }
  }

  function onPin() {
    if (phase !== 'pin') {
      if (phase === 'tiers') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('먼저 상·하층을 적층 순서로 여시오.');
      }
      return;
    }
    phase = 'note';
    animateVec3(pinGroup.position, new THREE.Vector3(-0.55, 0.12, 0.35), 350, () => {
      noteGroup.visible = true;
      api.setObjective('드러난 쪽지를 확인하시오.');
      api.setSteps('C', ['A', 'B']);
      api.playUnlock();
      api.toast('숨은 핀이 빠졌습니다.', true);
    });
    api.playClick();
    api.vibrate(30);
  }

  function onNote() {
    if (phase !== 'note') {
      if (phase !== 'finale') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('먼저 층문과 핀을 다루시오.');
      }
      return;
    }
    phase = 'finale';
    api.setObjective('실측 쪽지를 읽으시오.');
    api.playUnlock();
    api.vibrate([45, 30, 80]);
    api.showFinale({
      title: '이층농 · 쪽지',
      body: '상·하층을 순서대로 열고 다리 핀을 뽑자 쪽지가 나왔다. 「의궤함은 문서 트레이를 당기고, 봉인 끈을 푸라」.',
      footer: '— 장인의 실측 서고 · 이층농',
      epilogue: '제14장 이층농 — 해제 완료',
    });
    api.markCleared(id);
  }

  seedTeachingTier();

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives.filter(m => phase === 'tiers' ? m.userData.kind === 'tier' && !openSet.has(m.userData.id) :
      phase === 'pin' ? m.userData.kind === 'pin' : phase === 'note' && noteGroup.visible ? m.userData.kind === 'note' : false),
    build(scene) { scene.add(root); },
    start() { this.reset(); },
    reset() {
      phase = 'tiers';
      softFailCount = 0;
      badClicks = 0;
      hintLevel = 0;
      bodyGroup.position.x = 0;
      seedTeachingTier();
      pinGroup.visible = false;
      pinGroup.position.set(-0.38, 0.08, 0.22);
      noteGroup.visible = false;
      api.setObjective('적층 패를 따라 문을 여시오. 상층은 이미 조금 열려 있소.');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      api.toast('이층농 — 적층 패를 살피시오.', true);
    },
    getGestureFrame(kind, iid) {
      if (kind === 'tier' && tiers[iid]) return mechanismFrame(THREE, tiers[iid].group, 'rotate', [0, 1, 0]);
      if (kind === 'pin') return mechanismFrame(THREE, pinGroup, 'linear', [0, 1, 0]);
    },
    getDragInteraction(kind, iid) {
      if (kind === 'tier' && phase === 'tiers' && tiers[iid] && !openSet.has(iid)) {
        const t = tiers[iid]; let origin, turn = 0;
        return {
          start() { origin = t.group.rotation.y; turn = 0; },
          move(s) { turn = s.turn || 0; if (iid === TIER_ORDER[progress.length]) t.group.rotation.y = Math.max(0, Math.min(1.1, origin + turn)); },
          end(s) { turn = s?.turn ?? turn; t.group.rotation.y = origin; if (origin + turn >= .9) onTier(iid); },
          cancel() { t.group.rotation.y = origin; },
        };
      }
      if (kind === 'pin' && phase === 'pin') {
        const origin = pinGroup.position.clone(); let travel = 0;
        return {
          move(s) { travel = s.travel || 0; pinGroup.position.y = origin.y + Math.max(0, Math.min(.15, travel)); },
          end(s) { travel = s?.travel ?? travel; pinGroup.position.copy(origin); if (travel >= .1) onPin(); },
          cancel() { pinGroup.position.copy(origin); },
        };
      }
      return null;
    },
    handleInteract(kind, iid) {
      if (phase === 'finale') return;
      if (kind === 'tier') api.toast('층문 손잡이를 잡고 경첩을 따라 여시오. 위에서 아래로…');
      else if (kind === 'pin') api.toast('다리 속 핀을 위로 뽑으시오.');
      else if (kind === 'note') onNote();
    },
    revealHint() {
      hintLevel = bumpHintLevel(hintLevel);
      requestHint(api, hintLevel, HINT_PACK);
    },
    get mistook() { return softFailCount > 0; },
    getState() {
      return { phase, hintLevel, progress: [...progress], pinVisible: pinGroup.visible,
        tiers: Object.fromEntries(Object.entries(tiers).map(([key, t]) => [key, t.group.rotation.y])) };
    },
    solve() {
      TIER_ORDER.forEach((tid) => {
        if (!openSet.has(tid)) {
          progress.push(tid);
          openSet.add(tid);
          tiers[tid].group.rotation.y = 1.1;
          tiers[tid].open = true;
        }
      });
      pinGroup.visible = true;
      noteGroup.visible = true;
      phase = 'note';
      onNote();
    },
    dispose(scene) { scene.remove(root); disposeChapterResources(root, mats); interactives.length = 0; },
  };
}
