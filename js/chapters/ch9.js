/**
 * Chapter 9 — 규표 시계 궤
 *
 * Discoverable rule: 진주 beads follow the 규표 gnomon / hour-track 시각 순서
 * readable on the sundial face (중→좌→우 = BEAD_ORDER [1,0,2]) — not a HUD spoiler.
 * Center bead (중 / TEACHING_BEAD) starts unseated.
 * Pendulum angle sets the gnomon shadow length. The gear turns only while that
 * length is within SHADOW_TOL of the worn PEND_TARGET tick. Leaving the tick
 * stops the gear and hides the latch; beads stay. One latch confirm writes ch9-time.
 *
 * Soft-fail never advances hints. Hints: request-only observe → relate → FULL.
 * Phases: beads → pend → gear (alive, waiting) → finale.
 * Visual: Joseon sundial/clock chest (규표) — pedestal, gnomon, bead track, densified gears, 추.
 */
import { bevelBoxMesh as boxMesh, invisibleHit } from '../materials.js';
import { faceRing, insetFrame, screwHead, cloudRelief, disposeCraftRoot } from './craft-finish.js';
import { bumpHintLevel, requestHint, softFailNoHint } from '../hint-policy.js';

export const id = 9;
export const title = '규표 시계 궤';
export const blurb = '진주 낙하·톱니 복원·추 균형으로 규표 시계를 맞추시오.';
export const steps = [
  { id: 'A', label: '진주' },
  { id: 'B', label: '톱니' },
  { id: 'C', label: '추' },
];

/** Non-spoiler footer; FULL only via explicit revealHint ×3 */
export const hint = '시반에 끊긴 해의 궤적과 그림자가 닳게 한 자리를 살피시오.';
export const HINT_PARTIAL = '굵게 시작한 획과 가늘게 저무는 획 사이, 끊긴 높이가 같은 곳을 찾으시오.';
export const HINT_RELATION = '그림자가 눈금에 닿아도 함은 열리지 않습니다. 그 눈금에서만 톱니가 돌고, 벗어나면 톱니와 빗장만 멈춥니다. 진주는 그대로요.';
/** Spoiler: bead indices + shadow tick + latch */
export const HINT_FULL = '정답: 진주 [1, 0, 2] (중→좌→우) · 그림자 칸 2 · 맞닿은 뒤 빗장';
const HINT_PACK = { base: hint, partial: HINT_PARTIAL, relation: HINT_RELATION, full: HINT_FULL };

export const BEAD_ORDER = [1, 0, 2];
export const PEND_TARGET = 2; // 0–4
export const PEND_STEPS = 5;
export const GEAR_CLICKS = 1; // tooth restores once; do not raise this
/** Shadow length within this many world units of a tick counts as that step. */
export const SHADOW_TOL = 0.03;
/** World length from the gnomon base to tick n is n * SHADOW_STEP. */
export const SHADOW_STEP = 0.08;

/** Index of the center bead. It is first on the sundial and starts unseated. */
export const TEACHING_BEAD = 1;

/** Wrong bead clicks before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 3;

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch9_gyupyo';

  let phase = 'beads'; // beads | pend | gear | finale
  let beadProgress = [];
  let beadDone = new Set();
  let toothSeated = false;
  let gearAlive = false;
  let gearClicks = 0;
  let pendPos = 0; // continuous swing stops, no click cycling
  let latchTravel = 0;
  let softFailCount = 0;
  let badClicks = 0;
  let hintLevel = 0;
  const interactives = [];
  const slotMeshes = [];
  const beadVisuals = [];
  const sundialPlates = [];
  const tickMeshes = [];

  const woodMat = (mats.sliceWood || mats.woodRich || mats.wood).clone();
  woodMat.color.multiply(new THREE.Color(0xb8aaa0));
  const woodDark = mats.sliceWoodDark || mats.woodDark;
  const woodAcc = mats.sliceWood || mats.woodAccent || woodMat;
  const lacquer = mats.lacquer || woodDark;
  const brass = mats.sliceBrass || mats.brass;
  const brassB = mats.sliceBrassBright || mats.brassBright || brass;
  const iron = mats.iron;
  const nacre = mats.nacre;

  // ---- Clock pedestal / chest (규표 시계 궤) ----
  const BODY_W = 0.78;
  const BODY_H = 0.32;
  const BODY_D = 0.55;
  const bodyY0 = 0.1;
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Pedestal base carcass
  bodyGroup.add(boxMesh(THREE, BODY_W, BODY_H, BODY_D, woodDark, 0, bodyY0 + BODY_H / 2, 0));
  // Side panels
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.022, BODY_H - 0.04, BODY_D - 0.04, woodMat,
      sx * (BODY_W / 2 - 0.01), bodyY0 + BODY_H / 2, 0));
  });
  // Front apron
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.06, 0.04, 0.02, woodMat,
    0, bodyY0 + 0.04, BODY_D / 2 - 0.01));
  // Top platform
  const topY = bodyY0 + BODY_H + 0.025;
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.05, 0.05, BODY_D + 0.05, woodMat, 0, topY, 0));
  // Lacquer inset
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.1, 0.016, BODY_D - 0.1, lacquer, 0, topY + 0.028, 0));
  // Crown lip
  bodyGroup.add(boxMesh(THREE, BODY_W + 0.01, 0.014, BODY_D + 0.01, woodAcc, 0, topY + 0.038, 0.005));

  // Clock tower upright (back)
  const towerH = 0.52;
  const towerY = topY + towerH / 2 + 0.02;
  bodyGroup.add(boxMesh(THREE, 0.58, towerH, 0.18, woodDark, 0, towerY, -0.08));
  // Tower side posts
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.04, towerH + 0.04, 0.2, woodMat,
      sx * 0.28, towerY, -0.08));
  });
  // Tower crown
  bodyGroup.add(boxMesh(THREE, 0.64, 0.04, 0.24, woodMat, 0, topY + towerH + 0.04, -0.08));
  bodyGroup.add(boxMesh(THREE, 0.58, 0.016, 0.2, woodAcc, 0, topY + towerH + 0.06, -0.08));

  // Shaped feet + brass shoes
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(boxMesh(THREE, 0.07, 0.1, 0.06, woodDark,
      sx * (BODY_W / 2 - 0.1), 0.05, sz * (BODY_D / 2 - 0.08)));
    bodyGroup.add(boxMesh(THREE, 0.052, 0.014, 0.045, brass,
      sx * (BODY_W / 2 - 0.1), 0.01, sz * (BODY_D / 2 - 0.08)));
  });
  bodyGroup.add(boxMesh(THREE, 0.14, 0.045, 0.05, woodDark, 0, 0.03, BODY_D / 2 - 0.05));

  // Corner brackets with rivets
  function cornerBracket(x, y, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.add(boxMesh(THREE, 0.085, 0.014, 0.03, brassB, 0.038, 0, 0));
    g.add(boxMesh(THREE, 0.03, 0.014, 0.085, brassB, 0, 0, 0.038));
    for (let i = 0; i < 2; i++) {
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
      riv.position.set(0.018 + i * 0.028, 0.01, 0.01);
      g.add(riv);
    }
    bodyGroup.add(g);
  }
  const frontZ = BODY_D / 2 - 0.01;
  const rearZ = -BODY_D / 2 + 0.01;
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.05, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.05, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + 0.08, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + 0.08, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.05, rearZ, Math.PI / 2);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.05, rearZ, Math.PI);

  // Front latch plate
  bodyGroup.add(boxMesh(THREE, 0.085, 0.06, 0.014, brassB, 0, bodyY0 + BODY_H * 0.55, frontZ + 0.01));
  const latchKey = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 8), iron);
  latchKey.rotation.x = Math.PI / 2;
  latchKey.position.set(0, bodyY0 + BODY_H * 0.55 + 0.01, frontZ + 0.02);
  bodyGroup.add(latchKey);
  const latchRing = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.003, 6, 12), brass);
  latchRing.position.set(0, bodyY0 + BODY_H * 0.55 - 0.018, frontZ + 0.022);
  bodyGroup.add(latchRing);

  // Rivet strip
  for (let i = 0; i < 6; i++) {
    const rx = -0.3 + i * 0.12;
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
    riv.position.set(rx, topY + 0.01, frontZ + 0.02);
    bodyGroup.add(riv);
  }

  // Side ring pulls
  [-1, 1].forEach((sx) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 14), brass);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(sx * (BODY_W / 2 + 0.01), bodyY0 + BODY_H * 0.5, 0);
    bodyGroup.add(ring);
    bodyGroup.add(boxMesh(THREE, 0.01, 0.035, 0.03, brass,
      sx * (BODY_W / 2 + 0.005), bodyY0 + BODY_H * 0.5, 0));
  });

  // ---- Clock face (규표 dial) ----
  const faceY = topY + 0.32;
  const faceZ = 0.04;
  // Face disc
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.028, 64), brass);
  face.rotation.x = Math.PI / 2;
  face.position.set(0, faceY, faceZ);
  bodyGroup.add(face);
  // Face rim
  const faceRim = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.006, 10, 64), brassB);
  // Torus already lies in the dial XY plane; the cylinder is the rotated part.
  faceRim.rotation.x = 0;
  faceRim.position.set(0, faceY, faceZ + 0.016);
  bodyGroup.add(faceRim);
  // Hour marks (12 ticks)
  for (let t = 0; t < 12; t++) {
    const ang = (t / 12) * Math.PI * 2;
    const tick = boxMesh(THREE, 0.004, t % 3 === 0 ? 0.024 : 0.014, 0.003, brassB,
      Math.cos(ang) * 0.13, faceY, faceZ + 0.016 + Math.sin(ang) * 0.001);
    // Place ticks in face plane (approx on rim)
    tick.position.set(
      Math.cos(ang) * 0.13,
      faceY + Math.sin(ang) * 0.13,
      faceZ + 0.016,
    );
    tick.rotation.z = ang - Math.PI / 2;
    bodyGroup.add(tick);
  }
  faceRing(THREE, bodyGroup, 0.145, 0.0017, iron, 0, faceY, faceZ + 0.016);
  faceRing(THREE, bodyGroup, 0.107, 0.0014, brassB, 0, faceY, faceZ + 0.017);
  for (let t = 0; t < 60; t++) {
    if (t % 5 === 0) continue;
    const a = t / 60 * Math.PI * 2;
    const mark = boxMesh(THREE, 0.0017, 0.005, 0.002, iron, Math.cos(a) * 0.137, faceY + Math.sin(a) * 0.137, faceZ + 0.016);
    mark.rotation.z = a - Math.PI / 2;
    bodyGroup.add(mark);
  }
  // Center hub
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), brassB);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, faceY, faceZ + 0.018);
  bodyGroup.add(hub);
  // Gnomon / hand (삼각 규표 hint)
  const gnomon = new THREE.Group();
  gnomon.position.set(0, faceY, faceZ + 0.02);
  const gnomonBlade = boxMesh(THREE, 0.012, 0.1, 0.04, brassB, 0, 0.04, 0.01);
  gnomonBlade.rotation.x = -0.4;
  gnomon.add(gnomonBlade);
  bodyGroup.add(gnomon);


  // ---- 시각 순서 / hour-track rule plaque (readable world rule) ----
  function makeHourPlaque(label) {
    try {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 36;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(0, 0, 128, 36);
      ctx.strokeStyle = '#c9a84a';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 124, 32);
      ctx.fillStyle = '#e8d9b0';
      ctx.font = 'bold 13px serif';
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
  // Entry/exit heights form an ink chain. The faces contain no answer digits.
  function makeStepPlaque(step) {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#c8b694'; ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#604b32'; ctx.lineWidth = 2; ctx.strokeRect(5, 5, 118, 118);
      ctx.strokeStyle = '#352a20'; ctx.lineWidth = 5; ctx.beginPath();
      if (step === 0) { ctx.moveTo(25, 79); ctx.lineTo(52, 79); ctx.lineTo(81, 29); ctx.lineTo(117, 29); }
      else if (step === 1) { ctx.moveTo(11, 29); ctx.lineTo(47, 29); ctx.lineTo(82, 97); ctx.lineTo(117, 97); }
      else { ctx.moveTo(11, 97); ctx.lineTo(49, 97); ctx.lineTo(80, 62); ctx.lineTo(103, 62); }
      ctx.stroke();
      if (step === 0) { ctx.fillStyle = '#352a20'; ctx.beginPath(); ctx.arc(25, 79, 8, 0, Math.PI * 2); ctx.fill(); }
      if (step === 2) { ctx.strokeStyle = '#c8b694'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(94, 57); ctx.lineTo(110, 63); ctx.stroke(); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93, metalness: 0 });
      mat.userData.inkChain = { entry: step === 0 ? null : step === 1 ? 29 : 97, exit: step === 2 ? null : step === 0 ? 29 : 97 };
      return mat;
    } catch (_) { return brass; }
  }

  const hourPlaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.07),
    makeHourPlaque('규표 · 시각'),
  );
  hourPlaque.position.set(0, faceY - 0.18, faceZ + 0.04);
  bodyGroup.add(hourPlaque);
  // Gnomon points toward teaching (mid) slot as hour-track cue
  gnomon.rotation.z = 0; // upright; blade leans toward center track

  // ---- Bead track / slots (진주) ----
  const slotXs = [-0.18, 0, 0.18];
  const slotY = topY + 0.06;
  const slotZ = 0.22;
  // Track rail under slots
  bodyGroup.add(boxMesh(THREE, 0.55, 0.025, 0.1, woodDark, 0, slotY - 0.03, slotZ));
  bodyGroup.add(boxMesh(THREE, 0.52, 0.012, 0.08, brass, 0, slotY - 0.02, slotZ + 0.01));
  // Track end caps
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.03, 0.03, 0.1, brassB, sx * 0.28, slotY - 0.025, slotZ));
  });
  // Quiet track rivets
  for (let i = 0; i < 5; i++) {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), brass);
    riv.position.set(-0.2 + i * 0.1, slotY - 0.01, slotZ + 0.05);
    bodyGroup.add(riv);
  }

  for (let i = 0; i < 3; i++) {
    const slotGroup = new THREE.Group();
    slotGroup.position.set(slotXs[i], slotY, slotZ);
    // Cup / well
    const slot = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.055, 32), lacquer.clone());
    slot.userData = { id: `SLOT${i}`, kind: 'slot', index: i };
    slotGroup.add(slot);
    // Brass rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 8, 40), brassB);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.02;
    rim.userData = { id: `SLOT${i}`, kind: 'slot', index: i };
    slotGroup.add(rim);
    // Hour-track ink fragment — its entry/exit heights encode the physical flow
    const beadStep = BEAD_ORDER.indexOf(i);
    const stepGlyph = beadStep;
    const idxPlaque = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.008),
      makeStepPlaque(stepGlyph),
    );
    idxPlaque.position.set(0, 0.1, 0.05);
    idxPlaque.userData = { id: `CREST${beadStep}`, kind: 'sundial', index: i, panel: i, step: beadStep };
    slotGroup.add(idxPlaque);
    sundialPlates.push(idxPlaque);
    // Teaching glow ring on mid slot
    if (i === TEACHING_BEAD) {
      const teachRim = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.005, 6, 14), brassB.clone());
      teachRim.rotation.x = Math.PI / 2;
      teachRim.position.y = 0.025;
      if (teachRim.material.emissiveIntensity != null) {
        teachRim.material.emissive = new THREE.Color(0x403010);
        teachRim.material.emissiveIntensity = 0.07;
      }
      slotGroup.add(teachRim);
    }
    // A spring guide holds each pearl before it is pushed into the well.
    for (const side of [-1, 1]) {
      slotGroup.add(boxMesh(THREE, 0.008, 0.16, 0.012, brass, side * 0.043, 0.08, 0));
    }
    slotGroup.add(boxMesh(THREE, 0.014, 0.11, 0.012, woodDark, 0, 0.06, 0.047));
    root.add(slotGroup);
    const hit = invisibleHit(THREE, 0.12, 0.12, 0.12, { id: `SLOT${i}`, kind: 'slot', index: i }, slotXs[i], slotY, slotZ);
    root.add(hit);
    interactives.push(slot, rim, hit);
    slotMeshes.push(slot);

    // Pearl / 진주 bead
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.036, 32, 24), nacre.clone());
    bead.name = `ch9-pearl-${i}`;
    bead.position.set(slotXs[i], slotY + 0.14, slotZ);
    const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 12), brass);
    plunger.position.y = -0.087;
    bead.add(plunger);
    bead.visible = true;
    bead.userData = { id: `SLOT${i}`, kind: 'slot', index: i };
    interactives.push(bead);
    // Tiny iridescent highlight sphere
    const beadHighlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 8),
      mats.brassBright || brassB,
    );
    beadHighlight.scale.setScalar(0.22);
    beadHighlight.position.set(0.019, 0.021, 0.02);
    bead.add(beadHighlight);
    root.add(bead);
    beadVisuals.push(bead);
  }

  // ---- Missing gear tooth (appears after beads) ----
  const gearGroup = new THREE.Group();
  gearGroup.position.set(0.3, faceY - 0.05, 0.12);
  gearGroup.visible = false;
  root.add(gearGroup);
  // Gear mount plate
  gearGroup.add(boxMesh(THREE, 0.14, 0.02, 0.1, woodDark, 0, -0.04, 0));
  gearGroup.add(boxMesh(THREE, 0.12, 0.012, 0.08, brass, 0, -0.03, 0.01));
  const gearMat = brassBrightOr(brassB).clone();
  gearMat.emissive = new THREE.Color(0xc9a46a);
  gearMat.emissiveIntensity = 0.12;
  const gearBody = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.032, 48), gearMat);
  gearBody.rotation.x = Math.PI / 2;
  gearBody.userData = { id: 'GEAR', kind: 'gear', role: 'wheel' };
  gearGroup.add(gearBody);
  // Densified gear teeth (fixed ring of teeth; one missing until restore)
  const GEAR_TEETH = 10;
  const fixedTeeth = [];
  for (let t = 0; t < GEAR_TEETH; t++) {
    // Skip tooth at angle 0 — that's the missing one
    if (t === 0) continue;
    const ang = (t / GEAR_TEETH) * Math.PI * 2;
    const toothMesh = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.038, 0.022), brass);
    toothMesh.position.set(Math.cos(ang) * 0.095, Math.sin(ang) * 0.095, 0);
    toothMesh.rotation.z = ang;
    gearGroup.add(toothMesh);
    fixedTeeth.push(toothMesh);
  }
  // Hub
  const gearHub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.036, 12), brassB);
  gearHub.rotation.x = Math.PI / 2;
  gearHub.userData = { id: 'GEAR', kind: 'gear' };
  gearGroup.add(gearHub);
  // Missing tooth (restored on click)
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.04, 0.022), brassB);
  tooth.position.set(0.095, 0, 0);
  tooth.visible = false;
  tooth.userData = { id: 'GEAR', kind: 'gear' };
  gearGroup.add(tooth);
  // Empty slot indicator (quiet gap marker)
  const gapMark = boxMesh(THREE, 0.02, 0.02, 0.01, iron, 0.09, 0, 0.02);
  gearGroup.add(gapMark);
  const gearHit = invisibleHit(THREE, 0.24, 0.16, 0.14, { id: 'GEAR', kind: 'gear' });
  gearGroup.add(gearHit);
  interactives.push(gearBody, gearHub, tooth, gearHit);

  function brassBrightOr(fallback) {
    return mats.sliceBrassBright || mats.brassBright || fallback;
  }

  // ---- Pendulum (추) ----
  const pendPivot = new THREE.Group();
  pendPivot.name = 'ch9-pendulum-rotor';
  // The bob clears the dial, restored gear, and seated pearls throughout its arc.
  pendPivot.position.set(0, topY + towerH + 0.02, 0.33);
  pendPivot.visible = false;
  root.add(pendPivot);
  // Pivot bracket
  const pendMount = new THREE.Group();
  pendMount.name = 'ch9-pendulum-mount';
  pendMount.position.copy(pendPivot.position);
  root.add(pendMount);
  pendMount.add(boxMesh(THREE, 0.08, 0.03, 0.34, brassB, 0, 0.014, -0.155));
  const pivotAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 10), brass);
  pivotAxle.name = 'ch9-pendulum-axle';
  pivotAxle.rotation.x = Math.PI / 2;
  pivotAxle.userData = { id: 'PEND', kind: 'pend' };
  pendMount.add(pivotAxle);
  // Rod
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.38, 8), iron);
  rod.position.y = -0.2;
  rod.userData = { id: 'PEND', kind: 'pend' };
  pendPivot.add(rod);
  // Rod brass bands
  [-0.08, -0.2, -0.32].forEach((by) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 10), brass);
    band.rotation.x = Math.PI / 2;
    band.position.y = by;
    band.userData = { id: 'PEND', kind: 'pend' };
    pendPivot.add(band);
  });
  // Bob (추) — densified lenticular weight
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 32, 24), brassBrightOr(brassB).clone());
  bob.name = 'ch9-pendulum-bob';
  bob.position.y = -0.4;
  bob.userData = { id: 'PEND', kind: 'pend' };
  pendPivot.add(bob);
  // Bob equator ring
  const bobRing = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.006, 6, 16), brass);
  bobRing.position.y = -0.4;
  bobRing.userData = { id: 'PEND', kind: 'pend' };
  pendPivot.add(bobRing);
  // Bob tip finial
  const bobTip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 8), brassB);
  bobTip.position.y = -0.46;
  bobTip.rotation.z = Math.PI;
  bobTip.userData = { id: 'PEND', kind: 'pend' };
  pendPivot.add(bobTip);
  const pendHit = invisibleHit(THREE, 0.16, 0.55, 0.16, { id: 'PEND', kind: 'pend' }, 0, -0.22, 0);
  pendPivot.add(pendHit);
  interactives.push(bob, bobRing, bobTip, pendHit, rod, pivotAxle);

  // Scale marks on tower face — worn brighter tick at PEND_TARGET (readable 추 cue)
  for (let s = 0; s < PEND_STEPS; s++) {
    const isTarget = s === PEND_TARGET;
    const mark = boxMesh(THREE, isTarget ? 0.045 : 0.035, isTarget ? 0.008 : 0.005, 0.006,
      iron,
      -0.22, topY + 0.15 + s * 0.08, 0.02);
    bodyGroup.add(mark);
  }
  const pendLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, 0.032),
    makeHourPlaque('추 · 균형'),
  );
  pendLabel.position.set(-0.22, topY + 0.12 + PEND_TARGET * 0.08, 0.04);
  bodyGroup.add(pendLabel);

  // Gnomon shadow ruler. Tick n sits n * SHADOW_STEP from the base, and the
  // pendulum angle places the tip on that same line. Tick 2 is at world x = 0.
  const SWING = 0.35;
  const shadowRig = new THREE.Group();
  shadowRig.name = 'ch9-shadow';
  shadowRig.position.set(-PEND_TARGET * SHADOW_STEP, topY + 0.09, frontZ + 0.20);
  root.add(shadowRig);
  // Brass outriggers carry the scale ahead of the pendulum's swept volume.
  [-0.22, 0.22].forEach(x => {
    root.add(boxMesh(THREE, 0.025, 0.06, 0.23, brass, x, topY + 0.045, frontZ + 0.09));
  });
  const boardMat = (mats.paper || brass).clone();
  boardMat.color = new THREE.Color(0xe4d2b0);
  boardMat.emissive = new THREE.Color(0x3a2a18);
  boardMat.emissiveIntensity = 0.18;
  const shadowBoard = new THREE.Mesh(
    new THREE.BoxGeometry(PEND_STEPS * SHADOW_STEP + 0.1, 0.12, 0.012),
    boardMat,
  );
  shadowBoard.position.set(PEND_TARGET * SHADOW_STEP, 0, -0.012);
  shadowRig.add(shadowBoard);
  const originMat = iron.clone();
  originMat.color = new THREE.Color(0x1a120c);
  const shadowOrigin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), originMat);
  shadowOrigin.name = 'shadowOrigin';
  shadowOrigin.userData = { kind: 'shadowOrigin', role: 'origin', step: 0 };
  shadowRig.add(shadowOrigin);
  for (let s = 0; s < PEND_STEPS; s++) {
    const worn = s === PEND_TARGET;
    const tickMat = iron.clone();
    tickMat.emissive = new THREE.Color(0x000000);
    tickMat.emissiveIntensity = 0.04;
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(worn ? 0.024 : 0.016, 0.06, 0.014),
      tickMat,
    );
    mark.position.set(s * SHADOW_STEP, 0, 0);
    mark.userData = { kind: 'shadowTick', step: s, role: worn ? 'worn' : 'tick' };
    shadowRig.add(mark);
    tickMeshes.push(mark);
  }
  const shadowMat = iron.clone();
  shadowMat.color = new THREE.Color(0x140e0a);
  shadowMat.emissive = new THREE.Color(0x000000);
  const shadowBar = new THREE.Mesh(new THREE.BoxGeometry(SHADOW_STEP, 0.03, 0.012), shadowMat);
  shadowBar.name = 'ch9-shadow-bar';
  shadowBar.position.set(0, 0, 0.012);
  shadowRig.add(shadowBar);
  const tipMat = brassB.clone();
  tipMat.emissive = new THREE.Color(0xe8d9b0);
  tipMat.emissiveIntensity = 0.35;
  const shadowTip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), tipMat);
  shadowTip.name = 'shadowTip';
  shadowTip.userData = { kind: 'shadowTip', role: 'tip' };
  shadowRig.add(shadowTip);

  const confirmGroup = new THREE.Group();
  confirmGroup.name = 'ch9-time-latch';
  confirmGroup.position.set(0.3, topY + 0.09, frontZ + 0.22);
  confirmGroup.visible = false;
  root.add(confirmGroup);
  confirmGroup.add(boxMesh(THREE, 0.19, 0.055, 0.015, woodDark, 0.035, 0, -0.017));
  confirmGroup.add(boxMesh(THREE, 0.025, 0.06, 0.23, brass, 0, -0.045, -0.115));
  [-0.022, 0.09].forEach(x => confirmGroup.add(boxMesh(THREE, 0.01, 0.034, 0.023, brass, x, 0, 0)));
  const confirmMat = brassB.clone();
  confirmMat.emissive = new THREE.Color(0xc9a46a);
  confirmMat.emissiveIntensity = 0.45;
  const confirmBar = boxMesh(THREE, 0.07, 0.022, 0.018, confirmMat, 0, 0, 0);
  confirmBar.userData = { id: 'TIME_LATCH', kind: 'timeConfirm' };
  confirmGroup.add(confirmBar);
  const confirmHit = invisibleHit(THREE, 0.12, 0.08, 0.06, { id: 'TIME_LATCH', kind: 'timeConfirm' });
  confirmGroup.add(confirmHit);
  interactives.push(confirmBar, confirmHit);

  // Compartment
  const compartment = new THREE.Group();
  compartment.position.set(0, bodyY0 + BODY_H * 0.5, 0);
  compartment.visible = false;
  root.add(compartment);
  compartment.add(boxMesh(THREE, 0.32, 0.1, 0.24, woodAcc, 0, 0, 0));
  compartment.add(boxMesh(THREE, 0.06, 0.035, 0.01, brassB, 0, 0.02, 0.125));
  compartment.add(boxMesh(THREE, 0.22, 0.01, 0.16, mats.paper, 0, 0.06, 0));

  // Cabinet joinery and turned metal catch the room light without adding rule symbols.
  insetFrame(THREE, bodyGroup, 0.66, 0.19, woodAcc, 0, 0.25, frontZ + 0.006, 0.018);
  insetFrame(THREE, bodyGroup, 0.63, 0.16, brass, 0, 0.25, frontZ + 0.012, 0.003);
  for (const side of [-1, 1]) {
    cloudRelief(THREE, bodyGroup, brass, side * 0.17, 0.24, frontZ + 0.015, 0.62, side);
    screwHead(THREE, bodyGroup, brassB, iron, side * 0.235, topY + towerH + 0.02, 0.025);
  }
  faceRing(THREE, bodyGroup, 0.18, 0.002, brass, 0, faceY, faceZ - 0.003);
  insetFrame(THREE, shadowRig, PEND_STEPS * SHADOW_STEP + 0.105, 0.128, brass, PEND_TARGET * SHADOW_STEP, 0, -0.009, 0.007);
  const gearDetail = new THREE.Group();
  gearDetail.position.z = 0.018;
  gearGroup.add(gearDetail);
  faceRing(THREE, gearDetail, 0.076, 0.002, brassB, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const recess = new THREE.Mesh(new THREE.CircleGeometry(0.013, 20), iron);
    recess.position.set(Math.cos(a) * 0.052, Math.sin(a) * 0.052, 0.0005);
    gearDetail.add(recess);
    faceRing(THREE, gearDetail, 0.014, 0.0015, brassB, recess.position.x, recess.position.y, 0.001);
  }
  screwHead(THREE, gearDetail, brassB, iron, 0, 0, 0.006, 0.012);

  function clearBeads() {
    beadProgress = [];
    beadDone = new Set();
  }

  function applyBeads() {
    slotMeshes.forEach((s, i) => {
      const done = beadDone.has(i);
      s.material.emissiveIntensity = done ? 0.4 : 0.1;
      beadVisuals[i].visible = true;
      beadVisuals[i].position.y = slotY + (done ? 0.045 : 0.14);
    });
  }

  function shadowSpan() {
    const origin = new THREE.Vector3();
    const tip = new THREE.Vector3();
    shadowOrigin.getWorldPosition(origin);
    shadowTip.getWorldPosition(tip);
    return { origin, tip, len: origin.distanceTo(tip) };
  }

  function readShadowStep() {
    root.updateMatrixWorld(true);
    const span = shadowSpan();
    let step = -1;
    let best = Infinity;
    for (let s = 0; s < PEND_STEPS; s++) {
      const mark = new THREE.Vector3();
      tickMeshes[s].getWorldPosition(mark);
      const err = Math.abs(span.len - span.origin.distanceTo(mark));
      if (err <= SHADOW_TOL && err < best) {
        step = s;
        best = err;
      }
    }
    return { step, len: span.len };
  }

  function applyShadow() {
    const angle = (pendPos - PEND_TARGET) * SWING;
    pendPivot.rotation.z = angle;
    const along = PEND_TARGET + pendPivot.rotation.z / SWING;
    const length = along * SHADOW_STEP;
    shadowTip.position.set(length, 0, 0);
    shadowBar.scale.x = Math.max(length, 0.0001) / SHADOW_STEP;
    shadowBar.position.set(length / 2, 0, 0);
    const read = readShadowStep();
    const matched = read.step === PEND_TARGET;
    if (phase === 'pend' || phase === 'gear') phase = matched ? 'gear' : 'pend';
    const alive = phase === 'gear' && matched;
    gearAlive = alive;
    if (alive) toothSeated = true;
    gearMat.emissiveIntensity = alive ? 0.42 : 0.1;
    gearBody.rotation.z = alive ? 0.35 : 0;
    gearDetail.rotation.z = gearBody.rotation.z;
    tooth.visible = toothSeated;
    gapMark.visible = !toothSeated;
    confirmGroup.visible = alive;
    if (bob.material) bob.material.emissiveIntensity = alive ? 0.35 : 0.15;
    if (phase === 'pend' || phase === 'gear') {
      gearGroup.visible = true;
      pendPivot.visible = true;
    }
    return read;
  }

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

  function onSlot(index) {
    if (phase !== 'beads') {
      if (phase === 'gear') api.toast('진주는 이미 자리했소. 드러난 빗장으로 확정하시오.');
      else if (phase === 'pend') api.toast('진주는 이미 자리했소. 그림자 눈금을 살피시오.');
      else api.toast('진주는 이미 떨어졌습니다.');
      return;
    }
    if (beadDone.has(index)) {
      api.toast('이미 진주가 들어간 슬롯입니다.');
      return;
    }
    const expected = BEAD_ORDER[beadProgress.length];
    if (index !== expected) {
      api.playWrong();
      api.vibrate(20);
      badClicks += 1;
      clearBeads();
      applyBeads();
      softFailShake();
      if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
      else api.toast('진주 순서가 틀렸습니다. 규표 시반 시각 순서를 다시 살피시오.');
      return;
    }
    beadProgress.push(index);
    beadDone.add(index);
    badClicks = 0;
    beadVisuals[index].visible = true;
    animateVec3(beadVisuals[index].position, new THREE.Vector3(slotXs[index], slotY + 0.045, slotZ), 280);
    applyBeads();
    api.playThunk();
    api.vibrate(25);
    if (beadProgress.length === BEAD_ORDER.length) {
      phase = 'pend';
      badClicks = 0;
      gearGroup.visible = true;
      pendPivot.visible = true;
      applyShadow();
      api.setObjective('추를 돌려 규표 그림자를 닳은 눈금에 맞추시오. 맞으면 톱니가 살아납니다.');
      api.setSteps('B', ['A']);
      api.playUnlock();
      api.toast('진주가 시각 순서대로 안착했습니다. 추가 그림자를 움직입니다.', true);
    } else {
      api.toast(`진주 (${beadProgress.length}/3) · 시반 시각을 따르시오`, true);
    }
  }

  function onGear() {
    if (phase === 'beads') {
      api.playWrong();
      api.vibrate(18);
      softFailShake();
      api.toast('먼저 진주를 시반 시각 순서대로 떨어뜨리시오.');
      return;
    }
    if (phase === 'pend') {
      api.toast('톱니는 멈춰 있소. 그림자를 닳은 눈금에 맞추시오.');
      return;
    }
    if (phase === 'gear') api.toast('톱니는 이미 돌고 있소. 드러난 빗장으로 확정하시오.');
  }

  function onPend() {
    api.toast('추를 잡고 좌우 호를 그리며 움직여 그림자 길이를 맞추시오.');
  }

  function openCompartment() {
    compartment.visible = true;
    animateVec3(compartment.position, new THREE.Vector3(0, 0.35, 0.4), 650, () => {
      api.playUnlock();
      api.vibrate([50, 40, 80]);
      api.showFinale({
        title: '규표 · 시계의 심',
        body: '규표 시계가 정오를 알렸다. 함 안에서 「시각은 진실의 눈금」이라 적힌 쪽지와 함께, 태극 옥좌에 쓸 마지막 놋쇠 축이 나왔다.',
        footer: '— 규표 시계 기록',
        epilogue: '제9장 규표 시계 궤 — 해제 완료',
      });
      api.markCleared(id);
    });
  }

  function onConfirm() {
    if (phase !== 'gear') {
      api.playWrong();
      api.vibrate(18);
      api.toast('그림자가 눈금에서 벗어나 확정할 수 없습니다.');
      return;
    }
    const read = readShadowStep();
    if (read.step !== PEND_TARGET) {
      phase = 'pend';
      applyShadow();
      api.playWrong();
      api.vibrate(18);
      api.toast('그림자가 눈금에서 벗어나 확정할 수 없습니다.');
      return;
    }
    phase = 'finale';
    gearAlive = false;
    confirmGroup.visible = false;
    gearBody.rotation.z = 0;
    gearMat.emissiveIntensity = 0.12;
    if (api.recordEvidence) api.recordEvidence('ch9-time');
    openCompartment();
    api.toast('규표 그림자가 눈금에 맞았습니다.', true);
  }

  clearBeads();
  applyBeads();
  applyShadow();

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives,
    build(scene) { scene.add(root); },
    start() { this.reset(); },
    reset() {
      phase = 'beads';
      toothSeated = false;
      gearAlive = false;
      gearClicks = 0;
      pendPos = 0;
      latchTravel = 0; confirmBar.position.x = confirmHit.position.x = 0;
      softFailCount = 0;
      badClicks = 0;
      hintLevel = 0;
      clearBeads();
      applyBeads();
      beadVisuals.forEach((b, i) => {
        b.visible = true;
        b.position.set(slotXs[i], slotY + 0.14, slotZ);
      });
      gearGroup.visible = false;
      tooth.visible = false;
      gapMark.visible = true;
      gearBody.rotation.z = 0;
      gearMat.emissiveIntensity = 0.12;
      pendPivot.visible = false;
      confirmGroup.visible = false;
      applyShadow();
      compartment.visible = false;
      compartment.position.set(0, bodyY0 + BODY_H * 0.5, 0);
      bodyGroup.position.x = 0;
      api.setObjective('시반의 끊긴 궤적을 이은 뒤, 그 흐름대로 진주를 아래로 밀어 넣으시오.');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      api.toast('규표 시계 궤 — 시반과 그림자 눈금을 살피시오.', true);
    },
    getGestureFrame(kind, iid) {
      const index = Number(String(iid).replace(/\D/g, ''));
      const node = kind === 'pend' ? pendPivot : kind === 'timeConfirm' ? confirmGroup : kind === 'slot' ? beadVisuals[index] : null;
      if (!node) return null;
      root.updateMatrixWorld(true);
      const axis = new THREE.Vector3(...(kind === 'pend' ? [0, 0, 1] : kind === 'slot' ? [0, -1, 0] : [1, 0, 0]));
      axis.transformDirection(root.matrixWorld);
      return { type: kind === 'pend' ? 'rotate' : 'linear', origin: node.getWorldPosition(new THREE.Vector3()).toArray(), axis: axis.toArray() };
    },
    getDragInteraction(kind, iid) {
      if (kind === 'pend' && (phase === 'pend' || phase === 'gear')) {
        const start = pendPos; const startTooth = toothSeated;
        return {
          start() {},
          move(s) { if (Number.isFinite(s.turn)) { pendPos = Math.max(0, Math.min(PEND_STEPS - 1, start + s.turn / SWING)); applyShadow(); } },
          end() { const near = Math.round(pendPos); if (Math.abs(pendPos - near) < 0.12) pendPos = near; applyShadow(); api.playClick(); },
          cancel() { pendPos = start; toothSeated = startTooth; applyShadow(); },
        };
      }
      if (kind === 'slot' && phase === 'beads') {
        const index = Number(String(iid).replace(/\D/g, ''));
        const bead = beadVisuals[index]; if (!bead || beadDone.has(index)) return null;
        const y = bead.position.y; let travel = 0;
        return {
          start() {},
          move(s) { travel = Math.max(0, Math.min(0.095, Number(s.travel) || 0)); bead.position.y = y - travel; },
          end() { if (travel >= 0.075) onSlot(index); applyBeads(); },
          cancel() { bead.position.y = y; },
        };
      }
      if (kind === 'timeConfirm' && phase === 'gear' && readShadowStep().step === PEND_TARGET) {
        return {
          start() { latchTravel = 0; },
          move(s) { latchTravel = Math.max(0, Math.min(0.08, Number(s.travel) || 0)); confirmBar.position.x = confirmHit.position.x = latchTravel; },
          end() { if (latchTravel >= 0.055 && readShadowStep().step === PEND_TARGET) onConfirm(); else { latchTravel = 0; confirmBar.position.x = confirmHit.position.x = 0; } },
          cancel() { latchTravel = 0; confirmBar.position.x = confirmHit.position.x = 0; },
        };
      }
      return null;
    },
    handleInteract(kind, iid, userData) {
      if (phase === 'finale') return;
      if (kind === 'slot') api.toast('진주를 잡고 아래의 홈으로 밀어 넣으시오.');
      else if (kind === 'gear') onGear();
      else if (kind === 'pend') onPend();
      else if (kind === 'timeConfirm') api.toast('드러난 빗장을 오른쪽으로 당기시오.');
    },
    revealHint() {
      hintLevel = bumpHintLevel(hintLevel);
      requestHint(api, hintLevel, HINT_PACK);
    },
    get mistook() { return softFailCount > 0; },
    getMarkMeshes() {
      return sundialPlates.concat(tickMeshes, [shadowOrigin, shadowTip, gearBody]);
    },
    getState() {
      const read = readShadowStep();
      const alive = phase === 'gear' && read.step === PEND_TARGET;
      return {
        phase,
        hintLevel,
        pendPos,
        pendAngle: pendPivot.rotation.z,
        latchTravel,
        gearClicks,
        gearRestored: toothSeated,
        gearAlive: alive,
        beadCount: beadProgress.length,
        beads: beadProgress.slice(),
        teachingSeated: beadDone.has(TEACHING_BEAD),
        shadowLen: read.len,
        shadowStep: read.step,
        confirmVisible: confirmGroup.visible === true && alive,
        sundial: BEAD_ORDER.map((panel, step) => ({ step, panel })),
      };
    },
    solve() {
      phase = 'beads';
      clearBeads();
      applyBeads();
      BEAD_ORDER.forEach((i) => {
        if (phase === 'beads') onSlot(i);
      });
      pendPos = PEND_TARGET; applyShadow();
      if (phase === 'gear' && readShadowStep().step === PEND_TARGET) onConfirm();
    },
    dispose(scene) { scene.remove(root); disposeCraftRoot(root, mats); interactives.length = 0; },
  };
}
