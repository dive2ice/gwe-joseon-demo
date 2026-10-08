import { disposeChapterResources } from '../chapter-resources.js';
/**
 * Chapter 5 — 경대
 *
 * Two variables: oil-lamp X and mirror yaw (drag). First held path lights a
 * folded pattern; unfold it into a gobo. Second held path through the seated
 * gobo lights the altered document; pull the comb-box latch while held.
 * Sweeping the correct angle does not complete a stage.
 * Teaching ticks still map MIRROR_TARGET=2 / MIRROR_STEPS=6.
 * Hints: request-only observe → relate → FULL. Soft-fail never advances hints.
 */
import { boxMesh, bevelBoxMesh, invisibleHit } from '../materials.js';
import { createLightSegment, placeLightSegment, lightPathEndpoint, splitAtPlaneZ } from '../ch5-light-rig.js';

export const id = 5;
export const title = '경대';
export const blurb = '등잔과 거울로 빛 경로를 만들고, 펼친 도안을 가림판으로 쓴 뒤 빗장을 당기시오.';
export const steps = [
  { id: 'A', label: '빛' },
  { id: 'B', label: '가림판' },
  { id: 'C', label: '빗장' },
];

export const hint = '등잔을 옮기고 거울을 밀어 빛을 잇시오. 탁자 위 쪽지에 현장 단서가 있소.';
export const HINT_PARTIAL = '등잔 위치와 거울 각도를 함께 맞춰 접힌 도안이 밝아지는지 살피시오.';
export const HINT_RELATION = '밝아진 도안을 펼쳐 가림판으로 세운 뒤, 등잔을 다시 옮겨 고친 글이 비추게 하시오.';
export const HINT_FULL = '정답: 등잔을 첫 눈금(거울 칸 2)에 맞추고 도안을 펼친 다음, 등잔을 안쪽으로 옮겨 가림판을 통과한 빛에서 빗장을 당기시오.';

/** Field copy on the dressing table — always present for solo Ch5 entry */
export const REPLICA_NOTE = '등잔을 옮기고 거울을 돌려 접힌 도안을 비추라. 펼친 도안은 가림판이 된다.';

/** Target mirror angle index 0–5 */
export const MIRROR_TARGET = 2;
export const MIRROR_STEPS = 6;

/** Wrong mirror clicks (while not aligned) before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 5;

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch5_gyeongdae';

  let phase = 'aim1'; // aim1 | mask | latch | finale
  let lampX = -0.62;
  let mirrorYaw = -0.5;
  let unfolded = false;
  let maskSeated = false;
  let hintLevel = 0;
  let softFailCount = 0;
  let badTries = 0;
  let lastFeel = null;
  let craftEyeOn = false;
  let craftEyeTimer = null;
  let path1Announced = false;
  let path2Announced = false;
  const interactives = [];
  const LAMP_X1 = -0.48;
  const LAMP_X2 = -0.34;
  const LAMP_MIN = -0.66;
  const LAMP_MAX = -0.28;
  const LAMP_SLACK = 0.055;
  const YAW_SLACK = 0.1;

  const woodMat = mats.sliceWood || mats.woodRich || mats.wood;
  const woodDark = mats.sliceWoodDark || mats.woodDark;
  const woodAcc = mats.sliceWood || mats.woodAccent || woodMat;
  const brass = mats.sliceBrass || mats.brass;
  const brassB = mats.sliceBrassBright || mats.brassBright || brass;
  const paper = mats.slicePaper || mats.paper;
  const ink = new THREE.MeshStandardMaterial({ color: 0x302a22, roughness: 0.94 });
  const iron = mats.iron;

  // ---- Joseon dressing table (경대) — tabletop + body, shallow depth ----
  const TOP_W = 1.05;
  const TOP_D = 0.62; // Carries the comb box in front of the gobo travel.
  const TOP_H = 0.06;
  const BODY_W = 0.92;
  const BODY_H = 0.32;
  const BODY_D = 0.4;
  const bodyY0 = 0.14;
  const topY = bodyY0 + BODY_H + TOP_H / 2;

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Lower carcass
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W, BODY_H, BODY_D, woodDark, 0, bodyY0 + BODY_H / 2, 0));
  // Side panels
  [-1, 1].forEach((sx) => {
    bodyGroup.add(bevelBoxMesh(THREE, 0.022, BODY_H - 0.03, BODY_D - 0.03, woodDark,
      sx * (BODY_W / 2 - 0.01), bodyY0 + BODY_H / 2, 0));
  });
  // Tabletop (richer wood)
  bodyGroup.add(bevelBoxMesh(THREE, TOP_W, TOP_H, TOP_D, woodMat, 0, topY, 0.02));
  // Top edge molding
  bodyGroup.add(bevelBoxMesh(THREE, TOP_W + 0.02, 0.015, TOP_D + 0.02, woodAcc, 0, topY + TOP_H / 2 + 0.005, 0.02));

  // Shaped cabriole-ish feet (block + tapered tip)
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(boxMesh(THREE, 0.07, 0.14, 0.065, woodDark,
      sx * (BODY_W / 2 - 0.1), 0.07, sz * (BODY_D / 2 - 0.05)));
    bodyGroup.add(boxMesh(THREE, 0.05, 0.04, 0.045, woodDark,
      sx * (BODY_W / 2 - 0.1), 0.02, sz * (BODY_D / 2 - 0.05)));
    bodyGroup.add(boxMesh(THREE, 0.055, 0.012, 0.05, brass,
      sx * (BODY_W / 2 - 0.1), 0.006, sz * (BODY_D / 2 - 0.05)));
  });
  // Front apron
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.08, 0.035, 0.025, woodMat,
    0, bodyY0 + 0.03, BODY_D / 2 - 0.01));

  // Front drawer faces (decorative + one interactive-looking bay)
  const frontZ = BODY_D / 2 + 0.005;
  const drawerH = 0.1;
  // Left / center / right drawer fronts
  const drawerSpecs = [
    { x: -0.28, w: 0.28 },
    { x: 0, w: 0.28 },
    { x: 0.28, w: 0.28 },
  ];
  function ringPull(mat, scale = 1) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.014 * scale, 0.0035 * scale, 8, 16),
      mat,
    );
    ring.rotation.x = -0.18;
    g.add(ring);
    g.add(boxMesh(THREE, 0.028 * scale, 0.02 * scale, 0.006 * scale, mat, 0, 0, -0.004));
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.004 * scale, 6, 6), mat);
    riv.position.set(0, 0, 0.004);
    g.add(riv);
    return g;
  }
  drawerSpecs.forEach((d, i) => {
    const dy = bodyY0 + BODY_H * 0.55;
    bodyGroup.add(bevelBoxMesh(THREE, d.w - 0.01, drawerH, 0.04, woodMat, d.x, dy, frontZ - 0.01));
    // Panel inset
    bodyGroup.add(bevelBoxMesh(THREE, d.w - 0.05, drawerH - 0.035, 0.01, woodAcc, d.x, dy, frontZ + 0.01));
    const pull = ringPull(i === 1 ? brassB : brass, i === 1 ? 1.1 : 0.85);
    pull.position.set(d.x, dy - 0.01, frontZ + 0.02);
    bodyGroup.add(pull);
  });
  // Vertical stile separators
  [-0.14, 0.14].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.012, drawerH + 0.02, 0.03, woodDark,
      sx, bodyY0 + BODY_H * 0.55, frontZ - 0.015));
  });

  // Corner brackets on carcass front
  function cornerBracket(x, y, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.add(boxMesh(THREE, 0.07, 0.012, 0.028, brassB, 0.03, 0, 0));
    g.add(boxMesh(THREE, 0.028, 0.012, 0.07, brassB, 0, 0, 0.03));
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
    riv.position.set(0.02, 0.008, 0.008);
    g.add(riv);
    bodyGroup.add(g);
  }
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.05, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.05, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + 0.08, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + 0.08, frontZ, -Math.PI / 2);

  // ---- Mirror frame + stand posts + pivot ----
  const mirrorPivot = new THREE.Group();
  mirrorPivot.name = 'ch5_mirror_pivot';
  mirrorPivot.position.set(0, topY + 0.32, -0.08);
  root.add(mirrorPivot);

  // Stand posts (left/right) — fixed to table, not rotating with glass angle visual base
  const standGroup = new THREE.Group();
  standGroup.position.set(0, topY, -0.08);
  root.add(standGroup);
  [-1, 1].forEach((sx) => {
    // Vertical post
    standGroup.add(bevelBoxMesh(THREE, 0.035, 0.55, 0.035, woodDark, sx * 0.28, 0.28, 0));
    // Post brass cap
    standGroup.add(boxMesh(THREE, 0.045, 0.02, 0.045, brassB, sx * 0.28, 0.56, 0));
    // Base foot of post
    standGroup.add(boxMesh(THREE, 0.06, 0.025, 0.06, brass, sx * 0.28, 0.055, 0));
  });
  // Crossbar behind mirror
  standGroup.add(boxMesh(THREE, 0.58, 0.025, 0.02, woodDark, 0, 0.5, -0.16));

  // Horizontal sector and pointer share the mirror's actual vertical yaw axis.
  const tickArc = new THREE.Group();
  tickArc.name = 'ch5_yaw_scale';
  tickArc.position.set(0, 0.067, 0);
  standGroup.add(tickArc);
  const sector = new THREE.Mesh(new THREE.RingGeometry(0.225, 0.27, 36, 1, -0.62, 1.24), brass);
  sector.rotation.x = -Math.PI / 2;
  tickArc.add(sector);
  // Two small brackets seat the dial above the tabletop.
  [-1, 1].forEach(side => standGroup.add(boxMesh(THREE, 0.027, 0.025, 0.024, brass,
    0.247, 0.055, side * 0.105)));
  const angleTicks = [];
  for (let t = 0; t < MIRROR_STEPS; t++) {
    const isTarget = t === MIRROR_TARGET;
    const a = angleForStatic(t);
    const radius = 0.248;
    const tickMat = isTarget ? brassB.clone() : brass.clone();
    if (tickMat.emissiveIntensity != null) {
      tickMat.emissiveIntensity = isTarget ? 0.65 : 0.12;
    }
    if (isTarget && tickMat.emissive) tickMat.emissive.setHex(0x6a4820);
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(isTarget ? 0.022 : 0.012, isTarget ? 0.008 : 0.005, isTarget ? 0.014 : 0.008),
      tickMat,
    );
    tick.name = 'ch5_yaw_tick_' + t;
    tick.position.set(Math.cos(a) * radius, 0.003, -Math.sin(a) * radius);
    tick.rotation.y = a;
    tickArc.add(tick);
    angleTicks.push(tick);
    if (isTarget) {
      // Worn polish blot next to target tick (finger-worn teaching cue)
      const worn = new THREE.Mesh(
        new THREE.SphereGeometry(0.01, 6, 6),
        brassB.clone(),
      );
      worn.position.set(Math.cos(a) * 0.264, 0.003, -Math.sin(a) * 0.264);
      if (worn.material.emissiveIntensity != null) worn.material.emissiveIntensity = 0.5;
      tickArc.add(worn);
    }
  }
  // Tiny lamp-direction cue arrow on left post (points toward mirror → target path)
  const lampCue = boxMesh(THREE, 0.04, 0.006, 0.01, brassB.clone(), -0.28, 0.38, 0.04);
  if (lampCue.material && lampCue.material.emissiveIntensity != null) {
    lampCue.material.emissiveIntensity = 0.4;
  }
  standGroup.add(lampCue);
  const lampCueTip = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.022, 5), brassB.clone());
  lampCueTip.rotation.z = -Math.PI / 2;
  lampCueTip.position.set(-0.25, 0.38, 0.04);
  if (lampCueTip.material.emissiveIntensity != null) lampCueTip.material.emissiveIntensity = 0.45;
  standGroup.add(lampCueTip);

  function angleForStatic(i) {
    // Range roughly -0.5 to +0.5 rad around Y
    return -0.5 + (i / (MIRROR_STEPS - 1)) * 1.0;
  }

  // Bronze/brass mirror frame (rotates)
  const frameOuter = bevelBoxMesh(THREE, 0.42, 0.52, 0.035, brassB, 0, 0, 0);
  frameOuter.userData = { id: 'MIRROR', kind: 'mirror' };
  mirrorPivot.add(frameOuter);
  // Inner wood liner
  const frameInner = bevelBoxMesh(THREE, 0.36, 0.46, 0.02, woodAcc, 0, 0, 0.01);
  frameInner.userData = { id: 'MIRROR', kind: 'mirror' };
  mirrorPivot.add(frameInner);
  // Corner ornaments on frame
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const orn = boxMesh(THREE, 0.04, 0.04, 0.012, brass, sx * 0.18, sy * 0.22, 0.025);
    orn.userData = { id: 'MIRROR', kind: 'mirror' };
    mirrorPivot.add(orn);
  });
  // Top crest
  mirrorPivot.add(boxMesh(THREE, 0.12, 0.04, 0.02, brassB, 0, 0.28, 0.02));
  const crestDot = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), brass);
  crestDot.position.set(0, 0.3, 0.03);
  mirrorPivot.add(crestDot);

  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.015), mats.sliceMirror || mats.mirror);
  glass.position.z = 0.028;
  glass.userData = { id: 'MIRROR', kind: 'mirror' };
  mirrorPivot.add(glass);
  glass.name = 'ch5_mirror_surface';
  // Layered bevel and pierced corner scrolls catch grazing light without obscuring the glass.
  [-1, 1].forEach((side) => {
    mirrorPivot.add(boxMesh(THREE, 0.008, 0.42, 0.008, brassB, side * 0.164, 0, 0.038));
    mirrorPivot.add(boxMesh(THREE, 0.34, 0.008, 0.008, brassB, 0, side * 0.205, 0.038));
    for (let n = 0; n < 5; n++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), brass);
      bead.position.set(side * 0.188, -0.17 + n * 0.085, 0.035);
      mirrorPivot.add(bead);
    }
  });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.003, 6, 20, Math.PI * 1.7), brassB);
    scroll.scale.set(0.8, 1.2, 1);
    scroll.rotation.z = sx * sy * 0.6;
    scroll.position.set(sx * 0.186, sy * 0.23, 0.038);
    mirrorPivot.add(scroll);
  });
  const crest = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 8, 24), brassB);
  crest.scale.set(1.4, 0.75, 1);
  crest.position.set(0, 0.28, 0.04);
  mirrorPivot.add(crest);


  // A vertical spindle seats in the fixed tabletop socket, matching rotation.y.
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 16), brass);
  axle.name = 'ch5_yaw_spindle';
  axle.position.set(0, -0.265, 0);
  mirrorPivot.add(axle);
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.044, 0.024, 24), brassB);
  socket.name = 'ch5_yaw_socket';
  socket.position.set(0, topY + 0.055, -0.08);
  root.add(socket);

  // Pointer notch on frame edge — aligns with teaching tick when correct
  const framePointer = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.01, 0.02),
    brassB.clone(),
  );
  framePointer.name = 'ch5_yaw_pointer';
  framePointer.position.set(0.216, -0.253, 0);
  if (framePointer.material.emissiveIntensity != null) framePointer.material.emissiveIntensity = 0.35;
  framePointer.userData = { id: 'MIRROR', kind: 'mirror' };
  mirrorPivot.add(framePointer);

  const mHit = invisibleHit(THREE, 0.5, 0.6, 0.22, { id: 'MIRROR', kind: 'mirror' });
  mirrorPivot.add(mHit);
  interactives.push(mHit, glass, frameOuter, frameInner, framePointer);

  // ---- Oil lamp / light source (left) — crafted ----
  const lamp = new THREE.Group();
  lamp.position.set(-0.62, topY + 0.12, 0.12);
  root.add(lamp);
  const lampRail = boxMesh(THREE, 0.52, 0.028, 0.14, woodDark, -0.48, topY + 0.073, 0.12);
  root.add(lampRail);
  for (const x of [-0.5, -0.29]) root.add(boxMesh(THREE, 0.028, 0.06, 0.12, brass, x, topY + 0.044, 0.12));
  lamp.add(boxMesh(THREE, 0.13, 0.018, 0.125, brass, 0, -0.021, 0));
  for (const z of [0.064, 0.176]) root.add(boxMesh(THREE, 0.46, 0.004, 0.006, brassB, -0.48, topY + 0.089, z));
  // Turned bronze pedestal, oil bowl and wick: a readable flame source, not a light cube.
  const lampProfile = [
    [0.054, -0.012], [0.058, 0], [0.049, 0.012], [0.035, 0.02],
    [0.018, 0.035], [0.012, 0.115], [0.02, 0.143], [0.048, 0.156],
    [0.055, 0.174], [0.052, 0.185], [0.042, 0.184], [0.026, 0.16],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const lampVessel = new THREE.Mesh(new THREE.LatheGeometry(lampProfile, 32), brass);
  lampVessel.name = 'ch5_turned_oil_lamp';
  lamp.add(lampVessel);
  [0.018, 0.145, 0.18].forEach((y, i) => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry([0.038, 0.022, 0.053][i], 0.003, 6, 28), brassB);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y;
    lamp.add(rim);
  });
  const oil = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.003, 24), iron);
  oil.position.y = 0.169;
  lamp.add(oil);
  const wick = boxMesh(THREE, 0.005, 0.035, 0.005, ink, 0, 0.19, 0);
  wick.rotation.z = -0.12;
  lamp.add(wick);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), mats.lampFlame || mats.beam);
  flame.scale.set(0.45, 1.35, 0.45);
  flame.position.y = 0.22;
  lamp.add(flame);
  const flameHeart = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffefd1, toneMapped: false }));
  flameHeart.scale.set(0.5, 1.6, 0.5);
  flameHeart.position.y = 0.209;
  lamp.add(flameHeart);
  // Tiny handle ring
  const lampRing = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 12), brass);
  lampRing.position.set(0.05, 0.1, 0);
  lamp.add(lampRing);
  const handleStud = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.028, 12), brass);
  handleStud.rotation.z = Math.PI / 2;
  handleStud.position.set(0.024, 0.1, 0);
  lamp.add(handleStud);
  // Soft point light from lamp (readable light path cue)
  const lampLight = new THREE.PointLight(0xffc878, 0.55, 2.4, 2);
  lampLight.position.set(0, 0.24, 0);
  lamp.add(lampLight);
  lamp.userData = { id: 'LAMP', kind: 'lamp' };
  const lampHit = invisibleHit(THREE, 0.16, 0.32, 0.16, { id: 'LAMP', kind: 'lamp' });
  lampHit.position.y = 0.1;
  lamp.add(lampHit);
  interactives.push(lampHit);

  const replica = boxMesh(THREE, 0.16, 0.008, 0.1, paper, -0.34, topY + TOP_H / 2 + 0.01, 0.16);
  replica.userData = { id: 'REPLICA', kind: 'replica' };
  root.add(replica);
  const replicaHit = invisibleHit(THREE, 0.18, 0.04, 0.12, { id: 'REPLICA', kind: 'replica' });
  replicaHit.position.set(-0.34, topY + 0.04, 0.16);
  root.add(replicaHit);
  interactives.push(replica, replicaHit);

  // Every segment is attached to actual model-space contact points.
  const beamIn = createLightSegment(THREE, 'ch5_beam_incoming', 0.0024);
  const beam = createLightSegment(THREE, 'ch5_beam_reflected', 0.003);
  const beamThrough = createLightSegment(THREE, 'ch5_beam_through_mask', 0.0025);
  root.add(beamIn, beam, beamThrough);
  const beamOrigin = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), new THREE.MeshBasicMaterial({
    color: 0xffdeb0, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false,
  }));
  beamOrigin.name = 'ch5_mirror_contact';
  root.add(beamOrigin);

  // Target plate (right) — crafted brass plaque with stand, not a floating cube
  const targetGroup = new THREE.Group();
  targetGroup.name = 'ch5_target_stand';
  targetGroup.position.set(0.5, topY + 0.28, 0.08);
  root.add(targetGroup);
  targetGroup.add(boxMesh(THREE, 0.04, 0.27, 0.04, woodDark, 0, -0.1, -0.02)); // post
  const targetFoot = boxMesh(THREE, 0.06, 0.02, 0.06, brass, 0, -0.2275, -0.02);
  targetFoot.name = 'ch5_target_foot';
  targetGroup.add(targetFoot);
  const target = boxMesh(THREE, 0.14, 0.14, 0.025, brassB, 0, 0.05, 0);
  targetGroup.add(target);
  // Engraved inner disc
  const targetDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), brass);
  targetDisc.rotation.x = Math.PI / 2;
  targetDisc.position.set(0, 0.05, 0.02);
  targetGroup.add(targetDisc);
  // Corner rivets
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), brass);
    riv.position.set(sx * 0.05, 0.05 + sy * 0.05, 0.02);
    targetGroup.add(riv);
  });
  const targetGlow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false }));
  targetGlow.name = 'ch5_pattern_light';
  targetGlow.scale.z = 0.055;
  targetGlow.position.set(0.5, topY + 0.33, 0.14);
  targetGlow.visible = false;
  root.add(targetGlow);

  const pattern = boxMesh(THREE, 0.1, 0.14, 0.012, paper.clone(), 0, 0.05, 0.03);
  pattern.userData = { id: 'PATTERN', kind: 'pattern' };
  targetGroup.add(pattern);
  const patternHit = invisibleHit(THREE, 0.16, 0.18, 0.08, { id: 'PATTERN', kind: 'pattern' });
  patternHit.position.set(0, 0.05, 0.04);
  targetGroup.add(patternHit);
  interactives.push(pattern, patternHit);

  const maskShape = new THREE.Shape();
  maskShape.moveTo(-0.06, -0.08);
  maskShape.lineTo(0.06, -0.08);
  maskShape.lineTo(0.06, 0.08);
  maskShape.lineTo(-0.06, 0.08);
  maskShape.closePath();
  const aperture = new THREE.Path();
  aperture.moveTo(-0.038, -0.047);
  aperture.lineTo(-0.038, 0.047);
  aperture.lineTo(0.038, 0.047);
  aperture.lineTo(0.038, -0.047);
  aperture.closePath();
  maskShape.holes.push(aperture);
  const mask = new THREE.Mesh(new THREE.ExtrudeGeometry(maskShape, { depth: 0.006, bevelEnabled: false }), paper);
  mask.name = 'ch5_pierced_pattern';
  mask.position.set(0.5, topY + 0.28, 0.18);
  mask.visible = false;
  mask.userData = { id: 'MASK', kind: 'mask' };
  root.add(mask);
  const maskHit = invisibleHit(THREE, 0.16, 0.2, 0.08, { id: 'MASK', kind: 'mask' });
  maskHit.visible = false;
  mask.add(maskHit);
  interactives.push(mask, maskHit);

  const document = boxMesh(THREE, 0.14, 0.01, 0.1, paper, 0.42, topY + TOP_H / 2 + 0.012, 0.2);
  document.name = 'ch5_altered_document';
  document.userData = { id: 'DOC', kind: 'document' };
  root.add(document);
  const docMark = boxMesh(THREE, 0.04, 0.001, 0.03, brassB.clone(), 0.42, topY + TOP_H / 2 + 0.018, 0.2);
  if (docMark.material.emissiveIntensity != null) docMark.material.emissiveIntensity = 0.15;
  docMark.name = 'ch5_revealed_ink';
  root.add(docMark);

  // Give brass an emissive for target feedback
  target.material = brassB.clone();
  for (let row = 0; row < 5; row++) {
    const line = boxMesh(THREE, 0.074 - (row % 3) * 0.009, 0.001, 0.0014, ink, -0.015, 0.006, -0.031 + row * 0.014);
    document.add(line);
    const crease = boxMesh(THREE, 0.0016, 0.105, 0.001, ink, -0.035 + row * 0.0175, 0, 0.0067);
    pattern.add(crease);
  }
  // A quiet brass cradle makes the gobo's resting place readable in the world.
  root.add(boxMesh(THREE, 0.15, 0.01, 0.045, brass, 0.22, topY + TOP_H / 2 + 0.01, 0.08));
  [-1, 1].forEach((sx) => {
    root.add(boxMesh(THREE, 0.008, 0.15, 0.012, brass, 0.22 + sx * 0.066, topY + 0.105, 0.08));
  });

  const maskSill = boxMesh(THREE, 0.124, 0.01, 0.016, brass, 0.22, topY + 0.10, 0.08);
  maskSill.name = 'ch5_mask_sill';
  root.add(maskSill);

  // ---- Comb box (빗함) with brass pulls and secret slide ----
  const combBox = new THREE.Group();
  combBox.name = 'ch5_comb_box';
  combBox.position.set(-0.05, topY + TOP_H / 2 + 0.0575, 0.21);
  root.add(combBox);
  // Hollow carcass and open rails leave the sliding lid a clear +X exit.
  combBox.add(bevelBoxMesh(THREE, 0.38, 0.012, 0.22, woodDark, 0, -0.039, 0));
  [-1, 1].forEach(side => {
    combBox.add(bevelBoxMesh(THREE, 0.018, 0.075, 0.22, woodDark, side * 0.181, -0.0075, 0));
    combBox.add(bevelBoxMesh(THREE, 0.344, 0.075, 0.018, woodDark, 0, -0.0075, side * 0.101));
    combBox.add(bevelBoxMesh(THREE, 0.4, 0.015, 0.04, woodMat, 0, 0.05, side * 0.10));
  });
  // Corner brackets on comb box
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    combBox.add(boxMesh(THREE, 0.04, 0.01, 0.025, brassB, sx * 0.16, 0.04, sz * 0.09));
  });
  // Brass pull rings on front of box (quiet)
  const combPull = ringPull(brass, 0.9);
  combPull.position.set(0, 0, 0.12);
  combBox.add(combPull);

  // Secret slide lid (interactive)
  const slide = bevelBoxMesh(THREE, 0.32, 0.04, 0.16, woodAcc, 0, 0.055, 0);
  slide.name = 'ch5_sliding_lid';
  slide.userData = { id: 'SLIDE', kind: 'latch' };
  combBox.add(slide);
  // Slide brass edge strip + pull knob (stronger affordance)
  const slideStrip = boxMesh(THREE, 0.3, 0.008, 0.012, brassB, 0, 0.078, 0.06);
  slideStrip.userData = { id: 'SLIDE', kind: 'latch' };
  combBox.add(slideStrip);
  const slideKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.02, 10), brassB);
  slideKnob.rotation.x = Math.PI / 2;
  slideKnob.position.set(0.1, 0.07, 0.08);
  slideKnob.userData = { id: 'SLIDE', kind: 'latch' };
  combBox.add(slideKnob);
  // Seam hint for secret slide
  combBox.add(boxMesh(THREE, 0.005, 0.05, 0.14, woodDark, 0.155, 0.055, 0));

  const sHit = invisibleHit(THREE, 0.4, 0.14, 0.26, { id: 'SLIDE', kind: 'latch' });
  combBox.add(sHit);
  interactives.push(sHit, slide, slideStrip, slideKnob);

  const note = boxMesh(THREE, 0.18, 0.01, 0.12, paper, 0, 0.08, 0);
  note.visible = false;
  combBox.add(note);

  function angleFor(i) {
    return angleForStatic(i);
  }
  const YAW1 = angleFor(MIRROR_TARGET);
  const YAW2 = angleFor(4);

  function nearestIndex() {
    let best = 0;
    let dist = Infinity;
    for (let i = 0; i < MIRROR_STEPS; i++) {
      const d = Math.abs(mirrorYaw - angleFor(i));
      if (d < dist) { dist = d; best = i; }
    }
    return best;
  }

  function path1Held() {
    return Math.abs(lampX - LAMP_X1) <= LAMP_SLACK && Math.abs(mirrorYaw - YAW1) <= YAW_SLACK;
  }
  function path2Held() {
    return maskSeated && Math.abs(lampX - LAMP_X2) <= LAMP_SLACK && Math.abs(mirrorYaw - YAW2) <= YAW_SLACK;
  }

  function updateBeam() {
    lamp.position.x = lampX;
    mirrorPivot.rotation.y = mirrorYaw;
    const p1 = path1Held();
    const p2 = path2Held();
    const mirrorIndex = nearestIndex();
    const aligned = unfolded ? p2 : p1;
    // Calibrated visual aperture follows BOTH legacy variables. This keeps the
    // existing puzzle bands while making misses land outside the visible paper.
    const source = new THREE.Vector3(lampX, lamp.position.y + 0.22, lamp.position.z);
    const contact = new THREE.Vector3(Math.sin(mirrorYaw) * 0.036, mirrorPivot.position.y, mirrorPivot.position.z + Math.cos(mirrorYaw) * 0.036);
    const receiver = unfolded
      ? new THREE.Vector3(document.position.x, document.position.y + 0.006, document.position.z)
      : new THREE.Vector3(targetGroup.position.x, targetGroup.position.y + 0.05, targetGroup.position.z + 0.037);
    const endpoint = lightPathEndpoint(THREE, receiver, {
      lampError: (lampX - (unfolded ? LAMP_X2 : LAMP_X1)) / LAMP_SLACK,
      yawError: (mirrorYaw - (unfolded ? YAW2 : YAW1)) / YAW_SLACK,
      horizontal: unfolded,
    });
    const maskContact = unfolded && maskSeated ? splitAtPlaneZ(THREE, contact, endpoint, mask.position.z) : null;
    const visibility = craftEyeOn ? 0.55 : 0.24;
    placeLightSegment(THREE, beamIn, source, contact, visibility);
    placeLightSegment(THREE, beam, contact, maskContact || endpoint, visibility);
    beamThrough.visible = !!maskContact;
    if (maskContact) placeLightSegment(THREE, beamThrough, maskContact, endpoint, aligned ? 0.5 : visibility);
    beamOrigin.position.copy(contact);
    beamOrigin.material.opacity = craftEyeOn ? 0.8 : 0.5;
    // No target feedback from mirror index alone: the lamp and gobo must agree.
    target.material.emissiveIntensity = p1 && !unfolded ? 0.28 : 0.025;
    if (target.material.emissive) target.material.emissive.setHex(0x6a421b);
    targetGlow.visible = p1 && !unfolded;
    if (pattern.material) pattern.material.emissiveIntensity = p1 ? 0.28 : 0.025;
    if (docMark.material) docMark.material.emissiveIntensity = p2 ? 0.75 : 0.02;
    docMark.visible = p2;
    angleTicks.forEach((tick, t) => {
      if (tick.material?.emissiveIntensity == null) return;
      tick.material.emissiveIntensity = t === mirrorIndex ? 0.18 : 0.035;
    });
    if (framePointer.material?.emissiveIntensity != null) framePointer.material.emissiveIntensity = 0.12;
    // The oil flame is independent of puzzle correctness.
    lampLight.intensity = 0.55;

    if (p1 && !path1Announced) {
      path1Announced = true;
      if (api.playNacreChime) api.playNacreChime();
      feel('beam-hold', '빛이 표적에 머물렀습니다.');
    }
    if (!p1) path1Announced = false;
    if (p2 && !path2Announced) {
      path2Announced = true;
      if (api.playNacreChime) api.playNacreChime();
      feel('beam-hold', '가림판을 지난 빛이 고친 글에 머물렀습니다.');
    }
    if (!p2) path2Announced = false;
  }

  function feel(kind, text) {
    lastFeel = { kind, text };
    if (api.announceFeel) api.announceFeel(kind, text);
  }

  function softFailShake() {
    if (shake) shake(bodyGroup, 0.028, 340);
    else {
      const bx = bodyGroup.position.x;
      bodyGroup.position.x = bx + 0.022;
      setTimeout(() => { bodyGroup.position.x = bx; }, 80);
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
    softFailCount += 1;
    badTries = 0;
    softFailShake();
    api.playWrong();
    api.vibrate([30, 40, 30, 40, 60]);
    api.toast('막힌 까닭을 살펴보시오. 도움이 필요하면 힌트를 요청할 수 있소.');
  }

  function miss() {
    badTries += 1;
    if (badTries >= SOFT_FAIL_AFTER) onSoftFail();
  }

  function unfoldPattern() {
    if (unfolded || !path1Held()) return false;
    unfolded = true;
    phase = 'mask';
    pattern.visible = false;
    mask.visible = true;
    maskHit.visible = true;
    mask.position.set(0.5, topY + 0.28, 0.18);
    api.setObjective('펼친 도안을 빛 앞에 가림판으로 세우시오.');
    api.setSteps('B', ['A']);
    api.playUnlock();
    api.toast('접힌 도안이 펼쳐졌소. 가림판으로 쓰시오.', true);
    updateBeam();
    return true;
  }

  function seatMask() {
    const dx = Math.abs(mask.position.x - 0.22);
    const dz = Math.abs(mask.position.z - 0.08);
    maskSeated = dx < 0.12 && dz < 0.12;
    if (maskSeated) {
      mask.position.set(0.22, topY + 0.185, 0.08);
      if (phase === 'mask') {
        phase = 'latch';
        api.setObjective('가림판을 지난 빛이 고친 글에 닿은 채로 빗장을 당기시오.');
        api.setSteps('C', ['A', 'B']);
        api.toast('가림판이 앉았소. 등잔을 안쪽으로 옮기시오.', true);
      }
    }
    updateBeam();
  }

  function openLatch() {
    if (phase === 'finale') return;
    if (!path2Held()) {
      api.playWrong();
      api.vibrate(18);
      if (api.recoil) api.recoil(slide, 'x', -0.024, 240);
      softFailShake();
      feel('blocked', '먼저 가림판과 빛 경로를 표적에 맞추시오. 빗함은 아직 잠겨 있소.');
      api.toast('먼저 가림판과 빛 경로를 표적에 맞추시오. 빗함은 아직 잠겨 있소.');
      miss();
      return;
    }
    phase = 'finale';
    if (api.playLatchClack) api.playLatchClack();
    feel('latch-open', '빗장이 열립니다.');
    animateVec3(slide.position, new THREE.Vector3(0.22, 0.055, 0), 400, () => {
      note.visible = true;
      api.setObjective('비밀 쪽지를 확인하시오.');
      api.playUnlock();
      api.vibrate([45, 30, 80]);
      api.showFinale({
        title: '빗함 · 거울의 편지',
        body: '등잔과 거울로 첫 빛을 잇자 접힌 도안이 드러났다. 도안을 가림판으로 세우니 고친 글이 비추고, 빗장이 풀렸다. 쪽지에는 별자리가 그려져 있다. 「비천궤의 혼천의를 하늘을 향해 맞추라」.',
        footer: '— 세자 침전 경대',
        epilogue: '제5장 경대 — 해제 완료',
      });
      if (api.recordEvidence) api.recordEvidence('ch5-letter');
      api.markCleared(id);
    });
    animateVec3(slideStrip.position, new THREE.Vector3(0.22, 0.078, 0.06), 400);
    animateVec3(slideKnob.position, new THREE.Vector3(0.32, 0.07, 0.08), 400);
  }

  updateBeam();

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives,
    build(scene) { scene.add(root); },
    start() { this.reset(); },
    reset() {
      phase = 'aim1';
      lampX = -0.62;
      mirrorYaw = -0.5;
      unfolded = false;
      maskSeated = false;
      hintLevel = 0;
      softFailCount = 0;
      badTries = 0;
      lastFeel = null;
      craftEyeOn = false;
      path1Announced = false;
      path2Announced = false;
      if (craftEyeTimer) {
        clearTimeout(craftEyeTimer);
        craftEyeTimer = null;
      }
      pattern.visible = true;
      mask.visible = false;
      maskHit.visible = false;
      mask.position.set(0.5, topY + 0.28, 0.18);
      updateBeam();
      targetGlow.visible = false;
      slide.position.set(0, 0.055, 0);
      slideStrip.position.set(0, 0.078, 0.06);
      slideKnob.position.set(0.1, 0.07, 0.08);
      note.visible = false;
      bodyGroup.position.x = 0;
      api.setObjective('등잔을 옮기고 거울을 밀어 접힌 도안에 빛을 이으시오.');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      if (api.recordEvidence) api.recordEvidence('ch5-replica');
      api.toast('경대 — 등잔과 거울로 빛 경로를 만드시오.', true);
    },
    getDragInteraction(kind) {
      if (phase === 'finale') return null;
      if (kind === 'mirror') {
        const startYaw = mirrorYaw;
        return {
          cancel() { mirrorYaw = startYaw; updateBeam(); },
          move(s) {
            mirrorYaw = Math.max(-0.55, Math.min(0.55, mirrorYaw + s.deltaX * 0.006));
            updateBeam();
          },
        };
      }
      if (kind === 'lamp') {
        const startLampX = lampX;
        return {
          cancel() { lampX = startLampX; updateBeam(); },
          move(s) {
            lampX = Math.max(LAMP_MIN, Math.min(LAMP_MAX, lampX + s.deltaX * 0.0018));
            updateBeam();
          },
        };
      }
      if (kind === 'mask' && unfolded) {
        const startMask = mask.position.clone();
        const startSeated = maskSeated;
        return {
          cancel() { mask.position.copy(startMask); maskSeated = startSeated; updateBeam(); },
          move(s) {
            mask.position.x += s.deltaX * 0.0022;
            mask.position.z += s.deltaY * 0.0022;
            seatMask();
          },
          end() { seatMask(); },
        };
      }
      return null;
    },
    handleInteract(kind) {
      if (phase === 'finale') return;
      if (kind === 'replica') {
        if (api.recordEvidence) api.recordEvidence('ch5-replica');
        api.toast('쪽지: ' + REPLICA_NOTE);
        return;
      }
      if (kind === 'pattern') {
        if (!unfoldPattern()) {
          api.toast('빛이 도안을 비출 때만 펼칠 수 있소.');
          miss();
        }
        return;
      }
      if (kind === 'latch' || kind === 'slide') openLatch();
      else if (kind === 'mirror' || kind === 'lamp') {
        api.toast('밀어서 위치를 맞추시오. 스쳐 지나가면 잠기지 않소.');
      }
    },
    revealHint() {
      hintLevel = Math.min(3, hintLevel + 1);
      if (hintLevel === 1) {
        revealPartialHint();
        api.toast('힌트: ' + HINT_PARTIAL, true);
      } else if (hintLevel === 2) {
        if (api.setOrderHint) api.setOrderHint(HINT_RELATION);
        api.toast('힌트: ' + HINT_RELATION, true);
      } else {
        revealFullHint();
        api.toast('힌트: ' + HINT_FULL, true);
      }
      api.playClick();
    },
    toggleCraftEye() {
      if (craftEyeTimer) {
        clearTimeout(craftEyeTimer);
        craftEyeTimer = null;
      }
      craftEyeOn = true;
      updateBeam();
      api.playClick();
      api.vibrate([20, 30, 20]);
      api.toast('장인의 안목 — 빛 경로가 희미히 드러납니다.', true);
      craftEyeTimer = setTimeout(() => {
        craftEyeOn = false;
        craftEyeTimer = null;
        updateBeam();
      }, 2800);
    },
    get mistook() { return softFailCount > 0; },
    getState() {
      return {
        phase, lampX, mirrorYaw, unfolded, maskSeated,
        path1: path1Held(), path2: path2Held(), hintLevel, yaw1: YAW1, yaw2: YAW2,
        lampX1: LAMP_X1, lampX2: LAMP_X2,
        lastFeel, craftEyeOn,
      };
    },
    solve() {
      lampX = LAMP_X1;
      mirrorYaw = YAW1;
      updateBeam();
      unfoldPattern();
      mask.position.set(0.22, topY + 0.185, 0.08);
      seatMask();
      lampX = LAMP_X2;
      mirrorYaw = YAW2;
      updateBeam();
      openLatch();
    },
    dispose(scene) {
      if (craftEyeTimer) clearTimeout(craftEyeTimer);
      scene.remove(root);
      disposeChapterResources(root, mats);
      interactives.length = 0;
    },
  };
}
