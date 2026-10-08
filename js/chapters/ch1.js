/**
 * Chapter 1 — 반닫이 (기준작 / sensory flagship)
 * 사개맞춤 FL→FR→BL → 놋쇠 핀 → 들쇠(길게) → 놋쇠 빗장 → 비밀 서랍
 * + 장인의 안목 teaser (faint carve / stress lines)
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { boxMesh, bevelBoxMesh, invisibleHit } from '../materials.js';

import { createOpeningArt } from './opening-art.js';

const BANDAJI_GLB = './assets/ch1/bandaji.glb';

export const id = 1;
export const title = '반닫이';
export const blurb = '사개맞춤·놋쇠 핀·들쇠·빗장으로 비밀 서랍을 여시오.';
export const steps = [
  { id: 'A', label: '짜맞춤' },
  { id: 'B', label: '들쇠' },
  { id: 'C', label: '빗장' },
  { id: 'D', label: '비밀' },
];
/** Non-spoiler footer; full order via hint button / after first mistake */
export const hint = '모서리 장부의 결을 살피시오. · 장인의 안목으로 흔적을 볼 수 있소.';
export const HINT_FULL = '사개맞춤 순서: ①좌전 → ②우전 → ③좌후 · 그다음 경첩 핀';
export const JOINERY_ORDER = ['FL', 'FR', 'BL'];
export const HANDLE_HOLD_MS = 420;
const HANDLE_SNAP_Z = -Math.PI / 2;
const HANDLE_ENGAGE_Z = -Math.PI / 2 * 0.42;

function ch1ReducedMotion() {
  try {
    return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch { return false; }
}

const STATE = {
  JOINERY: 'joinery',
  PIN: 'pin',
  HANDLE: 'handle',
  LATCH: 'latch',
  OPENING: 'opening',
  FINALE: 'finale',
};

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake, recoil } = api;
  const root = new THREE.Group();
  root.name = 'ch1_bandaji';
  root.userData.visualReady = false;
  const art = createOpeningArt(THREE, mats);

  let phase = STATE.JOINERY;
  let joineryProgress = [];
  let joineryDone = new Set();
  let pinNudged = false;
  let handleRotated = false;
  let latchOpen = false;
  let gltfLatchBar = null;
  let lidOpen = false;
  let mistookOnce = false;
  let hintLevel = 0;
  let craftEyeOn = false;
  let craftEyeTimer = null;
  let hoverId = null;
  let handleHoldActive = false;
  let handleDragRot0 = 0;
  let handlePress = 0; // 0..1 press depth
  let letterTaken = false;
  let keyTaken = false;
  let drawerOpenAmt = 0; // 0 closed .. 1 open
  let lootReady = false;
  let letterMesh = null;
  let keyMesh = null;
  let letterHit = null;
  let keyHit = null;

  const interactives = [];
  const joineryMeshes = {};
  const craftOverlays = [];
  const highlightables = []; // { mesh, baseEmissive, baseIntensity }
  let disposed = false;
  let gltfRoot = null;

  const BODY_W = 1.4;
  const BODY_H = 0.72;
  const BODY_D = 0.72;
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);
  bodyGroup.position.y = 0.06; // sit on gallery plinth
  // ---- Museum gallery shell (Korea Furniture Museum tone: warm wood hero, low-glare room) ----
  const gallery = new THREE.Group();
  gallery.name = 'Ch1Gallery';
  root.add(gallery);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x3a3228, roughness: 0.78, metalness: 0.02,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2c2620, roughness: 0.9, metalness: 0.0,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x4a4034, roughness: 0.68, metalness: 0.05,
  });
  const windowGlow = new THREE.MeshStandardMaterial({
    color: 0xffe2b8, emissive: 0xffc878, emissiveIntensity: 0.35,
    roughness: 1, metalness: 0, transparent: true, opacity: 0.55,
  });
  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.002, 0);
  floor.receiveShadow = true;
  gallery.add(floor);
  // Soft wood plinth under bandaji
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 1.35), trimMat);
  plinth.position.set(0, 0.03, 0.05);
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  gallery.add(plinth);
  // Back wall
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.2), wallMat);
  backWall.position.set(0, 2.0, -2.4);
  gallery.add(backWall);
  // Side walls (open front for camera)
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 4.2), wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-2.6, 2.0, -0.15);
  gallery.add(leftWall);
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 4.2), wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(2.6, 2.0, -0.15);
  gallery.add(rightWall);
  // Faint window panel on left (hanok-paper glow, not a bright rectangle)
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6), windowGlow);
  win.rotation.y = Math.PI / 2;
  win.position.set(-2.55, 1.55, 0.55);
  gallery.add(win);
  // Thin lattice hint (3 bars)
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.55, 0.02), trimMat);
    bar.position.set(-2.53, 1.55, 0.2 + i * 0.35);
    gallery.add(bar);
  }
  // Soft window fill light (low glare)
  // The gallery uses the same modest point fill in all renderer profiles.
  const winFill = new THREE.PointLight(0xffd8a8, 0.75, 8, 2);
  winFill.position.set(-2.0, 1.6, 0.5);
  gallery.add(winFill);
  // Dim ceiling bounce
  const ceilFill = new THREE.PointLight(0xffe8d0, 0.22, 10, 2);
  ceilFill.position.set(0.2, 3.1, 0.4);
  gallery.add(ceilFill);


  // ---- Denser chest body (planks + fittings) ----
  const woodMat = mats.sliceWood || mats.woodRich || mats.wood;
  const woodDark = mats.sliceWoodDark || mats.woodDark;
  const woodAcc = mats.sliceWood || mats.woodAccent;
  const brass = mats.sliceBrass || mats.brass;
  const brassB = mats.sliceBrassBright || mats.brassBright;
  const brassPinMat = mats.brassPin || brassB;
  const iron = mats.iron;

  // Main carcass
  const carcass = new THREE.Group(); carcass.name = 'BandajiHollowCarcass'; bodyGroup.add(carcass);
  const wall = .04;
  for (const side of [-1, 1]) carcass.add(bevelBoxMesh(THREE, wall, BODY_H, BODY_D, woodMat, side*(BODY_W-wall)/2, BODY_H/2, 0));
  carcass.add(bevelBoxMesh(THREE, BODY_W-2*wall, BODY_H, wall, woodDark, 0, BODY_H/2, -(BODY_D-wall)/2));
  carcass.add(bevelBoxMesh(THREE, BODY_W-2*wall, wall, BODY_D-wall, woodDark, 0, wall/2, wall/2));
  carcass.add(bevelBoxMesh(THREE, BODY_W+.02, .045, BODY_D+.02, woodDark, 0, BODY_H+.02, 0));
  carcass.traverse(mesh => { if (mesh.isMesh) mesh.userData.mechanicalDetail = true; });
  // Side planks (visual articulation)
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.03, BODY_H - 0.06, BODY_D - 0.08, woodDark,
      sx * (BODY_W / 2 - 0.01), BODY_H / 2, 0));
  });
  // Back panel inset
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.1, BODY_H - 0.1, 0.03, woodDark,
    0, BODY_H / 2, -BODY_D / 2 + 0.02));
  // Top rail / lid rim
  // Feet
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(boxMesh(THREE, 0.09, 0.07, 0.09, woodDark,
      sx * (BODY_W / 2 - 0.09), 0.035, sz * (BODY_D / 2 - 0.09)));
  });

  // Corner iron brackets
  function cornerBracket(x, y, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.add(boxMesh(THREE, 0.1, 0.015, 0.04, iron, 0.04, 0, 0));
    g.add(boxMesh(THREE, 0.04, 0.015, 0.1, iron, 0, 0, 0.04));
    // rivets
    for (let i = 0; i < 2; i++) {
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), brass);
      riv.position.set(0.02 + i * 0.04, 0.01, 0.01);
      g.add(riv);
    }
    bodyGroup.add(g);
  }
  cornerBracket(-BODY_W / 2 + 0.02, BODY_H * 0.25, BODY_D / 2 - 0.02, 0);
  cornerBracket(BODY_W / 2 - 0.02, BODY_H * 0.25, BODY_D / 2 - 0.02, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, BODY_H * 0.75, BODY_D / 2 - 0.02, 0);
  cornerBracket(BODY_W / 2 - 0.02, BODY_H * 0.75, BODY_D / 2 - 0.02, -Math.PI / 2);

  // Front drop panel (opens down)
  const frontPanel = new THREE.Group();
  frontPanel.position.set(0, 0.06, BODY_D / 2 + 0.01);
  bodyGroup.add(frontPanel);
  frontPanel.add(bevelBoxMesh(THREE, BODY_W - 0.08, BODY_H - 0.1, 0.04, woodAcc, 0, (BODY_H - 0.1) / 2, 0));
  // Horizontal planks on front
  [0.28, 0.42, 0.56].forEach((hy) => {
    frontPanel.add(boxMesh(THREE, BODY_W - 0.18, 0.018, 0.048, woodDark, 0, BODY_H * hy, 0.006));
  });
  // Brass face plate ornament
  frontPanel.add(boxMesh(THREE, 0.22, 0.12, 0.015, brass, -0.35, BODY_H * 0.4, 0.025));
  frontPanel.add(boxMesh(THREE, 0.22, 0.12, 0.015, brass, 0.35, BODY_H * 0.4, 0.025));

  // Hinges (left & right on front)
  function makeHinge(x) {
    const hg = new THREE.Group();
    hg.position.set(x, 0, 0);
    hg.add(boxMesh(THREE, 0.06, 0.02, 0.04, iron, 0, 0, 0));
    const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 10), brassB);
    knuckle.rotation.z = Math.PI / 2;
    knuckle.position.set(0, 0, 0);
    hg.add(knuckle);
    frontPanel.add(hg);
    return hg;
  }
  makeHinge(-BODY_W / 2 + 0.18);
  makeHinge(BODY_W / 2 - 0.18);

  // Oil lamp (warm emissive) — cheap bloom substitute
  const lamp = new THREE.Group();
  lamp.position.set(-0.95, 0.95, 0.35);
  root.add(lamp);
  lamp.add(boxMesh(THREE, 0.08, 0.12, 0.08, iron, 0, 0, 0));
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mats.lampFlame || mats.beam);
  flame.position.set(0, 0.1, 0);
  lamp.add(flame);
  const lampLight = new THREE.PointLight(0xffc878, 0.85, 4.5, 2);
  lampLight.position.set(0, 0.12, 0);
  lamp.add(lampLight);

  // ---- Craft-eye overlays (faint carve / stress lines) ----
  function addCraftMark(parent, w, h, d, x, y, z, rot = [0, 0, 0]) {
    const mat = (mats.craftMark || mats.beam).clone();
    mat.emissiveIntensity = 0;
    mat.opacity = 0;
    mat.transparent = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rot[0], rot[1], rot[2]);
    m.renderOrder = 2;
    parent.add(m);
    craftOverlays.push(m);
    return m;
  }
  // Grain stress lines near joinery corners
  addCraftMark(bodyGroup, 0.02, 0.18, 0.01, -BODY_W / 2 + 0.04, BODY_H * 0.72, BODY_D / 2 + 0.03);
  addCraftMark(bodyGroup, 0.02, 0.18, 0.01, BODY_W / 2 - 0.04, BODY_H * 0.72, BODY_D / 2 + 0.03);
  addCraftMark(bodyGroup, 0.02, 0.18, 0.01, -BODY_W / 2 - 0.02, BODY_H * 0.7, BODY_D * 0.18);
  // Arrow-ish carve near FL (craft hint without spoiling full order)
  addCraftMark(frontPanel, 0.08, 0.01, 0.008, -0.45, BODY_H * 0.68, 0.03, [0, 0, -0.4]);
  addCraftMark(frontPanel, 0.08, 0.01, 0.008, 0.45, BODY_H * 0.68, 0.03, [0, 0, 0.4]);
  // Pin location mark
  addCraftMark(bodyGroup, 0.04, 0.04, 0.01, BODY_W / 2 + 0.02, BODY_H * 0.55, 0.15);

  function setCraftEye(on) {
    craftEyeOn = on;
    craftOverlays.forEach((m) => {
      m.material.opacity = on ? 0.55 : 0;
      m.material.emissiveIntensity = on ? 0.85 : 0;
    });
  }

  function toggleCraftEye() {
    if (craftEyeTimer) {
      clearTimeout(craftEyeTimer);
      craftEyeTimer = null;
    }
    setCraftEye(true);
    api.playClick();
    api.vibrate([20, 30, 20]);
    api.toast('장인의 안목 — 결구의 흔적이 희미히 드러납니다.', true);
    craftEyeTimer = art.later(() => {
      setCraftEye(false);
      craftEyeTimer = null;
    }, 2800);
  }

  // ---- Joinery pegs ----
  function trackHighlight(mesh) {
    if (!mesh.material || !mesh.material.emissive) return;
    highlightables.push({
      mesh,
      baseEmissive: mesh.material.emissive.clone(),
      baseIntensity: mesh.material.emissiveIntensity || 0,
    });
  }

  function makeJoinery(jid, x, y, z, label) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const peg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), woodAcc.clone());
    peg.material.emissive = new THREE.Color(0x5a3810);
    peg.material.emissiveIntensity = 0.45;
    peg.castShadow = true;
    peg.userData = { id: jid, kind: 'joinery', label };
    group.add(peg);
    trackHighlight(peg);
    // Mortise collar
    group.add(boxMesh(THREE, 0.12, 0.12, 0.02, woodDark, 0, 0, -0.04));
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.07), woodDark);
    tongue.position.set(0, 0, 0.065);
    group.add(tongue);
    // Tiny brass washer
    const wash = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 12), brassB);
    wash.rotation.x = Math.PI / 2;
    wash.position.set(0, 0, 0.05);
    group.add(wash);
    const hit = invisibleHit(THREE, 0.22, 0.22, 0.22, { id: jid, kind: 'joinery', label });
    group.add(hit);
    bodyGroup.add(group);
    interactives.push(hit, peg);
    const stop = bevelBoxMesh(THREE,.075,.015,.018,brass,x,y-.07,z+.04);
    stop.userData.mechanicalDetail = true;
    bodyGroup.add(stop);
    joineryMeshes[jid] = { group, peg, stop, basePos: group.position.clone(), pushed: false };
  }

  makeJoinery('FL', -BODY_W / 2 + 0.06, BODY_H * 0.72, BODY_D / 2 + 0.02, '좌전');
  makeJoinery('FR', BODY_W / 2 - 0.06, BODY_H * 0.72, BODY_D / 2 + 0.02, '우전');
  makeJoinery('BL', -BODY_W / 2 - 0.06, BODY_H * 0.7, BODY_D * 0.18, '좌후');

  function setJoineryHighlight(jid, on) {
    const j = joineryMeshes[jid];
    if (!j) return;
    j.peg.material.emissive = new THREE.Color(on ? 0x6a4018 : 0x2a1808);
    j.peg.material.emissiveIntensity = on ? 0.85 : 0.45;
    tintGltfPeg(jid, on ? 0x6a4018 : 0x2a1808, on ? 0.85 : 0.45);
  }

  // ---- Brass pin / hinge catch (extra beat after joinery) ----
  const pinGroup = new THREE.Group();
  pinGroup.position.set(BODY_W / 2 + 0.055, BODY_H * 0.48, BODY_D / 2 - 0.06);
  bodyGroup.add(pinGroup);
  const pinPlate = boxMesh(THREE, 0.04, 0.1, 0.02, brass, 0, 0, 0);
  pinGroup.add(pinPlate);
  pinGroup.add(bevelBoxMesh(THREE, .065, .055, .055, iron, -.032, 0, 0));
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 10), brassPinMat.clone());
  pin.position.set(0.02, 0.02, 0.02);
  pin.castShadow = true;
  pin.userData = { id: 'PIN', kind: 'pin' };
  pinGroup.add(pin);
  trackHighlight(pin);
  const pinHit = invisibleHit(THREE, 0.12, 0.14, 0.1, { id: 'PIN', kind: 'pin' }, 0.02, 0, 0.02);
  pin.add(pinHit); pinHit.position.set(0, -0.02, 0);
  interactives.push(pinHit, pin);
  pinGroup.visible = false;
  pinGroup.scale.set(1, 1, 1);

  // ---- Side handle (들쇠) — requires hold ----
  const handlePivot = new THREE.Group();
  handlePivot.position.set(BODY_W / 2 + 0.01, BODY_H * 0.42, 0.1);
  bodyGroup.add(handlePivot);
  const handleMount = boxMesh(THREE, 0.03, 0.08, 0.05, iron, -0.02, 0, 0);
  const handleSocket = new THREE.Group(); handleSocket.name = 'HandleFixedSocket';
  handleSocket.position.copy(handlePivot.position); bodyGroup.add(handleSocket); handleSocket.add(handleMount);
  const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 12), iron);
  handleBar.rotation.z = Math.PI / 2;
  handleBar.castShadow = true;
  handleBar.userData = { id: 'HANDLE', kind: 'handle' };
  handlePivot.add(handleBar);
  const handleKnob = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), brassB.clone());
  handleKnob.position.set(0.13, 0, 0);
  handleKnob.castShadow = true;
  handleKnob.userData = { id: 'HANDLE', kind: 'handle' };
  handlePivot.add(handleKnob);
  trackHighlight(handleKnob);
  const handleHit = invisibleHit(THREE, 0.3, 0.14, 0.14, { id: 'HANDLE', kind: 'handle' }, 0.06, 0, 0);
  handlePivot.add(handleHit);
  interactives.push(handleHit, handleKnob, handleBar);
  handlePivot.scale.set(0.3, 0.3, 0.3);
  handlePivot.visible = false;

  // Hold progress ring (simple torus that scales)
  const holdRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.006, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0xd4a84b, transparent: true, opacity: 0 }),
  );
  holdRing.position.set(0.13, 0, 0);
  holdRing.rotation.y = Math.PI / 2;
  handlePivot.add(holdRing);

  // ---- Latch ----
  const latchGroup = new THREE.Group();
  latchGroup.position.set(0.35, BODY_H * 0.55, 0.03);
  frontPanel.add(latchGroup);
  const latchPlate = boxMesh(THREE, 0.2, 0.09, 0.02, brass, 0, 0, 0);
  latchPlate.userData = { id: 'LATCH', kind: 'latch' };
  latchGroup.add(latchPlate);
  const latchBar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.038, 0.038), brassB.clone());
  latchBar.position.set(0, 0, 0.03);
  latchBar.castShadow = true;
  latchBar.userData = { id: 'LATCH', kind: 'latch' };
  latchGroup.add(latchBar);
  trackHighlight(latchBar);
  // Keeper
  latchGroup.add(boxMesh(THREE, 0.04, 0.06, 0.03, iron, 0.1, 0, 0.01));
  const latchHit = invisibleHit(THREE, 0.24, 0.14, 0.12, { id: 'LATCH', kind: 'latch' });
  latchGroup.add(latchHit);
  interactives.push(latchHit, latchBar, latchPlate);

  // ---- Secret drawer ----
  const drawer = new THREE.Group();
  drawer.position.set(0, 0.18, -0.05);
  drawer.visible = false;
  bodyGroup.add(drawer);
      letterTaken = false;
      keyTaken = false;
      lootReady = false;
      drawerOpenAmt = 0;
      if (letterMesh) { letterMesh.visible = false; letterMesh.userData.taken = false; letterMesh.position.set(-0.12, 0.060, 0.02); }
      if (keyMesh) { keyMesh.visible = false; keyMesh.userData.taken = false; keyMesh.position.set(0.16, 0.064, 0.05); }
      applyHandlePress(0);
  drawer.add(boxMesh(THREE, 0.7, 0.11, 0.4, woodAcc, 0, 0, 0));
  drawer.add(boxMesh(THREE, 0.72, 0.11, 0.03, woodMat, 0, 0, 0.22));
  const drawerPull = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 16), brass);
  drawerPull.name = 'DrawerPullGrip';
  drawerPull.position.set(0, 0, 0.25);
  drawer.add(drawerPull);
  drawerPull.userData = {kind:'drawer',id:'DRAWER',mechanicalDetail:true};
  const drawerHit=invisibleHit(THREE,.24,.13,.12,{kind:'drawer',id:'DRAWER'},0,0,.25);
  drawer.add(drawerHit);
  interactives.push(drawerPull,drawerHit);
  // ---- Loot (letter + key): local to drawer; revealed by open ratio ----
  function makeLetter() {
    const g = new THREE.Group();
    g.name = 'LootLetter';
    const sheet = boxMesh(THREE, 0.22, 0.008, 0.16, mats.paper, 0, 0, 0);
    const fold = boxMesh(THREE, 0.22, 0.006, 0.04, mats.paper, 0, 0.006, -0.06);
    fold.material = fold.material.clone();
    fold.material.color.setHex(0xe8dcc8);
    g.add(sheet, fold);
    g.position.set(-0.12, 0.060, 0.02);
    g.visible = false;
    return g;
  }
  function makeKey() {
    const g = new THREE.Group();
    g.name = 'LootKey';
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), brassB.clone());
    shank.rotation.z = Math.PI / 2;
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 16), brass.clone());
    bow.position.x = -0.07;
    bow.rotation.x = Math.PI / 2;
    const bit = boxMesh(THREE, 0.03, 0.01, 0.016, brassB, 0.06, 0, -0.008);
    g.add(shank, bow, bit);
    g.position.set(0.16, 0.064, 0.05);
    g.rotation.y = 0.35;
    g.visible = false;
    return g;
  }
  letterMesh = makeLetter();
  keyMesh = makeKey();
  drawer.add(letterMesh, keyMesh);
  letterHit = invisibleHit(THREE, 0.26, 0.08, 0.2, { id: 'LETTER', kind: 'loot', loot: 'letter' }, 0, 0.02, 0);
  keyHit = invisibleHit(THREE, 0.16, 0.08, 0.12, { id: 'KEY', kind: 'loot', loot: 'key' }, 0, 0.02, 0);
  letterMesh.add(letterHit);
  keyMesh.add(keyHit);

  // ---- GLB visual (greybox groups/hits stay; surfaces hide after load) ----
  function reparentIdentity(node, dest) {
    if (!node || !dest) return false;
    dest.add(node);
    node.position.set(0, 0, 0);
    node.rotation.set(0, 0, 0);
    node.quaternion.identity();
    node.scale.set(1, 1, 1);
    return true;
  }


  function enhanceGltfMaterials(_root) {
    art.finishGltf(_root); // Retain the baked grain; only refine material response.
  }
  function markGltfTree(obj) {
    obj.traverse((c) => {
      c.userData.fromGltf = true;
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
  }

  function cloneMeshMaterials(obj) {
    if (!obj) return;
    obj.traverse((c) => {
      if (!c.isMesh || !c.material) return;
      (Array.isArray(c.material) ? c.material : [c.material]).forEach(art.keep);
      c.material = Array.isArray(c.material)
        ? c.material.map((m) => m.clone())
        : c.material.clone();
    });
  }

  /** Legacy Blender authoring swaps Y/Z; only add_cube used half-size dimensions. */
  function prepareBandajiGltf(scene) {
    const namedRoot = scene.getObjectByName('ch1_bandaji');
    if (namedRoot) namedRoot.rotation.set(0, 0, 0);

    scene.traverse((obj) => {
      if (obj === scene) return;
      obj.position.z *= -1;
      obj.quaternion.x *= -1;
      obj.quaternion.y *= -1;
    });

    const fullSizePrimitives = new Set(['PinShaft', 'HandleBar', 'HandleKnob', 'DrawerPull']);
    scene.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry) return;
      art.keep(obj.geometry);
      const geom = obj.geometry.clone();
      const pos = geom.attributes.position;
      if (pos) {
        for (let i = 0; i < pos.count; i++) pos.setZ(i, -pos.getZ(i));
        pos.needsUpdate = true;
      }
      geom.computeBoundingBox();
      const bb = geom.boundingBox;
      if (bb && !fullSizePrimitives.has(obj.name)) {
        const cx = (bb.min.x + bb.max.x) * 0.5;
        const cy = (bb.min.y + bb.max.y) * 0.5;
        const cz = (bb.min.z + bb.max.z) * 0.5;
        geom.translate(-cx, -cy, -cz);
        geom.scale(2, 2, 2);
        geom.translate(cx, cy, cz);
      }
      // A reflection reverses handedness. Restore outward winding before normals.
      if (geom.index) {
        const index = geom.index;
        for (let i=0; i<index.count; i+=3) { const b=index.getX(i+1); index.setX(i+1,index.getX(i+2)); index.setX(i+2,b); }
        index.needsUpdate = true;
      } else {
        for (const attr of Object.values(geom.attributes)) {
          for(let i=0;i<attr.count;i+=3) for(let k=0;k<attr.itemSize;k++) {
            const a=(i+1)*attr.itemSize+k,b=(i+2)*attr.itemSize+k,temp=attr.array[a];attr.array[a]=attr.array[b];attr.array[b]=temp;
          }
          attr.needsUpdate = true;
        }
      }
      if (geom.attributes.tangent) {
        const tangent=geom.attributes.tangent;
        for(let i=0;i<tangent.count;i++){tangent.setZ(i,-tangent.getZ(i));tangent.setW(i,-tangent.getW(i));}
        tangent.needsUpdate=true;
      }
      if (obj.name.startsWith('Hinge_')) { geom.computeBoundingBox(); const c=geom.boundingBox.getCenter(new THREE.Vector3());geom.translate(0,-c.y,-c.z); }
      geom.computeVertexNormals();
      geom.computeBoundingBox(); geom.computeBoundingSphere();
      obj.geometry = geom;
    });
  }

  function hideGreyboxSurfaces() {
    bodyGroup.traverse((child) => {
      if (!child.isMesh) return;
      if (child.userData.fromGltf || child.userData.mechanicalDetail) return;
      if (craftOverlays.includes(child)) return;
      if (child === holdRing) return;
      // Keep greybox latch — GLTF Latch/Bar drifts after axis bake
      let p = child.parent;
      while (p) {
        if (p === latchGroup || p === letterMesh || p === keyMesh) return;
        p = p.parent;
      }
      if (child.material && child.material.visible === false) return;
      const src = child.material;
      if (!src) return;
      if (Array.isArray(src)) {
        child.material = src.map((m) => {
          art.keep(m);
          const c = m.clone();
          c.visible = false;
          return c;
        });
      } else {
        art.keep(src);
        child.material = src.clone();
        child.material.visible = false;
      }
    });
  }

  function tintGltfPeg(jid, colorHex, intensity) {
    const gp = joineryMeshes[jid] && joineryMeshes[jid].gltfPeg;
    if (!gp || !gp.material || !gp.material.emissive) return;
    gp.material.emissive.setHex(colorHex);
    gp.material.emissiveIntensity = intensity;
  }

  /** Move an invisibleHit under a named GLTF host so picks follow separated parts. */
  function rebindHitToHost(hit, host, localPos) {
    if (!hit || !host) return false;
    host.add(hit);
    if (localPos) hit.position.copy(localPos);
    else hit.position.set(0, 0, 0);
    hit.rotation.set(0, 0, 0);
    hit.quaternion.identity();
    return true;
  }

  /** Tag GLTF meshes with the same userData as the greybox hit; push once into interactives. */
  function tagGltfInteractive(root, userData) {
    if (!root) return;
    root.traverse((c) => {
      if (!c.isMesh) return;
      Object.assign(c.userData, userData);
      if (!interactives.includes(c)) interactives.push(c);
      trackHighlight(c);
    });
  }

  function bindGltfVisual(scene) {
    prepareBandajiGltf(scene);
    markGltfTree(scene);
    enhanceGltfMaterials(scene);
    const take = (name) => scene.getObjectByName(name);
    const nFront = take('FrontPanel');
    const nFL = take('Joinery_FL');
    const nFR = take('Joinery_FR');
    const nBL = take('Joinery_BL');
    const nPin = take('Pin');
    const nPinShaft = take('PinShaft');
    const nHandle = take('Handle');
    const nHandleMount = take('HandleMount');
    const nLatch = take('Latch');
    const nLatchBar = take('LatchBar');
    const nDrawer = take('Drawer');
    const nPegFL = take('Peg_FL');
    const nPegFR = take('Peg_FR');
    const nPegBL = take('Peg_BL');

    bodyGroup.add(scene);
    gltfRoot = scene;
    // The legacy solid Body filled the drawer cavity; use the real panel shell.
    for (const name of ['Body','SidePlank_L','SidePlank_R','BackPanel','Bottom','TopRail','DrawerPull']) { const mesh=take(name);if(mesh)mesh.visible=false; }

        // Keep LatchBar under Latch (do not orphan onto greybox bar — caused floating latch)
    gltfLatchBar = nLatchBar || null;
    reparentIdentity(nLatch, latchGroup);
    if (nLatch) nLatch.visible = false; // show greybox latch instead
    if (gltfLatchBar) gltfLatchBar.visible = false;

    reparentIdentity(nPinShaft, pin);
    reparentIdentity(nPin, pinGroup);
    reparentIdentity(nFL, joineryMeshes.FL.group);
    reparentIdentity(nFR, joineryMeshes.FR.group);
    reparentIdentity(nBL, joineryMeshes.BL.group);
    reparentIdentity(nHandle, handlePivot);
    reparentIdentity(nHandleMount, handleSocket);
    reparentIdentity(nFront, frontPanel);
    reparentIdentity(nDrawer, drawer);

    // Rebind invisibleHits onto separated GLTF hosts (not fused mesh-only).
    const hitFL = joineryMeshes.FL.group.children.find((c) => c.userData?.kind === 'joinery' && c.material?.visible === false);
    const hitFR = joineryMeshes.FR.group.children.find((c) => c.userData?.kind === 'joinery' && c.material?.visible === false);
    const hitBL = joineryMeshes.BL.group.children.find((c) => c.userData?.kind === 'joinery' && c.material?.visible === false);
    rebindHitToHost(hitFL, nFL || joineryMeshes.FL.group);
    rebindHitToHost(hitFR, nFR || joineryMeshes.FR.group);
    rebindHitToHost(hitBL, nBL || joineryMeshes.BL.group);
    rebindHitToHost(pinHit, pin, new THREE.Vector3(0, -.02, 0));
    rebindHitToHost(handleHit, nHandle || handlePivot, new THREE.Vector3(.06, 0, 0));
    rebindHitToHost(latchHit, latchGroup);

    tagGltfInteractive(nFL, { id: 'FL', kind: 'joinery', label: '좌전' });
    tagGltfInteractive(nFR, { id: 'FR', kind: 'joinery', label: '우전' });
    tagGltfInteractive(nBL, { id: 'BL', kind: 'joinery', label: '좌후' });
    tagGltfInteractive(nPin, { id: 'PIN', kind: 'pin' });
    tagGltfInteractive(nHandle, { id: 'HANDLE', kind: 'handle' });
    tagGltfInteractive(nLatch, { id: 'LATCH', kind: 'latch' });

    if (nPegFL) {
      cloneMeshMaterials(nPegFL);
      joineryMeshes.FL.gltfPeg = nPegFL;
      trackHighlight(nPegFL);
    }
    if (nPegFR) {
      cloneMeshMaterials(nPegFR);
      joineryMeshes.FR.gltfPeg = nPegFR;
      trackHighlight(nPegFR);
    }
    if (nPegBL) {
      cloneMeshMaterials(nPegBL);
      joineryMeshes.BL.gltfPeg = nPegBL;
      trackHighlight(nPegBL);
    }

    hideGreyboxSurfaces();
    if (phase === STATE.JOINERY) highlightNextJoinery();
    root.userData.visualReady = true;
    root.dispatchEvent({type:'visual-ready'});
  }

  new GLTFLoader().load(
    BANDAJI_GLB,
    (gltf) => {
      if (disposed) { art.dispose(gltf.scene); return; }
      bindGltfVisual(gltf.scene);
    },
    undefined,
    (err) => {
      if (disposed) return;
      console.warn('[ch1] bandaji.glb failed to load; keeping greybox', err);
      root.userData.visualReady = true;
      root.dispatchEvent({type:'visual-ready'});
    },
  );

  // ---- Helpers ----
  function revealOrderHint() {
    if (api.setOrderHint) api.setOrderHint(HINT_FULL);
    else if (api.orderHintEl) api.orderHintEl.innerHTML = HINT_FULL;
  }

  function pushJoineryVisual(jid) {
    const j = joineryMeshes[jid];
    if (!j || j.pushed) return;
    j.pushed = true;
    const inward = jid === 'BL'
      ? new THREE.Vector3(j.basePos.x + 0.055, j.basePos.y, j.basePos.z + 0.05)
      : new THREE.Vector3(
        j.basePos.x + (jid === 'FL' ? 0.055 : -0.055),
        j.basePos.y,
        j.basePos.z - 0.055,
      );
    // Overshoot then settle (~SFX 420ms window)
    const over = inward.clone();
    if (jid === 'BL') over.z += 0.014;
    else {
      over.x += jid === 'FL' ? 0.012 : -0.012;
      over.z -= 0.01;
    }
    animateVec3(j.group.position, over, 300, () => {
      animateVec3(j.group.position, inward, 140, null, 'outCubic');
    }, 'outCubic');
    if (recoil) recoil(j.group, 'y', 0.01, 280);
    j.peg.material.color.setHex(0x7a9a6a);
    j.peg.material.emissiveIntensity = 0.4;
    if (j.gltfPeg && j.gltfPeg.material) {
      j.gltfPeg.material.color.setHex(0x7a9a6a);
      j.gltfPeg.material.emissiveIntensity = 0.4;
    }
  }

  function resetJoineryVisuals() {
    JOINERY_ORDER.forEach((jid) => {
      const j = joineryMeshes[jid];
      if (!j) return;
      j.pushed = false;
      j.group.position.copy(j.basePos);
      j.peg.material.color.setHex(0xc9a06a);
      j.peg.material.emissive.setHex(0x2a1808);
      j.peg.material.emissiveIntensity = 0.45;
      if (j.gltfPeg && j.gltfPeg.material) {
        j.gltfPeg.material.color.setHex(0xc9a06a);
        if (j.gltfPeg.material.emissive) j.gltfPeg.material.emissive.setHex(0x2a1808);
        j.gltfPeg.material.emissiveIntensity = 0.45;
      }
    });
  }

  function expectedJoinery() {
    return JOINERY_ORDER[joineryProgress.length];
  }

  function highlightNextJoinery() {
    JOINERY_ORDER.forEach(jid=>{
      setJoineryHighlight(jid,false);
      const j=joineryMeshes[jid];
      j.stop.position.y=j.basePos.y-((jid===expectedJoinery()||joineryDone.has(jid)) ? .105 : .070);
    });
  }

  function softFailShake() {
    if (shake) shake(bodyGroup, 0.048, 420);
    else {
      const bx = bodyGroup.position.x;
      bodyGroup.position.x = bx + 0.03;
      art.later(() => { bodyGroup.position.x = bx; }, 80);
    }
    if (recoil) recoil(bodyGroup, 'z', 0.012, 360);
  }

  const DRAWER_Z0 = -0.05;
  const DRAWER_Z1 = 0.55;

  function updateLootReveal() {
    const z = drawer.position.z;
    drawerOpenAmt = Math.max(0, Math.min(1, (z - DRAWER_Z0) / (DRAWER_Z1 - DRAWER_Z0)));
    const show = drawer.visible && drawerOpenAmt > 0.28;
    if (letterMesh) {
      letterMesh.visible = show && !letterTaken;
      letterMesh.position.y = 0.060;
    }
    if (keyMesh) {
      keyMesh.visible = show && !keyTaken;
      keyMesh.position.y = 0.064;
    }
    lootReady = drawer.visible && drawerOpenAmt > 0.72;
    const ensure = (mesh, hit, taken) => {
      if (!mesh || !hit) return;
      const idx = interactives.indexOf(hit);
      if (lootReady && !taken) {
        if (idx < 0) interactives.push(hit);
      } else if (idx >= 0) {
        interactives.splice(idx, 1);
      }
    };
    ensure(letterMesh, letterHit, letterTaken);
    ensure(keyMesh, keyHit, keyTaken);
  }

  function finishFinaleFromLetter() {
    phase = STATE.FINALE;
    api.playUnlock();
    api.vibrate([50, 40, 80, 40, 100]);
    api.setObjective('비밀 서랍과 세자의 편지를 확인하시오.');
    api.setSteps(null, ['A', 'B', 'C', 'D']);
    api.showFinale({
      title: '비밀 서랍 · 세자의 편지',
      body: '사천장에게.<br />이 함을 여는 자여, 짐은 이미 천명을 다하였으나 진실은 아직 봉인되어 있다. 동궁의 여섯 궤를 모두 열면 역모의 증거가 드러나리라. 네 가문이 대를 이어 지켜 온 결구의 비밀로, 이 나라의 어둠을 밝혀 다오.',
      footer: '— 세자 친필 · 사천장 가문 전래',
      epilogue: '제1장 반닫이 — 해제 완료',
    });
    api.toast('비밀이 드러났습니다.', true);
    api.markCleared(id);
  }

  function pickupLoot(which) {
    if (!lootReady) {
      api.toast('서랍을 더 연 뒤에 손을 넣으시오.');
      return;
    }
    const mesh = which === 'letter' ? letterMesh : keyMesh;
    if (!mesh || mesh.userData.taken) return;
    mesh.userData.taken = true;
    if (which === 'letter') letterTaken = true;
    else keyTaken = true;
    const start = mesh.position.clone();
    const mid = start.clone(); mid.z += 0.12;
    const up = mid.clone(); up.y += 0.18;
    if (api.playRubPaper) api.playRubPaper();
    else api.playThunk();
    api.vibrate([25, 20, 35]);
    animateVec3(mesh.position, mid, 280, () => {
      if (api.playBrassScrape && which === 'key') api.playBrassScrape();
      animateVec3(mesh.position, up, 360, () => {
        mesh.visible = false;
        if (which === 'letter') {
          api.toast('세자의 편지를 집어 들었습니다.', true);
          finishFinaleFromLetter();
        } else {
          api.toast('놋쇠 열쇠를 집어 들었습니다.', true);
          if (letterTaken) finishFinaleFromLetter();
          else api.setObjective('서랍 안의 편지를 집어 확인하시오.');
        }
        updateLootReveal();
      }, 'outCubic');
    }, 'outCubic');
  }

  function revealDrawer() {
    drawer.visible = true;
    letterTaken = false;
    keyTaken = false;
    if (letterMesh) { letterMesh.userData.taken = false; letterMesh.position.set(-0.12, 0.060, 0.02); }
    if (keyMesh) { keyMesh.userData.taken = false; keyMesh.position.set(0.16, 0.064, 0.05); }
    if (api.playDrawerRumble) api.playDrawerRumble();
    else api.playThunk();
    api.vibrate([40, 30, 50, 30, 70, 40, 90]);
    api.setObjective('풀린 서랍을 당겨 안쪽을 살피시오.');
    drawer.position.set(0,.18,DRAWER_Z0+.035);
    updateLootReveal();
  }

  function onJoinery(jid) {
    if (phase !== STATE.JOINERY) {
      api.toast('이미 짜맞춤은 체결되었습니다.');
      return;
    }
    if (joineryDone.has(jid)) {
      api.toast('이미 밀어 넣은 장부입니다.');
      return;
    }
    if (jid !== expectedJoinery()) {
      api.playWrong();
      api.vibrate([30, 40, 30, 40, 60]);
      softFailShake();
      joineryProgress = [];
      joineryDone.clear();
      resetJoineryVisuals();
      highlightNextJoinery();
      mistookOnce = true;
      api.toast('맞물린 다른 장부가 움직임을 막습니다.');
      return;
    }
    joineryProgress.push(jid);
    joineryDone.add(jid);
    pushJoineryVisual(jid);
    if (api.playJoinerySlide) api.playJoinerySlide();
    else api.playThunk();
    api.vibrate([25, 20, 45]);
    if (joineryProgress.length === JOINERY_ORDER.length) {
      phase = STATE.PIN;
      api.setObjective('오른쪽 경첩의 놋쇠 핀을 살짝 밀어 올리시오.');
      api.setSteps('B', ['A']);
      // Always re-anchor on right front hinge (QA: was floating upper-left)
      pinGroup.position.set(BODY_W / 2 + 0.055, BODY_H * 0.48, BODY_D / 2 - 0.06);
      pinGroup.rotation.set(0, 0, 0);
      pinGroup.scale.set(1, 1, 1);
      pinGroup.visible = true;
      pin.position.set(0.02, 0.02, 0.02);
      api.toast('짜맞춤이 풀렸습니다. 오른쪽 경첩의 놋쇠 핀을 살피시오.', true);
      api.playUnlock();
      api.vibrate([30, 20, 50, 20, 40]);
      JOINERY_ORDER.forEach((j) => setJoineryHighlight(j, false));
    } else {
      highlightNextJoinery();
      const labels = { FL: '좌전', FR: '우전', BL: '좌후' };
      api.toast(`${labels[jid]} 장부 체결 (${joineryProgress.length}/3)`, true);
    }
  }

  function onPin() {
    if (phase !== STATE.PIN) {
      if (phase === STATE.JOINERY) api.toast('먼저 사개맞춤(짜맞춤)을 모두 체결하시오.');
      return;
    }
    if (pinNudged) return;
    pinNudged = true;
    const pinEnd = new THREE.Vector3(0.02, 0.07, 0.02);
    const pinOver = new THREE.Vector3(0.02, 0.085, 0.02);
    animateVec3(pin.position, pinOver, 260, () => {
      animateVec3(pin.position, pinEnd, 140, null, 'outCubic');
    }, 'outCubic');
    if (recoil && pinGroup) recoil(pinGroup, 'x', 0.006, 220);
    if (api.playBrassScrape) api.playBrassScrape();
    else api.playClick();
    api.vibrate([35, 25, 55]);
    phase = STATE.HANDLE;
    handlePivot.visible = true;
    animateVec3(handlePivot.scale, new THREE.Vector3(1, 1, 1), 500, null, 'outBack');
    api.setObjective('드러난 들쇠의 회전축과 걸리는 자리를 살피시오.');
    api.toast('놋쇠 핀이 빠졌습니다. 들쇠가 드러났습니다.', true);
    api.playUnlock();
  }

  function applyHandlePress(t) {
    handlePress = Math.max(0, Math.min(1, t));
    const depth = handlePress * 0.018;
    handleKnob.position.x = 0.13 - depth;
    if (!handleRotated) handlePivot.scale.setScalar(1 - handlePress * 0.04);
  }

  function springHandleTo(z, ms, onDone) {
    animateTo(handlePivot.rotation, 'z', z, ms, () => {
      applyHandlePress(0);
      if (onDone) onDone();
    }, 'outCubic');
  }

  function completeHandle(fromDrag = false) {
    if (phase !== STATE.HANDLE || handleRotated) return;
    handleRotated = true;
    handleHoldActive = false;
    holdRing.material.opacity = 0;
    holdRing.scale.setScalar(1);
    applyHandlePress(0);
    const finish = () => {
      if (recoil) recoil(handlePivot, 'y', 0.008, 260);
      api.playUnlock();
      api.vibrate([40, 30, 60, 30, 50]);
    };
    if (fromDrag && Math.abs(handlePivot.rotation.z - HANDLE_SNAP_Z) < 0.08) {
      handlePivot.rotation.z = HANDLE_SNAP_Z;
      finish();
    } else {
      animateTo(handlePivot.rotation, 'z', HANDLE_SNAP_Z, fromDrag ? 420 : 680, finish, fromDrag ? 'outCubic' : 'outBack');
    }
    if (api.playBrassScrape) api.playBrassScrape();
    else api.playClick();
    api.vibrate([40, 25, 50]);
    phase = STATE.LATCH;
    api.setObjective('들쇠와 빗장의 맞물림이 느슨해졌습니다.');
    api.setSteps('C', ['A', 'B']);
    api.toast('들쇠가 돌아갔습니다. 빗장이 풀릴 준비가 되었습니다.', true);
  }

  function onHandleClick() {
    if (phase !== STATE.HANDLE) {
      if (phase === STATE.JOINERY) api.toast('먼저 짜맞춤을 모두 해제하시오.');
      else if (phase === STATE.PIN) api.toast('먼저 놋쇠 핀을 밀어 올리시오.');
      return;
    }
    if (handleRotated) return;
    // Short click alone is not enough
    api.toast('들쇠를 잡고 축을 중심으로 돌려 보시오.');
    api.vibrate(15);
    holdRing.material.opacity = 0.35;
    art.later(() => { if (!handleHoldActive) holdRing.material.opacity = 0; }, 400);
  }

  function onLatch() {
    if (phase !== STATE.LATCH) {
      if ([STATE.JOINERY, STATE.PIN, STATE.HANDLE].includes(phase)) {
        api.toast('아직 빗장을 열 수 없습니다.');
      }
      return;
    }
    if (latchOpen) return;
    latchOpen = true;
    animateVec3(latchBar.position, new THREE.Vector3(0.13, 0, 0.03), 520, () => {
      if (recoil) recoil(latchGroup, 'z', 0.01, 200);
    }, 'inOutCubic');
    if (api.playLatchClack) api.playLatchClack();
    else api.playClick();
    api.vibrate([45, 30, 55]);
    art.later(() => {
      if (api.playWoodThunk) api.playWoodThunk();
      else api.playThunk();
      if (lidOpen) return;
      lidOpen = true;
      phase = STATE.OPENING;
      api.setObjective('앞판이 열리며 결구의 숨이 풀립니다…');
      api.setSteps('D', ['A', 'B', 'C']);
      animateTo(frontPanel.rotation, 'x', Math.PI / 2.1, 1180, revealDrawer, 'outQuint');
    }, 480);
  }

  function applyHover(kind, iid) {
    const key = kind && iid ? `${kind}:${iid}` : null;
    if (key === hoverId) return;
    hoverId = key;
    // Reset all tracked
    highlightables.forEach(({ mesh, baseEmissive, baseIntensity }) => {
      if (!mesh.material || !mesh.material.emissive) return;
      // don't clobber joinery next-highlight or done state heavily
      mesh.material.emissive.copy(baseEmissive);
      mesh.material.emissiveIntensity = baseIntensity;
    });
    if (phase === STATE.JOINERY) highlightNextJoinery();
    if (!kind) return;
    // Soft inspection glow on hovered interactive
    let mesh = null;
    if (kind === 'joinery' && joineryMeshes[iid]) {
      mesh = joineryMeshes[iid].gltfPeg || joineryMeshes[iid].peg;
    } else if (kind === 'pin') mesh = pin;
    else if (kind === 'handle') mesh = handleKnob;
    else if (kind === 'latch') mesh = latchBar;
    if (mesh && mesh.material && mesh.material.emissive) {
      mesh.material.emissive.setHex(0x8a6020);
      mesh.material.emissiveIntensity = Math.max(mesh.material.emissiveIntensity, 0.55);
    }
  }

  // Optional inspection zoom toward hovered part
  let zoomTarget = null;
  function inspectionZoom(kind, iid) {
    if (!api.setCameraFocus) return;
    if (kind === 'joinery' && joineryMeshes[iid]) {
      const p = new THREE.Vector3();
      joineryMeshes[iid].group.getWorldPosition(p);
      api.setCameraFocus(p, 1.35);
      zoomTarget = iid;
    }
  }

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives,
    build(scene) {
      scene.add(root);
      if (api.setCh1Lighting) api.setCh1Lighting(true);
    },
    start() {
      this.reset();
    },
    reset() {
      art.clearTimers();
      phase = STATE.JOINERY;
      joineryProgress = [];
      joineryDone.clear();
      pinNudged = false;
      handleRotated = false;
      latchOpen = false;
      lidOpen = false;
      mistookOnce = false;
      hintLevel = 0;
      handleHoldActive = false;
      setCraftEye(false);
      if (craftEyeTimer) { clearTimeout(craftEyeTimer); craftEyeTimer = null; }
      resetJoineryVisuals();
      pin.position.set(0.02, 0.02, 0.02);
      pinGroup.visible = false;
      pinGroup.scale.set(0.4, 0.4, 0.4);
      handlePivot.rotation.z = 0;
      handlePivot.scale.set(0.3, 0.3, 0.3);
      handlePivot.visible = false;
      holdRing.material.opacity = 0;
      latchBar.position.set(0, 0, 0.03);
      if (gltfLatchBar) gltfLatchBar.position.set(0, 0.02, 0.02);
      frontPanel.rotation.x = 0;
      drawer.visible = false;
      drawer.position.set(0, 0.18, -0.05);
      bodyGroup.position.x = 0;
      api.setObjective('장부 밑 걸쇠와 틈을 살피고 움직임을 시험하시오.');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      highlightNextJoinery();
      api.toast('반닫이 — 장인의 결구를 탐구하시오.', true);
    },
    getGestureFrame(kind,iid) {
      root.updateMatrixWorld(true);
      let pivot,axis,type='linear';
      if(kind==='joinery'){pivot=joineryMeshes[iid]?.group;axis=iid==='FL'?[1,0,-1]:iid==='FR'?[-1,0,-1]:[.055,0,.05];}
      else if(kind==='pin'){pivot=pin;axis=[0,1,0];}
      else if(kind==='latch'){pivot=latchBar;axis=[1,0,0];}
      else if(kind==='drawer'){pivot=drawerPull;axis=[0,0,1];}
      else if(kind==='handle'){pivot=handlePivot;axis=[0,0,1];type='rotate';}
      if(!pivot)return null;
      const worldAxis=new THREE.Vector3(...axis).applyQuaternion(pivot.parent.getWorldQuaternion(new THREE.Quaternion())).normalize();
      return {type,origin:pivot.getWorldPosition(new THREE.Vector3()).toArray(),axis:worldAxis.toArray()};
    },
    getDragInteraction(kind,iid) {
      if(kind==='joinery' && phase===STATE.JOINERY && !joineryDone.has(iid)){
        const j=joineryMeshes[iid],base=j.group.position.clone();
        const direction=new THREE.Vector3(...(iid==='FL'?[.055,0,-.055]:iid==='FR'?[-.055,0,-.055]:[.055,0,.05]));
        const distance=direction.length();direction.normalize();
        const released=iid===expectedJoinery();
        let travel=0;
        return {
          move(sample){travel=THREE.MathUtils.clamp(sample.travel||0,0,released?distance:.009);j.group.position.copy(base).addScaledVector(direction,travel);},
          end(){
            if(released && travel>=distance*.88){onJoinery(iid);}
            else{j.group.position.copy(base);api.playWoodThunk?.();if(!released)api.toast('장부 밑 걸쇠가 하중을 받고 있습니다.');}
          },
          cancel(){j.group.position.copy(base);},
        };
      }
      if((kind==='pin'&&phase===STATE.PIN)||(kind==='latch'&&phase===STATE.LATCH)){
        const isPin=kind==='pin',mesh=isPin?pin:latchBar,key=isPin?'y':'x';
        const start=mesh.position[key],distance=isPin?.05:.13;let travel=0;
        return {
          move(sample){travel=THREE.MathUtils.clamp(sample.travel||0,0,distance);mesh.position[key]=start+travel;},
          end(){if(travel>=distance*.88){isPin?onPin():onLatch();}else mesh.position[key]=start;},
          cancel(){mesh.position[key]=start;},
        };
      }
      if(kind==='drawer'&&drawer.visible){
        const start=drawer.position.z;
        return {move(sample){drawer.position.z=THREE.MathUtils.clamp(start+(sample.travel||0),DRAWER_Z0,DRAWER_Z1);updateLootReveal();},end(){updateLootReveal();},cancel(){drawer.position.z=start;updateLootReveal();}};
      }
      if(kind==='handle'&&phase===STATE.HANDLE&&!handleRotated){
        const start=handlePivot.rotation.z;
        return {
          start(){handleHoldActive=true;applyHandlePress(.55);api.playBrassScrape?.();},
          move(sample){handlePivot.rotation.z=THREE.MathUtils.clamp(start+(sample.turn||0),HANDLE_SNAP_Z,.04);},
          end(){if(handlePivot.rotation.z<=HANDLE_SNAP_Z+.15)completeHandle(true);else{handleHoldActive=false;applyHandlePress(0);springHandleTo(start,220);}},
          cancel(){handleHoldActive=false;applyHandlePress(0);handlePivot.rotation.z=start;holdRing.material.opacity=0;},
        };
      }
      if (kind === 'loot' && lootReady) {
        const which = (iid === 'KEY') ? 'key' : 'letter';
        const mesh = which === 'key' ? keyMesh : letterMesh;
        if (!mesh || mesh.userData.taken) return null;
        const base = mesh.position.clone();
        return {
          start() { api.vibrate(12); },
          move(s) {
            // Stage-1 slide only while dragging
            mesh.position.z = base.z + Math.max(0, Math.min(0.14, -s.dy * 0.002 + s.dx * 0.001));
            mesh.position.y = base.y + Math.max(0, Math.min(0.06, -s.dy * 0.001));
          },
          end() {
            if (mesh.position.z - base.z > 0.06 || mesh.position.y - base.y > 0.03) {
              pickupLoot(which);
            } else {
              animateVec3(mesh.position, base, 200, null, 'outCubic');
              api.toast('조금 더 끌어낸 뒤 들어 올리시오.');
            }
          },
          cancel() { animateVec3(mesh.position, base, 200, null, 'outCubic'); },
        };
      }
      return null;
    },
    handleInteract(kind, iid) {
      if (kind === 'loot') { pickupLoot((iid === 'KEY') ? 'key' : 'letter'); return; }
      if (phase === STATE.FINALE || phase === STATE.OPENING) return;
      if (kind === 'handle') onHandleClick();
      else if (['joinery','pin','latch','drawer'].includes(kind)) api.toast('홈과 부품이 움직이는 방향을 따라 밀거나 당기시오.');
    },
    /** Called from main on pointerdown when over interactive */
    onPointerDown(kind) {
      if (phase === STATE.HANDLE && kind === 'handle' && !handleRotated) {
        handleHoldActive = true;
        holdRing.material.opacity = 0.5;
        applyHandlePress(0.35);
        if (api.playBrassScrape) api.playBrassScrape();
        api.vibrate(20);
      }
    },
    onPointerHold(kind, _iid, elapsed) {
      if (!(phase === STATE.HANDLE && kind === 'handle' && handleHoldActive && !handleRotated)) return;
      const t = Math.min(1, elapsed / HANDLE_HOLD_MS);
      const te = t * t * (3 - 2 * t);
      holdRing.material.opacity = 0.35 + te * 0.6;
      holdRing.scale.setScalar(0.8 + te * 0.45);
      applyHandlePress(0.35 + te * 0.55);
      // Holding loads the spring; rotation must come from the hand.
    },
    onPointerUp(kind, _iid, info = {}) {
      if (phase === STATE.HANDLE && kind === 'handle') {
        if (!handleRotated && handleHoldActive) {
          {
            handleHoldActive = false;
            holdRing.material.opacity = 0;
            holdRing.scale.setScalar(1);
            applyHandlePress(0);
            springHandleTo(0, 280);
            onHandleClick();
          }
        }
      } else {
        handleHoldActive = false;
      }
    },
    onHover(kind, iid) {
      applyHover(kind, iid || null);
    },
    onInspect(kind, iid) {
      inspectionZoom(kind, iid);
    },
    toggleCraftEye,
    revealHint() {
      hintLevel=Math.min(3,hintLevel+1);
      const message=hintLevel===1?'장부 밑 작은 걸쇠와 빈 틈을 살피시오.':hintLevel===2?'걸쇠가 비켜난 장부가 움직이면 다음 장부의 하중이 풀립니다.':HINT_FULL;
      api.setOrderHint?.(message);api.toast(message,true);api.playClick();
    },
    getState(){return {phase,joineryProgress:[...joineryProgress],hintLevel,pinNudged,handleRotated,latchOpen,drawerOpenAmt,lootReady,handleAngle:handlePivot.rotation.z,pinY:pin.position.y,latchX:latchBar.position.x,drawerZ:drawer.position.z,joineryPositions:Object.fromEntries(JOINERY_ORDER.map(jid=>[jid,joineryMeshes[jid].group.position.toArray()]))};},
    get mistook() { return mistookOnce; },
    solve() {
      JOINERY_ORDER.forEach((jid) => onJoinery(jid));
      onPin();
      completeHandle(false);
      onLatch();
      art.later(() => {
        drawer.position.set(0, 0.18, DRAWER_Z1);
        updateLootReveal();
        pickupLoot('key');
        art.later(() => pickupLoot('letter'), 700);
      }, 1600);
    },
    dispose(scene) {
      disposed = true;
      if (craftEyeTimer) clearTimeout(craftEyeTimer);
      setCraftEye(false);
      if (api.setCh1Lighting) api.setCh1Lighting(false);
      scene.remove(root);
      art.dispose(root);
      interactives.length = 0;
      gltfRoot = null;
    },
  };
}
