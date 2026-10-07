/**
 * Chapter 3 — 어보 궤
 *
 * Five 오방색 dials match the lid's direction motifs to equally sized engravings.
 * Pointer rotation follows the hand continuously; release seats the nearest stop.
 * Taps only inspect. No dial starts on its target, and no target glows in advance.
 *
 * The taegeuk turns only while all five pointers hold their ticks.
 * A stud on the index seats the gear. The latch confirm is a separate gesture.
 * GEAR_CLICKS is the stud count, not a click counter.
 * Hints: request-only observe → relate → FULL. Soft-fail never dumps them.
 * Visual: Joseon royal seal chest (어보함).
 */
import { boxMesh, bevelBoxMesh, invisibleHit } from '../materials.js';
import { bumpHintLevel, requestHint, softFailNoHint } from '../hint-policy.js';

import { createOpeningArt } from './opening-art.js';
import { atStop, gestureFrame, rotaryDrag, pullDrag, MOTIFS, stopMotif, motifPlaque } from './tactile-rotary.js';

export const id = 3;
export const title = '어보 궤';
export const blurb = '오방색 다이얼과 태극 톱니로 어보 함을 여시오.';
export const steps = [
  { id: 'A', label: 'A 오방색' },
  { id: 'B', label: 'B 태극' },
  { id: 'C', label: '어보' },
];

/** Observe: the ring is in the scene. No dial starts on its long tick. */
export const hint = '뚜껑의 방위 문양과 다이얼 둘레 새김을 대조하시오.';
export const HINT_PARTIAL = '뚜껑에서 각 색에 짝지어진 문양을 찾아, 그 문양으로 놋쇠 끝을 돌리시오.';
export const HINT_RELATION = '다섯 색의 문양이 맞는 동안만 태극이 돕니다. 태극 점을 위 지표에 맞춘 뒤 아래 빗장을 오른쪽으로 당기시오.';
/** Spoiler: notch 0–3 for 청/적/황/백/흑. Request level 3 only. */
export const HINT_FULL = '청은 왼쪽, 적은 아래, 황은 위, 백은 오른쪽, 흑은 왼쪽 새김. 태극 점을 위로 돌린 뒤 빗장을 오른쪽으로 당기시오.';

/** Correct dial positions 0–3 for Blue,Red,Yellow,White,Black (청 적 황 백 흑) */
export const DIAL_TARGET = [1, 2, 0, 3, 1];
/** None of these equal DIAL_TARGET. Yellow (index 2) target is 0, so it must not start at 0. */
export const DIAL_START = [0, 0, 1, 1, 3];
/** Two taegeuk studs. Seating is a stud against the index, not this many clicks. */
export const GEAR_CLICKS = 2;

/** Yellow / 중앙. Its long tick is the visible example. The dial itself starts off that tick. */
export const TEACHING_DIAL = 2;

/** Bad dial clicks before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 7;

/** Direction labels for plaque ring (matches dial order) */
const DIR_KO = ['동청', '남적', '중앙황', '서백', '북흑'];
const COLOR_KO = ['청', '적', '황', '백', '흑'];

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch3_eobo';
  const art = createOpeningArt(THREE, mats);

  let phase = 'dials'; // dials | gear | finale
  let dialPos = DIAL_START.slice();
    let hintLevel = 0;
  let softFailCount = 0;
  let badClicks = 0;
  const interactives = [];
  const dialMeshes = [];
  const ringTicks = [];
  const hintPack = { base: hint, partial: HINT_PARTIAL, relation: HINT_RELATION, full: HINT_FULL };

  const woodMat = mats.sliceWood || mats.woodRich || mats.wood;
  const woodDark = mats.sliceWoodDark || mats.woodDark;
  const woodAcc = mats.sliceWood || mats.woodAccent || woodMat;
  const lacquer = art.lacquer;
  lacquer.color.setHex(0x241a17);
  const brass = mats.sliceBrass || mats.brass;
  const brassB = mats.sliceBrassBright || mats.brassBright || brass;
  const iron = mats.iron;

  // ---- Joseon royal seal chest (어보함) — wider than tall, shallow ----
  const BODY_W = 0.96;
  const BODY_H = 0.42;
  const BODY_D = 0.52;
  const bodyY0 = 0.1;
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Main lacquered carcass
  const carcass = new THREE.Group(); carcass.name='EoboHollowCarcass';bodyGroup.add(carcass);
  for(const side of [-1,1]) carcass.add(bevelBoxMesh(THREE,.04,BODY_H,BODY_D,lacquer,side*(BODY_W-.04)/2,bodyY0+BODY_H/2,0));
  for(const side of [-1,1]) carcass.add(bevelBoxMesh(THREE,BODY_W-.08,BODY_H,.035,lacquer,0,bodyY0+BODY_H/2,side*(BODY_D-.035)/2));
  carcass.add(bevelBoxMesh(THREE,BODY_W-.08,.04,BODY_D-.07,woodDark,0,bodyY0+.02,0));
  const lidPivot=new THREE.Group();lidPivot.name='EoboLidHinge';lidPivot.position.set(0,bodyY0+BODY_H+.02,-(BODY_D+.04)/2);bodyGroup.add(lidPivot);
  function addLid(mesh){mesh.position.sub(lidPivot.position);lidPivot.add(mesh);return mesh;}
  for(const side of [-1,1]){
    const hinge=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.11,16),brass);
    hinge.rotation.z=Math.PI/2;hinge.position.copy(lidPivot.position);hinge.position.x=side*.31;hinge.name='EoboHingeAxle';bodyGroup.add(hinge);
  }
  // Side panels (slight inset)
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.02, BODY_H - 0.04, BODY_D - 0.04, woodDark,
      sx * (BODY_W / 2 - 0.01), bodyY0 + BODY_H / 2, 0));
  });
  // Front apron rail
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.06, 0.04, 0.02, woodMat,
    0, bodyY0 + 0.04, BODY_D / 2 - 0.01));
  // Top lid slab (slight overhang)
  addLid(bevelBoxMesh(THREE, BODY_W + 0.04, 0.055, BODY_D + 0.04, woodDark,
    0, bodyY0 + BODY_H + 0.02, 0));
  // Lid crown lip
  addLid(bevelBoxMesh(THREE, BODY_W + 0.01, 0.018, BODY_D + 0.01, woodAcc,
    0, bodyY0 + BODY_H + 0.05, 0.005));
  // Lid center plaque frame (seal reveal sits under / above)
  addLid(boxMesh(THREE, 0.36, 0.012, 0.28, brass,
    0, bodyY0 + BODY_H + 0.055, 0.02));

  // Shaped feet
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(boxMesh(THREE, 0.08, 0.1, 0.07, woodDark,
      sx * (BODY_W / 2 - 0.1), 0.05, sz * (BODY_D / 2 - 0.06)));
    // Foot brass shoe tip
    bodyGroup.add(boxMesh(THREE, 0.06, 0.014, 0.05, brass,
      sx * (BODY_W / 2 - 0.1), 0.01, sz * (BODY_D / 2 - 0.06)));
  });
  // Front center foot rail
  bodyGroup.add(boxMesh(THREE, 0.14, 0.045, 0.05, woodDark, 0, 0.03, BODY_D / 2 - 0.04));

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
  // Front corners (top + bottom)
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.06, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.06, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + 0.08, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + 0.08, frontZ, -Math.PI / 2);
  // Rear corners (quieter)
  const rearZ = -BODY_D / 2 + 0.01;
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.06, rearZ, Math.PI / 2);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.06, rearZ, Math.PI);

  // Confirm latch is below the gear and in front of it, so a ray to the bar
  // does not pass through the taegeuk first.
  const latchY = bodyY0 + 0.02;
  const latchZ = frontZ + 0.16;
  const latchMat = brassB.clone();
  if (latchMat.emissive) {
    latchMat.emissive = new THREE.Color(0xf0d090);
    latchMat.emissiveIntensity = 0.55;
  }
  const latchPlate = bevelBoxMesh(THREE, 0.22, 0.032, 0.02, latchMat, 0, latchY, latchZ);
  latchPlate.userData = { id: 'LATCH', kind: 'confirm' };
  bodyGroup.add(latchPlate);
  const latchKey = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.018, 8), iron);
  latchKey.rotation.x = Math.PI / 2;
  latchKey.position.set(0, latchY, latchZ + 0.016);
  latchKey.userData = { id: 'LATCH', kind: 'confirm' };
  bodyGroup.add(latchKey);
  const latchRing = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 12), brassB);
  latchRing.position.set(0.07, latchY, latchZ + 0.012);
  latchRing.userData = { id: 'LATCH', kind: 'confirm' };
  bodyGroup.add(latchRing);
  const latchHit = invisibleHit(THREE, 0.28, 0.08, 0.06, { id: 'LATCH', kind: 'confirm' }, 0, latchY, latchZ);
  bodyGroup.add(latchHit);
  interactives.push(latchHit, latchPlate, latchKey, latchRing);

  // Quiet decorative rivet strips along front edge
  for (let i = 0; i < 5; i++) {
    const rx = -0.35 + i * 0.175;
    if (Math.abs(rx) < 0.08) continue; // skip latch area
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
    riv.position.set(rx, bodyY0 + BODY_H - 0.02, frontZ + 0.01);
    bodyGroup.add(riv);
  }

  // Side ring pulls (quiet, non-interactive)
  [-1, 1].forEach((sx) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 14), brass);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(sx * (BODY_W / 2 + 0.01), bodyY0 + BODY_H * 0.5, 0);
    bodyGroup.add(ring);
    bodyGroup.add(boxMesh(THREE, 0.01, 0.035, 0.03, brass,
      sx * (BODY_W / 2 + 0.005), bodyY0 + BODY_H * 0.5, 0));
  });

  // ---- 방위 고리 plaque (동청·남적·중앙황·서백·북흑) — in-world rule ----
  function makeDirPlaque(label) {
    try {
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 32;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3a2a14';
      ctx.fillRect(0, 0, 96, 32);
      ctx.strokeStyle = '#c9a84a';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 94, 30);
      ctx.fillStyle = '#f0e0b8';
      ctx.font = 'bold 14px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 48, 17);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.5, metalness: 0.25,
        emissive: 0x1a1008, emissiveIntensity: 0.12,
      });
    } catch (_) {
      return brass;
    }
  }

  // Arc of direction plaques on lid — readable world rule
  const plaqueY = bodyY0 + BODY_H + 0.062;
  DIR_KO.forEach((label, i) => {
    const mat = makeDirPlaque(`${label} · ${MOTIFS[i % 4]}`);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.036), mat);
    pl.rotation.x = -Math.PI / 2;
    pl.position.set(-0.34 + i * 0.17, plaqueY, -0.12);
    addLid(pl);
  });
  // Brass ring frame behind plaques
  addLid(boxMesh(THREE, 0.9, 0.006, 0.05, brass, 0, plaqueY - 0.004, -0.12));

  // Hanja / color plaque helper for dials
  function makeColorPlaque(text, fillHex) {
    try {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#5a4420';
      ctx.beginPath();
      ctx.arc(32, 32, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fillHex;
      ctx.beginPath();
      ctx.arc(32, 32, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c9a84a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = text === '백' || text === '황' ? '#2a2010' : '#f0e8d0';
      ctx.font = 'bold 22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 33);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.45, metalness: 0.35,
        emissive: 0x1a1008, emissiveIntensity: 0.08,
      });
    } catch (_) {
      return brassB;
    }
  }

  const colors = [
    { name: '청', mat: mats.bangBlue, key: 'B', hex: '#2a4a8a' },
    { name: '적', mat: mats.bangRed, key: 'R', hex: '#8a2020' },
    { name: '황', mat: mats.bangYellow, key: 'Y', hex: '#c8a020' },
    { name: '백', mat: mats.bangWhite, key: 'W', hex: '#e8e0d0' },
    { name: '흑', mat: mats.bangBlack, key: 'K', hex: '#1a1a1c' },
  ];

  // Dial rail on front face
  const dialY = bodyY0 + BODY_H - 0.11;
  const dialZ = frontZ + 0.04;
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.12, 0.03, 0.06, woodMat, 0, dialY - 0.02, dialZ - 0.02));

  const dialXs = [-0.34, -0.17, 0, 0.17, 0.34];

  colors.forEach((c, i) => {
    const g = new THREE.Group();
    g.position.set(dialXs[i], dialY + 0.02, dialZ);
    // Brass rim disc (outer)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.018, 48), brassB);
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    rim.userData = { id: c.key, kind: 'dial', index: i };
    g.add(rim);
    const rolledEdge = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.0025, 6, 40), brassB);
    rolledEdge.position.z = 0.011;
    g.add(rolledEdge);
    for (let cut = 0; cut < 20; cut++) {
      const a = cut * Math.PI * 2 / 20;
      const ridge = boxMesh(THREE, 0.003, 0.006, 0.012, brass, Math.cos(a) * 0.061, Math.sin(a) * 0.061, 0);
      ridge.rotation.z = a - Math.PI / 2;
      g.add(ridge);
    }
    // Color inlay disc
    const enamel = new THREE.MeshPhysicalMaterial({ color: c.hex, roughness: 0.3, metalness: 0.05, clearcoat: 0.78, clearcoatRoughness: 0.2, emissive: 0x17130e, emissiveIntensity: 0.12 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.022, 40), enamel);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = 0.004;
    disc.castShadow = true;
    disc.userData = { id: c.key, kind: 'dial', index: i };
    g.add(disc);
    // Hanja / color plaque on face
    const plaqueMat = makeColorPlaque(c.name, c.hex);
    const plaque = new THREE.Mesh(new THREE.CircleGeometry(0.028, 20), plaqueMat);
    plaque.position.z = 0.018;
    plaque.userData = { id: c.key, kind: 'dial', index: i };
    g.add(plaque);
    // Brass pointer. Local +Y. rotation.z = stop * π/2 swings the tip onto that stop.
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.046, 0.012), brassB);
    notch.position.set(0, 0.062, 0.02);
    notch.userData = { id: c.key, kind: 'dial', index: i };
    g.add(notch);
    // Mount studs
    [-0.04, 0.04].forEach((oy) => {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), brass);
      stud.position.set(0, oy, -0.008);
      g.add(stud);
    });
    const hit = invisibleHit(THREE, 0.11, 0.11, 0.08, { id: c.key, kind: 'dial', index: i });
    g.add(hit);
    bodyGroup.add(g);
    interactives.push(hit, disc, rim, plaque, notch);
    const axle=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.046,16),iron);axle.rotation.x=Math.PI/2;
    axle.position.set(dialXs[i],dialY+.02,frontZ+.02);axle.name='DialFixedAxle_'+c.key;bodyGroup.add(axle);
    dialMeshes.push({ group: g, disc, notch, rim });
  });

  // rotation.z sends local +Y (0, r, 0) to (−sin θ, cos θ). Ticks use that offset
  // so the pointer tip and the engraved stop are the same direction.
  const TICK_R = 0.096;
  function stopOffset(stop, radius) {
    const th = stop * (Math.PI / 2);
    return { x: -Math.sin(th) * radius, y: Math.cos(th) * radius };
  }
  dialXs.forEach((dx, di) => {
    for (let t = 0; t < 4; t++) {
      const isTarget = t === DIAL_TARGET[di];
      const off = stopOffset(t, TICK_R);
      const alongX = Math.abs(off.x) > Math.abs(off.y);
      const radial = 0.022;
      const tickMat = brass.clone();
      if (tickMat.emissiveIntensity != null) tickMat.emissiveIntensity = 0.12;
      const tick = boxMesh(THREE,
        alongX ? radial : 0.012,
        alongX ? 0.012 : radial,
        0.01,
        tickMat,
        dx + off.x, dialY + 0.02 + off.y, dialZ + 0.016);
      tick.userData = { kind: 'ringTick', dial: di, stop: t, target: isTarget, motif: stopMotif(di, t, DIAL_TARGET[di]) };
      const glyph = motifPlaque(THREE, tick.userData.motif, brass, 0.028, 0.026);
      glyph.position.set(dx + off.x, dialY + 0.02 + off.y, dialZ + 0.023);
      bodyGroup.add(glyph);
      bodyGroup.add(tick);
      ringTicks.push(tick);
    }
  });

  // Yin-yang gear (appears after dials correct) — brass/disc mechanism
  const gearPivot = new THREE.Group();
  gearPivot.position.set(0, .23, frontZ + .06); gearPivot.scale.setScalar(.8);gearPivot.name='TaegeukPivot';
  bodyGroup.add(gearPivot);
  const gearAxle=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.07,20),iron);gearAxle.rotation.x=Math.PI/2;gearAxle.position.set(0,.23,frontZ+.025);gearAxle.name='TaegeukFixedAxle';bodyGroup.add(gearAxle);
  // Outer brass gear ring
  const gearRim = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.014, 8, 24), brassB);
  gearRim.rotation.x = 0;
  gearPivot.add(gearRim);
  // Tooth nubs around rim
  for (let t = 0; t < 8; t++) {
    const a = (t / 8) * Math.PI * 2;
    const tooth = bevelBoxMesh(THREE, 0.022, 0.016, 0.018, brass,
      Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0);
    tooth.rotation.z = a;
    gearPivot.add(tooth);
  }
  // Taegeuk halves
  const gearA = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 24), mats.bangWhite);
  gearA.rotation.x = Math.PI / 2;
  gearA.userData = { id: 'GEAR', kind: 'gear' };
  gearPivot.add(gearA);
  const taegeuk = new THREE.Shape();
  const taegeukR = 0.07;
  taegeuk.moveTo(0, taegeukR);
  taegeuk.absarc(0, 0, taegeukR, Math.PI / 2, Math.PI * 1.5, false);
  taegeuk.absarc(0, -taegeukR / 2, taegeukR / 2, -Math.PI / 2, Math.PI / 2, false);
  taegeuk.absarc(0, taegeukR / 2, taegeukR / 2, -Math.PI / 2, Math.PI / 2, true);
  taegeuk.closePath();
  const gearB = new THREE.Mesh(new THREE.ShapeGeometry(taegeuk, 32), mats.bangBlack);
  gearB.position.z = 0.013;
  gearB.userData = { id: 'GEAR', kind: 'gear' };
  gearPivot.add(gearB);
  // Center pin + one stud per taegeuk half (GEAR_CLICKS). Opposite, so either can meet the index.
  const gearPin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10), brassB);
  gearPin.rotation.x = Math.PI / 2;
  gearPin.position.z = 0.02;
  gearPivot.add(gearPin);
  const studs = [];
  for (let i = 0; i < GEAR_CLICKS; i++) {
    const a = Math.PI / 4 + i * (Math.PI * 2 / GEAR_CLICKS);
    const stud = new THREE.Mesh(
      new THREE.SphereGeometry(i === 0 ? 0.012 : 0.01, 8, 8),
      (i === 0 ? brassB : brass).clone(),
    );
    stud.position.set(Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0.028);
    stud.userData = { id: 'GEAR', kind: 'gear', stud: i };
    if (stud.material.emissiveIntensity != null) stud.material.emissiveIntensity = 0.3;
    gearPivot.add(stud);
    studs.push(stud);
    interactives.push(stud);
  }
  const gearHit = invisibleHit(THREE, 0.22, 0.20, 0.08, { id: 'GEAR', kind: 'gear' });
  gearPivot.add(gearHit);
  interactives.push(gearHit, gearA, gearB);

  // Fixed alignment index on body (gear sync cue — stud must meet this)
  const gearIndex = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.036, 0.01), brassB.clone());
  gearIndex.position.set(0, .23 + .08, frontZ + .05);
  if (gearIndex.material.emissiveIntensity != null) gearIndex.material.emissiveIntensity = 0.45;
  bodyGroup.add(gearIndex);

  // Seal case (어보) — framed lid compartment
  const seal = new THREE.Group();
  seal.position.set(0, .32, 0);
  seal.visible = false;
  bodyGroup.add(seal); seal.name='EoboLiftTray';
  const liftPosts=[];
  for(const side of [-1,1]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.012,.015,1,16),brass);
    post.name='EoboLiftPost';post.position.set(side*.10,.205,0);post.scale.y=.13;bodyGroup.add(post);liftPosts.push(post);
  }
  // Framed lacquer box
  seal.add(bevelBoxMesh(THREE, 0.3, 0.1, 0.3, woodDark, 0, 0, 0));
  seal.add(bevelBoxMesh(THREE, 0.26, 0.02, 0.26, woodMat, 0, 0.055, 0));
  // Brass frame rails
  seal.add(boxMesh(THREE, 0.32, 0.015, 0.32, brassB, 0, 0.065, 0));
  // Corner rivets on seal lid
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), brass);
    riv.position.set(sx * 0.13, 0.075, sz * 0.13);
    seal.add(riv);
  });
  // Seal knob (turtle / traditional finial hint)
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.07, 12), brassB);
  knob.position.y = 0.11;
  seal.add(knob);
  const knobTop = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), brass);
  knobTop.position.y = 0.155;
  seal.add(knobTop);
  seal.add(boxMesh(THREE, 0.16, 0.01, 0.12, mats.paper, 0, 0.08, 0.05));

  function applyDials() {
    dialMeshes.forEach((d, i) => {
      d.group.rotation.z = dialPos[i] * (Math.PI / 2);
      d.disc.material.emissiveIntensity = 0.12;
    });
  }

  function checkDials() {
    return dialMeshes.every((d, i) => atStop(d.group.rotation.z, DIAL_TARGET[i]));
  }

  function readRingMark() {
    const mark = new Array(DIAL_TARGET.length).fill(null);
    for (const tick of ringTicks) {
      if (!tick.userData.target) continue;
      mark[tick.userData.dial] = tick.userData.stop;
    }
    return mark;
  }

  function studAlign() {
    gearPivot.updateWorldMatrix(true, true);
    const pivot = new THREE.Vector3();
    const index = new THREE.Vector3();
    gearPivot.getWorldPosition(pivot);
    gearIndex.getWorldPosition(index);
    const aimX = index.x - pivot.x;
    const aimY = index.y - pivot.y;
    const aimLen = Math.hypot(aimX, aimY);
    if (aimLen < 1e-6) return 0;
    let best = -1;
    for (const stud of studs) {
      const p = new THREE.Vector3();
      stud.getWorldPosition(p);
      const dx = p.x - pivot.x;
      const dy = p.y - pivot.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      best = Math.max(best, (dx / len) * (aimX / aimLen) + (dy / len) * (aimY / aimLen));
    }
    return best;
  }

  function gearSeated() {
    return studAlign() > 0.92;
  }

  function softFailShake() {
    if (shake) shake(bodyGroup, 0.03, 360);
    else {
      const bx = bodyGroup.position.x;
      bodyGroup.position.x = bx + 0.025;
      art.later(() => { bodyGroup.position.x = bx; }, 80);
    }
  }

  function onSoftFail() {
    softFailCount += 1;
    badClicks = 0;
    softFailNoHint(api, softFailShake);
  }

  function enterGearPhase() {
    phase = 'gear';
    updateGearAlignCue(gearSeated());
    api.setObjective('태극 점을 위 지표에 맞춘 뒤, 아래 빗장으로 확정하시오.');
    api.setSteps('B', ['A']);
    api.playUnlock();
    api.vibrate([30, 20, 50]);
    api.toast('다섯 색이 눈금에 머뭅니다. 태극이 돕니다.', true);
  }

  function leaveGearPhase() {
    phase = 'dials';
    updateGearAlignCue(false);
    api.setObjective('뚜껑의 방위 문양을 읽어 각 색의 놋쇠 끝을 돌리시오.');
    api.setSteps('A', []);
    api.toast('색이 눈금에서 벗어나 태극이 멈췄소.');
  }

  function updateGearAlignCue(aligned) {
    const stud = studs[0];
    if (stud && stud.material && stud.material.emissiveIntensity != null) {
      stud.material.emissiveIntensity = aligned ? 0.95 : 0.35;
    }
    if (gearIndex.material && gearIndex.material.emissiveIntensity != null) {
      gearIndex.material.emissiveIntensity = aligned ? 0.85 : 0.4;
    }
  }

  function commitDial(index, stop) {
    dialPos[index] = stop;
    api.playThunk();
    if (checkDials()) { if (phase === 'dials') enterGearPhase(); }
    else if (phase === 'gear') leaveGearPhase();
  }

  const latchParts = [latchPlate, latchKey, latchRing, latchHit];
  const latchBases = latchParts.map(part => part.position.x);
  function setLatchPull(distance) { latchParts.forEach((part, i) => { part.position.x = latchBases[i] + distance; }); }
  const tactileClick = () => { api.playClick(); api.vibrate(9); };
  function getDragInteraction(kind, iid, hit) {
    if (phase === 'finale') return null;
    const index = hit?.userData?.index ?? hit?.object?.userData?.index ?? ['B', 'R', 'Y', 'W', 'K'].indexOf(iid);
    if (kind === 'dial' && dialMeshes[index]) return rotaryDrag({
      object: dialMeshes[index].group, axis: 'z', commit: stop => commitDial(index, stop), detent: tactileClick,
    });
    if (kind === 'gear') return rotaryDrag({
      object: gearPivot, axis: 'z', step: Math.PI / 4, allowed: checkDials, detent: tactileClick,
      changed: () => updateGearAlignCue(gearSeated()),
      blocked: () => { api.playWrong(); api.toast('오방색의 결구가 태극 축을 붙들고 있소.'); },
      commit: () => { api.playThunk(); updateGearAlignCue(gearSeated()); },
    });
    if (kind === 'confirm') return pullDrag({
      read: () => latchPlate.position.x, write: setLatchPull,
      ready: () => checkDials() && gearSeated(), confirm: onConfirm,
      blocked: () => onConfirm(),
    });
    return null;
  }
  function getGestureFrame(kind, iid, hit) {
    const index = hit?.userData?.index ?? hit?.object?.userData?.index ?? ['B', 'R', 'Y', 'W', 'K'].indexOf(iid);
    if (kind === 'dial' && dialMeshes[index]) return gestureFrame(THREE, dialMeshes[index].group, [0, 0, 1]);
    if (kind === 'gear') return gestureFrame(THREE, gearPivot, [0, 0, 1]);
    if (kind === 'confirm') return gestureFrame(THREE, latchPlate, [1, 0, 0], 'linear');
    return null;
  }

  function openSeal() {
    phase = 'finale';
    api.setSteps('C', ['A', 'B']);
    api.setObjective('어보 함과 단서를 확인하시오.');
    setLatchPull(0.06);
    // Open the real rear hinge before extending the tray through the top aperture.
    animateTo(lidPivot.rotation,'x',-Math.PI*.46,650,()=>{
      seal.visible = true;
      for(const post of liftPosts){animateTo(post.scale,'y',.395,650,null,'outCubic');animateVec3(post.position,new THREE.Vector3(post.position.x,.3375,0),650,null,'outCubic');}
      animateVec3(seal.position, new THREE.Vector3(0, .585, 0), 650, () => {
      api.playUnlock();
      api.vibrate([50, 30, 80]);
      api.showFinale({
        title: '어보 함 · 옥새의 그림자',
        body: '오방색이 방위를 찾고 태극이 맞물리자, 어보를 닮은 함이 열렸다. 안쪽 비단 위에 적힌 한 줄 — 「약장의 서랍은 서로 물고 물린다」.',
        footer: '— 동궁 인장 서고',
        epilogue: '제3장 어보 궤 — 해제 완료',
      });
      api.markCleared(id);
      },'outCubic');
    },'outCubic');
    api.toast('어보 함이 열렸습니다.', true);
  }

  function onConfirm() {
    if (phase === 'finale') return;
    if (!checkDials() || !gearSeated()) {
      api.playWrong();
      api.vibrate(18);
      api.toast(!checkDials()
        ? '오방색이 어긋나면 빗장이 열리지 않소.'
        : '태극 점이 지표에 닿은 뒤에 빗장을 오른쪽으로 당기시오.');
      return;
    }
    openSeal();
  }

  applyDials();

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives,
    getRingMeshes: () => ringTicks,
    getDragInteraction, getGestureFrame,
    build(scene) { scene.add(root); },
    start() { this.reset(); },
    reset() {
      art.clearTimers();
      phase = 'dials';
      dialPos = DIAL_START.slice();
      hintLevel = 0;
      softFailCount = 0;
      badClicks = 0;
      applyDials();
      gearPivot.rotation.z = 0;
      updateGearAlignCue(false);
      setLatchPull(0);
      seal.visible = false;
      seal.position.set(0,.32,0);lidPivot.rotation.x=0;
      for(const post of liftPosts){post.position.y=.205;post.scale.y=.13;}
      bodyGroup.position.x = 0;
      api.setObjective('뚜껑의 방위 문양을 읽어 각 색의 놋쇠 끝을 돌리시오.');
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      api.toast('어보 궤 — 뚜껑과 다이얼 둘레의 문양을 대조하시오.', true);
    },
    handleInteract(kind, iid, userData) {
      if (phase === 'finale') return;
      if (kind === 'dial') api.toast('놋쇠 테두리를 잡고 돌리시오. 뚜껑의 문양이 짝을 알려 줍니다.');
      else if (kind === 'gear') api.toast('태극의 톱니를 잡고 원을 그리며 돌리시오.');
      else if (kind === 'confirm') api.toast('빗장을 오른쪽으로 당겨 결구를 확인하시오.');
    },
    revealHint() {
      hintLevel = bumpHintLevel(hintLevel);
      requestHint(api, hintLevel, hintPack);
    },
    get mistook() { return softFailCount > 0; },
    solve() {
      dialPos = DIAL_TARGET.slice();
      applyDials();
      if (phase === 'dials') enterGearPhase();
      gearPivot.rotation.z = Math.PI / 4;
      updateGearAlignCue(true);
      onConfirm();
    },
    getState() {
      root.updateMatrixWorld(true);
      const pointers = dialMeshes.map((d) => {
        const p = new THREE.Vector3();
        d.notch.getWorldPosition(p);
        return { x: p.x, y: p.y, z: p.z };
      });
      const ticks = ringTicks.map((t) => {
        const p = new THREE.Vector3();
        t.getWorldPosition(p);
        return { dial: t.userData.dial, stop: t.userData.stop, target: !!t.userData.target, x: p.x, y: p.y, z: p.z };
      });
      return {
        phase,
        dialPos: dialPos.slice(),
        dialAngles: dialMeshes.map(d => d.group.rotation.z),
        dialsHeld: checkDials(),
        latchPull: latchPlate.position.x,
        clueMotifs: DIAL_TARGET.map((_, i) => MOTIFS[i % 4]),
        dialMotifs: DIAL_TARGET.map((target, i) => [0, 1, 2, 3].map(stop => stopMotif(i, stop, target))),
        ringMark: readRingMark(),
        gearSeated: gearSeated(),
        studAlign: studAlign(),
        gearAngle: gearPivot.rotation.z,
        lidAngle: lidPivot.rotation.x,
        sealPosition: seal.position.toArray(),
        liftTop: liftPosts[0].position.y + liftPosts[0].scale.y/2,
        hintLevel,
        studCount: studs.length,
        ticks,
        pointers,
      };
    },
    dispose(scene) { scene.remove(root); art.dispose(root); interactives.length = 0; },
  };
}
