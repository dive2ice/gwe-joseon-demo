/**
 * Chapter 12 — 혼수함 (DLC · 장인의 실측 서고)
 *
 * 겹 3장은 시작 시 모두 닫혀 있다. 가르침 겹(청 / TEACHING_FLAP)은 문양 견본이다.
 * 견본과 각 겹의 가장자리는 BOJAGI_ORDER 자리의 막대 수를 같이 쓴다.
 * 접힘 축(로컬 +X, 뒤 가장자리)을 드래그해 연다. 클릭 순서는 자물쇠 단계가 아니다.
 * 잘못된 다음 겹은 FOLD_RETURN_MS 안에 닫힌 각으로 돌아온다.
 * Soft-fail never advances hints. Hints: request-only observe → relate → FULL.
 * Phases: bojagi → lock → secret → finale.
 * Visual: Joseon wedding chest — densified lacquer body, textile-like bojagi, crafted lock/secret.
 */
import { boxMesh, invisibleHit } from '../materials.js';
import { bumpHintLevel, requestHint, softFailNoHint } from '../hint-policy.js';

export const id = 12;
export const title = '혼수함';
export const blurb = '보자기 겹을 올바른 순서로 풀고 자물쇠와 비밀칸을 여시오.';
export const steps = [
  { id: 'A', label: 'A 보자기' },
  { id: 'B', label: 'B 자물쇠' },
  { id: 'C', label: '비밀칸' },
];
/** Non-spoiler footer; FULL only via explicit revealHint ×3 */
export const hint = '세 겹은 닫혀 있소. 가르침 겹의 가장자리 견본과 같은 문양을 접힘 축으로 맞추시오.';
export const HINT_PARTIAL = '겹은 접힘 축을 따라 당기시오. 견본의 막대와 옷감 가장자리의 막대가 같은 겹이 다음이오.';
export const HINT_RELATION = '열림 각에 못 미치면 겹은 머물지 않습니다. 순서가 아닌 겹은 되돌아갑니다. 세 겹 다음이 자물쇠입니다.';
/** Spoiler: flap indices */
export const HINT_FULL = '정답: 보자기 [1, 0, 2] (청→적→황) — 그다음 자물쇠·비밀칸';
const HINT_PACK = { base: hint, partial: HINT_PARTIAL, relation: HINT_RELATION, full: HINT_FULL };

/** Correct fold unwrap order (indices of three bojagi flaps) */
export const BOJAGI_ORDER = [1, 0, 2];

/** Index of the teaching flap (청). It shows the edge sample and starts closed. */
export const TEACHING_FLAP = 1;

/** Wrong flap commits before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 3;

/**
 * Hinge is the flap group's local +X, at the back edge. Local +Z is the free edge.
 * Rx(θ) of (0,0,+z) is y = -z*sin(θ): negative θ lifts that edge.
 * Pointer dy grows downward, so an upward drag (dy < 0) times this positive scale
 * reaches the negative open angle.
 */
export const FOLD_OPEN = -1.2;
export const FOLD_ALIGN = 0.15;
export const FOLD_RETURN_MS = 400;
export const FOLD_RAD_PER_PX = 0.006;

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch12_honsuham';

  let phase = 'bojagi'; // bojagi | lock | secret | finale
  let progress = [];
  let doneFlaps = new Set();
  let softFailCount = 0;
  let badClicks = 0;
  let hintLevel = 0;
  const interactives = [];

  const woodMat = mats.woodRich || mats.wood;
  const woodDark = mats.woodDark;
  const woodAcc = mats.woodAccent || woodMat;
  const lacquer = mats.lacquer || woodDark;
  const brass = mats.brass;
  const brassB = mats.brassBright || brass;
  const iron = mats.iron;

  // ---- Wedding chest carcass (혼수함) ----
  const BODY_W = 1.1;
  const BODY_H = 0.55;
  const BODY_D = 0.65;
  const bodyY0 = 0.1;
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Lacquer body
  bodyGroup.add(boxMesh(THREE, BODY_W, BODY_H, BODY_D, lacquer, 0, bodyY0 + BODY_H / 2, 0));
  // Side panels (wood accent framing)
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.03, BODY_H - 0.04, BODY_D - 0.04, woodDark,
      sx * (BODY_W / 2 - 0.01), bodyY0 + BODY_H / 2, 0));
  });
  // Front frame rails
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.08, 0.035, 0.025, woodMat,
    0, bodyY0 + 0.06, BODY_D / 2 - 0.01));
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.08, 0.035, 0.025, woodMat,
    0, bodyY0 + BODY_H - 0.06, BODY_D / 2 - 0.01));
  // Top
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.05, 0.05, BODY_D + 0.04, woodDark, 0, bodyY0 + BODY_H + 0.02, 0));
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.1, 0.016, BODY_D - 0.1, lacquer, 0, bodyY0 + BODY_H + 0.04, 0));
  // Crown lip
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.02, 0.014, BODY_D + 0.02, woodAcc, 0, bodyY0 + BODY_H + 0.05, 0.005));

  // Feet + brass shoes
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(boxMesh(THREE, 0.08, 0.1, 0.07, woodDark,
      sx * 0.48, 0.05, sz * 0.26));
    bodyGroup.add(boxMesh(THREE, 0.055, 0.014, 0.05, brass,
      sx * 0.48, 0.01, sz * 0.26));
  });
  bodyGroup.add(boxMesh(THREE, 0.14, 0.045, 0.05, woodDark, 0, 0.03, BODY_D / 2 - 0.04));

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

  // Decorative front panel inset (wedding motif frame)
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.2, BODY_H - 0.2, 0.015, woodAcc,
    0, bodyY0 + BODY_H / 2, frontZ + 0.005));
  // Brass diamond motif
  const motif = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), brassB);
  motif.position.set(0, bodyY0 + BODY_H / 2 + 0.08, frontZ + 0.02);
  bodyGroup.add(motif);

  // Side ring pulls
  [-1, 1].forEach((sx) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 14), brass);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(sx * (BODY_W / 2 + 0.01), bodyY0 + BODY_H * 0.5, 0);
    bodyGroup.add(ring);
    bodyGroup.add(boxMesh(THREE, 0.01, 0.04, 0.03, brass,
      sx * (BODY_W / 2 + 0.005), bodyY0 + BODY_H * 0.5, 0));
  });

  // Rivet strip
  for (let i = 0; i < 7; i++) {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
    riv.position.set(-0.42 + i * 0.14, bodyY0 + BODY_H + 0.01, frontZ + 0.02);
    bodyGroup.add(riv);
  }

  // ---- Three crafted bojagi flaps. Sample and hems share BOJAGI_ORDER bar counts. ----
  const flaps = [];
  const markMeshes = [];
  const CLOTH_W = 0.18;
  const CLOTH_D = 0.3;
  const HINGE_Z = -0.08;
  const flapDefs = [
    { i: 0, x: -0.3, color: mats.bangRed || brass, label: '적' },
    { i: 1, x: 0, color: mats.bangBlue || brass, label: '청' },
    { i: 2, x: 0.3, color: mats.bangYellow || brass, label: '황' },
  ];

  function addMotif(parent, flapIndex, role, x, y, z, scale = 1) {
    const bars = BOJAGI_ORDER.indexOf(flapIndex) + 1;
    const gap = 0.058 * scale;
    const span = (bars - 1) * gap;
    for (let b = 0; b < bars; b++) {
      const mat = brassB.clone();
      mat.color = new THREE.Color(0xfff6d8);
      mat.emissive = new THREE.Color(0xfff1c4);
      mat.emissiveIntensity = 1.4;
      mat.roughness = 0.22;
      const post = boxMesh(
        THREE, 0.022 * scale, 0.11 * scale, 0.022 * scale, mat,
        x + b * gap - span / 2, y, z,
      );
      post.userData = { kind: 'edgeMotif', role, flap: flapIndex, bars, step: bars - 1 };
      parent.add(post);
      markMeshes.push(post);
    }
  }

  function motifPad(parent, x, z, w) {
    const mat = (woodDark || brass).clone();
    mat.color = new THREE.Color(0x1a120c);
    mat.emissive = new THREE.Color(0x000000);
    mat.emissiveIntensity = 0;
    mat.roughness = 0.6;
    parent.add(boxMesh(THREE, w, 0.006, 0.055, mat, x, 0.014, z));
  }

  flapDefs.forEach((f) => {
    const g = new THREE.Group();
    g.position.set(f.x, 0.76, HINGE_Z);
    const clothW = f.i === TEACHING_FLAP ? 0.26 : CLOTH_W;
    const mesh = boxMesh(THREE, clothW, 0.02, CLOTH_D, f.color, 0, 0, CLOTH_D / 2);
    g.add(mesh);
    g.add(boxMesh(THREE, clothW, 0.008, 0.024, f.color, 0, 0.012, 0.03));
    g.add(boxMesh(THREE, 0.036, 0.016, 0.036, brassB, 0, 0.018, 0.03));
    // Hem sits on the cloth top. Posts are separated so the bar count reads.
    motifPad(g, 0, 0.2, Math.min(0.15, clothW - 0.02));
    addMotif(g, f.i, 'hem', 0, 0.068, 0.2, 1);
    if (f.i === TEACHING_FLAP) {
      BOJAGI_ORDER.forEach((flapIndex, step) => {
        const x = -0.078 + step * 0.078;
        motifPad(g, x, 0.08, 0.095);
        addMotif(g, flapIndex, 'sample', x, 0.05, 0.08, 0.7);
      });
    }
    const hit = invisibleHit(
      THREE, CLOTH_W, 0.14, CLOTH_D,
      { id: f.i, kind: 'bojagi' },
      0, 0.04, CLOTH_D / 2,
    );
    g.add(hit);
    root.add(g);
    interactives.push(hit);
    flaps.push({ group: g, i: f.i, label: f.label });
  });

  // ---- Crafted front lock ----
  const lock = new THREE.Group();
  lock.position.set(0, 0.4, frontZ + 0.02);
  root.add(lock);
  // Backplate
  lock.add(boxMesh(THREE, 0.14, 0.18, 0.02, brassB, 0, 0, 0));
  const lockBody = boxMesh(THREE, 0.1, 0.12, 0.05, brass, 0, 0, 0.03);
  lockBody.userData = { id: 'LOCK', kind: 'lock' };
  lock.add(lockBody);
  // Keyhole
  const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 8), iron);
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(0, 0.02, 0.055);
  lock.add(keyhole);
  // Drop ring
  const dropRing = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12), brass);
  dropRing.position.set(0, -0.05, 0.05);
  lock.add(dropRing);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 5, 5), brass);
    riv.position.set(sx * 0.05, sy * 0.07, 0.015);
    lock.add(riv);
  });
  const lockHit = invisibleHit(THREE, 0.2, 0.2, 0.12, { id: 'LOCK', kind: 'lock' });
  lock.add(lockHit);
  interactives.push(lockBody, lockHit, keyhole, dropRing);

  // ---- Secret compartment (side, densified) ----
  const secret = new THREE.Group();
  secret.position.set(0.58, 0.35, 0);
  secret.visible = false;
  root.add(secret);
  secret.add(boxMesh(THREE, 0.18, 0.2, 0.35, woodAcc, 0, 0, 0));
  // Drawer face with brass pull
  secret.add(boxMesh(THREE, 0.02, 0.16, 0.3, woodMat, 0.09, 0, 0));
  const secretRing = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0035, 6, 12), brassB);
  secretRing.rotation.y = Math.PI / 2;
  secretRing.position.set(0.11, 0, 0);
  secret.add(secretRing);
  secret.add(boxMesh(THREE, 0.01, 0.03, 0.025, brass, 0.1, 0, 0));
  // Side brackets
  [[-1], [1]].forEach(([sz]) => {
    secret.add(boxMesh(THREE, 0.03, 0.012, 0.04, brass, 0.08, 0.08, sz * 0.14));
  });
  const slip = boxMesh(THREE, 0.12, 0.01, 0.1, mats.paper, 0, 0.08, 0);
  slip.visible = false;
  secret.add(slip);
  const sHit = invisibleHit(THREE, 0.24, 0.26, 0.4, { id: 'SECRET', kind: 'secret' });
  secret.add(sHit);
  interactives.push(sHit, secretRing);

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

  function seedTeachingFlap() {
    progress = [];
    doneFlaps = new Set();
    flaps.forEach((f) => {
      f.group.rotation.x = 0;
      f.group.visible = true;
    });
  }

  function applyFold(flap, angle) {
    flap.group.rotation.x = Math.max(FOLD_OPEN, Math.min(0, angle));
  }

  function finishFold(flap, angle) {
    if (!flap || phase !== 'bojagi' || doneFlaps.has(flap.i)) return;
    applyFold(flap, angle);
    const posed = flap.group.rotation.x;
    const aligned = Math.abs(posed - FOLD_OPEN) <= FOLD_ALIGN + 1e-9;
    if (!aligned) {
      animateTo(flap.group.rotation, 'x', 0, FOLD_RETURN_MS);
      return;
    }
    const expected = BOJAGI_ORDER[progress.length];
    if (flap.i !== expected) {
      badClicks += 1;
      animateTo(flap.group.rotation, 'x', 0, FOLD_RETURN_MS);
      api.playWrong();
      api.vibrate(22);
      if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
      else api.toast('겹이 되돌아갔습니다.');
      return;
    }
    flap.group.rotation.x = FOLD_OPEN;
    progress.push(flap.i);
    doneFlaps.add(flap.i);
    badClicks = 0;
    api.playThunk();
    api.vibrate(24);
    if (progress.length === BOJAGI_ORDER.length) {
      phase = 'lock';
      api.setObjective('세 겹이 열렸소. 전면 자물쇠를 여시오.');
      api.setSteps('B', ['A']);
      api.playUnlock();
      api.toast('세 겹이 축에 맞았습니다. 자물쇠는 아직이오.', true);
    } else {
      api.toast('겹이 축에 맞았습니다.', true);
    }
  }

  function onBojagi() {
    if (phase !== 'bojagi') {
      if (phase === 'lock') api.toast('보자기는 이미 풀렸소. 자물쇠를 여시오.');
      else if (phase === 'secret') api.toast('보자기는 이미 풀렸소. 비밀칸을 당기시오.');
      return;
    }
    api.toast('겹은 접힘 축을 따라 당기시오.');
  }

  function onLock() {
    if (phase !== 'lock') {
      if (phase === 'bojagi') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('먼저 보자기 겹을 접힘 축으로 푸시오.');
      }
      return;
    }
    phase = 'secret';
    animateTo(lock.rotation, 'z', 1.2, 300);
    secret.visible = true;
    api.setObjective('측면 비밀칸을 당기시오.');
    api.setSteps('C', ['A', 'B']);
    api.playUnlock();
    api.toast('자물쇠가 열렸습니다.', true);
  }

  function onSecret() {
    if (phase !== 'secret') {
      if (phase !== 'finale') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('먼저 보자기와 자물쇠를 푸시오.');
      }
      return;
    }
    phase = 'finale';
    animateVec3(secret.position, new THREE.Vector3(0.85, 0.35, 0.15), 420, () => {
      slip.visible = true;
      api.setObjective('실측 쪽지를 확인하시오.');
      api.playUnlock();
      api.vibrate([40, 30, 70]);
      api.showFinale({
        title: '혼수함 · 비밀칸',
        body: '보자기 겹과 자물쇠가 풀리자 측면 비밀칸에서 쪽지가 나왔다. 「문갑의 서랍은 가볍게, 문은 장부로」.',
        footer: '— 장인의 실측 서고 · 혼수함',
        epilogue: '제12장 혼수함 — 해제 완료',
      });
      api.markCleared(id);
    });
    api.playClick();
  }

  seedTeachingFlap();

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives,
    getMarkMeshes: () => markMeshes.slice(),
    build(scene) { scene.add(root); },
    start() { this.reset(); },
    reset() {
      phase = 'bojagi';
      softFailCount = 0;
      badClicks = 0;
      hintLevel = 0;
      bodyGroup.position.x = 0;
      seedTeachingFlap();
      lock.rotation.z = 0;
      secret.visible = false;
      secret.position.set(0.58, 0.35, 0);
      slip.visible = false;
      api.setObjective('가르침 겹의 가장자리 견본과 같은 문양을 접힘 축으로 푸시오.');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      api.toast('혼수함 — 닫힌 겹의 가장자리를 살피시오.', true);
    },
    getDragInteraction(kind, iid) {
      if (phase !== 'bojagi' || kind !== 'bojagi') return null;
      const flap = flaps.find((f) => f.i === iid);
      if (!flap || doneFlaps.has(iid)) return null;
      let origin = 0;
      return {
        start() { origin = flap.group.rotation.x; },
        move(s) { applyFold(flap, origin + (s.dy || 0) * FOLD_RAD_PER_PX); },
        end(s) { finishFold(flap, origin + (s?.dy || 0) * FOLD_RAD_PER_PX); },
        cancel() { flap.group.rotation.x = origin; },
      };
    },
    handleInteract(kind) {
      if (phase === 'finale') return;
      if (kind === 'bojagi') onBojagi();
      else if (kind === 'lock') onLock();
      else if (kind === 'secret') onSecret();
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
        openCount: doneFlaps.size,
        folds: flaps.map((f) => ({
          i: f.i,
          angle: f.group.rotation.x,
          open: doneFlaps.has(f.i),
        })),
      };
    },
    solve() {
      phase = 'bojagi';
      seedTeachingFlap();
      BOJAGI_ORDER.forEach((fid) => {
        finishFold(flaps.find((f) => f.i === fid), FOLD_OPEN);
      });
      if (phase === 'lock') onLock();
      if (phase === 'secret') onSecret();
    },
    dispose(scene) { scene.remove(root); interactives.length = 0; },
  };
}
