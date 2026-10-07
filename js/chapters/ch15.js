/**
 * Chapter 15 — 의궤함 (DLC · 장인의 실측 서고)
 *
 * Discoverable rule: 봉인 끈은 인장 매듭 순서(청→적→황 = CORD_ORDER [2,0,1])
 * readable on the seal/knot plaque — not a HUD spoiler.
 * Teaching cord (청 / index 2) starts already untied.
 * Soft-fail never advances hints. Hints: request-only observe → relate → FULL.
 * Phases: tray → cord → slip → finale.
 * Visual: lacquer archive chest — densified brass case, crafted tray / cord knots / slip.
 */
import { boxMesh, invisibleHit } from '../materials.js';
import { bumpHintLevel, requestHint, softFailNoHint } from '../hint-policy.js';

export const id = 15;
export const title = '의궤함';
export const blurb = '문서함 서랍을 밀고 봉인 끈 매듭을 풀어 기록 쪽지를 찾으시오.';
export const steps = [
  { id: 'A', label: 'A 서랍' },
  { id: 'B', label: 'B 봉인' },
  { id: 'C', label: '기록' },
];
/** Non-spoiler footer; FULL only via explicit revealHint ×3 */
export const hint = '문서함 트레이를 민 뒤, 봉인 매듭 패를 살피시오. · 청 끈은 이미 풀려 있소.';
export const HINT_PARTIAL = '봉인 끈은 인장 매듭 순서대로. 청 → 적 → 황…';
export const HINT_RELATION = '청 끈을 본보기로 적·황 매듭을 이으시오. 인장 패의 순서가 끈의 순서다.';
/** Spoiler: cord indices */
export const HINT_FULL = '정답: 봉인 끈 [2, 0, 1] (청→적→황) — 그다음 기록 쪽지';
const HINT_PACK = { base: hint, partial: HINT_PARTIAL, relation: HINT_RELATION, full: HINT_FULL };

/** Cord knot segment click order */
export const CORD_ORDER = [2, 0, 1];

/** Index of teaching cord that starts already untied (청 = first in knot order) */
export const TEACHING_CORD = 2;

/** Wrong cord clicks before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 3;

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch15_uigweham';

  let phase = 'tray'; // tray | cord | slip | finale
  let trayOpen = false;
  let cordProgress = [];
  let cordDone = new Set();
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

  // ---- Lacquer archive chest carcass (의궤함) ----
  const BODY_W = 1.08;
  const BODY_H = 0.38;
  const BODY_D = 0.72;
  const bodyY0 = 0.16;
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Main lacquer body
  bodyGroup.add(boxMesh(THREE, BODY_W, BODY_H, BODY_D, lacquer, 0, bodyY0 + BODY_H / 2, 0));
  // Wood frame rails (Joseon lacquer chest often frames lacquer panels)
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.03, BODY_H - 0.04, BODY_D - 0.04, woodDark,
      sx * (BODY_W / 2 - 0.012), bodyY0 + BODY_H / 2, 0));
  });
  // Front lip rail
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.08, 0.025, 0.03, woodMat,
    0, bodyY0 + BODY_H - 0.02, BODY_D / 2 - 0.01));
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.08, 0.025, 0.03, woodMat,
    0, bodyY0 + 0.02, BODY_D / 2 - 0.01));

  // Lid / top
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.05, 0.05, BODY_D + 0.05, woodDark, 0, bodyY0 + BODY_H + 0.02, 0));
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.06, 0.016, BODY_D - 0.06, lacquer, 0, bodyY0 + BODY_H + 0.04, 0));
  // Lid edge brass rail
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.02, 0.012, 0.02, brass, 0, bodyY0 + BODY_H + 0.01, BODY_D / 2 + 0.015));

  // Base plinth
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.05, 0.05, BODY_D + 0.05, woodDark, 0, bodyY0 - 0.02, 0));
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.08, 0.012, BODY_D - 0.08, woodAcc, 0, bodyY0 + 0.01, 0.01));

  // Feet + brass shoes
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(boxMesh(THREE, 0.08, 0.12, 0.07, woodDark,
      sx * 0.46, 0.06, sz * 0.28));
    bodyGroup.add(boxMesh(THREE, 0.06, 0.014, 0.05, brass,
      sx * 0.46, 0.01, sz * 0.28));
  });
  bodyGroup.add(boxMesh(THREE, 0.16, 0.05, 0.055, woodDark, 0, 0.03, BODY_D / 2 - 0.05));

  // Corner brackets
  function cornerBracket(x, y, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.add(boxMesh(THREE, 0.1, 0.014, 0.032, brassB, 0.045, 0, 0));
    g.add(boxMesh(THREE, 0.032, 0.014, 0.1, brassB, 0, 0, 0.045));
    for (let i = 0; i < 2; i++) {
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), brass);
      riv.position.set(0.022 + i * 0.032, 0.01, 0.01);
      g.add(riv);
    }
    bodyGroup.add(g);
  }
  const frontZ = BODY_D / 2 - 0.01;
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.04, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.04, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + 0.06, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + 0.06, frontZ, -Math.PI / 2);
  // Mid side brackets
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H * 0.5, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H * 0.5, frontZ, -Math.PI / 2);
  // Lid corners
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H + 0.03, frontZ + 0.01, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H + 0.03, frontZ + 0.01, -Math.PI / 2);

  // Side carry rings
  [-1, 1].forEach((sx) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.005, 6, 14), brass);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(sx * (BODY_W / 2 + 0.01), bodyY0 + BODY_H * 0.55, 0);
    bodyGroup.add(ring);
    bodyGroup.add(boxMesh(THREE, 0.01, 0.045, 0.035, brass,
      sx * (BODY_W / 2 + 0.005), bodyY0 + BODY_H * 0.55, 0));
  });

  // Lid rim rivets
  for (let i = 0; i < 8; i++) {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
    riv.position.set(-0.42 + i * 0.12, bodyY0 + BODY_H + 0.02, frontZ + 0.025);
    bodyGroup.add(riv);
  }

  // Decorative brass lock plate (non-interactive visual)
  bodyGroup.add(boxMesh(THREE, 0.14, 0.1, 0.015, brassB, 0.38, bodyY0 + BODY_H * 0.55, frontZ + 0.01));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), brass);
    riv.position.set(0.38 + sx * 0.05, bodyY0 + BODY_H * 0.55 + sy * 0.035, frontZ + 0.02);
    bodyGroup.add(riv);
  });
  const lockRing = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0035, 5, 12), brass);
  lockRing.position.set(0.38, bodyY0 + BODY_H * 0.55 - 0.02, frontZ + 0.03);
  bodyGroup.add(lockRing);

  // ---- Crafted document tray (front slide) ----
  const tray = new THREE.Group();
  tray.position.set(0, 0.32, 0.15);
  root.add(tray);
  // Tray body / face
  const trayFace = boxMesh(THREE, 0.88, 0.14, 0.42, woodAcc, 0, 0, 0);
  trayFace.userData = { id: 'TRAY', kind: 'tray' };
  tray.add(trayFace);
  // Inner tray floor
  tray.add(boxMesh(THREE, 0.8, 0.02, 0.36, woodMat, 0, 0.04, -0.02));
  // Side walls of tray
  [-1, 1].forEach((sx) => {
    tray.add(boxMesh(THREE, 0.02, 0.08, 0.38, woodDark, sx * 0.42, 0.02, 0));
  });
  tray.add(boxMesh(THREE, 0.84, 0.06, 0.02, woodDark, 0, 0.02, -0.2));
  // Face lip
  tray.add(boxMesh(THREE, 0.86, 0.012, 0.43, woodMat, 0, 0.065, 0));
  // Brass pull bar + drop rings
  const trayPull = boxMesh(THREE, 0.18, 0.025, 0.04, brassB, 0, -0.01, 0.23);
  trayPull.userData = { id: 'TRAY', kind: 'tray' };
  tray.add(trayPull);
  [-1, 1].forEach((sx) => {
    const dropRing = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0035, 5, 12), brass);
    dropRing.position.set(sx * 0.06, -0.03, 0.25);
    dropRing.userData = { id: 'TRAY', kind: 'tray' };
    tray.add(dropRing);
    interactives.push(dropRing);
  });
  // Pull plate rivets
  [-1, 1].forEach((sx) => {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), brass);
    riv.position.set(sx * 0.07, -0.01, 0.25);
    tray.add(riv);
  });
  // Label plate
  tray.add(boxMesh(THREE, 0.06, 0.022, 0.008, brass, 0.3, 0.02, 0.22));
  const trayHit = invisibleHit(THREE, 0.94, 0.2, 0.52, { id: 'TRAY', kind: 'tray' });
  tray.add(trayHit);
  interactives.push(trayFace, trayPull, trayHit);

  // ---- 봉인 매듭 order plaque (readable knot world rule) ----
  function makeRulePlaque(label, w = 160, h = 36) {
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
  const knotPlaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.07),
    makeRulePlaque('봉인 · 청→적→황'),
  );
  knotPlaque.position.set(0, 0.72, 0.12);
  root.add(knotPlaque);

  // ---- Crafted seal / cord knots (three segments on lid) ----
  const cords = [];
  const cordMats = [mats.bangRed, mats.bangYellow, mats.bangBlue];
  const cordLabels = ['적', '황', '청'];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    g.position.set(-0.28 + i * 0.28, 0.6, 0.05);
    // Knot core (cube + torus wrap)
    const knot = boxMesh(THREE, 0.09, 0.055, 0.09, cordMats[i], 0, 0, 0);
    knot.userData = { id: i, kind: 'cord' };
    g.add(knot);
    // Knot wrap rings
    const wrapH = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 5, 12), cordMats[i]);
    wrapH.rotation.x = Math.PI / 2;
    wrapH.position.set(0, 0.01, 0);
    wrapH.userData = { id: i, kind: 'cord' };
    g.add(wrapH);
    const wrapV = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 5, 10), cordMats[i]);
    wrapV.rotation.y = Math.PI / 2;
    wrapV.userData = { id: i, kind: 'cord' };
    g.add(wrapV);
    // Cord line running back toward seal
    g.add(boxMesh(THREE, 0.025, 0.018, 0.28, cordMats[i], 0, -0.04, -0.08));
    // Cord tip brass ferrule
    g.add(boxMesh(THREE, 0.035, 0.02, 0.03, brassB, 0, -0.04, -0.22));
    // Small brass bead at knot center
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), brassB);
    bead.position.set(0, 0.04, 0);
    g.add(bead);
    // Knot-order step glyph from CORD_ORDER
    const cordStep = CORD_ORDER.indexOf(i);
    const stepGlyph = cordStep >= 0 ? ['①', '②', '③'][cordStep] : '·';
    const stepPlaque = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.028, 0.006),
      makeRulePlaque(stepGlyph, 64, 32),
    );
    stepPlaque.position.set(0, 0.06, 0.06);
    stepPlaque.userData = { id: i, kind: 'cord' };
    g.add(stepPlaque);
    // Teaching glow on 청 cord
    if (i === TEACHING_CORD) {
      const teachRim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.005, 5, 12), brassB.clone());
      teachRim.rotation.x = Math.PI / 2;
      teachRim.position.y = 0.03;
      if (teachRim.material.emissiveIntensity != null) {
        teachRim.material.emissive = new THREE.Color(0x203050);
        teachRim.material.emissiveIntensity = 0.55;
      }
      g.add(teachRim);
    }
    const hit = invisibleHit(THREE, 0.16, 0.14, 0.24, { id: i, kind: 'cord' });
    g.add(hit);
    root.add(g);
    interactives.push(knot, hit, wrapH, wrapV, stepPlaque);
    cords.push({ group: g, i, label: cordLabels[i] });
  }

  // Seal stamp (crafted visual on lid)
  const seal = new THREE.Group();
  seal.position.set(0, 0.62, -0.18);
  root.add(seal);
  seal.add(boxMesh(THREE, 0.14, 0.06, 0.14, brassB, 0, 0, 0));
  seal.add(boxMesh(THREE, 0.1, 0.03, 0.1, brass, 0, 0.04, 0));
  // Stamp handle
  const stampHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.06, 8), woodDark);
  stampHandle.position.set(0, 0.08, 0);
  seal.add(stampHandle);
  // Seal face disc
  const sealFace = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 12), mats.bangRed);
  sealFace.rotation.x = Math.PI / 2;
  sealFace.position.set(0, -0.02, 0.06);
  seal.add(sealFace);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), brass);
    riv.position.set(sx * 0.05, 0.02, sz * 0.05);
    seal.add(riv);
  });

  // ---- Crafted archive slip ----
  const slip = new THREE.Group();
  slip.position.set(0, 0.38, 0.35);
  slip.visible = false;
  root.add(slip);
  slip.add(boxMesh(THREE, 0.24, 0.01, 0.17, mats.paper, 0, 0, 0));
  // Folded edge
  slip.add(boxMesh(THREE, 0.06, 0.008, 0.05, mats.paper, 0.08, 0.008, 0.05));
  // Archive seal blot (red)
  slip.add(boxMesh(THREE, 0.045, 0.008, 0.04, mats.bangRed, -0.07, 0.01, -0.04));
  // Brass corner clip
  slip.add(boxMesh(THREE, 0.04, 0.01, 0.03, brassB, 0.09, 0.012, -0.06));
  // Tiny string binding
  slip.add(boxMesh(THREE, 0.015, 0.006, 0.12, mats.bangYellow, -0.1, 0.012, 0));
  const slipHit = invisibleHit(THREE, 0.28, 0.08, 0.22, { id: 'SLIP', kind: 'slip' });
  slip.add(slipHit);
  interactives.push(slipHit);

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

  function seedTeachingCord() {
    cordProgress = [TEACHING_CORD];
    cordDone = new Set([TEACHING_CORD]);
    cords.forEach((c) => {
      if (c.i === TEACHING_CORD) {
        c.group.scale.set(1, 0.15, 1);
        c.group.visible = false;
      } else {
        c.group.scale.set(1, 1, 1);
        c.group.visible = true;
      }
    });
  }

  function onTray() {
    // Minor: if a stale tray hit fires after slip, treat as slip click (no wrong toast)
    if (phase === 'slip') { onSlip(); return; }
    if (phase === 'finale') return;
    if (phase !== 'tray') {
      if (trayOpen && phase === 'cord') {
        api.toast('문서함은 이미 열려 있습니다. 봉인 매듭 패를 살피시오.');
      }
      return;
    }
    trayOpen = true;
    phase = 'cord';
    badClicks = 0;
    // Remove tray from interactives entirely (QA Critical/Minor)
    for (let i = interactives.length - 1; i >= 0; i--) {
      const m = interactives[i];
      if (m.userData && m.userData.kind === 'tray') {
        m.raycast = () => {};
        interactives.splice(i, 1);
      }
    }
    seedTeachingCord();
    animateVec3(tray.position, new THREE.Vector3(0, 0.32, 0.42), 380);
    api.setObjective('봉인 매듭 패를 따라 끈을 푸시오. 청은 이미 풀려 있소.');
    api.setSteps('B', ['A']);
    api.playThunk();
    api.playUnlock();
    api.vibrate(28);
    api.toast('문서 트레이가 밀려 나왔습니다. 봉인 매듭을 살피시오.', true);
  }

  function onCord(cid) {
    if (phase !== 'cord') {
      if (phase === 'tray') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('먼저 문서함 서랍을 미시오.');
      } else if (phase === 'slip') {
        api.toast('봉인은 이미 풀렸소. 기록 쪽지를 살피시오.');
      }
      return;
    }
    if (cordDone.has(cid)) {
      api.toast(cid === TEACHING_CORD
        ? '청 끈은 이미 풀려 있소. 매듭 패의 다음을…'
        : '이미 푼 매듭입니다.');
      return;
    }
    if (cid !== CORD_ORDER[cordProgress.length]) {
      api.playWrong();
      api.vibrate(22);
      badClicks += 1;
      seedTeachingCord();
      softFailShake();
      if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
      else api.toast('봉인 순서가 틀렸습니다. 매듭 패를 다시 살피시오.');
      return;
    }
    cordProgress.push(cid);
    cordDone.add(cid);
    badClicks = 0;
    const c = cords.find((x) => x.i === cid);
    animateTo(c.group.scale, 'y', 0.15, 220, () => { c.group.visible = false; });
    api.playClick();
    api.vibrate(20);
    if (cordProgress.length === CORD_ORDER.length) {
      phase = 'slip';
      badClicks = 0;
      slip.visible = true;
      for (let i = interactives.length - 1; i >= 0; i--) {
        const m = interactives[i];
        const k = m.userData && m.userData.kind;
        if (k === 'tray' || k === 'cord') {
          m.raycast = () => {};
          if (k === 'tray') interactives.splice(i, 1);
          else m.raycast = () => {};
        }
      }
      api.setObjective('기록 쪽지를 확인하시오.');
      api.setSteps('C', ['A', 'B']);
      api.playUnlock();
      api.toast('봉인이 매듭 순서대로 풀렸습니다.', true);
    } else {
      api.toast(`${c.label} 매듭 해제 (${cordProgress.length}/3) · 매듭 패를 따르시오`, true);
    }
  }

  function onSlip() {
    if (phase !== 'slip') {
      if (phase !== 'finale') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('먼저 서랍과 봉인을 푸시오.');
      }
      return;
    }
    phase = 'finale';
    api.setObjective('실측 기록을 읽으시오.');
    api.playUnlock();
    api.vibrate([50, 30, 90]);
    api.showFinale({
      title: '의궤함 · 기록 쪽지',
      body: '문서함과 봉인 끈이 풀리자 실측 기록이 나왔다. 「장인의 다섯 궤 — 뒤주·혼수함·문갑·이층농·의궤함 — 실측 서고의 문을 모두 열었다」.',
      footer: '— 장인의 실측 서고 · 의궤함',
      epilogue: '제15장 의궤함 — 해제 완료 · DLC 완주',
    });
    api.markCleared(id);
  }

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => {
      // QA Critical: huge trayHit must not steal slip clicks after tray opens
      if (phase === 'tray') return interactives.filter((m) => m.userData && m.userData.kind === 'tray');
      if (phase === 'cord') return interactives.filter((m) => m.userData && m.userData.kind === 'cord');
      if (phase === 'slip') return interactives.filter((m) => m.userData && m.userData.kind === 'slip');
      return [];
    },
    build(scene) { scene.add(root); },
    start() { this.reset(); },
    reset() {
      phase = 'tray';
      trayOpen = false;
      softFailCount = 0;
      badClicks = 0;
      hintLevel = 0;
      bodyGroup.position.x = 0;
      cordProgress = [];
      cordDone.clear();
      tray.position.set(0, 0.32, 0.15);
      cords.forEach((c) => {
        c.group.scale.set(1, 1, 1);
        c.group.visible = true;
      });
      slip.visible = false;
      interactives.forEach((m) => {
        if (m && m.isMesh) m.raycast = THREE.Mesh.prototype.raycast;
      });
      // Re-seat tray interactives spliced out after open (replay / 초기화)
      tray.traverse((o) => {
        if (o.userData && o.userData.kind === 'tray') {
          o.raycast = THREE.Mesh.prototype.raycast;
          if (!interactives.includes(o)) interactives.push(o);
        }
      });
      api.setObjective('의궤함 전면 문서 트레이를 앞으로 미시오. 그 뒤 봉인 매듭 패를…');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      api.toast('의궤함 — 문서함과 봉인 매듭을 살피시오.', true);
    },
    handleInteract(kind, iid) {
      if (phase === 'finale') return;
      if (kind === 'tray') onTray();
      else if (kind === 'cord') onCord(iid);
      else if (kind === 'slip') onSlip();
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
      trayOpen = true;
      tray.position.set(0, 0.32, 0.42);
      phase = 'cord';
      seedTeachingCord();
      CORD_ORDER.forEach((cid) => {
        if (!cordDone.has(cid) && phase === 'cord') onCord(cid);
      });
      if (phase === 'slip') onSlip();
    },
    dispose(scene) { scene.remove(root); interactives.length = 0; },
  };
}
