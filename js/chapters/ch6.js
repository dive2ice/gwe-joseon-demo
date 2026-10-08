/**
 * Chapter 6 — 혼천의 궤 (별칭: 비천궤)
 *
 * Discoverable rule: armillary rings align so each pointer bead meets the
 * horizon / meridian tick marks and polar axis (지평·자오·북극축). Star markers
 * follow the constellation plaque grooves on the star plate — readable in-world,
 * not from a HUD spoiler array.
 * The separate base and constellation plaques pair motifs with each mechanism.
 * All local engravings have equal weight; neither part starts on its target.
 *
 * Ring ticks and star grooves are on screen together. Stars turn only while
 * every ring bead sits on its corresponding motif. Knocking a ring off blocks star
 * turns; restoring the rings does not open the letter. A front hasp confirms
 * after both marks are held. Soft-fail never advances hints.
 * Hints: request-only observe → relate → FULL.
 * Phases: rings → stars → finale letter.
 * Visual: Joseon celestial chest — armillary rings, horizon band, star plate, brass arcs.
 */
import { boxMesh, bevelBoxMesh, invisibleHit } from '../materials.js';
import { craftPalette, addRaisedPanel, disposeCraftRoot } from '../campaign-craft-art.js';
import { bumpHintLevel, requestHint, softFailNoHint } from '../hint-policy.js';
import { atStop, gestureFrame, rotaryDrag, pullDrag, MOTIFS, stopMotif, motifPlaque } from './tactile-rotary.js?v=ko-20261008';

export const id = 6;
export const title = '혼천의 궤';
export const blurb = '혼천의 고리와 별표를 성좌에 맞추시오. (별칭: 비천궤)';
export const steps = [
  { id: 'A', label: '고리' },
  { id: 'B', label: '별표' },
  { id: 'C', label: '종장' },
];

/** Non-spoiler footer; FULL only via explicit revealHint ×3 */
export const hint = '받침의 고리 문양과 성좌 패의 짝을, 구슬과 별의 새김에서 찾으시오.';
export const HINT_PARTIAL = '고리는 바깥·가운데·안쪽의 문양, 별은 패에 새긴 앞줄·뒷줄 문양을 따릅니다.';
export const HINT_RELATION = '세 고리의 문양이 맞는 동안만 별이 돕니다. 별 첨도 대응 문양으로 돌린 뒤 앞 빗장을 아래로 당기시오.';
/** Spoiler: ring + star quarter-turn indices */
export const HINT_FULL = '바깥 고리 달, 가운데 산, 안쪽 물. 앞줄 별은 달·산, 뒷줄은 물·구름에 첨을 두고 빗장을 아래로 당기시오.';
const HINT_PACK = { base: hint, partial: HINT_PARTIAL, relation: HINT_RELATION, full: HINT_FULL };

/** Armillary ring target indices (0–3 each) */
export const RING_TARGET = [1, 2, 0];
/** Star marker target indices (0–3 each) */
export const STAR_TARGET = [2, 0, 1, 3];

/** Outer ring whose long tick is the visible example. It does not start on that tick. */
export const TEACHING_RING = 0;
/** Star whose long groove is the visible example. It does not start on that groove. */
export const TEACHING_STAR = 1;
/** Start stops. Every index differs from the target. Ring 0 is not 1. Star 1 is not 0. */
export const RING_START = [0, 0, 2];
export const STAR_START = [3, 3, 2, 1];

/** Wrong ring/star clicks before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 6;

export function create(api) {
  const { THREE, mats, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch6_bicheon';

  let phase = 'rings'; // rings | stars | finale
  let ringPos = RING_START.slice();
  let starPos = STAR_START.slice();
  let softFailCount = 0;
  let badClicks = 0;
  let hintLevel = 0;
  const interactives = [];
  const ringMeshes = [];
  const ringBeads = [];
  const starMeshes = [];
  const ringTicks = [];
  const starGuideMarks = [];
  const starPointers = [];

  const art = craftPalette(THREE, mats, 6);
  const woodMat = art.wood;
  const woodDark = art.dark;
  const woodAcc = art.wood;
  const lacquer = art.lacquer;
  const brass = art.brass;
  const brassB = art.bright;
  const iron = mats.iron;

  // ---- Celestial chest body (혼천의 궤) — square pedestal, lid platform ----
  const BODY_W = 0.72;
  const BODY_H = 0.38;
  const BODY_D = 0.72;
  const bodyY0 = 0.1;
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Main carcass
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W, BODY_H, BODY_D, woodDark, 0, bodyY0 + BODY_H / 2, 0));
  // Side panel insets
  [-1, 1].forEach((sx) => {
    bodyGroup.add(bevelBoxMesh(THREE, 0.02, BODY_H - 0.04, BODY_D - 0.05, woodMat,
      sx * (BODY_W / 2 - 0.01), bodyY0 + BODY_H / 2, 0));
  });
  // Front / rear apron rails
  [1, -1].forEach((sz) => {
    bodyGroup.add(bevelBoxMesh(THREE, BODY_W - 0.06, 0.035, 0.02, woodMat,
      0, bodyY0 + 0.04, sz * (BODY_D / 2 - 0.01)));
  });
  // Top lid slab (overhang) — armillary sits on this
  const lidY = bodyY0 + BODY_H + 0.03;
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W + 0.06, 0.055, BODY_D + 0.06, woodMat, 0, lidY, 0));
  // Lacquer inset top plate
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W - 0.08, 0.02, BODY_D - 0.08, lacquer, 0, lidY + 0.03, 0));
  // Crown lip
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W + 0.02, 0.016, BODY_D + 0.02, woodAcc, 0, lidY + 0.04, 0.005));

  // Shaped feet + brass shoe tips
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(bevelBoxMesh(THREE, 0.075, 0.1, 0.07, woodDark,
      sx * (BODY_W / 2 - 0.1), 0.05, sz * (BODY_D / 2 - 0.1)));
    bodyGroup.add(boxMesh(THREE, 0.055, 0.014, 0.05, brass,
      sx * (BODY_W / 2 - 0.1), 0.01, sz * (BODY_D / 2 - 0.1)));
  });
  // Front center foot rail
  bodyGroup.add(bevelBoxMesh(THREE, 0.14, 0.045, 0.05, woodDark, 0, 0.03, BODY_D / 2 - 0.06));

  // Yellow-brass corner brackets with rivets
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
  const rearZ = -BODY_D / 2 + 0.01;
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.06, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.06, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + 0.08, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + 0.08, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.06, rearZ, Math.PI / 2);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.06, rearZ, Math.PI);

  // Recessed joinery and a narrow plinth catch the workshop's grazing light.
  addRaisedPanel(THREE, bodyGroup, woodMat, woodDark, BODY_W - 0.18, BODY_H - 0.13, frontZ + 0.015, bodyY0 + BODY_H / 2);
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W + 0.03, 0.027, BODY_D + 0.03, woodDark, 0, bodyY0 + 0.012, 0));

  // Front latch plate (decorative)
  bodyGroup.add(boxMesh(THREE, 0.09, 0.065, 0.014, brassB, 0, bodyY0 + BODY_H * 0.55, frontZ + 0.01));
  const latchKey = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.016, 8), iron);
  latchKey.rotation.x = Math.PI / 2;
  latchKey.position.set(0, bodyY0 + BODY_H * 0.55 + 0.01, frontZ + 0.02);
  bodyGroup.add(latchKey);
  const latchRing = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0035, 6, 12), brass);
  latchRing.position.set(0, bodyY0 + BODY_H * 0.55 - 0.02, frontZ + 0.022);
  bodyGroup.add(latchRing);

  // Rivet strip along top front edge
  for (let i = 0; i < 6; i++) {
    const rx = -0.28 + i * 0.112;
    if (Math.abs(rx) < 0.06) continue;
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
    riv.position.set(rx, lidY + 0.01, frontZ + 0.02);
    bodyGroup.add(riv);
  }

  // Side ring pulls (quiet)
  [-1, 1].forEach((sx) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 14), brass);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(sx * (BODY_W / 2 + 0.01), bodyY0 + BODY_H * 0.5, 0);
    bodyGroup.add(ring);
    bodyGroup.add(boxMesh(THREE, 0.01, 0.035, 0.03, brass,
      sx * (BODY_W / 2 + 0.005), bodyY0 + BODY_H * 0.5, 0));
  });

  // ---- Lid plaque: 지평·자오·북극 — in-world rule cue ----
  function makeRulePlaque(label) {
    try {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 32;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2a1e0e';
      ctx.fillRect(0, 0, 128, 32);
      ctx.strokeStyle = '#c9a84a';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 126, 30);
      ctx.fillStyle = '#f0e0b8';
      ctx.font = 'bold 13px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 64, 17);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.5, metalness: 0.25,
        emissive: 0x1a1008, emissiveIntensity: 0.15,
      });
    } catch (_) {
      return brass;
    }
  }
  const ruleY = lidY + 0.055;
  ['바깥 · 달', '가운데 · 산', '안쪽 · 물'].forEach((label, i) => {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.035), makeRulePlaque(label));
    pl.rotation.x = -Math.PI / 2;
    pl.position.set(-0.22 + i * 0.22, ruleY, -0.28);
    bodyGroup.add(pl);
  });
  bodyGroup.add(boxMesh(THREE, 0.62, 0.006, 0.045, brass, 0, ruleY - 0.004, -0.28));

  // ---- Armillary assembly on lid ----
  const ARM_Y = lidY + 0.42;
  const armGroup = new THREE.Group();
  armGroup.position.set(0, 0, 0);
  root.add(armGroup);

  // Pedestal column under rings
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.041, 0.12, 24), brass);
  stem.position.set(0, lidY + 0.1, 0); stem.castShadow = true; armGroup.add(stem);
  [-1, 1].forEach((sy) => {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.014, 28), brassB);
    collar.position.set(0, lidY + 0.1 + sy * 0.045, 0);
    armGroup.add(collar);
  });
  armGroup.add(boxMesh(THREE, 0.12, 0.025, 0.12, brass, 0, lidY + 0.05, 0));
  // Meridian cradle arcs (fixed decorative brass)
  for (let a = 0; a < 2; a++) {
    const cradle = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.01, 10, 64, Math.PI),
      brassB,
    );
    cradle.rotation.y = a * (Math.PI / 2);
    cradle.name = 'ch6_meridian_cradle_' + a;
    cradle.rotation.z = Math.PI;
    cradle.position.set(0, ARM_Y, 0);
    armGroup.add(cradle);
  }
  // Horizon band (fixed equatorial ring, non-interactive)
  const horizon = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.014, 12, 72),
    brass,
  );
  horizon.name = 'ch6_fixed_horizon';
  horizon.rotation.x = Math.PI / 2;
  horizon.position.set(0, ARM_Y - 0.02, 0);
  armGroup.add(horizon);
  // Horizon tick marks — cardinals brighter (align targets live on these)
  for (let t = 0; t < 8; t++) {
    const ang = (t / 8) * Math.PI * 2;
    const isCardinal = t % 2 === 0;
    const tick = boxMesh(THREE, isCardinal ? 0.014 : 0.01, isCardinal ? 0.014 : 0.01, isCardinal ? 0.04 : 0.03,
      isCardinal ? brassB : brass,
      Math.cos(ang) * 0.29, ARM_Y - 0.02, Math.sin(ang) * 0.29);
    if (isCardinal && tick.material && tick.material.emissiveIntensity != null) {
      tick.material = brassB.clone();
      tick.material.emissiveIntensity = 0.45;
      if (tick.material.emissive) tick.material.emissive.setHex(0x4a3820);
    }
    armGroup.add(tick);
  }

  // Interactive armillary rings (3) — denser tubes + pointer beads
  // Tick bars are placed later from this same bead, at rotation.z = stop * π/2.
  const ringRadii = [0.22, 0.16, 0.10]; // Space also for each fixed index carrier.
  const ringColors = [brassB, brass, iron];
  const ringTilt = [0.15, 0.45, 0.85];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    g.name = 'ch6_ring_' + i;
    g.position.set(0, ARM_Y, 0);
    g.rotation.x = Math.PI / 2 + ringTilt[i];
    const tor = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadii[i], 0.014, 12, 72),
      ringColors[i].clone(),
    );
    tor.castShadow = true;
    // Visual only — do not raycast (QA: outer R0 torus stole R1/R2 bead picks)
    tor.raycast = () => {};
    g.add(tor);
    // Rolled edges travel with the ring; no additional target-like ticks.
    [-1, 1].forEach((side) => {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(ringRadii[i], 0.0022, 6, 64), brassB);
      rim.position.z = side * 0.011; rim.raycast = () => {}; g.add(rim);
    });
    // Pointer bead on ring
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), brassB);
    bead.position.set(ringRadii[i], 0, 0);
    bead.userData = { id: `R${i}`, kind: 'ring', index: i };
    g.add(bead);
    ringBeads.push(bead);
    // Small notch opposite
    const notch = boxMesh(THREE, 0.02, 0.012, 0.012, brass, -ringRadii[i], 0, 0);
    notch.userData = { id: `R${i}`, kind: 'ring', index: i };
    g.add(notch);
    // Per-ring hit at bead (local space) — NOT shared center (QA Critical: stacked hits stole R1/R2)
    const hit = invisibleHit(THREE, 0.1, 0.1, 0.1, { id: `R${i}`, kind: 'ring', index: i }, ringRadii[i], 0, 0);
    g.add(hit);
    root.add(g);
    interactives.push(bead, notch, hit); // no torus — bead/notch/hit only
    ringMeshes.push(g);
  }

  // The fixed index carriers sit behind the rotating bands. Twin bridges join
  // their brackets to the horizon without crossing the central celestial globe.
  function fixedRod(name, a, b, radius = 0.003) {
    const vector = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, vector.length(), 10), brass);
    mesh.name = name;
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
    armGroup.add(mesh);
    return mesh;
  }
  for (const side of [-1, 1]) fixedRod('ch6_index_bridge_' + side,
    new THREE.Vector3(side * 0.124, ARM_Y - 0.032, 0),
    new THREE.Vector3(side * 0.29, ARM_Y - 0.032, 0));
  ringMeshes.forEach((ring, i) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + ringTilt[i], 0, 0));
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const center = new THREE.Vector3(0, ARM_Y, 0).addScaledVector(normal, 0.026);
    const carrier = new THREE.Mesh(new THREE.TorusGeometry(ringRadii[i] + 0.027, 0.003, 8, 64), brass);
    carrier.name = 'ch6_index_carrier_' + i;
    carrier.position.copy(center); carrier.quaternion.copy(q); armGroup.add(carrier);
    for (const side of [-1, 1]) {
      const a = center.clone().add(new THREE.Vector3(side * (ringRadii[i] + 0.027), 0, 0));
      fixedRod('ch6_index_bracket_' + i + '_' + side, a,
        new THREE.Vector3(a.x, ARM_Y - 0.032, 0));
    }
    for (let stop = 0; stop < 4; stop++) {
      const angle = stop * Math.PI / 2;
      const at = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0)
        .multiplyScalar(ringRadii[i] + 0.025).applyQuaternion(q).add(new THREE.Vector3(0, ARM_Y, 0));
      fixedRod('ch6_index_pin_' + i + '_' + stop, at, at.clone().addScaledVector(normal, 0.026), 0.0025);
    }
  });
  // Horizon screws reach the larger meridian cradle instead of crossing a moving band.
  for (let stop = 0; stop < 4; stop++) {
    const angle = stop * Math.PI / 2;
    const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const center = new THREE.Vector3(0, ARM_Y - 0.02, 0);
    fixedRod('ch6_horizon_mount_' + stop, center.clone().addScaledVector(outward, 0.282),
      center.clone().addScaledVector(outward, 0.322), 0.005);
  }

  // Central celestial sphere + polar axis
  const enamel = new THREE.MeshPhysicalMaterial({ color: 0x233e40, roughness: 0.3, metalness: 0.15, clearcoat: 0.65, clearcoatRoughness: 0.18 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.055, 28, 20), enamel);
  core.position.set(0, ARM_Y, 0);
  core.castShadow = true;
  root.add(core);
  const equator = new THREE.Mesh(new THREE.TorusGeometry(0.0555, 0.0016, 5, 48), brassB);
  equator.rotation.x = Math.PI / 2; equator.position.copy(core.position); root.add(equator);
  const polar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 8), brassB);
  polar.position.set(0, ARM_Y, 0);
  root.add(polar);
  // Polar caps
  [-1, 1].forEach((sy) => {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), brass);
    cap.position.set(0, ARM_Y + sy * 0.25, 0);
    root.add(cap);
  });

  // ---- Star plate (revealed after rings) ----
  const starPlate = new THREE.Group();
  starPlate.name = 'ch6_star_plate';
  starPlate.position.set(0, lidY + 0.06, BODY_D / 2 - 0.08);
  starPlate.visible = true;
  root.add(starPlate);
  // Lacquer plate body
  starPlate.add(bevelBoxMesh(THREE, 0.52, 0.03, 0.38, lacquer, 0, 0, 0));
  // Brass rim frame
  starPlate.add(bevelBoxMesh(THREE, 0.54, 0.012, 0.02, brassB, 0, 0.02, 0.19));
  starPlate.add(bevelBoxMesh(THREE, 0.54, 0.012, 0.02, brassB, 0, 0.02, -0.19));
  starPlate.add(bevelBoxMesh(THREE, 0.02, 0.012, 0.38, brassB, 0.26, 0.02, 0));
  starPlate.add(bevelBoxMesh(THREE, 0.02, 0.012, 0.38, brassB, -0.26, 0.02, 0));
  // Corner rivets on plate
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), brass);
    riv.position.set(sx * 0.24, 0.025, sz * 0.17);
    starPlate.add(riv);
  });
  // Constellation guide grooves (quiet decorative lines)
  for (let i = 0; i < 3; i++) {
    starPlate.add(bevelBoxMesh(THREE, 0.35 - i * 0.05, 0.004, 0.004, brass,
      0, 0.02, -0.08 + i * 0.08));
  }
  // Constellation plaque label
  try {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 36;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(0, 0, 160, 36);
    ctx.strokeStyle = '#c9a84a';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 158, 34);
    ctx.fillStyle = '#e8d9b0';
    ctx.font = 'bold 14px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('앞 달·산 / 뒤 물·구름', 80, 19, 150);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plMat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.5, metalness: 0.2,
      emissive: 0x1a1008, emissiveIntensity: 0.2,
    });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.06), plMat);
    pl.rotation.x = -Math.PI / 2;
    pl.position.set(0, 0.022, -0.15);
    starPlate.add(pl);
  } catch (_) { /* ignore */ }

  // The projecting plate is carried by two cantilever rails fixed into the lid.
  for (const side of [-1, 1]) {
    const rail = bevelBoxMesh(THREE, 0.035, 0.024, 0.23, brass, side * 0.21, lidY + 0.034, 0.365);
    rail.name = 'ch6_plate_support_' + side;
    root.add(rail);
  }

  // Star markers (4) — denser octahedron + pointer + brass collar
  const starSlots = [
    [-0.15, 0.1], [0.15, 0.1], [-0.15, -0.08], [0.15, -0.08],
  ];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    g.position.set(starSlots[i][0], lidY + 0.1, BODY_D / 2 - 0.08 + starSlots[i][1]);
    g.visible = true;
    // Brass collar base
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.03, 16), brass);
    collar.name = 'ch6_star_bearing_' + i;
    collar.position.y = -0.015;
    g.add(collar);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), mats.star.clone());
    star.userData = { id: `S${i}`, kind: 'star', index: i };
    star.castShadow = true;
    g.add(star);
    // Tiny pointer tip
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 5), brassB);
    tip.position.y = 0.05;
    tip.userData = { id: `S${i}`, kind: 'star', index: i };
    g.add(tip);
    // Index plaque notch
    const notch = boxMesh(THREE, 0.02, 0.008, 0.012, brassB, 0, 0.01, 0.04);
    notch.userData = { id: `S${i}`, kind: 'star', index: i, pointer: true };
    g.add(notch);
    starPointers.push(notch);
    const hit = invisibleHit(THREE, 0.12, 0.12, 0.12, { id: `S${i}`, kind: 'star', index: i });
    g.add(hit);
    root.add(g);
    interactives.push(star, tip, notch, hit);
    starMeshes.push({ group: g, star });

    // rotation.y = stop * π/2 sends the notch's local +Z to (sin θ, 0, cos θ).
    // Grooves use that same offset. A second angle formula would miss the tip.
    for (let t = 0; t < 4; t++) {
      const th = t * (Math.PI / 2);
      const target = t === STAR_TARGET[i];
      const teaching = i === TEACHING_STAR && target;
      const reach = 0.07;
      const gMat = brassB.clone();
      if (gMat.emissive) gMat.emissive.setHex(0x4a3820);
      if (gMat.emissiveIntensity != null) gMat.emissiveIntensity = 0.15;
      const guide = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.006, 0.012),
        gMat,
      );
      guide.position.set(
        starSlots[i][0] + Math.sin(th) * reach,
        0.022,
        starSlots[i][1] + Math.cos(th) * reach,
      );
      guide.rotation.y = th;
      guide.userData = { kind: 'starGroove', star: i, stop: t, target, motif: stopMotif(i, t, STAR_TARGET[i]) };
      const glyph = motifPlaque(THREE, guide.userData.motif, brass, 0.033, 0.028);
      glyph.rotation.x = -Math.PI / 2;
      glyph.position.copy(guide.position); glyph.position.y += 0.005; starPlate.add(glyph);
      starPlate.add(guide);
      starGuideMarks.push(guide);
    }
  }

  // Front hasp. In front of the star plate so a click does not turn a star.
  const haspY = lidY - 0.04;
  const haspZ = BODY_D / 2 + 0.16;
  // Front overhang carries the downward hasp in two fixed guides.
  for (const side of [-1, 1]) {
    const bracket = bevelBoxMesh(THREE, 0.024, 0.15, 0.024, brass, side * 0.065, lidY - 0.025, haspZ - 0.015);
    bracket.name = 'ch6_hasp_guide_' + side; root.add(bracket);
    root.add(bevelBoxMesh(THREE, 0.024, 0.02, 0.065, brass, side * 0.065, lidY + 0.04, haspZ - 0.035));
  }
  const haspBar = boxMesh(THREE, 0.16, 0.028, 0.02, brassB, 0, haspY, haspZ);
  haspBar.name = 'ch6_hasp_bar';
  haspBar.material = brassB.clone();
  if (haspBar.material.emissive) haspBar.material.emissive.setHex(0xf0d090);
  if (haspBar.material.emissiveIntensity != null) haspBar.material.emissiveIntensity = 0.7;
  haspBar.userData = { id: 'HASP', kind: 'confirm' };
  root.add(haspBar);
  const haspHit = invisibleHit(THREE, 0.2, 0.08, 0.06, { id: 'HASP', kind: 'confirm' }, 0, haspY, haspZ);
  root.add(haspHit);
  interactives.push(haspBar, haspHit);

  // Final letter compartment
  const letterBox = new THREE.Group();
  letterBox.position.set(0, bodyY0 + BODY_H * 0.55, 0);
  letterBox.visible = false;
  root.add(letterBox);
  letterBox.add(boxMesh(THREE, 0.38, 0.07, 0.28, woodAcc, 0, 0, 0));
  letterBox.add(boxMesh(THREE, 0.34, 0.012, 0.24, brass, 0, 0.04, 0));
  letterBox.add(boxMesh(THREE, 0.3, 0.01, 0.22, art.paper, 0, 0.055, 0));
  // Small lock hasp on letter box
  letterBox.add(boxMesh(THREE, 0.04, 0.03, 0.01, brassB, 0, 0.02, 0.145));

  function applyRings() {
    ringMeshes.forEach((r, i) => { r.rotation.z = ringPos[i] * (Math.PI / 2); });
  }
  function ringsHeld() {
    return ringMeshes.every((ring, i) => atStop(ring.rotation.z, RING_TARGET[i]));
  }
  function applyStars() {
    starMeshes.forEach((s, i) => {
      s.group.rotation.y = starPos[i] * (Math.PI / 2);
      s.star.material.emissiveIntensity = 0.15;
    });
    starGuideMarks.forEach(g => { g.material.emissiveIntensity = 0.15; });
  }

  function placeRingTicks() {
    const pivot = new THREE.Vector3(0, ARM_Y, 0);
    const xAxis = new THREE.Vector3(1, 0, 0);
    ringMeshes.forEach((group, i) => {
      const bead = group.children.find((c) => c.geometry && c.geometry.type === 'SphereGeometry');
      const saved = group.rotation.z;
      for (let t = 0; t < 4; t++) {
        group.rotation.z = t * (Math.PI / 2);
        group.updateWorldMatrix(true, true);
        const at = new THREE.Vector3();
        bead.getWorldPosition(at);
        const dir = at.clone().sub(pivot);
        if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
        else dir.normalize();
        const target = t === RING_TARGET[i];
        const teaching = i === TEACHING_RING && target;
        const barLen = 0.02;
        const mat = brassB.clone();
        if (mat.emissive) mat.emissive.setHex(0x4a3820);
        if (mat.emissiveIntensity != null) mat.emissiveIntensity = 0.15;
        const tick = new THREE.Mesh(new THREE.BoxGeometry(barLen, 0.01, 0.012), mat);
        tick.position.copy(at).addScaledVector(dir, 0.016 + barLen * 0.45);
        tick.quaternion.setFromUnitVectors(xAxis, dir);
        tick.userData = { kind: 'ringTick', ring: i, stop: t, target, motif: stopMotif(i, t, RING_TARGET[i]) };
        const glyph = motifPlaque(THREE, tick.userData.motif, brass, 0.034, 0.031);
        glyph.position.copy(tick.position);
        glyph.quaternion.copy(group.getWorldQuaternion(new THREE.Quaternion()));
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(glyph.quaternion);
        glyph.position.addScaledVector(normal, 0.009); armGroup.add(glyph);
        armGroup.add(tick);
        ringTicks.push(tick);
      }
      group.rotation.z = saved;
    });
  }

  function checkRings() {
    return ringsHeld();
  }

  function checkStars() {
    return starMeshes.every((star, i) => atStop(star.group.rotation.y, STAR_TARGET[i]));
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

  function commitRing(index, stop) {
    ringPos[index] = stop;
    api.playThunk();
    if (ringsHeld() && phase === 'rings') {
      phase = 'stars';
      api.setObjective('성좌 패의 짝을 찾아 별의 첨을 돌리시오.');
      api.setSteps('B', ['A']); api.playUnlock();
      api.toast('혼천의 축이 풀리며 성좌 판이 움직입니다.', true);
    }
  }
  function commitStar(index, stop) { starPos[index] = stop; api.playThunk(); }
  function setHaspPull(distance) { haspBar.position.y = haspY - distance; haspHit.position.y = haspY - distance; }
  const tactileClick = () => { api.playClick(); api.vibrate(9); };
  function interactionIndex(iid, hit) { return hit?.userData?.index ?? hit?.object?.userData?.index ?? Number(String(iid).slice(1)); }
  function getDragInteraction(kind, iid, hit) {
    if (phase === 'finale') return null;
    const index = interactionIndex(iid, hit);
    if (kind === 'ring' && ringMeshes[index]) return rotaryDrag({
      object: ringMeshes[index], axis: 'z', detent: tactileClick, commit: stop => commitRing(index, stop),
    });
    if (kind === 'star' && starMeshes[index]) return rotaryDrag({
      object: starMeshes[index].group, axis: 'y', allowed: () => phase === 'stars' && ringsHeld(),
      detent: tactileClick, commit: stop => commitStar(index, stop),
      blocked: () => { badClicks += 1; api.playWrong(); api.toast('고리가 어긋나 성좌 홈이 흐려졌소. 받침 문양을 다시 살피시오.'); if (badClicks >= SOFT_FAIL_AFTER) onSoftFail(); },
    });
    if (kind === 'confirm') return pullDrag({
      read: () => haspY - haspBar.position.y, write: setHaspPull,
      ready: () => ringsHeld() && checkStars(), confirm: onConfirm, blocked: onConfirm,
    });
    return null;
  }
  function getGestureFrame(kind, iid, hit) {
    const index = interactionIndex(iid, hit);
    if (kind === 'ring' && ringMeshes[index]) return gestureFrame(THREE, ringMeshes[index], [0, 0, 1]);
    if (kind === 'star' && starMeshes[index]) return gestureFrame(THREE, starMeshes[index].group, [0, 1, 0]);
    if (kind === 'confirm') return gestureFrame(THREE, haspBar, [0, -1, 0], 'linear');
    return null;
  }

  function openLetter() {
    phase = 'finale';
    api.setSteps('C', ['A', 'B']);
    api.setObjective('마지막 편지를 확인하시오.');
    letterBox.visible = true;
    setHaspPull(0.06);
    if (api.recordEvidence) api.recordEvidence('ch6-letter');
    animateVec3(letterBox.position, new THREE.Vector3(0, bodyY0 + BODY_H * 0.6, 0.5), 700, () => {
      api.playUnlock();
      api.vibrate([60, 40, 80, 40, 120]);
      api.showFinale({
        title: '종장 · 세자의 유언',
        body: '혼천의 궤(비천궤)에서 편지가 나왔다. 「사천장이어, 네 손이 열어 준 결구는 곧 진실의 열쇠다. 그러나 아직 남은 궤가 있으니 — 벽사·수문·규표·옥좌를 이으며 증거를 완성하라.」',
        footer: '— 세자 친필 · 궤 완결',
        epilogue: '제6장 혼천의 궤 — 해제 완료',
      });
      api.markCleared(id);
    });
    api.toast('성좌가 완성되었습니다.', true);
  }

  function onConfirm() {
    if (phase === 'finale') return;
    if (!ringsHeld() || !checkStars()) {
      badClicks += 1;
      api.playWrong();
      api.vibrate(18);
      softFailShake();
      api.toast(ringsHeld()
        ? '별 첨이 홈에 닿지 않아 빗장이 움직이지 않습니다.'
        : '고리가 눈금을 벗어나 빗장이 움직이지 않습니다.');
      if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
      return;
    }
    openLetter();
  }

  placeRingTicks();
  applyRings();
  applyStars();

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives,
    getDragInteraction, getGestureFrame,
    build(scene) { scene.add(root); },
    start() { this.reset(); },
    reset() {
      phase = 'rings';
      ringPos = RING_START.slice();
      starPos = STAR_START.slice();
      softFailCount = 0;
      badClicks = 0;
      hintLevel = 0;
      applyRings();
      applyStars();
      starPlate.visible = true;
      starMeshes.forEach((s) => { s.group.visible = true; });
      letterBox.visible = false;
      letterBox.position.set(0, bodyY0 + BODY_H * 0.55, 0);
      setHaspPull(0);
      bodyGroup.position.x = 0;
      api.setObjective('받침의 문양과 대조하여 고리 구슬을 돌리시오.');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      api.toast('혼천의 궤 — 받침과 성좌 패의 문양을 대조하시오.', true);
    },
    handleInteract(kind, iid, userData) {
      if (phase === 'finale') return;
      if (kind === 'ring') api.toast('고리의 구슬을 잡고 둥글게 돌리시오. 받침 문양과 대조할 수 있소.');
      else if (kind === 'star') api.toast('별의 첨을 잡아 성좌 패와 같은 문양으로 돌리시오.');
      else if (kind === 'confirm') api.toast('앞 빗장을 아래로 당겨 결구를 확인하시오.');
    },
    revealHint() {
      hintLevel = bumpHintLevel(hintLevel);
      requestHint(api, hintLevel, HINT_PACK);
    },
    get mistook() { return softFailCount > 0; },
    getMarkMeshes: () => ringTicks.concat(starGuideMarks),
    getState() {
      root.updateMatrixWorld(true);
      const at = (mesh) => {
        const p = new THREE.Vector3();
        mesh.getWorldPosition(p);
        return { x: p.x, y: p.y, z: p.z };
      };
      const ticks = ringTicks.map((t) => ({
        ...at(t), ring: t.userData.ring, stop: t.userData.stop, target: !!t.userData.target,
      }));
      const beads = ringBeads.map((bead, i) => ({ ...at(bead), ring: i }));
      const grooves = starGuideMarks.map((g) => ({
        ...at(g), star: g.userData.star, stop: g.userData.stop, target: !!g.userData.target,
      }));
      const tips = starPointers.map((n, i) => ({ ...at(n), star: i }));
      const ringMark = RING_TARGET.map((_, i) => ticks.find((t) => t.ring === i && t.target).stop);
      const starMark = STAR_TARGET.map((_, i) => grooves.find((g) => g.star === i && g.target).stop);
      return {
        phase,
        ringPos: ringPos.slice(),
        ringAngles: ringMeshes.map(ring => ring.rotation.z),
        starAngles: starMeshes.map(star => star.group.rotation.y),
        haspPull: haspY - haspBar.position.y,
        ringClueMotifs: RING_TARGET.map((_, i) => MOTIFS[i]),
        starClueMotifs: STAR_TARGET.map((_, i) => MOTIFS[i]),
        ringMotifs: RING_TARGET.map((target, i) => [0, 1, 2, 3].map(stop => stopMotif(i, stop, target))),
        starMotifs: STAR_TARGET.map((target, i) => [0, 1, 2, 3].map(stop => stopMotif(i, stop, target))),
        starPos: starPos.slice(),
        hintLevel,
        ringsHeld: ringsHeld(),
        starsSolved: checkStars(),
        ringMark,
        starMark,
        ticks,
        beads,
        grooves,
        tips,
        plateVisible: starPlate.visible,
        starsVisible: starMeshes.every((s) => s.group.visible),
      };
    },
    solve() {
      ringPos = RING_TARGET.slice();
      starPos = STAR_TARGET.slice();
      applyRings();
      applyStars();
      phase = 'stars';
      onConfirm();
    },
    dispose(scene) {
      scene.remove(root);
      disposeCraftRoot(root, mats, [lacquer]);
      interactives.length = 0;
    },
  };
}
