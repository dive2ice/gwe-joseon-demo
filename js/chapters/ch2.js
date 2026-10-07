/**
 * Chapter 2 — 나전흑칠 연상 (flagship-adjacent finding logic)
 *
 * Discoverable rule: four nacre tiles are cardinal petals of a 사군자/방사 문양.
 * Each brass wedge tip must point **inward toward the center oil-lamp / moonlight**,
 * along the light’s radial direction. Teaching tile (N) starts already correct and glowing.
 *
 * Soft-fail: spam of wrong rotations → shake + partial hint; 2nd fail → numeric target.
 * Phase B: ghost engrave → place 한지 → one rub stroke. Phase C: 묵함 + 밀서.
 * The stroke list is the pattern, the coverage check, and the drag path.
 */
import { boxMesh, bevelBoxMesh, invisibleHit, makeInkWritingMap } from '../materials.js';

import { createOpeningArt, addNacreSpray } from './opening-art.js';

export const id = 2;
export const title = '나전흑칠 연상';
export const blurb = '영롱한 자개를 달빛 쪽으로 돌리고, 탁본으로 묵함을 여시오.';
export const steps = [
  { id: 'A', label: 'A 자개' },
  { id: 'B', label: 'B 탁본' },
  { id: 'C', label: '묵함' },
];

/** Non-spoiler footer; full angles via soft-fail ×2 / hint button */
export const hint = '자개에 남은 방향과 등잔 아래 문양의 관계를 살피시오.';
export const HINT_PARTIAL = '빛이 모이는 쪽으로 끝을 돌리시오';
/** Spoiler: quarter-turns 0–3 for N/E/S/W — tips face center (inward) */
export const HINT_FULL = '정답 각도(¼회전): N=0 · E=1 · S=2 · W=3 — 끝이 중앙 등잔을 향함';

/**
 * Target rotations in quarter-turns (0–3) for pieces N, E, S, W.
 * Tip points along local −Z; after rot.y, tip faces center when target is matched.
 */
export const NACRE_TARGET = [0, 1, 2, 3];

/** Index of teaching tile that starts already correct (N = 0) */
export const TEACHING_TILE = 0;

/** Bad rotations before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 8;

/** Covered fraction of RUB_STROKE that reveals the writing. Path-length ratio, not a click count. */
export const RUB_COVERAGE = 0.80;

/** World-unit radius. Ink marks where the stone passes; 0.80 is the finish, not the first mark. */
export const RUB_BRUSH = 0.045;

/**
 * One brush path on the desk, XZ. Ghost lines and ink meshes are built from this list.
 * Local +X of each segment follows the segment. rotation.y = atan2(-dz, dx)
 * because that rotation sends local +X to (cos θ, 0, −sin θ).
 */
export const RUB_STROKE = [
  [-0.13, 0.07],
  [-0.05, 0.10],
  [0.05, 0.06],
  [0.11, -0.01],
  [0.05, -0.08],
  [-0.05, -0.06],
  [0.00, 0.00],
];

export const RUB_WRITING = '빛이 모이는 곳에 뜻이 모인다';

export function strokeLength(points = RUB_STROKE) {
  let n = 0;
  for (let i = 1; i < points.length; i++) {
    n += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return n;
}

export function strokeYaw(dx, dz) {
  return Math.atan2(-dz, dx);
}

const STATE = {
  NACRE: 'nacre',
  PAPER: 'paper',
  RUB: 'rub',
  FINALE: 'finale',
};

const PAPER_Y = 0.433; // underside 1mm above the lacquer panel at .429
const RUB_Y = PAPER_Y + .003 + .0175 + .001;
const LABELS = ['N', 'E', 'S', 'W'];
const LABEL_KO = { N: '북', E: '동', S: '남', W: '서' };

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch2_najeon';
  const art = createOpeningArt(THREE, mats);
  const lacquer = art.lacquer;
  const woodDark = mats.sliceWoodDark || mats.woodDark;
  const brass = mats.sliceBrass || mats.brass;
  const brassBright = mats.sliceBrassBright || mats.brassBright;

  let phase = STATE.NACRE;
  // Start: N correct (teaching), E/S/W scrambled away from target
  let rotations = [0, 0, 1, 2];
  let rubProgress = 0;
  let coveredLength = 0;
  let paperPlaced = false;
  let hintLevel = 0;
  let writingNoted = false;
  let rubSoundAt = 0;
  let softFailCount = 0;
  let badClicks = 0;
  let craftEyeOn = false;
  let craftEyeTimer = null;
  let hoverKey = null;

  const interactives = [];
  const pieces = [];
  const craftOverlays = [];
  const ghostLines = [];

  // ---- Desk body (richer black lacquer) ----
  const desk = new THREE.Group();
  root.add(desk);

  desk.add(bevelBoxMesh(THREE, 1.2, 0.1, 0.78, lacquer, 0, 0.36, 0));
  const cabinet = new THREE.Group(); cabinet.name = 'InkCabinetShell'; desk.add(cabinet);
  // The central opening is .45 wide, from y=.135 to the table underside at .31.
  for (const side of [-1,1]) cabinet.add(bevelBoxMesh(THREE, .315, .32, .62, lacquer, side*.3825, .18, 0));
  cabinet.add(bevelBoxMesh(THREE, .45, .32, .03, woodDark, 0, .18, -.295));
  cabinet.add(bevelBoxMesh(THREE, .45, .115, .62, lacquer, 0, .0775, 0));
  cabinet.add(bevelBoxMesh(THREE, .45, .03, .62, lacquer, 0, .325, 0));
  for(const side of [-1,1]) cabinet.add(bevelBoxMesh(THREE, .018, .014, .48, woodDark, side*.178, .153, .10));
  // Inset rim
  desk.add(bevelBoxMesh(THREE, 1.14, 0.03, 0.04, woodDark, 0, 0.42, 0.37));
  desk.add(bevelBoxMesh(THREE, 1.14, 0.03, 0.04, woodDark, 0, 0.42, -0.37));
  desk.add(bevelBoxMesh(THREE, 0.04, 0.03, 0.7, woodDark, 0.55, 0.42, 0));
  desk.add(bevelBoxMesh(THREE, 0.04, 0.03, 0.7, woodDark, -0.55, 0.42, 0));
  // Legs
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    desk.add(boxMesh(THREE, 0.07, 0.18, 0.07, woodDark,
      sx * 0.48, 0.09, sz * 0.3));
  });
  // Brass corner studs
  [[-0.5, -0.32], [0.5, -0.32], [-0.5, 0.32], [0.5, 0.32]].forEach(([x, z]) => {
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 8), brass);
    stud.position.set(x, 0.42, z);
    desk.add(stud);
  });

  // Lid inset panel
  const panel = bevelBoxMesh(THREE, 0.72, 0.018, 0.58, lacquer, 0, 0.42, 0);
  desk.add(panel);
  // The plum inlay belongs to the sliding drawer face below.
  // Flush border inlay sits outside the rotating petals and paper path.
  [-1, 1].forEach((side) => {
    desk.add(boxMesh(THREE, 1.08, 0.0015, 0.002, art.nacre, 0, 0.436, side * 0.335));
    desk.add(boxMesh(THREE, 0.002, 0.0015, 0.64, art.nacre, side * 0.53, 0.436, 0));
  });

  // Faint radial petal guides (always subtle)
  const guideRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.055, 0.00045, 6, 28),
    brass.clone(),
  );
  guideRing.rotation.x = Math.PI / 2;
  guideRing.position.set(0, 0.4295, 0);
  guideRing.material.emissiveIntensity = 0.35;
  desk.add(guideRing);

  // Radial highlight arcs (light cue — tips should follow these inward)
  for (let a = 0; a < 4; a++) {
    const arc = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.0008, 0.1),
      (mats.beam || brassBright).clone(),
    );
    arc.material.transparent = true;
    arc.material.opacity = 0.22;
    arc.material.emissiveIntensity = 0.4;
    const ang = (a * Math.PI) / 2;
    arc.position.set(Math.sin(ang) * 0.07, 0.4295, Math.cos(ang) * 0.07);
    arc.rotation.y = ang;
    desk.add(arc);
    craftOverlays.push(arc);
  }

  // ---- Center oil-lamp / moonlight disc (light gathers here) ----
  const lampGroup = new THREE.Group();
  lampGroup.name = 'NacreLamp';
  lampGroup.position.set(0, 0.435, 0);
  desk.add(lampGroup);
  // Disc base (moonlight plate)
  const moonDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.05, 0.012, 24),
    brassBright.clone(),
  );
  moonDisc.material.emissive.setHex(0x806040);
  moonDisc.material.emissiveIntensity = 0.55;
  lampGroup.add(moonDisc);
  // Small oil cup
  const oilCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.028, 0.03, 12),
    mats.iron || woodDark,
  );
  oilCup.position.y = 0.02;
  lampGroup.add(oilCup);
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 8, 8),
    mats.lampFlame || mats.beam,
  );
  flame.position.y = 0.045;
  lampGroup.add(flame);
  const lampLight = new THREE.PointLight(0xffc878, 0.7, 2.2, 2);
  lampLight.position.set(0, 0.06, 0);
  lampGroup.add(lampLight);
  // Soft highlight ring on lacquer
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.14, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffe0a0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = -0.005;
  lampGroup.add(glowRing);

  // ---- Nacre petals ----
  const slotPos = [
    [0, 0.1],    // N
    [0.15, 0],   // E
    [0, -0.1],   // S
    [-0.15, 0],  // W
  ];

  function makePiece(i) {
    const g = new THREE.Group();
    g.name = 'NacreTile_' + LABELS[i];
    g.position.set(slotPos[i][0], 0.437, slotPos[i][1]);
    const tileMat = art.nacre.clone();
    const tile = bevelBoxMesh(THREE, 0.11, 0.014, 0.11, tileMat, 0, 0, 0, 0.002);
    tile.castShadow = true;
    tile.userData = { id: LABELS[i], kind: 'nacre', index: i };
    // Thin nacre sheen layer
    const sheen = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.004, 0.1),
      art.nacre.clone(),
    );
    sheen.position.y = 0.01;
    sheen.material.transparent = true;
    sheen.material.opacity = 0.55;
    sheen.material.emissiveIntensity = 0.15;
    // Brass wedge tip — points along local −Z (toward center when at target)
    const arrow = new THREE.Shape();
    arrow.moveTo(-.019,.026);arrow.lineTo(.019,.026);arrow.lineTo(0,-.025);arrow.closePath();
    const tip = new THREE.Mesh(new THREE.ExtrudeGeometry(arrow,{depth:.0018,bevelEnabled:false}),brassBright.clone());
    tip.rotation.x = Math.PI / 2; // Shape's -Y apex becomes local -Z.
    tip.position.set(0, .0135, -.012);tip.name='NacrePointer_'+LABELS[i];
    tip.userData = { id: LABELS[i], kind: 'nacre', index: i };
    g.add(tile);
    g.add(sheen);
    g.add(tip);
    const hit = invisibleHit(THREE, 0.15, 0.08, 0.15, { id: LABELS[i], kind: 'nacre', index: i });
    g.add(hit);
    desk.add(g);
    interactives.push(hit, tile, tip);
    pieces.push({ group: g, tile, tip, sheen, baseEmissive: 0.2 });
    return g;
  }

  for (let i = 0; i < 4; i++) makePiece(i);

  // ---- Ghost engraved lines (under lacquer — revealed after match / craft-eye) ----
  function addGhostLine(w, h, d, x, y, z, rotY = 0) {
    const mat = (mats.craftMark || mats.beam).clone();
    mat.emissiveIntensity = 0;
    mat.opacity = 0;
    mat.transparent = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.renderOrder = 3;
    desk.add(m);
    ghostLines.push(m);
    return m;
  }
  // The engraving is the same path the stone must cover.
  const STROKE_LEN = strokeLength(RUB_STROKE);
  for (let i = 1; i < RUB_STROKE.length; i++) {
    const prev = RUB_STROKE[i - 1];
    const next = RUB_STROKE[i];
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz);
    addGhostLine(len, 0.0005, 0.012, (prev[0] + next[0]) / 2, 0.4295, (prev[1] + next[1]) / 2, strokeYaw(dx, dz));
  }

  function setGhostVisible(on, strong = false) {
    ghostLines.forEach((m) => {
      m.material.opacity = on ? (strong ? 0.7 : 0.45) : 0;
      m.material.emissiveIntensity = on ? (strong ? 0.95 : 0.55) : 0;
    });
  }

  function setCraftEye(on) {
    craftEyeOn = on;
    // During nacre: boost radial arcs + faint ghost peek
    craftOverlays.forEach((m) => {
      if (m.material) {
        m.material.opacity = on ? 0.55 : 0.22;
        m.material.emissiveIntensity = on ? 0.85 : 0.4;
      }
    });
    if (phase === STATE.NACRE) setGhostVisible(on, false);
    else if (phase === STATE.PAPER || phase === STATE.RUB) setGhostVisible(true, on);
  }

  function toggleCraftEye() {
    if (craftEyeTimer) {
      clearTimeout(craftEyeTimer);
      craftEyeTimer = null;
    }
    setCraftEye(true);
    api.playClick();
    api.vibrate([20, 30, 20]);
    if (phase === STATE.NACRE) {
      api.toast('장인의 안목 — 등잔 쪽으로 모이는 빛줄기가 희미히 보입니다.', true);
    } else {
      api.toast('장인의 안목 — 흑칠 아래 새김이 드러납니다.', true);
    }
    craftEyeTimer = art.later(() => {
      setCraftEye(false);
      craftEyeTimer = null;
      // Keep ghosts if past nacre match
      if (phase !== STATE.NACRE) setGhostVisible(true, false);
    }, 2800);
  }

  // ---- 한지 sheet (place after nacre) ----
  const paperGroup = new THREE.Group();
  paperGroup.position.set(0.38, 0.44, -0.18);
  paperGroup.visible = true; // stack visible from start as desk prop
  desk.add(paperGroup);
  const paperStack = boxMesh(THREE, 0.16, 0.015, 0.2, art.paper, 0, 0, 0);
  paperStack.userData = { id: 'PAPER', kind: 'paper' };
  paperGroup.add(paperStack);
  for (let sheet = 0; sheet < 3; sheet++) {
    const edge = boxMesh(THREE, 0.16 - sheet * 0.001, 0.001, 0.2, art.paper, (sheet % 2) * 0.002, 0.0078 + sheet * 0.0012, 0);
    paperStack.add(edge);
  }
  const paperHit = invisibleHit(THREE, 0.2, 0.08, 0.24, { id: 'PAPER', kind: 'paper' });
  paperGroup.add(paperHit);
  interactives.push(paperHit, paperStack);

  // Placed sheet over engraving (hidden until placed)
  const placedSheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.006, 0.28),
    art.paper.clone(),
  );
  placedSheet.position.set(0, 0.44, 0);
  placedSheet.visible = false;
  placedSheet.material.transparent = true;
  placedSheet.material.opacity = 0.92;
  desk.add(placedSheet);

  const inkSegs = [];
  const strokeSamples = [];
  for (let i = 1; i < RUB_STROKE.length; i++) {
    const prev = RUB_STROKE[i - 1];
    const next = RUB_STROKE[i];
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz);
    const mat = (mats.sumi || lacquer).clone();
    mat.transparent = true;
    mat.opacity = 0.38;
    mat.depthWrite = false;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 0.0006, 0.014), mat);
    mesh.position.set((prev[0] + next[0]) / 2, PAPER_Y + .0035, (prev[1] + next[1]) / 2);
    mesh.rotation.y = strokeYaw(dx, dz);
    mesh.renderOrder = 4;
    mesh.visible = false;
    mesh.userData = { x0: prev[0], z0: prev[1], x1: next[0], z1: next[1], length: len, seg: i - 1 };
    desk.add(mesh);
    inkSegs.push(mesh);
    const slices = Math.max(1, Math.ceil(len / 0.008));
    for (let s = 0; s < slices; s++) {
      const t = (s + 0.5) / slices;
      strokeSamples.push({
        seg: i - 1,
        x: prev[0] + dx * t,
        z: prev[1] + dz * t,
        on: false,
      });
    }
  }
  const writingMap = makeInkWritingMap(RUB_WRITING);
  const writingMat = (mats.sumi || lacquer).clone();
  writingMat.transparent = true;
  writingMat.opacity = 0;
  writingMat.depthWrite = false;
  if (writingMap) {
    writingMat.map = writingMap;
    writingMat.color.setHex(0xffffff);
  }
  const writing = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.07), writingMat);
  writing.rotation.x = -Math.PI / 2;
  writing.position.set(0, PAPER_Y + .004, 0);
  writing.renderOrder = 5;
  writing.visible = false;
  writing.name = 'inkWriting';
  desk.add(writing);

  // ---- Rub stone (탁본) — peeks from paper corner before full reveal ----
  const rubGroup = new THREE.Group();
  rubGroup.position.set(0.42, 0.445, 0.18);
  desk.add(rubGroup);
  const rubStone = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.035, 0.14),
    mats.woodAccent.clone(),
  );
  rubStone.castShadow = true;
  rubStone.userData = { id: 'RUB', kind: 'rub' };
  rubGroup.add(rubStone);
  // Stone face
  rubGroup.add(boxMesh(THREE, 0.08, 0.01, 0.1, mats.iron || woodDark, 0, 0.02, 0));
  const rubHit = invisibleHit(THREE, 0.16, 0.1, 0.2, { id: 'RUB', kind: 'rub' });
  rubGroup.add(rubHit);
  interactives.push(rubHit, rubStone);

  function setRubPeek(mode) {
    // 'hidden' | 'peek' | 'ready'
    if (mode === 'hidden') {
      rubGroup.visible = true;
      rubGroup.scale.set(0.55, 0.55, 0.55);
      rubGroup.position.set(0.48, 0.42, 0.28);
      rubStone.rotation.z = 0.35;
      // mostly under desk lip — corner peek
    } else if (mode === 'peek') {
      rubGroup.visible = true;
      rubGroup.scale.set(0.7, 0.7, 0.7);
      rubGroup.position.set(0.44, 0.445, 0.22);
      rubStone.rotation.z = 0.2;
    } else {
      rubGroup.visible = true;
      rubGroup.scale.set(1, 1, 1);
      rubGroup.position.set(0.36, RUB_Y, 0.12);
      rubStone.rotation.z = 0;
    }
  }

  // ---- Ink compartment (묵함) — QA Minor: lift contrast vs lacquer desk ----
  const inkBox = new THREE.Group();
  inkBox.position.set(0, 0.205, 0.12);
  inkBox.visible = true;
  desk.add(inkBox); inkBox.name = 'InkDrawer';
  const drawerFace = bevelBoxMesh(THREE,.445,.165,.016,lacquer,0,.015,.198); drawerFace.name='InkDrawerFront';inkBox.add(drawerFace);
  const inlay=addNacreSpray(THREE,inkBox,art.nacre,0,0,.207,.33);if(inlay)inlay.scale.y=.5;
  const inkBodyMat = woodDark.clone();
  inkBodyMat.color.setHex(0xa07848);
  inkBodyMat.emissive.setHex(0x3a2818);
  inkBodyMat.emissiveIntensity = 0.28;
  const inkLidMat = (lacquer).clone();
  inkLidMat.emissive.setHex(0x1a3040);
  inkLidMat.emissiveIntensity = 0.22;
  inkLidMat.roughness = 0.35;
  inkBox.add(boxMesh(THREE, 0.38, 0.09, 0.28, inkBodyMat, 0, 0, 0));
  inkBox.add(boxMesh(THREE, 0.4, 0.02, 0.3, inkLidMat, 0, 0.05, 0));
  // Brass rim lip for silhouette against black lacquer
  inkBox.add(boxMesh(THREE, 0.41, 0.008, 0.31, brassBright || brass, 0, 0.055, 0));
  const inkWellMat = mats.bangBlack.clone();
  inkWellMat.emissive.setHex(0x222222);
  inkWellMat.emissiveIntensity = 0.15;
  const inkWell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.05, 0.055, 16),
    inkWellMat,
  );
  inkWell.position.set(-0.08, 0.07, 0);
  inkBox.add(inkWell);
  // Letter / 밀서 — brighter paper for readout
  const letterMat = art.paper.clone();
  letterMat.emissive.setHex(0x404030);
  letterMat.emissiveIntensity = 0.2;
  letterMat.color.setHex(0xf5f0e0);
  const letter = boxMesh(THREE, 0.2, 0.008, 0.14, letterMat, 0.1, 0.06, 0.02);
  inkBox.add(letter);
  const letterCopyMat = writingMat.clone();
  if (writingMap) letterCopyMat.map = writingMap;
  letterCopyMat.opacity = 1;
  const letterCopy = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.045), letterCopyMat);
  letterCopy.rotation.x = -Math.PI / 2;
  letterCopy.position.set(0.1, 0.07, 0.02);
  letterCopy.name = 'inkReplica';
  inkBox.add(letterCopy);
  // Seal stamp
  inkBox.add(boxMesh(THREE, 0.04, 0.025, 0.04, brassBright || brass, 0.1, 0.075, -0.05));

  // ---- Visual state ----
  function applyRotations() {
    pieces.forEach((p,i)=>{
      p.group.rotation.y=rotations[i]*Math.PI/2;
      p.tile.material.emissive.setHex(0x152018);p.tile.material.emissiveIntensity=.12;
      p.tile.material.color.setHex(0xc4d1c8);p.tile.material.roughness=.28;
      p.sheen.material.emissiveIntensity=.12;p.sheen.material.opacity=.38;
      p.tip.material.emissiveIntensity=.15;
    });
  }

  function correctCount() {
    return rotations.filter((r, i) => r === NACRE_TARGET[i]).length;
  }

  function checkNacre() {
    return rotations.every((r, i) => r === NACRE_TARGET[i]);
  }

  function softFailShake() {
    if (shake) shake(desk, 0.03, 360);
    else {
      const bx = desk.position.x;
      desk.position.x = bx + 0.025;
      art.later(() => { desk.position.x = bx; }, 80);
    }
  }

  function revealPartialHint() {
    if (api.setOrderHint) api.setOrderHint(HINT_PARTIAL);
    else if (api.orderHintEl) api.orderHintEl.innerHTML = HINT_PARTIAL;
  }

  function revealFullHint() {
    if (api.setOrderHint) api.setOrderHint(HINT_FULL);
    else if (api.orderHintEl) api.orderHintEl.innerHTML = HINT_FULL;
  }

  function onSoftFail() {
    softFailCount++;badClicks=0;softFailShake();api.playWrong();api.vibrate([25,20,25]);
    api.toast('조각들이 아직 하나의 문양을 이루지 못합니다.');
  }

  function clearRubbingPanel(immediate=false) {
    const move=(object,to)=>immediate?object.position.copy(to):animateVec3(object.position,to,350,null,'outCubic');
    // Matched petals slide on the lacquer deck; the lamp moves to its side rest.
    pieces.forEach((piece,i)=>move(piece.group,new THREE.Vector3(slotPos[i][0]*1.9,.437,slotPos[i][1]*2.15)));
    move(lampGroup,new THREE.Vector3(-.43,.417,-.18));
  }

  function enterPaperPhase() {
    phase = STATE.PAPER;
    clearRubbingPanel();
    setGhostVisible(true, false);
    setRubPeek('peek');
    api.setObjective('한지를 흑칠 문양 위에 올려 탁본을 준비하시오.');
    api.setSteps('B', ['A']);
    if (api.playNacreChime) api.playNacreChime();
    api.playUnlock();
    api.vibrate([30, 20, 50, 20, 40]);
    api.toast('자개가 영롱히 맞춰졌습니다. 한지를 올리시오.', true);
  }

  function onPaper() {
    if (phase === STATE.NACRE) {
      api.toast('먼저 네 자개를 달빛(등잔) 쪽으로 맞추시오.');
      return;
    }
    if (phase !== STATE.PAPER) {
      if (phase === STATE.RUB) api.toast('한지는 이미 올렸습니다. 탁본석으로 문지르시오.');
      return;
    }
    if (paperPlaced) return;
    paperPlaced = true;
    // Move sheet from stack onto panel
    placedSheet.visible = true;
    placedSheet.position.set(paperGroup.position.x, 0.5, paperGroup.position.z);
    animateVec3(placedSheet.position, new THREE.Vector3(0, PAPER_Y, 0), 500, () => {
      setRubPeek('ready');
      phase = STATE.RUB;
      inkSegs.forEach((m) => { m.visible = true; });
      writing.visible = true;
      api.setObjective('탁본석으로 한지의 먹선을 따라 문지르시오.');
      api.toast('한지를 올렸습니다. 먹선을 따라 문지르시오.', true);
    }, 'outCubic');
    paperStack.position.y = -0.008;
    if (api.playRubPaper) api.playRubPaper();
    else api.playThunk();
    api.vibrate(25);
  }

  function distToSeg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    if (l2 < 1e-10) return Math.hypot(px - ax, pz - az);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
  }

  function refreshInk() {
    const onCount = strokeSamples.reduce((n, s) => n + (s.on ? 1 : 0), 0);
    coveredLength = strokeSamples.length ? (onCount / strokeSamples.length) * STROKE_LEN : 0;
    rubProgress = STROKE_LEN > 0 ? coveredLength / STROKE_LEN : 0;
    inkSegs.forEach((mesh) => {
      const mine = strokeSamples.filter((s) => s.seg === mesh.userData.seg);
      const frac = mine.length ? mine.reduce((n, s) => n + (s.on ? 1 : 0), 0) / mine.length : 0;
      mesh.material.opacity = 0.38 + 0.57 * frac;
    });
    const show = rubProgress >= RUB_COVERAGE;
    writing.material.opacity = show ? 0.94 : 0;
    if (show && !writingNoted) {
      writingNoted = true;
      if (api.recordEvidence) api.recordEvidence('ch2-letter');
    }
  }

  function stampTravel(x0, z0, x1, z1) {
    let changed = false;
    for (const s of strokeSamples) {
      if (s.on) continue;
      if (distToSeg(s.x, s.z, x0, z0, x1, z1) <= RUB_BRUSH) {
        s.on = true;
        changed = true;
      }
    }
    if (changed) refreshInk();
  }

  function coverAll() {
    strokeSamples.forEach((s) => { s.on = true; });
    refreshInk();
  }

  function finishRub() {
    if (phase === STATE.FINALE) return;
    if (rubProgress < RUB_COVERAGE) return;
    phase = STATE.FINALE;
    setRubPeek('ready');
    api.setSteps('C', ['A', 'B']);
    api.setObjective('묵함과 밀서를 확인하시오.');
    openInkCompartment();
  }

  function onRub() {
    if (phase === STATE.NACRE) {
      api.toast('먼저 자개 문양을 맞추시오.');
      return;
    }
    if (phase === STATE.PAPER) {
      api.toast('먼저 한지를 문양 위에 올리시오. (종이 더미를 클릭)');
      setRubPeek('peek');
      return;
    }
    if (phase !== STATE.RUB) return;
    api.toast('탁본석을 먹선 따라 문지르시오.');
  }

  function openInkCompartment() {
    inkBox.visible = true;
    if (api.playDrawerRumble) api.playDrawerRumble();
    else api.playThunk();
    api.vibrate([40, 30, 50, 30, 70, 40, 90]);
    animateVec3(inkBox.position, new THREE.Vector3(0, 0.205, 0.43), 850, () => {
      api.playUnlock();
      api.vibrate([50, 40, 80]);
      api.showFinale({
        title: '묵함 · 선비의 밀서',
        body: `흑칠 아래 탁본에 드러난 글씨 — 「${RUB_WRITING}」.<br /><br />묵함 속 쪽지: 동궁 서고의 세 번째 궤를 찾으라. 선비가 남긴 밀서는 어보를 닮은 함이 지키는 다음 봉인을 가리킨다. 나전의 영롱함은 달빛이 아니라, 뜻을 향한 방향이었노라.`,
        footer: '— 사천장 비기 · 나전흑칠 연상',
        epilogue: '제2장 나전흑칠 연상 — 해제 완료',
      });
      api.toast('묵함이 열렸습니다. 밀서를 읽으시오.', true);
      api.markCleared(id);
    }, 'outCubic');
  }

  applyRotations();
  setRubPeek('hidden');

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives,
    build(scene) {
      scene.add(root);
      if (api.setCh2Lighting) api.setCh2Lighting(true);
    },
    start() { this.reset(); },
    reset() {
      art.clearTimers();
      phase = STATE.NACRE;
      rotations = [2, 0, 3, 1]; // Every tile requires observation and rotation.
      rubProgress = 0;
      coveredLength = 0;
      paperPlaced = false;
      hintLevel = 0;
      writingNoted = false;
      softFailCount = 0;
      badClicks = 0;
      strokeSamples.forEach((s) => { s.on = false; });
      refreshInk();
      setCraftEye(false);
      if (craftEyeTimer) { clearTimeout(craftEyeTimer); craftEyeTimer = null; }
      setGhostVisible(false);
      applyRotations();
      setRubPeek('hidden');
      placedSheet.visible = false;
      placedSheet.position.set(0, 0.44, 0);
      inkSegs.forEach((m) => { m.visible = false; });
      writing.visible = false;
      writing.material.opacity = 0;
      paperStack.position.y = 0;
      inkBox.visible = true;
      inkBox.position.set(0, 0.205, 0.12);
      desk.position.x = 0;
      lampLight.intensity = 0.7;
      lampGroup.position.set(0,.435,0);
      pieces.forEach((piece,i)=>piece.group.position.set(slotPos[i][0],.437,slotPos[i][1]));
      api.setObjective('자개와 놋쇠가 이루는 문양을 살피시오.');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      api.toast('나전흑칠 연상 — 빛이 모이는 곳을 살피시오.', true);
    },
    handleInteract(kind, iid, userData) {
      if (phase === STATE.FINALE) return;
      if (kind === 'nacre') {
        const idx = (userData && userData.index != null)
          ? userData.index
          : LABELS.indexOf(iid);
        if (idx >= 0) api.toast('자개 가장자리를 잡고 문양을 돌려 보시오.');
      } else if (kind === 'paper') onPaper();
      else if (kind === 'rub') onRub();
    },
    onHover(kind,iid) {
      if(phase!==STATE.NACRE)return;
      const index=typeof iid==='number'?iid:LABELS.indexOf(iid);
      pieces.forEach((p,i)=>{p.tile.material.emissiveIntensity=kind==='nacre'&&index===i?.2:.12;});
    },
    toggleCraftEye,
    revealHint() {
      hintLevel=Math.min(3,hintLevel+1);
      const message=hintLevel===1?'놋쇠 끝과 가운데 등잔 아래 흔적을 비교하시오.':hintLevel===2?HINT_PARTIAL:HINT_FULL;
      api.setOrderHint?.(message);api.toast(message,true);api.playClick();
    },
    get mistook() { return softFailCount > 0; },
    solve() {
      rotations = NACRE_TARGET.slice();
      applyRotations();
      enterPaperPhase();
      clearRubbingPanel(true);
      paperPlaced = true;
      placedSheet.visible = true;
      placedSheet.position.set(0, PAPER_Y, 0);
      setRubPeek('ready');
      phase = STATE.RUB;
      inkSegs.forEach((m) => { m.visible = true; });
      writing.visible = true;
      coverAll();
      finishRub();
    },
    getGestureFrame(kind,iid,hit) {
      root.updateMatrixWorld(true);
      if(kind==='rub'){
        const q=rubGroup.parent.getWorldQuaternion(new THREE.Quaternion());
        const direction=v=>new THREE.Vector3(...v).applyQuaternion(q).toArray();
        return {type:'plane',origin:rubGroup.getWorldPosition(new THREE.Vector3()).toArray(),axis:direction([0,1,0]),xAxis:direction([1,0,0]),zAxis:direction([0,0,1])};
      }
      if(kind!=='nacre')return null;
      const index=hit?.index??LABELS.indexOf(iid),p=pieces[index];if(!p)return null;
      root.updateMatrixWorld(true);
      return {type:'rotate',origin:p.group.getWorldPosition(new THREE.Vector3()).toArray(),axis:new THREE.Vector3(0,1,0).applyQuaternion(p.group.parent.getWorldQuaternion(new THREE.Quaternion())).toArray()};
    },
    getDragInteraction(kind,iid,hit) {
      if(kind==='nacre'&&phase===STATE.NACRE){
        const index=hit?.index??LABELS.indexOf(iid),p=pieces[index];if(!p)return null;
        const start=rotations[index],angle=start*Math.PI/2;let value=angle;
        return {
          move(sample){value=angle+(sample.turn||0);p.group.rotation.y=value;},
          end(){
            const stop=Math.round(value/(Math.PI/2));
            if(Math.abs(value-stop*Math.PI/2)>.18){p.group.rotation.y=angle;api.playNacreClick?.();return;}
            rotations[index]=THREE.MathUtils.euclideanModulo(stop,4);applyRotations();api.playNacreClick?.();
            if(checkNacre())enterPaperPhase();else{badClicks++;if(badClicks>=SOFT_FAIL_AFTER)onSoftFail();}
          },
          cancel(){rotations[index]=start;p.group.rotation.y=angle;},
        };
      }
      if (phase !== STATE.RUB || kind !== 'rub') return null;
      const originX = rubGroup.position.x;
      const originZ = rubGroup.position.z;
      let lastX = originX;
      let lastZ = originZ;
      return {
        start() {
          lastX = rubGroup.position.x;
          lastZ = rubGroup.position.z;
        },
        // s.dx, s.dy are world X and Z from the press point, same units as RUB_STROKE.
        move(s) {
          const x = Math.max(-0.55, Math.min(0.55, originX + (s.dx || 0)));
          const z = Math.max(-0.4, Math.min(0.4, originZ + (s.dy || 0)));
          stampTravel(lastX, lastZ, x, z);
          lastX = x;
          lastZ = z;
          rubGroup.position.x = x;
          rubGroup.position.z = z;
          const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          if (now - rubSoundAt > 140) {
            rubSoundAt = now;
            if (api.playRubPaper) api.playRubPaper();
            else api.playThunk();
            api.vibrate(16);
          }
        },
        end() { finishRub(); },
        cancel() {
          rubGroup.position.x = originX;
          rubGroup.position.z = originZ;
        },
      };
    },
    getState() {
      return {
        phase,
        rubProgress,
        coveredLength,
        strokeLength: STROKE_LEN,
        markLength: inkSegs.reduce((n, m) => n + m.userData.length, 0),
        coverage: RUB_COVERAGE,
        writingOpacity: writing.material.opacity,
        inkOpacity: inkSegs.map((m) => m.material.opacity),
        stone: { x: rubGroup.position.x, z: rubGroup.position.z },
        stroke: RUB_STROKE.map((p) => [p[0], p[1]]),
        hintLevel,
        writing: RUB_WRITING,
        replicaMap: letterCopy.material.map === writing.material.map,
        nacreYaw: pieces.map((p) => p.group.rotation.y),
        rotations:[...rotations],
        inkDrawerPosition: inkBox.position.toArray(),
        rubbingSurfaceY: PAPER_Y + .003,
        rubbingContactGap: rubGroup.position.y - .0175 - (placedSheet.position.y + .003),
        nacreGlow:pieces.map(p=>p.tile.material.emissiveIntensity),
      };
    },
    getStrokeMeshes() { return inkSegs; },
    dispose(scene) {
      if (craftEyeTimer) clearTimeout(craftEyeTimer);
      setCraftEye(false);
      if (api.setCh2Lighting) api.setCh2Lighting(false);
      scene.remove(root);
      art.dispose(root);
      interactives.length = 0;
    },
  };
}
