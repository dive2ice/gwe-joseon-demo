/**
 * Chapter 8 — 수문장 병풍 궤
 *
 * Discoverable rule: 먹선 follows the 수문장 crest on the screen
 * (좌→우→중 = WIRE_ORDER [0,2,1]). The left wire (TEACHING_WIRE) starts
 * unconnected. Folding swings one ink end. The two ends meet in world
 * space only when the gap is <= INK_TOUCH, which is FOLD_TARGET.
 * Meeting does not open the chest. A latch shows only while they touch.
 * One confirm writes ch8-fold.
 *
 * Soft-fail never advances hints. Hints: request-only observe → relate → FULL.
 * Phases: panels → wires → fold → finale.
 * Visual: Joseon folding-screen chest — multi-panel 병풍, ink-line wires, brass hinges/latches, feet.
 */
import { boxMesh, bevelBoxMesh, invisibleHit } from '../materials.js';
import { craftPalette, addRaisedPanel, makeScreenPaper, screenLeaf, disposeCraftRoot } from '../campaign-craft-art.js';
import { bumpHintLevel, requestHint, softFailNoHint } from '../hint-policy.js';

export const id = 8;
export const title = '수문장 병풍 궤';
export const blurb = '병풍을 접고 먹선 배선·접힘각으로 밀실을 여시오.';
export const steps = [
  { id: 'A', label: '병풍' },
  { id: 'B', label: '먹선' },
  { id: 'C', label: '접힘각' },
];

/** Non-spoiler footer; FULL only via explicit revealHint ×3 */
export const hint = '병풍을 펼쳐 끊긴 획과 접힌 먹 끝을 견주시오.';
export const HINT_PARTIAL = '각 문양에서 먹이 들어오는 높이와 빠져나가는 높이를 견주시오.';
export const HINT_RELATION = '굵게 맺힌 시작에서 같은 높이의 획을 이어 가시오. 다이얼을 돌려 먹 끝이 만나면 빗장을 당기시오.';
/** Spoiler: wire indices + fold target + confirm */
export const HINT_FULL = '정답: 먹선 [0, 2, 1] (좌→우→중) · 접힘각 칸 2 · 맞닿은 뒤 빗장';
const HINT_PACK = { base: hint, partial: HINT_PARTIAL, relation: HINT_RELATION, full: HINT_FULL };

export const WIRE_ORDER = [0, 2, 1];
export const FOLD_TARGET = 2; // 0–3 detents, continuous between them
export const FOLD_STEPS = 4;

/** Left wire, first in the crest path. Starts unconnected. */
export const TEACHING_WIRE = 0;
/** Ink ends at or under this world-unit gap count as touching. */
export const INK_TOUCH = 0.02;

/** Wrong wire clicks before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 3;

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch8_sumunjang';

  let phase = 'panels'; // panels | wires | fold | finale
  let panelOpen = [false, false, false];
  let wireProgress = [];
  let wireDone = new Set();
  let foldPos = 0; // continuous quarter-turns, snapped only close to a detent
  let latchTravel = 0;
  let softFailCount = 0;
  let badClicks = 0;
  let hintLevel = 0;
  const interactives = [];
  const panelMeshes = [];
  const wireMeshes = [];
  let foldTargetTick = null;

  const art = craftPalette(THREE, mats, 8);
  const woodMat = art.wood;
  const woodDark = art.dark;
  const woodAcc = art.wood;
  const lacquer = art.lacquer;
  const brass = art.brass;
  const brassB = art.bright;
  const iron = mats.iron;

  // ---- Chest base under the folding screen (병풍 궤) ----
  const BODY_W = 1.05;
  const BODY_H = 0.28;
  const BODY_D = 0.42;
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
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W - 0.06, 0.04, 0.02, woodMat,
    0, bodyY0 + 0.04, BODY_D / 2 - 0.01));
  // Top platform (screen rests here)
  const topY = bodyY0 + BODY_H + 0.02;
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W + 0.04, 0.04, BODY_D + 0.04, woodMat, 0, topY, 0));
  // Lacquer inset top
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W - 0.1, 0.014, BODY_D - 0.08, lacquer, 0, topY + 0.022, 0));
  // Crown lip
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W + 0.01, 0.012, BODY_D + 0.01, woodAcc, 0, topY + 0.032, 0.005));

  // Shaped feet + brass shoes
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(bevelBoxMesh(THREE, 0.075, 0.1, 0.065, woodDark,
      sx * (BODY_W / 2 - 0.1), 0.05, sz * (BODY_D / 2 - 0.06)));
    bodyGroup.add(boxMesh(THREE, 0.055, 0.014, 0.048, brass,
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
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.05, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.05, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + 0.08, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + 0.08, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.05, rearZ, Math.PI / 2);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.05, rearZ, Math.PI);

  addRaisedPanel(THREE, bodyGroup, woodMat, woodDark, BODY_W - 0.2, BODY_H - 0.12, frontZ + 0.015, bodyY0 + BODY_H / 2);
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W + 0.025, 0.024, BODY_D + 0.025, woodDark, 0, bodyY0 + 0.012, 0));

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
  for (let i = 0; i < 7; i++) {
    const rx = -0.42 + i * 0.14;
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

  // Screen rail / channel on top (병풍 레일)
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W - 0.12, 0.018, 0.06, woodDark, 0, topY + 0.04, -0.02));
  // Brass rail caps
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.03, 0.022, 0.07, brassB,
      sx * (BODY_W / 2 - 0.1), topY + 0.04, -0.02));
  });

  // Ink-line plaque helper (먹선 glyph)
  function makeInkPlaque(label) {
    try {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = '#c9a84a';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, 56, 56);
      // Simple ink stroke mark
      ctx.strokeStyle = '#e8d9b0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(16, 36);
      ctx.quadraticCurveTo(32, 5, 48, 34);
      ctx.stroke();
      ctx.fillStyle = '#c9a84a';
      ctx.font = 'bold 18px serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, 32, 56, 54);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.55, metalness: 0.12,
        emissive: 0x1a1008, emissiveIntensity: 0.12,
      });
    } catch (_) {
      return brassB;
    }
  }


  // ---- 수문장 crest / ink-flow rule plaque (readable world rule) ----
  function makeCrestPlaque(label) {
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
      ctx.font = label.length <= 3 ? 'bold 20px serif' : 'bold 16px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 64, 18, 116);
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

  const crestPlaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.08),
    makeCrestPlaque('수문장 · 먹선'),
  );
  // Leave a clear gap below the three ink fragments so the caption stays legible.
  crestPlaque.position.set(0, bodyY0 + BODY_H * 0.35, frontZ + 0.025);
  bodyGroup.add(crestPlaque);

  // Unfolded fragments sit at their physical panel positions; reconstruct the chain from their ink joints.
  const crestBoard = new THREE.Group();
  crestBoard.position.set(0, bodyY0 + BODY_H * 0.78, frontZ + 0.03);
  bodyGroup.add(crestBoard);
  crestBoard.add(boxMesh(THREE, 0.42, 0.09, 0.012, woodDark, 0, 0, 0));
  const crestMarks = [];
  for (let step = 0; step < WIRE_ORDER.length; step++) {
    const panel = WIRE_ORDER[step];
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.01),
      makeStepPlaque(step),
    );
    mark.position.set((panel - 1) * 0.13, 0, 0.014);
    mark.userData = { kind: 'crest', panel, step, id: `CREST${step}` };
    crestBoard.add(mark);
    crestMarks.push(mark);
  }

  // Ink-junction chain on panel backs (same entry/exit levels as the mechanism)

  // ---- Three folding panels (병풍) with frames, hinges, ink faces ----
  const panelBaseY = topY + 0.06;
  const panelXs = [-0.34, 0, 0.34];
  const PANEL_W = 0.3;
  const PANEL_H = 0.58;
  const PANEL_D = 0.035;
  const landscape = makeScreenPaper(THREE, art.paper);

  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.name = `ch8-panel-pivot-${i}`;
    const hingeSide = i === 0 ? 1 : i === 2 ? -1 : 0;
    const hingeX = hingeSide * (PANEL_W / 2 + 0.01);
    const hingeZ = 0.025;
    pivot.position.set(panelXs[i] + hingeX, panelBaseY, -0.02 + hingeZ);
    // Outer lacquer face
    const panel = bevelBoxMesh(THREE, PANEL_W, PANEL_H, PANEL_D, lacquer, 0, PANEL_H / 2, 0, 0.003);
    panel.userData = { id: `P${i}`, kind: 'panel', index: i };
    pivot.add(panel);
    // Wood frame rails around panel
    pivot.add(bevelBoxMesh(THREE, PANEL_W + 0.02, 0.02, PANEL_D + 0.01, woodMat, 0, PANEL_H - 0.005, 0));
    pivot.add(bevelBoxMesh(THREE, PANEL_W + 0.02, 0.02, PANEL_D + 0.01, woodMat, 0, 0.01, 0));
    pivot.add(bevelBoxMesh(THREE, 0.018, PANEL_H, PANEL_D + 0.008, woodMat, -PANEL_W / 2 + 0.005, PANEL_H / 2, 0));
    pivot.add(bevelBoxMesh(THREE, 0.018, PANEL_H, PANEL_D + 0.008, woodMat, PANEL_W / 2 - 0.005, PANEL_H / 2, 0));
    // Paper lies inside the joinery; one quiet panorama continues across all leaves.
    const paperBack = bevelBoxMesh(THREE, PANEL_W - 0.041, PANEL_H - 0.054, 0.008, art.paper,
      0, PANEL_H / 2, -0.014, 0.001);
    pivot.add(paperBack);
    const painting = screenLeaf(THREE, landscape, i, PANEL_W - 0.043, PANEL_H - 0.062);
    painting.position.set(0, PANEL_H / 2, 0.019);
    pivot.add(painting);
    // A pale lining between pigment and frame reads as layered mounted paper.
    [-1, 1].forEach((side) => {
      pivot.add(bevelBoxMesh(THREE, 0.005, PANEL_H - 0.05, 0.005, art.paper,
        side * (PANEL_W / 2 - 0.022), PANEL_H / 2, 0.019, 0.0008));
    });

    // Both knuckles share the actual yaw axis. A fixed spindle runs down
    // into the rail; only the leaf and its hinge straps turn around it.
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, PANEL_H + 0.018, 16), brass);
    spindle.name = `ch8-panel-spindle-${i}`;
    spindle.position.set(panelXs[i] + hingeX, panelBaseY + PANEL_H / 2 - 0.009, -0.02 + hingeZ);
    root.add(spindle);
    for (const hy of [0.12, 0.44]) {
      const hinge = new THREE.Group();
      hinge.name = `ch8-panel-knuckle-${i}-${hy}`;
      hinge.position.set(hingeX, hy, hingeZ);
      hinge.add(boxMesh(THREE, 0.04, 0.018, 0.008, brassB, -hingeSide * 0.018, 0, -0.004));
      hinge.add(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.042, 16), brass));
      pivot.add(hinge);
    }

    // Corner rivets on each panel frame
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => {
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
      riv.position.set(sx * (PANEL_W / 2 - 0.02), PANEL_H / 2 + sy * (PANEL_H / 2 - 0.03), 0.022);
      pivot.add(riv);
    });

    // Hint glyph on back (visible when folded open) — crest path step teaches wire order
    const hintMark = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.008),
      makeInkPlaque(['왼쪽', '가운데', '오른쪽'][i]),
    );
    hintMark.position.set(0, PANEL_H * 0.55, -PANEL_D / 2 - 0.006);
    hintMark.visible = false;
    pivot.add(hintMark);
    // Crest-path ink fragment: matching junction heights reveal the flow
    const crestStep = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.006),
      makeStepPlaque(WIRE_ORDER.indexOf(i)),
    );
    crestStep.position.set(0, PANEL_H * 0.35, -PANEL_D / 2 - 0.006);
    crestStep.visible = false;
    pivot.add(crestStep);
    // Teaching glow strip on panel that maps to TEACHING_WIRE
    let teachGlow = null;
    if (i === TEACHING_WIRE) {
      teachGlow = boxMesh(THREE, PANEL_W - 0.12, 0.008, 0.005, brassB, 0, PANEL_H * 0.2, -PANEL_D / 2 - 0.004);
      teachGlow.visible = false;
      pivot.add(teachGlow);
    }

    // Small brass plaque on front (quiet)
    const frontPlaque = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.028, 0.004),
      brassB,
    );
    frontPlaque.position.set(0, PANEL_H * 0.85, PANEL_D / 2 + 0.004);
    pivot.add(frontPlaque);

    const hit = invisibleHit(THREE, PANEL_W + 0.04, PANEL_H, 0.14, { id: `P${i}`, kind: 'panel', index: i }, 0, PANEL_H / 2, 0);
    pivot.add(hit);
    // Preserve closed leaf coordinates while moving its transform to the pin.
    pivot.children.forEach(child => { child.position.x -= hingeX; child.position.z -= hingeZ; });
    root.add(pivot);
    interactives.push(panel, hit);
    panelMeshes.push({ pivot, panel, hintMark, crestStep, teachGlow });
  }

  // ---- Ink-line wiring nodes (revealed after all panels open) ----
  const wireY = topY + 0.08;
  const wireZ = 0.2;
  const wirePositions = [
    [-0.28, wireY, wireZ],
    [0, wireY, wireZ],
    [0.28, wireY, wireZ],
  ];
  // Wire track rail (decorative channel for 먹선)
  const wireTrack = boxMesh(THREE, 0.7, 0.02, 0.08, woodDark, 0, wireY - 0.02, wireZ);
  wireTrack.visible = false;
  root.add(wireTrack);
  wirePositions.forEach(([x]) => {
    wireTrack.add(boxMesh(THREE, 0.13, 0.004, 0.018, lacquer, x + 0.035, 0.012, 0));
    wireTrack.add(boxMesh(THREE, 0.007, 0.012, 0.035, brass, x + 0.084, 0.016, 0));
  });
  // Brass track ends
  const trackEnds = [];
  [-1, 1].forEach((sx) => {
    const end = boxMesh(THREE, 0.03, 0.028, 0.09, brassB, sx * 0.36, wireY - 0.02, wireZ);
    end.visible = false;
    root.add(end);
    trackEnds.push(end);
  });

  for (let i = 0; i < 3; i++) {
    const nodeGroup = new THREE.Group();
    nodeGroup.position.set(...wirePositions[i]);
    nodeGroup.visible = false;
    // Iron/bronze ink node sphere
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 14), iron.clone());
    node.userData = { id: `W${i}`, kind: 'wire', index: i };
    nodeGroup.add(node);
    // Brass collar under node
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.02, 12), brassB);
    collar.position.y = -0.025;
    collar.userData = { id: `W${i}`, kind: 'wire', index: i };
    nodeGroup.add(collar);
    // Ink-line plaque on node
    const plaque = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.006),
      makeStepPlaque(WIRE_ORDER.indexOf(i)),
    );
    plaque.position.set(0, 0.02, 0.04);
    plaque.userData = { id: `W${i}`, kind: 'wire', index: i };
    nodeGroup.add(plaque);
    // Tiny rivets around collar
    for (let r = 0; r < 4; r++) {
      const a = (r / 4) * Math.PI * 2;
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), brass);
      riv.position.set(Math.cos(a) * 0.04, -0.02, Math.sin(a) * 0.04);
      nodeGroup.add(riv);
    }
    root.add(nodeGroup);
    const hit = invisibleHit(THREE, 0.12, 0.12, 0.12, { id: `W${i}`, kind: 'wire', index: i }, ...wirePositions[i]);
    hit.visible = false;
    root.add(hit);
    interactives.push(node, collar, plaque, hit);
    wireMeshes.push({ nodeGroup, node, hit });
  }

  // Connecting line visual (ink bar between wired nodes)
  const lineBar = boxMesh(THREE, 0.55, 0.012, 0.012, mats.bangBlack || iron, 0, wireY, wireZ);
  lineBar.visible = false;
  root.add(lineBar);
  // Secondary thinner ink stroke
  const lineBar2 = boxMesh(THREE, 0.55, 0.006, 0.006, mats.bangRed || iron, 0, wireY + 0.01, wireZ + 0.01);
  lineBar2.visible = false;
  root.add(lineBar2);

  // Adjacent panel ink ends. The leaf rotates with the fold dial.
  // At FOLD_TARGET the moving tip lands on the fixed tip (gap <= INK_TOUCH).
  const INK_RADIUS = 0.08;
  const inkMatA = iron.clone();
  inkMatA.color = new THREE.Color(0x14110e);
  inkMatA.emissive = new THREE.Color(0xc8b090);
  inkMatA.emissiveIntensity = 0.15;
  const inkMatB = inkMatA.clone();
  const inkHinge = new THREE.Group();
  inkHinge.name = 'ch8-ink-hinge';
  inkHinge.position.set(0, topY + 0.36, 0.16);
  root.add(inkHinge);
  // The geared indicator is carried by a spindle, rather than two floating ink rods.
  const inkSpindle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.31, 16), brass);
  inkSpindle.position.set(0, topY + 0.205, 0.16);
  inkSpindle.name = 'ch8-ink-spindle';
  root.add(inkSpindle);
  root.add(bevelBoxMesh(THREE, 0.12, 0.025, 0.12, woodDark, 0, topY + 0.045, 0.16, 0.003));
  inkHinge.add(bevelBoxMesh(THREE, INK_RADIUS + 0.012, 0.1, 0.006, art.paper, -INK_RADIUS / 2, -0.04, -0.012, 0.001));
  const inkEndA = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12), inkMatA);
  inkEndA.position.set(-INK_RADIUS, 0, 0);
  inkEndA.name = 'inkEndFixed';
  inkEndA.userData = { kind: 'inkEnd', role: 'fixed', panel: 0 };
  inkHinge.add(inkEndA);
  inkHinge.add(boxMesh(THREE, INK_RADIUS, 0.008, 0.008, inkMatA, -INK_RADIUS / 2, 0, 0));
  const inkLeaf = new THREE.Group();
  inkLeaf.name = 'ch8-ink-leaf';
  inkHinge.add(inkLeaf);
  inkLeaf.add(bevelBoxMesh(THREE, INK_RADIUS + 0.012, 0.1, 0.006, art.paper, INK_RADIUS / 2, -0.04, -0.012, 0.001));
  const inkEndB = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12), inkMatB);
  inkEndB.position.set(INK_RADIUS, 0, 0);
  inkEndB.name = 'inkEndFold';
  inkEndB.userData = { kind: 'inkEnd', role: 'fold', panel: 1 };
  inkLeaf.add(inkEndB);
  inkLeaf.add(boxMesh(THREE, INK_RADIUS, 0.008, 0.008, inkMatB, INK_RADIUS / 2, 0, 0));

  // ---- Fold-angle control dial (접힘각) ----
  const foldDial = new THREE.Group();
  foldDial.position.set(0, topY + 0.18, 0.28);
  foldDial.visible = false;
  root.add(foldDial);
  const foldRotor = new THREE.Group();
  foldDial.add(foldRotor);
  // Mount plate
  foldDial.add(bevelBoxMesh(THREE, 0.18, 0.19, 0.018, woodDark, 0, 0, -0.036, 0.003));
  foldDial.add(bevelBoxMesh(THREE, 0.15, 0.16, 0.006, brass, 0, 0, -0.024, 0.001));
  const driveAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 16), brass);
  driveAxle.rotation.x = Math.PI / 2;
  driveAxle.position.z = -0.065;
  foldDial.add(driveAxle);
  const dialDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.032, 20), brass.clone());
  dialDisc.rotation.x = Math.PI / 2;
  dialDisc.userData = { id: 'FOLD', kind: 'fold' };
  foldRotor.add(dialDisc);
  // Dial rim
  const dialRim = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.008, 8, 24), brassB);
  dialRim.rotation.x = 0;
  dialRim.userData = { id: 'FOLD', kind: 'fold' };
  foldRotor.add(dialRim);
  // Four equal detents: the moving ink ends, not a highlighted dial tick, reveal alignment
  for (let n = 0; n < FOLD_STEPS; n++) {
    const ang = n * (Math.PI / 2);
    const isTarget = n === FOLD_TARGET;
    const notch = new THREE.Mesh(
      new THREE.BoxGeometry(0.009, 0.016, 0.006),
      brass,
    );
    notch.position.set(Math.cos(ang) * 0.06, Math.sin(ang) * 0.06, 0.024);
    notch.rotation.z = ang - Math.PI / 2;
    foldDial.add(notch);
    if (isTarget) foldTargetTick = notch;
  }
  // Tiny 접힘각 label plaque on dial mount
  const foldLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.035),
    makeCrestPlaque('접힘각'),
  );
  foldLabel.position.set(0, -0.045, 0.06);
  foldDial.add(foldLabel);
  const dialNotch = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.034, 0.012), brassB);
  dialNotch.position.set(0, 0.055, 0.025);
  dialNotch.userData = { id: 'FOLD', kind: 'fold' };
  foldRotor.add(dialNotch);
  // Center rivet
  const dialRiv = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), brassB);
  dialRiv.position.set(0, 0, 0.023);
  dialRiv.userData = { id: 'FOLD', kind: 'fold' };
  foldRotor.add(dialRiv);
  const foldHit = invisibleHit(THREE, 0.18, 0.14, 0.14, { id: 'FOLD', kind: 'fold' });
  foldDial.add(foldHit);
  interactives.push(dialDisc, dialRim, dialNotch, dialRiv, foldHit);

  // Confirm latch. Visible only while the ink ends touch during the fold phase.
  const confirmGroup = new THREE.Group();
  confirmGroup.position.set(0.18, topY + 0.2, 0.34);
  confirmGroup.visible = false;
  root.add(confirmGroup);
  confirmGroup.add(bevelBoxMesh(THREE, 0.22, 0.065, 0.018, woodDark, 0.035, 0, -0.018, 0.003));
  confirmGroup.add(bevelBoxMesh(THREE, 0.03, 0.18, 0.11, brass, 0, -0.10, -0.055, 0.002));
  [-0.035, 0.095].forEach(x => confirmGroup.add(bevelBoxMesh(THREE, 0.012, 0.042, 0.028, brass, x, 0, 0.002, 0.002)));
  const confirmBar = boxMesh(THREE, 0.1, 0.028, 0.02, brassB, 0, 0, 0);
  confirmBar.userData = { id: 'FOLD_LATCH', kind: 'foldConfirm' };
  confirmGroup.add(confirmBar);
  const confirmHit = invisibleHit(THREE, 0.14, 0.08, 0.08, { id: 'FOLD_LATCH', kind: 'foldConfirm' });
  confirmGroup.add(confirmHit);
  interactives.push(confirmBar, confirmHit);

  // Compartment (밀실)
  const compartment = new THREE.Group();
  compartment.position.set(0, bodyY0 + BODY_H * 0.5, 0);
  compartment.visible = false;
  root.add(compartment);
  compartment.add(boxMesh(THREE, 0.38, 0.12, 0.28, woodAcc, 0, 0, 0));
  compartment.add(boxMesh(THREE, 0.34, 0.02, 0.24, woodMat, 0, 0.07, 0));
  compartment.add(boxMesh(THREE, 0.06, 0.04, 0.01, brassB, 0, 0.02, 0.145));
  compartment.add(boxMesh(THREE, 0.26, 0.01, 0.18, art.paper, 0, 0.08, 0));

  function applyPanels() {
    panelMeshes.forEach((p, i) => {
      const open = panelOpen[i];
      p.pivot.rotation.y = open ? (i === 0 ? 0.9 : i === 2 ? -0.9 : 0.35) : 0;
      p.hintMark.visible = open;
      if (p.crestStep) p.crestStep.visible = open;
      if (p.teachGlow) p.teachGlow.visible = open;
      p.panel.material = open ? woodAcc : lacquer;
    });
  }

  function allPanelsOpen() {
    return panelOpen.every(Boolean);
  }

  function revealWires() {
    wireMeshes.forEach((w) => {
      w.nodeGroup.visible = true;
      w.hit.visible = true;
    });
    wireTrack.visible = true;
    trackEnds.forEach((e) => { e.visible = true; });
  }

  function clearWires() {
    wireProgress = [];
    wireDone.clear();
  }

  function inkSpan() {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    inkEndA.getWorldPosition(a);
    inkEndB.getWorldPosition(b);
    return { a, b, dist: a.distanceTo(b) };
  }

  function inkTouching() {
    return inkSpan().dist <= INK_TOUCH;
  }

  function applyWires() {
    wireMeshes.forEach((w, i) => {
      const done = wireDone.has(i);
      w.nodeGroup.position.x = wirePositions[i][0] + (done ? 0.045 : 0);
      w.hit.position.x = w.nodeGroup.position.x;
      const teach = i === TEACHING_WIRE && done;
      w.node.material.emissive = new THREE.Color(done ? (teach ? 0x506028 : 0x405020) : 0x101010);
      w.node.material.emissiveIntensity = teach ? 0.7 : done ? 0.5 : 0.1;
    });
    lineBar.visible = wireDone.size >= 2;
    lineBar2.visible = wireDone.size >= 2;
  }

  function applyFold() {
    inkLeaf.rotation.y = foldPos * (Math.PI / 2);
    foldRotor.rotation.z = foldPos * (Math.PI / 2);
    const touching = inkTouching();
    inkMatA.emissiveIntensity = touching ? 0.85 : 0.15;
    inkMatB.emissiveIntensity = touching ? 0.85 : 0.15;
    dialDisc.material.emissiveIntensity = touching ? 0.5 : 0.15;
    confirmGroup.visible = phase === 'fold' && touching;
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

  function onPanel(index) {
    if (phase !== 'panels') {
      api.toast('병풍은 이미 펼쳐졌습니다.');
      return;
    }
    panelOpen[index] = !panelOpen[index];
    applyPanels();
    api.playClick();
    api.vibrate(20);
    if (allPanelsOpen()) {
      phase = 'wires';
      revealWires();
      clearWires();
      applyWires();
      api.setObjective('획의 시작과 이어지는 높이를 읽고 먹선 마디를 옆 홈으로 당기시오.');
      api.setSteps('B', ['A']);
      api.playUnlock();
      api.toast('병풍 뒷면에 문장 경로와 배선이 드러났습니다.', true);
    } else {
      const n = panelOpen.filter(Boolean).length;
      api.toast(`병풍 패널 (${n}/3) · 뒷면 획을 살피시오`, true);
    }
  }

  function onWire(index) {
    if (phase !== 'wires') {
      if (phase === 'panels') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('먼저 병풍을 모두 펼쳐 문장 경로를 확인하시오.');
      } else if (phase === 'fold') {
        api.toast('먹선은 이미 이어졌소. 접힘각 눈금을 살피시오.');
      }
      return;
    }
    if (wireDone.has(index)) {
      api.toast('이미 이은 배선입니다.');
      return;
    }
    const expected = WIRE_ORDER[wireProgress.length];
    if (index !== expected) {
      api.playWrong();
      api.vibrate(20);
      badClicks += 1;
      clearWires();
      applyWires();
      softFailShake();
      if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
      else api.toast('먹선 순서가 틀렸습니다. 획의 연결 높이를 다시 살피시오.');
      return;
    }
    wireProgress.push(index);
    wireDone.add(index);
    badClicks = 0;
    applyWires();
    api.playThunk();
    api.vibrate(25);
    if (wireProgress.length === WIRE_ORDER.length) {
      phase = 'fold';
      badClicks = 0;
      foldDial.visible = true;
      applyFold();
      api.setObjective('접힘각을 돌려 먹 끝을 맞닿게 한 뒤, 드러난 빗장으로 확정하시오.');
      api.setSteps('C', ['A', 'B']);
      api.playUnlock();
      api.toast('먹선이 문장 경로대로 이어졌습니다. 접힘각 다이얼이 드러납니다.', true);
    } else {
      api.toast(`먹선 (${wireProgress.length}/3) · 문장 경로를 따르시오`, true);
    }
  }

  function onFold() {
    api.toast('다이얼 테두리를 잡고 원을 그리며 돌리시오. 짧게 누르는 것만으로는 움직이지 않소.');
  }

  function onConfirm() {
    if (phase !== 'fold') {
      api.toast('아직 먹선을 확정할 수 없습니다.');
      return;
    }
    if (!inkTouching()) {
      api.playWrong();
      api.vibrate(18);
      api.toast('먹 끝이 떨어져 확정할 수 없습니다.');
      return;
    }
    phase = 'finale';
    confirmGroup.visible = false;
    if (api.recordEvidence) api.recordEvidence('ch8-fold');
    compartment.visible = true;
    animateVec3(compartment.position, new THREE.Vector3(0, 0.35, 0.4), 650, () => {
      api.playUnlock();
      api.vibrate([50, 30, 80]);
      api.showFinale({
        title: '수문장 · 병풍 밀실',
        body: '병풍 안에서 수문장의 묵선도와 쪽지가 나왔다. 「문은 접힘으로 열고, 선은 문장 경로로 잇는다.」 다음 시계 궤의 열쇠가 될 놋쇠 고리가 함께 있었다.',
        footer: '— 수문장 병풍 기록',
        epilogue: '제8장 수문장 병풍 궤 — 해제 완료',
      });
      api.markCleared(id);
    });
    api.playClick();
    api.vibrate(35);
    api.toast('맞닿은 먹선을 확정했습니다.', true);
  }

  applyPanels();

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives,
    build(scene) { scene.add(root); },
    start() { this.reset(); },
    reset() {
      phase = 'panels';
      panelOpen = [false, false, false];
      wireProgress = [];
      wireDone.clear();
      foldPos = 0;
      latchTravel = 0; confirmBar.position.x = confirmHit.position.x = 0;
      softFailCount = 0;
      badClicks = 0;
      hintLevel = 0;
      applyPanels();
      wireMeshes.forEach((w) => { w.nodeGroup.visible = false; w.hit.visible = false; });
      applyWires();
      lineBar.visible = false;
      lineBar2.visible = false;
      wireTrack.visible = false;
      trackEnds.forEach((e) => { e.visible = false; });
      foldDial.visible = false;
      applyFold();
      compartment.visible = false;
      compartment.position.set(0, bodyY0 + BODY_H * 0.5, 0);
      bodyGroup.position.x = 0;
      api.setObjective('병풍 세 폭을 펼쳐 끊긴 먹획의 연결을 살피시오.');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      api.toast('수문장 병풍 궤 — 문장 경로와 먹선을 살피시오.', true);
    },
    getGestureFrame(kind, iid) {
      const index = Number(String(iid).replace(/\D/g, ''));
      const node = kind === 'fold' ? foldDial : kind === 'foldConfirm' ? confirmGroup : kind === 'wire' ? wireMeshes[index]?.nodeGroup : null;
      if (!node) return null;
      root.updateMatrixWorld(true);
      const axis = new THREE.Vector3(...(kind === 'foldConfirm' || kind === 'wire' ? [1, 0, 0] : [0, 0, 1]));
      axis.transformDirection(root.matrixWorld);
      return { type: kind === 'fold' ? 'rotate' : 'linear', origin: node.getWorldPosition(new THREE.Vector3()).toArray(), axis: axis.toArray() };
    },
    getDragInteraction(kind, iid) {
      if (kind === 'fold' && phase === 'fold') {
        const start = foldPos;
        return {
          start() {},
          move(s) { if (Number.isFinite(s.turn)) { foldPos = start + s.turn / (Math.PI / 2); applyFold(); } },
          end() {
            const nearest = Math.round(foldPos);
            if (Math.abs(foldPos - nearest) < 0.12) foldPos = nearest;
            foldPos = ((foldPos % FOLD_STEPS) + FOLD_STEPS) % FOLD_STEPS;
            applyFold(); api.playClick();
          },
          cancel() { foldPos = start; applyFold(); },
        };
      }
      if (kind === 'wire' && phase === 'wires') {
        const index = Number(String(iid).replace(/\D/g, ''));
        const w = wireMeshes[index]; if (!w || wireDone.has(index)) return null;
        let travel = 0;
        return {
          start() {},
          move(s) { travel = Math.max(0, Math.min(0.085, Number(s.travel) || 0)); w.nodeGroup.position.x = w.hit.position.x = wirePositions[index][0] + travel; },
          end() { if (travel >= 0.055) onWire(index); applyWires(); },
          cancel() { applyWires(); },
        };
      }
      if (kind === 'foldConfirm' && phase === 'fold' && inkTouching()) {
        return {
          start() { latchTravel = 0; },
          move(s) { latchTravel = Math.max(0, Math.min(0.08, Number(s.travel) || 0)); confirmBar.position.x = confirmHit.position.x = latchTravel; },
          end() { if (latchTravel >= 0.055 && inkTouching()) onConfirm(); else { latchTravel = 0; confirmBar.position.x = confirmHit.position.x = 0; } },
          cancel() { latchTravel = 0; confirmBar.position.x = confirmHit.position.x = 0; },
        };
      }
      return null;
    },
    handleInteract(kind, iid, userData) {
      if (phase === 'finale') return;
      if (kind === 'panel') onPanel(userData.index);
      else if (kind === 'wire') api.toast('먹선 마디를 잡고 오른쪽 홈으로 당기시오.');
      else if (kind === 'fold') onFold();
      else if (kind === 'foldConfirm') api.toast('드러난 빗장을 오른쪽으로 당기시오.');
    },
    revealHint() {
      hintLevel = bumpHintLevel(hintLevel);
      requestHint(api, hintLevel, HINT_PACK);
    },
    get mistook() { return softFailCount > 0; },
    getMarkMeshes: () => crestMarks.concat([inkEndA, inkEndB]),
    getState() {
      const span = inkSpan();
      return {
        phase,
        hintLevel,
        foldPos,
        foldAngle: foldPos * Math.PI / 2,
        latchTravel,
        wireCount: wireProgress.length,
        wires: wireProgress.slice(),
        teachingConnected: wireDone.has(TEACHING_WIRE),
        touching: span.dist <= INK_TOUCH,
        inkDist: span.dist,
        confirmVisible: confirmGroup.visible,
        crest: crestMarks
          .map((m) => ({ panel: m.userData.panel, step: m.userData.step }))
          .sort((p, q) => p.step - q.step),
      };
    },
    solve() {
      panelOpen = [true, true, true];
      applyPanels();
      phase = 'wires';
      revealWires();
      clearWires();
      applyWires();
      WIRE_ORDER.forEach((i) => {
        if (!wireDone.has(i) && phase === 'wires') onWire(i);
      });
      foldPos = FOLD_TARGET; applyFold();
      if (phase === 'fold' && inkTouching()) onConfirm();
    },
    dispose(scene) {
      scene.remove(root);
      disposeCraftRoot(root, mats, [lacquer, ...(landscape === art.paper ? [] : [landscape])]);
      interactives.length = 0;
    },
  };
}
