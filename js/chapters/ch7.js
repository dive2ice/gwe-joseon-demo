/**
 * Chapter 7 — 벽사도 함
 *
 * Two red seals carry one 벽사 pattern. The true seal's ink stops match the
 * chest engraving, and those stops are CHAR_TARGET. The false seal is the same
 * pattern turned one quarter. A false seat does not wake the woodblocks.
 * No block starts on its engraving stop. The sword, not the last block, opens.
 *
 * Soft-fail never advances hints. Hints: request-only observe → relate → FULL.
 * Phases: stamp → chars → sword (gated) → finale.
 * Visual: Joseon talisman chest — wooden case, crafted 부적/목판/검 빗장, brass fittings.
 */
import { boxMesh, bevelBoxMesh, invisibleHit } from '../materials.js';
import { craftPalette, addRaisedPanel, makeSealLacquer, disposeCraftRoot } from '../campaign-craft-art.js';
import { bumpHintLevel, requestHint, softFailNoHint } from '../hint-policy.js';

export const id = 7;
export const title = '벽사도 함';
export const blurb = '부적 찍기·목판 글자 회전·미니어처 검 빗장으로 함을 여시오.';
export const steps = [
  { id: 'A', label: 'A 부적' },
  { id: 'B', label: 'B 목판' },
  { id: 'C', label: 'C 검빗장' },
];

/** Non-spoiler footer; FULL only via explicit revealHint ×3 */
export const hint = '함의 새김과 두 인장의 먹 방향을 견주시오. 사는 긴 획이오.';
export const HINT_PARTIAL = '긴 획이 새김과 같은 인장을 앉히고, 목판의 놋쇠 끝을 그 획에 맞추시오.';
export const HINT_RELATION = '방향이 다른 인장은 목판을 깨우지 못하오. 참을 앉힌 뒤 세 끝을 맞추고 검을 당기시오.';
/** Spoiler: wood-block quarter-turns */
export const HINT_FULL = '정답: 목판 [2, 0, 3] (벽=2 · 사=0 · 도=3) — 새김과 같은 인장만 목판을 살린다';
const HINT_PACK = { base: hint, partial: HINT_PARTIAL, relation: HINT_RELATION, full: HINT_FULL };

/** Wood-block character quarter-turns (0–3) */
export const CHAR_TARGET = [2, 0, 3];

/** Index of the long engraving stroke (사). The block does not start on it. */
export const TEACHING_CHAR = 1;

/** Quarter-turns at reset. None equal CHAR_TARGET. 사 starts one turn off 0. */
export const CHAR_START = [3, 1, 0];

/** Wrong char clicks before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 5;

const CHAR_KO = ['벽', '사', '도'];

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch7_byeoksa';

  let phase = 'stamp'; // stamp | chars | sword | finale
  let seated = null; // null | 'false' | 'true'
  let charPos = CHAR_START.slice();
  let swordOpen = false;
  let softFailCount = 0;
  let badClicks = 0;
  let hintLevel = 0;
  const interactives = [];
  const charMeshes = [];
  const stampOrientMarks = [];

  const art = craftPalette(THREE, mats, 7);
  const woodMat = art.wood;
  const woodDark = art.dark;
  const woodAcc = art.wood;
  const lacquer = art.lacquer;
  const brass = art.brass;
  const brassB = art.bright;
  const iron = mats.iron;

  // ---- Talisman chest body (벽사도 함) — wider case, shallow lid ----
  const BODY_W = 0.92;
  const BODY_H = 0.42;
  const BODY_D = 0.55;
  const bodyY0 = 0.1;
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Main carcass
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W, BODY_H, BODY_D, woodDark, 0, bodyY0 + BODY_H / 2, 0));
  // Side panels
  [-1, 1].forEach((sx) => {
    bodyGroup.add(bevelBoxMesh(THREE, 0.022, BODY_H - 0.04, BODY_D - 0.04, woodMat,
      sx * (BODY_W / 2 - 0.01), bodyY0 + BODY_H / 2, 0));
  });
  // Front apron
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W - 0.06, 0.04, 0.022, woodMat,
    0, bodyY0 + 0.04, BODY_D / 2 - 0.01));
  // Top lid slab
  const lidY = bodyY0 + BODY_H + 0.025;
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W + 0.05, 0.05, BODY_D + 0.05, woodMat, 0, lidY, 0));
  // Lacquer lid inset
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W - 0.1, 0.018, BODY_D - 0.1, lacquer, 0, lidY + 0.028, 0));
  // Crown lip
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W + 0.01, 0.014, BODY_D + 0.01, woodAcc, 0, lidY + 0.038, 0.005));

  // Shaped feet + brass shoes
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(bevelBoxMesh(THREE, 0.08, 0.1, 0.07, woodDark,
      sx * (BODY_W / 2 - 0.1), 0.05, sz * (BODY_D / 2 - 0.06)));
    bodyGroup.add(boxMesh(THREE, 0.06, 0.014, 0.05, brass,
      sx * (BODY_W / 2 - 0.1), 0.01, sz * (BODY_D / 2 - 0.06)));
  });
  bodyGroup.add(bevelBoxMesh(THREE, 0.14, 0.045, 0.05, woodDark, 0, 0.03, BODY_D / 2 - 0.04));

  // Corner brackets with rivets
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

  addRaisedPanel(THREE, bodyGroup, woodMat, woodDark, BODY_W - 0.19, BODY_H - 0.13, frontZ + 0.014, bodyY0 + BODY_H / 2);
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W + 0.028, 0.026, BODY_D + 0.025, woodDark, 0, bodyY0 + 0.012, 0));

  // Front decorative lock plate (sword latch mounts near here later)
  bodyGroup.add(boxMesh(THREE, 0.1, 0.08, 0.014, brassB, 0.12, bodyY0 + BODY_H * 0.5, frontZ + 0.01));
  const frontKey = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.016, 8), iron);
  frontKey.rotation.x = Math.PI / 2;
  frontKey.position.set(0.12, bodyY0 + BODY_H * 0.5 + 0.012, frontZ + 0.02);
  bodyGroup.add(frontKey);

  // Rivet strip along lid front
  for (let i = 0; i < 7; i++) {
    const rx = -0.38 + i * 0.126;
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
    riv.position.set(rx, lidY + 0.01, frontZ + 0.025);
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

  // Front panel plaque frame (부적 area sits on lid)
  bodyGroup.add(boxMesh(THREE, 0.36, 0.012, 0.02, brass, -0.22, lidY + 0.04, 0.12));

  // Hanja plaque helper for wood-block characters
  function makeCharPlaque(text) {
    try {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#5a3a18';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(4, 4, 56, 56);
      ctx.strokeStyle = '#c9a84a';
      ctx.lineWidth = 3;
      ctx.strokeRect(6, 6, 52, 52);
      ctx.fillStyle = '#e8d9b0';
      ctx.font = 'bold 32px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 34);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.55, metalness: 0.12,
        emissive: 0x1a1008, emissiveIntensity: 0.15,
      });
    } catch (_) {
      return woodAcc;
    }
  }

  // ---- Talisman paper + stamp pad (부적) ----
  const paperGroup = new THREE.Group();
  paperGroup.position.set(-0.24, lidY + 0.05, -0.08);
  root.add(paperGroup);
  // Paper sheet with slight thickness
  const paper = boxMesh(THREE, 0.3, 0.008, 0.38, art.paper, 0, 0, 0);
  paper.name = 'ch7-stamp-paper';
  paperGroup.add(paper);
  // Paper corner weights (brass)
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    paperGroup.add(boxMesh(THREE, 0.03, 0.01, 0.03, brass, sx * 0.13, 0.008, sz * 0.16));
  });
  // Quiet ink-grid lines (decorative 부적 guide)
  for (let i = 0; i < 4; i++) {
    paperGroup.add(boxMesh(THREE, 0.22, 0.002, 0.003, mats.bangRed || iron,
      0, 0.006, -0.12 + i * 0.08));
  }

  // 벽사 문양 order plaque on paper edge — readable world rule (before stamp)
  function makeByeoksaPlaque(label) {
    try {
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 28;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3a1a10';
      ctx.fillRect(0, 0, 96, 28);
      ctx.strokeStyle = '#c9a84a';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 94, 26);
      ctx.fillStyle = '#f0d0a0';
      ctx.font = 'bold 12px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 48, 15);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.55, metalness: 0.15,
        emissive: 0x1a0808, emissiveIntensity: 0.18,
      });
    } catch (_) {
      return brass;
    }
  }
  const orderPl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.055), makeByeoksaPlaque('벽사 문양'));
  orderPl.rotation.x = -Math.PI / 2;
  orderPl.position.set(0, 0.01, -0.16);
  paperGroup.add(orderPl);

  // Lid yaw. rotation.y = stop * π/2 sends local +Z to (sin θ, 0, cos θ):
  // stop 0 → +Z, 1 → +X, 2 → −Z, 3 → −X. The wood-block notch uses this same yaw.
  function stopDir(stop) {
    const th = stop * (Math.PI / 2);
    return { x: Math.sin(th), z: Math.cos(th), rotY: th };
  }
  const sealInk = new THREE.MeshStandardMaterial({
    color: 0xf2e2b0, roughness: 0.35, metalness: 0.12,
    emissive: 0x302010, emissiveIntensity: 0.08,
  });
  const sealTeach = sealInk.clone();
  sealTeach.emissiveIntensity = 0.08;

  function addPattern(parent, stops, spec) {
    stops.forEach((stop, i) => {
      const teaching = i === TEACHING_CHAR;
      const len = teaching ? spec.long : spec.short;
      const dir = stopDir(stop);
      const stroke = new THREE.Mesh(
        new THREE.BoxGeometry(spec.wide, spec.thick, len),
        teaching ? spec.teachMat : spec.mat,
      );
      stroke.position.set(dir.x * spec.reach, spec.y, dir.z * spec.reach);
      stroke.rotation.y = dir.rotY;
      stroke.userData = {
        kind: spec.kind,
        seal: spec.seal,
        index: i,
        stop,
        teaching,
        target: stop === CHAR_TARGET[i],
      };
      parent.add(stroke);
      if (spec.kind === 'engrave' || spec.kind === 'sealInk') stampOrientMarks.push(stroke);
    });
  }

  // Chest engraving — the mark. Always visible. Stops are CHAR_TARGET.
  const engrave = new THREE.Group();
  engrave.position.set(-0.23, lidY + 0.06, 0.24);
  root.add(engrave);
  engrave.add(boxMesh(THREE, 0.24, 0.012, 0.22, woodDark, 0, 0, 0));
  engrave.add(boxMesh(THREE, 0.22, 0.006, 0.2, lacquer, 0, 0.008, 0));
  addPattern(engrave, CHAR_TARGET, {
    kind: 'engrave', reach: 0.04, y: 0.018,
    long: 0.09, short: 0.042, wide: 0.016, thick: 0.012,
    mat: sealInk, teachMat: sealTeach,
  });

  // Two seals, one red, one pattern. False is the true pattern plus one quarter.
  const sealSurface = makeSealLacquer(THREE);
  const sealY = lidY + 0.13;
  const sealZ = -0.08;
  const sealHome = { true: -0.34, false: -0.12 };
  const seals = {};
  function makeSeal(seal) {
    const id = seal === 'true' ? 'STAMP_TRUE' : 'STAMP_FALSE';
    const g = new THREE.Group();
    g.position.set(sealHome[seal], sealY, sealZ);
    root.add(g);
    const bodyMat = sealSurface.clone();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.06, 36), bodyMat);
    body.castShadow = true;
    body.userData = { id, kind: 'stamp', seal };
    g.add(body);
    // The die reaches the paper after the existing 0.04 press stroke.
    const die = bevelBoxMesh(THREE, 0.086, 0.012, 0.086, brass, 0, -0.03, 0, 0.002);
    die.name = `ch7-seal-die-${seal}`;
    g.add(die);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.005, 6, 16), brassB);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.004;
    band.userData = { id, kind: 'stamp', seal };
    g.add(band);
    const lowerBand = new THREE.Mesh(new THREE.TorusGeometry(0.059, 0.0025, 6, 36), brass);
    lowerBand.rotation.x = Math.PI / 2; lowerBand.position.y = -0.023; g.add(lowerBand);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.028, 10), woodAcc);
    knob.position.y = 0.042;
    knob.userData = { id, kind: 'stamp', seal };
    g.add(knob);
    const stops = CHAR_TARGET.map((s) => (s + (seal === 'true' ? 0 : 1)) % 4);
    // Strokes sit outside the grip so the long arm is the readable ink direction.
    addPattern(g, stops, {
      kind: 'sealInk', seal, reach: 0.046, y: 0.036,
      long: 0.07, short: 0.04, wide: 0.012, thick: 0.01,
      mat: sealInk, teachMat: sealTeach,
    });
    const hit = invisibleHit(THREE, 0.13, 0.12, 0.13, { id, kind: 'stamp', seal });
    g.add(hit);
    interactives.push(body, band, knob, hit);
    seals[seal] = { group: g, bodyMat };
  }
  makeSeal('true');
  makeSeal('false');

  // Ink blot (appears under the seated seal; color does not say which is true)
  const blot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), mats.bangRed.clone());
  blot.rotation.x = -Math.PI / 2;
  blot.position.set(sealHome.false, lidY + 0.058, sealZ);
  blot.visible = false;
  root.add(blot);

  // ---- Wood-block characters (목판) — denser blocks with Hanja plaques ----
  const labels = ['벽', '사', '도'];
  const charXs = [0.05, 0.24, 0.43];
  // Rail under characters
  const charRail = boxMesh(THREE, 0.55, 0.025, 0.16, woodDark, 0.24, lidY + 0.04, 0.05);
  charRail.visible = false;
  root.add(charRail);
  // Brass rail ends
  const railL = boxMesh(THREE, 0.02, 0.03, 0.14, brassB, -0.02, lidY + 0.045, 0.05);
  const railR = boxMesh(THREE, 0.02, 0.03, 0.14, brassB, 0.5, lidY + 0.045, 0.05);
  railL.visible = false;
  railR.visible = false;
  root.add(railL, railR);

  labels.forEach((label, i) => {
    const g = new THREE.Group();
    g.position.set(charXs[i], lidY + 0.08, 0.05);
    g.visible = false;
    // Thick wood block
    const block = bevelBoxMesh(THREE, 0.14, 0.05, 0.14, woodAcc.clone(), 0, 0, 0, 0.004, i * 0.27);
    block.castShadow = true;
    block.userData = { id: `C${i}`, kind: 'char', index: i };
    g.add(block);
    // Brass rim edge
    g.add(boxMesh(THREE, 0.145, 0.01, 0.145, brass, 0, -0.02, 0));
    // Hanja face plaque
    const plaqueMat = makeCharPlaque(label);
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.01, 0.1), plaqueMat);
    plaque.position.y = 0.03;
    plaque.userData = { id: `C${i}`, kind: 'char', index: i };
    g.add(plaque);
    // Orientation notch (brass pointer) — match to stamp/부적 direction
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.018, 0.04), brassB);
    notch.position.set(0, 0.035, 0.055);
    notch.userData = { id: `C${i}`, kind: 'char', index: i };
    g.add(notch);
    // Side rivets
    [-1, 1].forEach((sx) => {
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), brass);
      riv.position.set(sx * 0.06, 0.01, 0.07);
      g.add(riv);
    });
    const hit = invisibleHit(THREE, 0.16, 0.12, 0.16, { id: `C${i}`, kind: 'char', index: i });
    g.add(hit);
    root.add(g);
    interactives.push(block, plaque, notch, hit);
    charMeshes.push({ group: g, block, label, notch });
  });

  // ---- Miniature sword latch (검 빗장) — denser blade/hilt/scabbard mount ----
  const swordPivot = new THREE.Group();
  // In front of the lid lip so the high lid camera can still press it.
  swordPivot.position.set(0, lidY + 0.02, 0.4);
  swordPivot.visible = false;
  root.add(swordPivot);
  const swordSlide = new THREE.Group();
  swordPivot.add(swordSlide);
  // Scabbard mount plate (fixed relative to pivot start)
  // A hollow channel shares the blade's X slide axis. The old solid sheath
  // was below and behind the blade, leaving it to slide through open air.
  const scabbard = new THREE.Group();
  scabbard.name = 'ch7-scabbard';
  [-1, 1].forEach(side => {
    scabbard.add(bevelBoxMesh(THREE, 0.28, 0.01, 0.068, lacquer, 0.10, 0.01 + side * 0.025, 0.01, 0.002));
    scabbard.add(bevelBoxMesh(THREE, 0.28, 0.04, 0.008, lacquer, 0.10, 0.01, 0.01 + side * 0.030, 0.002));
  });
  [-0.022, 0.218].forEach(x => {
    scabbard.add(bevelBoxMesh(THREE, 0.015, 0.011, 0.072, brass, x, 0.036, 0.01, 0.0015));
    scabbard.add(bevelBoxMesh(THREE, 0.015, 0.011, 0.072, brass, x, -0.016, 0.01, 0.0015));
    // Brackets reach the chest front (world z = 0.275), carrying the sheath.
    swordPivot.add(bevelBoxMesh(THREE, 0.026, 0.038, 0.11, brass, x, -0.035, -0.075, 0.002));
  });
  scabbard.userData = { id: 'SWORD', kind: 'sword' };
  swordPivot.add(scabbard);
  // Blade
  const steel = iron.clone(); steel.color.setHex(0x9ba4a2); steel.roughness = 0.24; steel.metalness = 0.94;
  const blade = bevelBoxMesh(THREE, 0.24, 0.022, 0.035, steel, 0, 0, 0, 0.002);
  blade.name = 'ch7-sword-blade';
  swordSlide.name = 'ch7-sword-slide';
  blade.position.set(0.06, 0.01, 0.01);
  blade.castShadow = true;
  blade.userData = { id: 'SWORD', kind: 'sword' };
  swordSlide.add(blade);
  // Blade tip taper hint
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 4), steel);
  tip.rotation.z = -Math.PI / 2;
  tip.position.set(0.2, 0.01, 0.01);
  tip.userData = { id: 'SWORD', kind: 'sword' };
  swordSlide.add(tip);
  // Hilt / guard
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.055, 0.06), brassB);
  guard.position.set(-0.06, 0.01, 0.01);
  guard.userData = { id: 'SWORD', kind: 'sword' };
  swordSlide.add(guard);
  const hilt = bevelBoxMesh(THREE, 0.07, 0.035, 0.04, woodDark, 0, 0, 0, 0.003);
  hilt.position.set(-0.11, 0.01, 0.01);
  hilt.userData = { id: 'SWORD', kind: 'sword' };
  swordSlide.add(hilt);
  for (let wrap = 0; wrap < 5; wrap++) {
    const binding = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0015, 5, 12), brass);
    binding.rotation.y = Math.PI / 2; binding.scale.y = 0.82;
    binding.position.set(-0.137 + wrap * 0.013, 0.01, 0.01); swordSlide.add(binding);
  }
  // Pommel
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), brass);
  pommel.position.set(-0.155, 0.01, 0.01);
  pommel.userData = { id: 'SWORD', kind: 'sword' };
  swordSlide.add(pommel);
  // Hinge pin visual
  const hingePin = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.06, 8), brassB);
  hingePin.rotation.x = Math.PI / 2;
  hingePin.position.set(-0.02, 0, 0);
  swordPivot.add(hingePin);
  const swordHit = invisibleHit(THREE, 0.35, 0.12, 0.12, { id: 'SWORD', kind: 'sword' });
  swordSlide.add(swordHit);
  interactives.push(blade, tip, guard, hilt, pommel, scabbard, swordHit);

  // Secret compartment
  const secret = new THREE.Group();
  secret.position.set(0, bodyY0 + BODY_H * 0.45, 0);
  secret.visible = false;
  root.add(secret);
  secret.add(boxMesh(THREE, 0.32, 0.09, 0.24, woodAcc, 0, 0, 0));
  secret.add(boxMesh(THREE, 0.28, 0.012, 0.2, brass, 0, 0.05, 0));
  secret.add(boxMesh(THREE, 0.24, 0.01, 0.18, art.paper, 0, 0.065, 0));
  // Tiny 부적 strip in secret
  secret.add(boxMesh(THREE, 0.08, 0.008, 0.12, mats.bangRed || iron, -0.06, 0.07, 0));

  function applyChars() {
    charMeshes.forEach((c, i) => {
      c.group.rotation.y = charPos[i] * (Math.PI / 2);
      // The engraved stroke, rather than a correct-answer glow, explains the stop.
      c.block.material.emissiveIntensity = 0.10;
    });
  }

  function checkChars() {
    return charPos.every((v, i) => v === CHAR_TARGET[i]);
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

  function seatSeal(seal) {
    const home = new THREE.Vector3(sealHome[seal], sealY, sealZ);
    const g = seals[seal].group;
    animateVec3(g.position, new THREE.Vector3(home.x, sealY - 0.04, home.z), 160, () => {
      animateVec3(g.position, home, 220);
    });
    blot.visible = true;
    blot.position.set(home.x, lidY + 0.058, home.z);
  }

  function reviveBlocks() {
    charMeshes.forEach((c) => { c.group.visible = true; });
    charRail.visible = true;
    railL.visible = true;
    railR.visible = true;
    applyChars();
  }

  function onStamp(seal) {
    if (phase !== 'stamp') {
      if (phase === 'chars') api.toast('목판이 살아 있소. 놋쇠 끝을 새김에 맞추시오.');
      else if (phase === 'sword') api.toast('목판은 이미 맞았소. 검 빗장을 여시오.');
      return;
    }
    if (seal !== 'true' && seal !== 'false') {
      api.playWrong();
      api.vibrate(18);
      softFailShake();
      api.toast('함의 새김과 먹 방향이 같은 인장을 앉히시오.');
      return;
    }
    seated = seal;
    seatSeal(seal);
    api.playThunk();
    api.vibrate(30);
    if (seal !== 'true') {
      badClicks += 1;
      api.playWrong();
      softFailShake();
      api.toast('먹 방향이 함의 새김과 다르오. 목판은 잠잠하오.');
      if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
      return;
    }
    badClicks = 0;
    phase = 'chars';
    reviveBlocks();
    api.setObjective('목판의 놋쇠 끝을 새김의 획에 맞추시오.');
    api.setSteps('B', ['A']);
    api.playUnlock();
    api.toast('참 인장이 새김과 같소. 목판이 살아났소.', true);
  }

  function onChar(index, next = (charPos[index] + 1) % 4) {
    if (phase !== 'chars') {
      if (phase === 'stamp') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('함의 새김과 먹 방향이 같은 인장을 먼저 앉히시오.');
      } else if (phase === 'sword') {
        api.toast('목판은 이미 맞았소. 검 빗장을 여시오.');
      }
      return;
    }

    charPos[index] = next;
    applyChars();api.playClick();api.vibrate(18);
    // A single correctly oriented block does not announce the answer.
    if(!checkChars()){badClicks+=1;if(badClicks>=SOFT_FAIL_AFTER)onSoftFail();}

    if (checkChars()) {
      phase = 'sword';
      badClicks = 0;
      swordPivot.visible = true;
      api.setObjective('검 손잡이를 잡고 칼집에서 왼쪽으로 당기시오.');
      api.setSteps('C', ['A', 'B']);
      api.playUnlock();
      api.toast('목판 문양이 맞았습니다. 검 빗장이 드러납니다.', true);
    }
  }

  function onSword() {
    if (phase !== 'sword') {
      if (phase === 'stamp' || phase === 'chars') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('아직 검 빗장을 열 수 없습니다. 먼저 부적과 목판을 맞추시오.');
      }
      return;
    }
    if (swordOpen) return;
    swordOpen = true;
    animateTo(swordSlide.position, 'x', -0.18, 160, () => {
      phase = 'finale';
      secret.visible = true;
      animateVec3(secret.position, new THREE.Vector3(0, bodyY0 + BODY_H * 0.55, 0.42), 600, () => {
        api.playUnlock();
        api.vibrate([50, 30, 70]);
        if (api.recordEvidence) api.recordEvidence('ch7-stamp');
        api.showFinale({
          title: '벽사도 · 부적함',
          body: '함 안에서 낡은 벽사도가 나왔다. 「악귀는 글자로, 칼은 결구로 막는다.」 사천장의 부적과 함께 다음 궤의 열쇠가 될 놋쇠 조각이 숨겨져 있었다.',
          footer: '— 벽사도 함 기록',
          epilogue: '제7장 벽사도 함 — 해제 완료',
        });
        api.markCleared(id);
      });
    });
    api.playClick();
    api.vibrate(35);
    api.toast('검 빗장이 열렸습니다.', true);
  }

  function readStop(mesh) {
    const origin = new THREE.Vector3();
    const p = new THREE.Vector3();
    mesh.parent.getWorldPosition(origin);
    mesh.getWorldPosition(p);
    const q = Math.atan2(p.x - origin.x, p.z - origin.z) / (Math.PI / 2);
    return ((Math.round(q) % 4) + 4) % 4;
  }

  function readPattern(kind, seal) {
    return stampOrientMarks
      .filter((m) => m.userData.kind === kind && (seal == null || m.userData.seal === seal))
      .map((m) => ({
        index: m.userData.index,
        stop: m.userData.stop,
        read: readStop(m),
        teaching: m.userData.teaching,
      }))
      .sort((a, b) => a.index - b.index);
  }

  function frameOf(object, type, axis) {
    root.updateMatrixWorld(true);
    const origin = object.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(...axis).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion())).normalize();
    return { type, origin: origin.toArray(), axis: direction.toArray() };
  }
  function partIndex(iid, hit) { return hit?.index ?? Number(String(iid).replace(/\D/g, '')); }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function gesture(kind, iid, hit = {}) {
    if (kind === 'stamp' && phase === 'stamp') {
      const seal = hit.seal || (iid === 'STAMP_TRUE' ? 'true' : iid === 'STAMP_FALSE' ? 'false' : null);
      if (!seals[seal]) return null;
      const g = seals[seal].group;
      let base = g.position.y;
      const move = sample => { g.position.y = base + clamp(sample.travel || 0, -0.04, 0.008); };
      return {
        start() { base = g.position.y; }, move,
        end(sample) {
          move(sample);
          const pressed = base - g.position.y >= 0.03;
          g.position.y = base;
          if (pressed) onStamp(seal);
          else animateTo(g.position, 'y', sealY, 160);
        },
        cancel() { g.position.y = base; },
      };
    }
    if (kind === 'char' && phase === 'chars') {
      const index = partIndex(iid, hit), part = charMeshes[index];
      if (!part) return null;
      let base = charPos[index] * Math.PI / 2;
      const move = sample => { part.group.rotation.y = base + (sample.turn || 0); };
      return {
        start() { base = part.group.rotation.y; }, move,
        end(sample) {
          move(sample);
          const angle = part.group.rotation.y;
          const step = Math.round(angle / (Math.PI / 2));
          if (Math.abs(sample.turn || 0) > 0.18 && Math.abs(angle - step * Math.PI / 2) < 0.22) {
            onChar(index, ((step % 4) + 4) % 4);
          } else { part.group.rotation.y = base; }
        },
        cancel() { part.group.rotation.y = base; },
      };
    }
    if (kind === 'sword' && phase === 'sword' && !swordOpen) {
      let base = swordSlide.position.x;
      const move = sample => { swordSlide.position.x = clamp(base + (sample.travel || 0), -0.18, 0); };
      return {
        start() { base = swordSlide.position.x; }, move,
        end(sample) { move(sample); if (swordSlide.position.x <= -0.12) onSword(); else animateTo(swordSlide.position, 'x', base, 180); },
        cancel() { swordSlide.position.x = base; },
      };
    }
    return null;
  }

  applyChars();

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives,
    getMarkMeshes: () => stampOrientMarks.slice(),
    build(scene) { scene.add(root); },
    start() { this.reset(); },
    reset() {
      phase = 'stamp';
      seated = null;
      charPos = CHAR_START.slice();
      swordOpen = false;
      softFailCount = 0;
      badClicks = 0;
      hintLevel = 0;
      blot.visible = false;
      seals.true.group.position.set(sealHome.true, sealY, sealZ);
      seals.false.group.position.set(sealHome.false, sealY, sealZ);
      charMeshes.forEach((c) => { c.group.visible = false; });
      charRail.visible = false;
      railL.visible = false;
      railR.visible = false;
      applyChars();
      swordPivot.visible = false;
      swordPivot.rotation.z = 0;
      swordSlide.position.x = 0;
      secret.visible = false;
      secret.position.set(0, bodyY0 + BODY_H * 0.45, 0);
      bodyGroup.position.x = 0;
      api.setObjective('함의 새김과 두 인장의 먹 방향을 견주어, 같은 인장을 앉히시오.');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      api.toast('벽사도 함 — 새김과 두 인장의 먹 방향을 살피시오.', true);
    },
    getGestureFrame(kind, iid, hit = {}) {
      if (kind === 'stamp') {
        const seal = hit.seal || (iid === 'STAMP_TRUE' ? 'true' : 'false');
        return seals[seal] ? frameOf(seals[seal].group, 'linear', [0, 1, 0]) : null;
      }
      if (kind === 'char') {
        const part = charMeshes[partIndex(iid, hit)];
        return part ? frameOf(part.group, 'rotate', [0, 1, 0]) : null;
      }
      if (kind === 'sword') return frameOf(swordSlide, 'linear', [1, 0, 0]);
      return null;
    },
    getDragInteraction: gesture,
    handleInteract(kind) {
      if (phase === 'finale') return;
      if (kind === 'stamp') api.toast('인장을 잡고 아래로 눌러 먹을 찍으시오.');
      else if (kind === 'char') api.toast('목판 가장자리를 잡고 새김의 획을 향해 돌리시오.');
      else if (kind === 'sword') api.toast('손잡이를 잡고 칼집에서 왼쪽으로 당기시오.');
    },
    revealHint() {
      hintLevel = bumpHintLevel(hintLevel);
      requestHint(api, hintLevel, HINT_PACK);
    },
    get mistook() { return softFailCount > 0; },
    getState() {
      const notches = charMeshes.map((c, index) => {
        const origin = new THREE.Vector3();
        const p = new THREE.Vector3();
        c.group.getWorldPosition(origin);
        c.notch.getWorldPosition(p);
        const q = Math.atan2(p.x - origin.x, p.z - origin.z) / (Math.PI / 2);
        return { index, read: ((Math.round(q) % 4) + 4) % 4 };
      });
      return {
        phase,
        seated,
        stamped: seated === 'true',
        charPos: charPos.slice(),
        hintLevel,
        swordOpen,
        swordTravel: Math.max(0, -swordSlide.position.x),
        stampDepth: { true: sealY - seals.true.group.position.y, false: sealY - seals.false.group.position.y },
        charAngles: charMeshes.map(c => c.group.rotation.y),
        blocksAlive: charMeshes.every((c) => c.group.visible),
        trueColor: seals.true.bodyMat.color.getHex(),
        falseColor: seals.false.bodyMat.color.getHex(),
        engrave: readPattern('engrave'),
        trueSeal: readPattern('sealInk', 'true'),
        falseSeal: readPattern('sealInk', 'false'),
        notches,
      };
    },
    solve() {
      if (phase === 'stamp') onStamp('true');
      charPos = CHAR_TARGET.slice();
      applyChars();
      phase = 'sword';
      swordPivot.visible = true;
      onSword();
    },
    dispose(scene) {
      scene.remove(root);
      disposeCraftRoot(root, mats, [lacquer, sealSurface]);
      interactives.length = 0;
    },
  };
}
