/**
 * Chapter 10 — 태극 옥좌 밀실 궤
 *
 * 아홉 부품은 방위 홈의 문양(SLOT_DIRS / PART_SLOT)과 같은 부품만 앉는다.
 * 등롱 각이 만드는 그림자가 일월 표적과 SHADOW_TOL 이하로 겹쳐도 핀으로 가지 않는다.
 * 그 겹침에서만 빗장이 보이고, 확정 뒤에 핀. 다음 핀은 이전 핀이 앉아 있을 때만 움직이고,
 * 빼면 다음이 죽는다. 첫 핀(TEACHING_PIN)은 시작 시 미장착. 앉은 핀 0.
 * 엔딩 문장과 증거 게이트는 유지.
 *
 * Soft-fail never advances hints. Hints: request-only observe → relate → FULL.
 * Phases: parts → lantern → pins → endings → finale.
 * Visual: throne wall silhouette larger than the chest, sun/moon target, pin ticks.
 */
import { bevelBoxMesh as boxMesh, invisibleHit } from '../materials.js';
import { insetFrame, screwHead, cloudRelief, taegeukInlay, disposeCraftRoot } from './craft-finish.js';
import { PARTS, PART_SLOT, SLOT_DIRS, PART_MARKS } from '../inventory.js';
import { bumpHintLevel, requestHint, softFailNoHint } from '../hint-policy.js';
import {
  ENDING_BRIEFS, evaluateEnding, citeEndingBody, MISSING_EVIDENCE_GUIDE,
} from '../ledger.js';

export const id = 10;
export const title = '태극 옥좌 밀실 궤';
export const blurb = '아홉 놋쇠·그림자 투영·무정 코어로 밀실을 열고 의금부에 전하시오.';
export const steps = [
  { id: 'A', label: 'A 아홉쇠' },
  { id: 'B', label: 'B 그림자' },
  { id: 'C', label: 'C 무정' },
  { id: 'D', label: '결말' },
];
/** Non-spoiler footer; FULL only via explicit revealHint ×3 */
export const hint = '방위 홈의 문양과 같은 놋쇠만 앉습니다. 등롱 그림자와 일월 표적, 무정 핀 눈금을 살피시오. 첫 핀은 아직 빠져 있소.';
export const HINT_PARTIAL = '홈에 새긴 방위와 같은 부품만 안치하시오. 등롱 그림자를 일월 표적에 겹치고, 무정 판의 핀 눈금을 따르시오.';
export const HINT_RELATION = '그림자가 일월에 겹쳐도 핀은 열리지 않습니다. 그 겹침에서만 빗장이 나오고, 벗어나면 빗장만 숨습니다. 다음 핀은 이전 핀이 앉아 있을 때만 움직이고, 빼면 다음이 멈춥니다.';
/** Spoiler: lantern index + pin order */
export const HINT_FULL = '정답: 등롱 칸 3 · 겹친 뒤 빗장 · 핀 [2, 0, 3, 1]';
const HINT_PACK = { base: hint, partial: HINT_PARTIAL, relation: HINT_RELATION, full: HINT_FULL };

export const LANTERN_TARGET = 3; // 0–7
export const LANTERN_STEPS = 8;
export const PIN_ORDER = [2, 0, 3, 1];
/** Shadow center vs sun/moon center. One lantern step is SHADOW_STEP, past this tolerance. */
export const SHADOW_TOL = 0.04;
export const SHADOW_STEP = 0.06;

/** First pin in PIN_ORDER. Starts unmounted; the rim is only a mark. */
export const TEACHING_PIN = 2;

/** Existing slot-direction pattern. Glyphs only name SLOT_DIRS; the check is PART_SLOT. */
const DIR_GLYPH = {
  N: '북', NE: '북동', E: '동', SE: '남동', S: '남',
  SW: '남서', W: '서', NW: '북서', C: '중',
};

/** Wrong lantern/pin clicks before soft-fail shake + gated hint */
export const SOFT_FAIL_AFTER = 5;

export const ENDINGS = [
  {
    id: 'direct',
    label: '직접 의금부에 올리기',
    title: '결말 甲 · 직소',
    body: '사천장은 증거를 품에 안고 의금부 대문으로 향했다. 심문은 혹독했으나, 여섯—아니 열 궤에서 나온 서찰은 거짓을 이길 수 없었다. 세자의 원한이 조정에 울렸다.',
    footer: '— 의금부 직소 기록',
    epilogue: '엔딩 A: 직접 고발 · 조정이 흔들린다',
  },
  {
    id: 'envoy',
    label: '밀사로 전하기',
    title: '결말 乙 · 밀사',
    body: '사천장은 믿을 수 있는 내관에게 봉함 서류를 맡겼다. 밀사는 밤길을 달려 의금부에 닿았고, 이름 없는 손으로 진실이 심어졌다. 다음 날, 조정은 조용히 뒤집히기 시작했다.',
    footer: '— 밀사 봉함 기록',
    epilogue: '엔딩 B: 밀사 전달 · 그림자가 먼저 움직인다',
  },
  {
    id: 'seal',
    label: '서고에 다시 봉인',
    title: '결말 丙 · 봉인',
    body: '사천장은 아직 때가 아니라 판단했다. 아홉 놋쇠와 서찰을 태극 옥좌 밀실에 다시 봉인하고, 「후일의 사천장에게」라는 쪽지만 남겼다. 진실은 잠들었으나, 궤는 기다린다.',
    footer: '— 서고 봉인 기록',
    epilogue: '엔딩 C: 재봉인 · 비밀은 대를 잇는다',
  },
];

export function create(api) {
  const { THREE, mats, animateTo, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch10_taegeuk';

  let phase = 'parts'; // parts | lantern | pins | endings | finale
  let placed = {}; // slotDir -> partId
  let selectedPartId = null;
  let lanternPos = 0;
  const pinSeated = new Set();
  let endingChosen = null;
  let softFailCount = 0;
  let badClicks = 0;
  let hintLevel = 0;
  const interactives = [];
  const slotMeshes = {};
  const pinMeshes = [];
  const dirPlaques = [];
  const shadowTicks = [];


  const woodMat = (mats.sliceWood || mats.woodRich || mats.wood).clone();
  woodMat.color.multiply(new THREE.Color(0xc6a690));
  const woodDark = mats.sliceWoodDark || mats.woodDark;
  const woodAcc = mats.woodAccent || woodMat;
  const lacquer = new THREE.MeshPhysicalMaterial({color:0x211719,roughness:.29,metalness:.08,clearcoat:.55,clearcoatRoughness:.23,bumpMap:mats.sliceWood?.bumpMap || null,bumpScale:.0008});
  const brass = mats.sliceBrass || mats.brass;
  const brassB = mats.sliceBrassBright || mats.brassBright || brass;
  const iron = mats.iron;

  // ---- Throne / secret-chest carcass (태극 옥좌 밀실) ----
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const BASE_W = 1.15;
  const BASE_D = 0.82;
  // Pedestal base
  bodyGroup.add(boxMesh(THREE, BASE_W, 0.22, BASE_D, woodDark, 0, 0.18, 0));
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.028, 0.18, BASE_D - 0.06, woodMat,
      sx * (BASE_W / 2 - 0.015), 0.18, 0));
  });
  bodyGroup.add(boxMesh(THREE, BASE_W - 0.08, 0.045, 0.025, woodMat, 0, 0.08, BASE_D / 2 - 0.01));
  // Top platform
  bodyGroup.add(boxMesh(THREE, BASE_W + 0.04, 0.05, BASE_D + 0.04, woodMat, 0, 0.32, 0));
  bodyGroup.add(boxMesh(THREE, BASE_W - 0.12, 0.016, BASE_D - 0.1, lacquer, 0, 0.348, 0));

  // Seat / chest body — size reference for the wall silhouette
  const seatBody = boxMesh(THREE, 0.72, 0.42, 0.27, woodDark, 0, 0.55, -0.185);
  seatBody.userData = { kind: 'throneBody', role: 'furniture' };
  bodyGroup.add(seatBody);

  // Wall silhouette behind the throne, larger than the chest
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x786e5a, map:mats.slicePaper?.map || null, roughness: 0.94, metalness: 0 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.35, 0.06), wallMat);
  wall.position.set(0, 1.25, -0.78);
  wall.userData = { kind: 'throneWall', role: 'silhouette' };
  root.add(wall);
  const wallFace = new THREE.MeshStandardMaterial({ color: 0x333d43, map:mats.slicePaper?.map || null, roughness: 0.9, metalness: 0 });
  const wallPanel = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.85, 0.025), wallFace);
  wallPanel.position.set(0, 1.28, -0.74);
  root.add(wallPanel);
  insetFrame(THREE, root, 1.56, 1.86, brass, 0, 1.28, -.718, .014);
  // Restrained royal cloud carving, outside the shadow target and slot markings.
  for (const side of [-1,1]) {
    cloudRelief(THREE, root, brass, side*.39, 1.73, -.714, 1.1, side);
    cloudRelief(THREE, root, woodMat, side*.39, 1.68, -.712, 1.1, side);
    insetFrame(THREE, bodyGroup, .29, .25, brass, side*.245, 1.06, -.28, .006);
    cloudRelief(THREE, bodyGroup, brass, side*.245, 1.045, -.277, .85, side);
  }
  root.add(boxMesh(THREE, 0.07, 1.7, 0.03, woodDark, -0.62, 1.2, -0.73));
  root.add(boxMesh(THREE, 0.07, 1.7, 0.03, woodDark, 0.62, 1.2, -0.73));
  root.add(boxMesh(THREE, 1.4, 0.08, 0.035, woodDark, 0, 2.02, -0.73));
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.022, 0.38, 0.46, woodMat, sx * 0.35, 0.55, -0.06));
  });
  bodyGroup.add(boxMesh(THREE, 0.76, 0.04, 0.56, woodMat, 0, 0.78, -0.06));
  bodyGroup.add(boxMesh(THREE, 0.68, 0.018, 0.48, lacquer, 0, 0.805, -0.06));

  // Backrest (고좌)
  bodyGroup.add(boxMesh(THREE, 0.92, 0.1, 0.08, lacquer, 0, 0.88, -0.3));
  bodyGroup.add(boxMesh(THREE, 0.88, 0.42, 0.06, woodDark, 0, 1.05, -0.32));
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.05, 0.55, 0.08, woodMat, sx * 0.44, 0.98, -0.32));
  });
  bodyGroup.add(boxMesh(THREE, 0.96, 0.04, 0.1, woodMat, 0, 1.28, -0.32));
  bodyGroup.add(boxMesh(THREE, 0.9, 0.016, 0.08, woodAcc, 0, 1.31, -0.32));

  // Armrests
  [-1, 1].forEach((sx) => {
    bodyGroup.add(boxMesh(THREE, 0.1, 0.06, 0.42, woodMat, sx * 0.42, 0.72, -0.02));
    bodyGroup.add(boxMesh(THREE, 0.07, 0.28, 0.07, woodDark, sx * 0.42, 0.55, 0.16));
  });

  // Shaped feet + brass shoes
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(boxMesh(THREE, 0.08, 0.1, 0.07, woodDark,
      sx * (BASE_W / 2 - 0.12), 0.05, sz * (BASE_D / 2 - 0.1)));
    bodyGroup.add(boxMesh(THREE, 0.058, 0.014, 0.05, brass,
      sx * (BASE_W / 2 - 0.12), 0.01, sz * (BASE_D / 2 - 0.1)));
  });
  bodyGroup.add(boxMesh(THREE, 0.16, 0.05, 0.055, woodDark, 0, 0.03, BASE_D / 2 - 0.06));

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
  const frontZ = BASE_D / 2 - 0.01;
  const rearZ = -BASE_D / 2 + 0.01;
  cornerBracket(-BASE_W / 2 + 0.02, 0.28, frontZ, 0);
  cornerBracket(BASE_W / 2 - 0.02, 0.28, frontZ, -Math.PI / 2);
  cornerBracket(-BASE_W / 2 + 0.02, 0.1, frontZ, 0);
  cornerBracket(BASE_W / 2 - 0.02, 0.1, frontZ, -Math.PI / 2);
  cornerBracket(-BASE_W / 2 + 0.02, 0.28, rearZ, Math.PI / 2);
  cornerBracket(BASE_W / 2 - 0.02, 0.28, rearZ, Math.PI);
  cornerBracket(-0.34, 0.72, 0.18, 0);
  cornerBracket(0.34, 0.72, 0.18, -Math.PI / 2);

  // Front latch plate
  bodyGroup.add(boxMesh(THREE, 0.09, 0.07, 0.014, brassB, 0, 0.2, frontZ + 0.01));
  const latchKey = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.016, 8), iron);
  latchKey.rotation.x = Math.PI / 2;
  latchKey.position.set(0, 0.21, frontZ + 0.02);
  bodyGroup.add(latchKey);
  const latchRing = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0035, 6, 12), brass);
  latchRing.position.set(0, 0.18, frontZ + 0.022);
  bodyGroup.add(latchRing);

  // Rivet strip
  for (let i = 0; i < 7; i++) {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
    riv.position.set(-0.42 + i * 0.14, 0.33, frontZ + 0.02);
    bodyGroup.add(riv);
  }

  // Side ring pulls
  [-1, 1].forEach((sx) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 14), brass);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(sx * (BASE_W / 2 + 0.01), 0.2, 0);
    bodyGroup.add(ring);
    bodyGroup.add(boxMesh(THREE, 0.01, 0.04, 0.032, brass,
      sx * (BASE_W / 2 + 0.005), 0.2, 0));
  });

  // ---- Taegeuk disc (crafted mount) ----
  bodyGroup.add(boxMesh(THREE, 0.28, 0.28, 0.04, lacquer, 0, 0.7, 0.2));
  const taeRim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.009, 10, 64), brassB);
  taeRim.position.set(0, 0.7, 0.23);
  bodyGroup.add(taeRim);
  const redEnamel = new THREE.MeshPhysicalMaterial({color:0x973833,roughness:.3,clearcoat:.58,metalness:.12});
  const blueEnamel = new THREE.MeshPhysicalMaterial({color:0x264c63,roughness:.3,clearcoat:.58,metalness:.12});
  taegeukInlay(THREE, root, redEnamel, blueEnamel, .119, 0, .7, .239);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + 0.4;
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), brass);
    riv.position.set(Math.cos(ang) * 0.14, 0.7 + Math.sin(ang) * 0.14, 0.24);
    bodyGroup.add(riv);
  }

  // The forward console rests on rails rather than floating above the pedestal.
  for (const x of [-0.30, 0.30]) {
    root.add(boxMesh(THREE, 0.045, 0.075, 0.64, woodDark, x, 0.365, 0.32));
  }
  // ---- 9 directional slots on a crafted plate ----
  root.add(boxMesh(THREE, 0.78, 0.05, 0.78, lacquer, 0, 0.4, 0.38));
  root.add(boxMesh(THREE, 0.82, 0.02, 0.82, brass, 0, 0.425, 0.38));
  root.add(boxMesh(THREE, 0.7, 0.012, 0.7, woodDark, 0, 0.43, 0.38));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const bg = new THREE.Group();
    bg.position.set(sx * 0.36, 0.435, 0.38 + sz * 0.36);
    bg.add(boxMesh(THREE, 0.06, 0.01, 0.022, brassB, sx * 0.02, 0, 0));
    bg.add(boxMesh(THREE, 0.022, 0.01, 0.06, brassB, 0, 0, sz * 0.02));
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), brass);
    riv.position.set(sx * 0.015, 0.008, sz * 0.015);
    bg.add(riv);
    root.add(bg);
  });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const rail = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 5, 10), brass);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(Math.cos(ang) * 0.32, 0.44, 0.38 + Math.sin(ang) * 0.32);
    root.add(rail);
  }

  // Spread further so SW/대각 are readable in default 3/4 camera (QA Major)
  const slotLayout = {
    N: [0, 0.28], NE: [0.22, 0.22], E: [0.28, 0], SE: [0.22, -0.22],
    S: [0, -0.28], SW: [-0.22, -0.22], W: [-0.28, 0], NW: [-0.22, 0.22],
    C: [0, 0],
  };

  SLOT_DIRS.forEach((dir) => {
    const [sx, sz] = slotLayout[dir];
    const g = new THREE.Group();
    g.position.set(sx, 0.452, 0.38 + sz);
    g.add(boxMesh(THREE, 0.09, 0.012, 0.09, brass, 0, -0.01, 0));
    const cupMat = woodAcc.clone();
    cupMat.emissive.setHex(0x6a4820);
    cupMat.emissiveIntensity = 0.42; // empty-slot silhouette (QA Major)
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.032, 14), cupMat);
    cup.userData = { id: dir, kind: 'slot', dir };
    g.add(cup);
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.005, 6, 16), brassB.clone());
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.014;
    if (innerRing.material.emissiveIntensity != null) innerRing.material.emissiveIntensity = 0.55;
    g.add(innerRing);
    g.add(boxMesh(THREE, 0.032, 0.012, 0.024, brassB, 0, 0.022, 0));
    // Direction plaque — helps find SW/대각 in 3/4 view
    const tag = boxMesh(THREE, 0.04, 0.01, 0.028, brassB, 0, 0.002, 0.055);
    tag.userData = { id: dir, kind: 'slot', dir };
    g.add(tag);
    for (let r = 0; r < 3; r++) {
      const ang = (r / 3) * Math.PI * 2;
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), brass);
      riv.position.set(Math.cos(ang) * 0.034, 0.012, Math.sin(ang) * 0.034);
      g.add(riv);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.028), brassB.clone());
    gem.position.y = 0.045;
    gem.visible = false;
    g.add(gem);
    // Larger hit + sphere for easier targeting
    const hit = invisibleHit(THREE, 0.16, 0.14, 0.16, { id: dir, kind: 'slot', dir });
    hit.position.y = 0.02;
    g.add(hit);
    const hitBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 10),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitBall.position.y = 0.03;
    hitBall.userData = { id: dir, kind: 'slot', dir };
    g.add(hitBall);
    root.add(g);
    interactives.push(cup, tag, hit, hitBall);
    slotMeshes[dir] = { group: g, cup, gem, ring: innerRing };
  });

  // ---- Lantern housing / gyro (등롱) ----
  const lanternMount = new THREE.Group();
  lanternMount.name = 'ch10-lantern-mount';
  lanternMount.position.set(-0.48, 0.78, 0.15);
  lanternMount.visible = false;
  root.add(lanternMount);
  const lanternPivot = new THREE.Group();
  lanternPivot.name = 'ch10-lantern-rotor';
  lanternMount.add(lanternPivot);

  // Stand
  // The stand reaches the platform at y=.356 and stays still while the lantern turns.
  lanternMount.add(boxMesh(THREE, 0.12, 0.025, 0.12, woodDark, 0, -0.412, 0));
  lanternMount.add(boxMesh(THREE, 0.04, 0.37, 0.04, woodMat, 0, -0.215, 0));
  lanternMount.add(boxMesh(THREE, 0.06, 0.02, 0.06, brass, 0, -0.025, 0));
  const lanternBearing = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.025, 24), brass);
  lanternBearing.position.y = -0.002;
  lanternMount.add(lanternBearing);

  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.11), brass.clone());
  lantern.position.y = 0.08;
  lantern.userData = { id: 'LANTERN', kind: 'lantern' };
  lanternPivot.add(lantern);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    lanternPivot.add(boxMesh(THREE, 0.012, 0.16, 0.012, brassB, sx * 0.05, 0.08, sz * 0.05));
  });
  lanternPivot.add(boxMesh(THREE, 0.14, 0.03, 0.14, brassB, 0, 0.17, 0));
  lanternPivot.add(boxMesh(THREE, 0.06, 0.04, 0.06, brass, 0, 0.2, 0));
  [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([sx, sz]) => {
    lanternPivot.add(boxMesh(THREE, sx === 0 ? 0.09 : 0.008, 0.12, sz === 0 ? 0.09 : 0.008,
      mats.slicePaper || mats.paper, sx * 0.052, 0.08, sz * 0.052));
  });
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), mats.beam.clone());
  flame.position.y = 0.1;
  lanternPivot.add(flame);
  // The paper screen has its own fixed frame. It must not orbit the lamp.
  const silhouetteFrame = new THREE.Group();
  silhouetteFrame.name = 'ch10-lantern-paper-frame';
  silhouetteFrame.position.set(0.58, 0.22, 0);
  silhouetteFrame.rotation.y = -0.3;
  lanternMount.add(silhouetteFrame);
  const silhouette = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), mats.paper.clone());
  silhouette.name = 'ch10-lantern-paper';
  silhouetteFrame.add(silhouette);
  silhouetteFrame.add(boxMesh(THREE, 0.26, 0.02, 0.02, woodDark, 0, 0.15, 0));
  silhouetteFrame.add(boxMesh(THREE, 0.26, 0.02, 0.02, woodDark, 0, -0.15, 0));
  [-1, 1].forEach(side => {
    silhouetteFrame.add(boxMesh(THREE, 0.02, 0.34, 0.02, woodDark, side * 0.11, -0.01, 0));
    silhouetteFrame.add(boxMesh(THREE, 0.045, 0.014, 0.07, brass, side * 0.11, -0.182, 0));
  });
  const lanternHit = invisibleHit(THREE, 0.22, 0.28, 0.22, { id: 'LANTERN', kind: 'lantern' });
  lanternHit.position.y = 0.08;
  lanternPivot.add(lanternHit);
  interactives.push(lantern, lanternHit, flame);

  // Target glyph marker
  const glyphTarget = boxMesh(THREE, 0.08, 0.12, 0.01, mats.bangBlack, 0.35, 0.75, 0.4);
  glyphTarget.visible = false;
  root.add(glyphTarget);
  const glyphFrame = boxMesh(THREE, 0.12, 0.16, 0.02, brass, 0.35, 0.75, 0.385);
  glyphFrame.visible = false;
  root.add(glyphFrame);
  // Sync glyphFrame visibility with glyphTarget in applyLantern via patch below

  // ---- 등롱 각도 / shadow world-rule plaque + worn tick teaching ----
  function makeRulePlaque(label, w = 128, h = 36) {
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
  function makeDirPlaque(label) {
    try {
      const c = document.createElement('canvas');
      c.width = 160;
      c.height = 96;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1a100c';
      ctx.fillRect(0, 0, 160, 96);
      ctx.strokeStyle = '#c9a84a';
      ctx.lineWidth = 6;
      ctx.strokeRect(5, 5, 150, 86);
      ctx.fillStyle = '#f3e6c4';
      ctx.font = label.length > 1 ? 'bold 40px serif' : 'bold 64px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 80, 52);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.55, metalness: 0.08,
        emissive: 0x1a1008, emissiveIntensity: 0.22,
      });
    } catch (_) {
      return brassB.clone();
    }
  }
  SLOT_DIRS.forEach((dir) => {
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.008), makeDirPlaque(PART_MARKS[PARTS.find(p=>PART_SLOT[p.id]===dir).id]));
    plaque.position.set(0, 0.055, 0.068);
    plaque.userData = { kind: 'slotGlyph', dir, glyph: PART_MARKS[PARTS.find(p=>PART_SLOT[p.id]===dir).id] };
    slotMeshes[dir].group.add(plaque);
  });
  // Worn angle ticks around lantern stand — brighter at LANTERN_TARGET (teaching cue)
  for (let s = 0; s < LANTERN_STEPS; s++) {
    const ang = s * (Math.PI / 4);
    const tick = boxMesh(THREE, 0.022, 0.006, 0.008,
      iron,
      Math.cos(ang) * 0.14, -0.22, Math.sin(ang) * 0.14);
    lanternMount.add(tick);
  }
  const lanternRule = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.07),
    makeRulePlaque('등롱 · 그림자'),
  );
  lanternRule.position.set(0.35, -0.22, 0.2);
  lanternMount.add(lanternRule);

  // ---- Wooden pins (무정 코어) densified housing ----
  const pinGroup = new THREE.Group();
  pinGroup.position.set(0.42, 0.58, 0.12);
  root.add(pinGroup);
  pinGroup.add(boxMesh(THREE, 0.28, 0.22, 0.22, woodDark, 0, 0, 0));
  pinGroup.add(boxMesh(THREE, 0.24, 0.18, 0.02, woodMat, 0, 0, 0.11));
  pinGroup.add(boxMesh(THREE, 0.22, 0.16, 0.012, brass, 0, 0, 0.125));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 5, 5), brassB);
    riv.position.set(sx * 0.09, sy * 0.06, 0.135);
    pinGroup.add(riv);
  });
  pinGroup.add(boxMesh(THREE, 0.14, 0.02, 0.008, brassB, 0, 0.09, 0.132));

  const pinPositions = [[-0.06, 0.08], [0.06, 0.08], [-0.06, -0.06], [0.06, -0.06]];
  for (let i = 0; i < 4; i++) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.2, 10), woodAcc.clone());
    pin.position.set(pinPositions[i][0], 0.05, pinPositions[i][1]);
    pin.userData = { id: `PIN${i}`, kind: 'pin', role: 'pin', index: i };
    pinGroup.add(pin);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 10), brassB);
    head.position.set(0, 0.1, 0);
    head.userData = { id: `PIN${i}`, kind: 'pin', index: i };
    pin.add(head);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 5, 10), brass);
    collar.rotation.x = Math.PI / 2;
    collar.name = `ch10-pin-collar-${i}`;
    collar.position.set(0, 0.08, 0);
    pin.add(collar);
    const hit = invisibleHit(THREE, 0.08, 0.22, 0.08, { id: `PIN${i}`, kind: 'pin', index: i });
    pin.add(hit);
    interactives.push(pin, hit, head);
    pinMeshes.push(pin);
    // A plain contact plate remains interactive; exposed gate rods carry the relation.
    const pinStep = PIN_ORDER.indexOf(i);
    const stepGlyph = ''; // The visible gate links replace numbered solution labels.
    const pinPlaque = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.04, 0.008),
      makeDirPlaque(stepGlyph),
    );
    pinPlaque.position.set(pinPositions[i][0], -0.09, 0.16);
    pinPlaque.userData = { id: `PIN${i}`, kind: 'pinTick', role: 'pinTick', index: i, step: pinStep };
    pinGroup.add(pinPlaque);
    interactives.push(pinPlaque);

  }
  // Exposed gate rods show cause and effect without printing a pin sequence.
  const pinLinks = [];
  for (let step = 1; step < PIN_ORDER.length; step++) {
    const from = PIN_ORDER[step - 1], to = PIN_ORDER[step];
    const a = new THREE.Vector3(pinPositions[from][0], 0.122, pinPositions[from][1]);
    const b = new THREE.Vector3(pinPositions[to][0], 0.122, pinPositions[to][1]);
    const delta = b.clone().sub(a), normal = new THREE.Vector3(-delta.z, 0, delta.x).normalize();
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, delta.length(), 8), brass);
    rail.position.copy(a.clone().add(b).multiplyScalar(0.5));
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    pinGroup.add(rail);
    const gate = boxMesh(THREE, 0.043, 0.012, 0.012, iron, b.x, 0.12, b.z);
    gate.rotation.y = -Math.atan2(normal.z, normal.x);
    pinGroup.add(gate);
    pinLinks.push({ from, to, gate, base: gate.position.clone(), normal });
  }

  const pinRule = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.06),
    makeRulePlaque('무정 · 걸림쇠'),
  );
  pinRule.position.set(0, 0.14, 0.14);
  pinGroup.add(pinRule);

  // Field copies — always present so solo Ch10 is not a memory test
  root.add(boxMesh(THREE, 0.25, 0.022, 0.68, woodDark, -0.555, 0.492, 0.04));
  for (const z of [-0.16, 0.24]) {
    root.add(boxMesh(THREE, 0.04, 0.14, 0.035, brass, -0.54, 0.422, z));
  }
  const briefIds = ['direct', 'envoy', 'seal'];
  const briefLabels = ['직소 쪽지', '밀사 쪽지', '봉인 쪽지'];
  briefIds.forEach((bid, i) => {
    const g = new THREE.Group();
    g.position.set(-0.58, 0.52, -0.18 + i * 0.22);
    g.add(boxMesh(THREE, 0.16, 0.012, 0.2, mats.paper || brass, 0, 0, 0));
    g.add(boxMesh(THREE, 0.17, 0.006, 0.21, brassB, 0, -0.008, 0));
    const pl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.05),
      makeRulePlaque(briefLabels[i], 128, 36),
    );
    pl.rotation.x = -Math.PI / 2;
    pl.position.y = 0.01;
    pl.userData = { id: 'BRIEF_' + bid, kind: 'brief', endingId: bid };
    g.add(pl);
    const hit = invisibleHit(THREE, 0.18, 0.06, 0.22, { id: 'BRIEF_' + bid, kind: 'brief', endingId: bid });
    g.add(hit);
    root.add(g);
    interactives.push(pl, hit);
  });

  // Facing the chapter camera so the nine direction marks and the shadow scale stay in frame.
  const shadowRig = new THREE.Group();
  shadowRig.name = 'ch10-shadow';
  shadowRig.position.set(0.34, 0.96, 0.46);
  shadowRig.lookAt(1.85, 1.4, 1.75);
  root.add(shadowRig);
  SLOT_DIRS.forEach((dir, panel) => {
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.042, 0.008), makeDirPlaque(DIR_GLYPH[dir]));
    plaque.position.set(-0.16, (panel - 4) * 0.05, 0.02);
    plaque.userData = { kind: 'dir', role: 'dir', dir, panel, glyph: DIR_GLYPH[dir] };
    shadowRig.add(plaque);
    dirPlaques.push(plaque);
  });
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xb3a182, map:mats.slicePaper?.map || null, roughness: 0.94, metalness: 0.02 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.012), boardMat);
  board.position.set(0.02, 0.03, 0);
  shadowRig.add(board);
  insetFrame(THREE, shadowRig, .218, .64, woodDark, .02, .03, -.004, .014);
  // A physical bracket fixes the scale to the armrest rather than leaving it suspended.
  shadowRig.add(boxMesh(THREE, .06, .22, .032, brass, .02, -.40, -.015));
  const sunMat = new THREE.MeshStandardMaterial({
    color: 0xf0d080, emissive: 0xc9a46a, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.2,
  });
  const moonMat = new THREE.MeshStandardMaterial({
    color: 0xf4f0e6, emissive: 0x9a9a9a, emissiveIntensity: 0.25, roughness: 0.45, metalness: 0.15,
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), sunMat);
  sun.position.set(-0.02, 0.016, 0.02);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), moonMat);
  moon.position.set(0.022, -0.012, 0.02);
  const targetCenter = new THREE.Mesh(
    new THREE.SphereGeometry(0.01, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.5, metalness: 0.1 }),
  );
  targetCenter.position.set(0, 0, 0.02);
  targetCenter.userData = { kind: 'sunMoon', role: 'target' };
  shadowRig.add(sun, moon, targetCenter);
  for (let s = 0; s < LANTERN_STEPS; s++) {
    const worn = s === LANTERN_TARGET;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.012, 0.01),
      new THREE.MeshStandardMaterial({
        color: 0x4a3a28,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.6,
      }),
    );
    tick.position.set(0.055, (s - LANTERN_TARGET) * SHADOW_STEP, 0.02);
    tick.userData = { kind: 'shadowTick', role: worn ? 'worn' : 'tick', step: s };
    shadowRig.add(tick);
    shadowTicks.push(tick);
  }
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x140e0a, roughness: 0.8, metalness: 0.05 });
  const shadowBar = new THREE.Mesh(new THREE.BoxGeometry(0.016, SHADOW_STEP, 0.01), shadowMat);
  shadowRig.add(shadowBar);
  const shadowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), shadowMat);
  shadowCenter.userData = { kind: 'lanternShadow', role: 'shadow' };
  shadowRig.add(shadowCenter);
  const confirmGroup = new THREE.Group();
  confirmGroup.name = 'ch10-shadow-latch';
  confirmGroup.position.set(0.1, 0, 0.03);
  confirmGroup.visible = false;
  const confirmBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.04, 0.016),
    new THREE.MeshStandardMaterial({
      color: 0xc9a46a, emissive: 0xc9a46a, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.45,
    }),
  );
  confirmBar.userData = { id: 'SHADOW_LATCH', kind: 'lanternConfirm' };
  confirmGroup.add(confirmBar);
  const confirmHit = invisibleHit(THREE, 0.1, 0.08, 0.06, { id: 'SHADOW_LATCH', kind: 'lanternConfirm' });
  confirmGroup.add(confirmHit);
  shadowRig.add(confirmGroup);
  interactives.push(confirmBar, confirmHit);

  function ownedIds() {
    return api.getInventory ? api.getInventory() : new Set(PARTS.map((p) => p.id));
  }

  function applySlots() {
    SLOT_DIRS.forEach((dir) => {
      const s = slotMeshes[dir];
      const pid = placed[dir];
      s.gem.visible = !!pid;
      if (pid) {
        const ok = PART_SLOT[pid] === dir;
        s.cup.material.emissiveIntensity = ok ? 0.4 : 0.2;
        s.gem.material.color.setHex(ok ? 0xb8954a : 0x8a4040);
      } else {
        s.cup.material.emissive.setHex(0x6a4820);
        s.cup.material.emissiveIntensity = 0.48;
        if (s.ring && s.ring.material.emissiveIntensity != null) s.ring.material.emissiveIntensity = 0.6;
      }
    });
  }

  function allPartsPlacedCorrect() {
    if (Object.keys(placed).length < 9) return false;
    return PARTS.every((p) => placed[PART_SLOT[p.id]] === p.id);
  }

  function readShadow() {
    root.updateMatrixWorld(true);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    shadowCenter.getWorldPosition(a);
    targetCenter.getWorldPosition(b);
    const dist = a.distanceTo(b);
    return { dist, matched: dist <= SHADOW_TOL };
  }

  function applyLantern() {
    lanternPivot.rotation.y = lanternPos * (Math.PI / 4);
    const along = (lanternPos - LANTERN_TARGET) * SHADOW_STEP;
    shadowCenter.position.set(0, along, 0.02);
    shadowBar.scale.y = Math.max(Math.abs(along), 0.0001) / SHADOW_STEP;
    shadowBar.position.set(0, along / 2, 0.02);
    const read = readShadow();
    const waiting = phase === 'lantern' && read.matched;
    flame.material.emissiveIntensity = waiting ? 0.55 : 0.28;
    silhouette.material.color.setHex(waiting ? 0x2a2010 : 0xe8d9b8);
    confirmGroup.visible = waiting;
    glyphTarget.visible = false;
    glyphFrame.visible = false;
    return read;
  }

  function applyPins() {
    pinLinks.forEach(link => link.gate.position.copy(link.base).addScaledVector(link.normal, pinSeated.has(link.from) ? 0.042 : 0));
    pinMeshes.forEach((p, i) => {
      const seated = pinSeated.has(i);
      p.position.y = seated ? -0.08 : 0.05;
      p.material.emissiveIntensity = seated ? 0.35 : 0.12;
    });
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

  function foundIds() {
    return api.foundEvidence ? api.foundEvidence() : [];
  }

  function readBrief(endingId) {
    const brief = ENDING_BRIEFS[endingId];
    if (!brief) return;
    (brief.records || []).forEach((rid) => {
      if (api.recordEvidence) api.recordEvidence(rid);
    });
    api.toast(brief.body);
    if (phase === 'endings') showEndingChoices();
  }

  function chooseEnding(ending) {
    const pick = typeof ending === 'string'
      ? ENDINGS.find((e) => e.id === ending)
      : ending;
    if (!pick) return false;
    const found = foundIds();
    const ready = evaluateEnding(pick.id, found);
    if (!ready.ok) {
      api.playWrong();
      api.toast(MISSING_EVIDENCE_GUIDE);
      return false;
    }
    endingChosen = pick.id;
    phase = 'finale';
    if (api.recordEnding) api.recordEnding(pick.id);
    api.markCleared(id);
    api.showFinale({
      title: pick.title,
      body: citeEndingBody(pick, found),
      footer: pick.footer,
      epilogue: pick.epilogue + ' · 제10장 해제 완료',
    });
    api.toast('결말이 정해졌습니다.', true);
    return true;
  }

  function showEndingChoices() {
    phase = 'endings';
    api.setObjective('장부의 증거로 의금부에 전할 길을 고르시오.');
    api.setSteps('D', ['A', 'B', 'C']);
    const found = foundIds();
    const endings = ENDINGS.map((e) => {
      const ready = evaluateEnding(e.id, found);
      return {
        ...e,
        ready: ready.ok,
        note: ready.ok ? '장부의 증거가 이 길을 받칩니다.' : '증거가 모자랍니다. 쪽지를 살피시오.',
      };
    });
    api.showFinale({
      title: '태극 옥좌 · 선택의 문',
      body: '밀실이 열렸다. 세자의 서류와 아홉 놋쇠의 비밀이 손안에 있다. 쪽지를 읽고, 증거가 받치는 길을 고르시오.',
      footer: '— 종장 분기',
      epilogue: '엔딩을 선택하시오',
      briefs: briefIds.map((bid) => ENDING_BRIEFS[bid]),
      onBrief: (b) => readBrief(b.id),
      endings,
      onEnding: (ending) => chooseEnding(ending),
    });
  }

  function onSlot(dir) {
    if (phase !== 'parts') {
      api.toast('놋쇠는 이미 안치되었습니다.');
      return;
    }
    const inv = ownedIds();
    if (inv.size < 9) {
      api.toast(`놋쇠 부품이 부족합니다 (${inv.size}/9). 앞선 아홉 궤에서 남은 부품을 찾아오시오.`);
      api.playWrong();
      return;
    }
    // An empty socket cannot choose its own key. Compare the carried keyway to the carving.
    if (placed[dir]) {
      delete placed[dir];selectedPartId=null;api.setSelectedPart?.(null);applySlots();api.playClick();return;
    }
    if (selectedPartId == null) {
      api.toast('놋쇠 부품을 먼저 고르고, 홈의 새김과 견주어 보시오.');
      return;
    }

    const pid = selectedPartId;
    selectedPartId = null;

    if (PART_SLOT[pid] !== dir) {
      api.playWrong();
      api.vibrate(20);
      api.toast(`${PARTS.find((p) => p.id === pid).name} — ${dir} 방위가 아닙니다. 올바른 홈을 더 정확히 누르시오.`);
      // soft-fail: do not place
      if (api.setSelectedPart) api.setSelectedPart(null);
      return;
    }

    // Remove from any other slot
    Object.keys(placed).forEach((d) => {
      if (placed[d] === pid) delete placed[d];
    });
    placed[dir] = pid;
    applySlots();
    api.playThunk();
    api.vibrate(22);
    if (api.setSelectedPart) api.setSelectedPart(null);

    if (allPartsPlacedCorrect()) {
      phase = 'lantern';
      lanternMount.visible = true;
      applyLantern();
      api.setObjective('등롱을 돌려 그림자를 일월 표적에 겹치시오. 겹쳐도 빗장으로 확정해야 핀이 열립니다.');
      api.setSteps('B', ['A']);
      api.playUnlock();
      api.toast('아홉 놋쇠가 안치되었습니다. 등롱이 켜집니다.', true);
    } else {
      const n = Object.keys(placed).length;
      api.toast(`안치 (${n}/9)`, true);
    }
  }

  function onLantern(next = (lanternPos + 1) % LANTERN_STEPS) {
    if (phase !== 'lantern') {
      if (phase === 'parts') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('먼저 아홉 놋쇠를 방위에 안치하시오.');
      } else if (phase === 'pins') {
        api.toast('그림자는 이미 맞았소. 무정 코어 핀 눈금을 살피시오.');
      }
      return;
    }
    lanternPos = next;
    const read = applyLantern();
    api.playClick();
    api.vibrate(18);
    if (read.matched) {
      badClicks = 0;
      api.toast('그림자가 일월 표적에 겹쳤습니다. 빗장으로 확정하시오. 핀은 아직이오.', true);
    } else {
      api.toast('그림자가 표적을 벗어났습니다. 핀은 열리지 않습니다.', true);
    }
  }

  function onConfirm() {
    if (phase !== 'lantern') {
      api.playWrong();
      api.toast(phase === 'parts'
        ? '먼저 아홉 놋쇠를 방위 문양에 맞추시오.'
        : '이미 핀 단계요.');
      return;
    }
    const read = readShadow();
    if (!read.matched) {
      api.playWrong();
      api.vibrate(18);
      api.toast('그림자가 일월 표적에서 벗어나 확정할 수 없습니다.');
      return;
    }
    phase = 'pins';
    confirmGroup.visible = false;
    pinGroup.visible = true;
    applyPins();
    api.setObjective('핀을 받치는 걸림쇠와 이어진 막대를 살피시오. 열린 핀을 밀고, 앉은 핀을 당겨 볼 수 있소.');
    api.setSteps('C', ['A', 'B']);
    api.playUnlock();
    api.toast('그림자가 표적에 겹쳐 확정되었습니다. 열린 걸림쇠의 핀을 눌러 앉히시오.', true);
  }

  function onPin(index) {
    if (phase !== 'pins') {
      if (phase === 'parts' || phase === 'lantern') {
        api.playWrong();
        api.vibrate(18);
        softFailShake();
        api.toast('아직 핀을 움직일 수 없습니다. 먼저 아홉 놋쇠와 등롱 그림자를 확정하시오.');
      }
      return;
    }
    const step = PIN_ORDER.indexOf(index);
    const prev = step > 0 ? PIN_ORDER[step - 1] : null;
    if (prev != null && !pinSeated.has(prev)) {
      api.playWrong();
      api.vibrate(25);
      badClicks += 1;
      softFailShake();
      if (badClicks >= SOFT_FAIL_AFTER) onSoftFail();
      else api.toast('이전 핀이 앉아 있어야 다음 핀이 움직입니다.');
      return;
    }
    if (pinSeated.has(index)) {
      pinSeated.delete(index);
      for (let s = step + 1; s < PIN_ORDER.length; s++) pinSeated.delete(PIN_ORDER[s]);
      applyPins();
      api.playClick();
      api.toast('핀을 빼 다음이 멈췄습니다. 앞 핀은 그대로요.', true);
      return;
    }
    pinSeated.add(index);
    badClicks = 0;
    applyPins();
    api.playThunk();
    api.vibrate(28);
    if (PIN_ORDER.every((i) => pinSeated.has(i))) {
      api.playUnlock();
      api.vibrate([60, 40, 100]);
      api.toast('무정 코어가 해제되었습니다.', true);
      showEndingChoices();
    } else {
      api.toast(`핀 (${pinSeated.size}/4) · 코어 눈금을 따르시오`, true);
    }
  }

  /** Called from inventory strip click */
  function selectPart(partId) {
    if (phase !== 'parts') return;
    if (Object.values(placed).includes(partId)) {
      api.toast('이미 안치된 부품입니다.');
      return;
    }
    const inv = ownedIds();
    if (!inv.has(partId)) {
      api.toast('아직 얻지 못한 부품입니다.');
      return;
    }
    selectedPartId = partId;
    if (api.setSelectedPart) api.setSelectedPart(partId);
    const p = PARTS.find((x) => x.id === partId);
    api.toast(`${p.name} · 새김 ${PART_MARKS[partId]}을 홈의 음각과 견주시오.`, true);
    api.playClick();
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function pinIndex(iid, hit) { return hit?.index ?? Number(String(iid).replace(/\D/g, '')); }
  function frameOf(object, type, axis) {
    root.updateMatrixWorld(true);
    return {
      type,
      origin: object.getWorldPosition(new THREE.Vector3()).toArray(),
      axis: new THREE.Vector3(...axis).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion())).normalize().toArray(),
    };
  }
  function gesture(kind, iid, hit = {}) {
    if (kind === 'lantern' && phase === 'lantern') {
      let base = lanternPos;
      const move = sample => { lanternPos = clamp(base + (sample.turn || 0) / (Math.PI / 4), 0, LANTERN_STEPS - 1); applyLantern(); };
      return {
        start() { base = lanternPos; }, move,
        end(sample) {
          move(sample);
          const nearest = Math.round(lanternPos);
          if (Math.abs(sample.turn || 0) > 0.12 && Math.abs(lanternPos - nearest) * Math.PI / 4 < 0.18) onLantern(nearest);
          else { lanternPos = base; applyLantern(); }
        },
        cancel() { lanternPos = base; applyLantern(); },
      };
    }
    if ((kind === 'pin' || kind === 'pinTick') && phase === 'pins') {
      const index = pinIndex(iid, hit), pin = pinMeshes[index];
      if (!pin) return null;
      let base = pin.position.y, wasSeated = pinSeated.has(index);
      const step = PIN_ORDER.indexOf(index), prev = step > 0 ? PIN_ORDER[step - 1] : null;
      const canMove = () => prev == null || pinSeated.has(prev);
      const move = sample => {
        const travel = sample.travel || 0;
        pin.position.y = canMove() ? clamp(base + travel, -0.08, 0.05) : clamp(base + travel, base - 0.012, base);
      };
      return {
        start() { base = pin.position.y; wasSeated = pinSeated.has(index); }, move,
        end(sample) {
          move(sample);
          const distance = pin.position.y - base;
          if ((!wasSeated && distance <= -0.10) || (wasSeated && distance >= 0.10)) onPin(index);
          else {
            applyPins();
            if (!canMove() && (sample.travel || 0) < -0.03) onPin(index); // Preserve request-only soft-fail guidance after repeated blocked pushes.
          }
        },
        cancel() { applyPins(); },
      };
    }
    return null;
  }

  applySlots();

  return {
    id, title, blurb, steps, hint, root,
    selectPart,
    getGestureFrame(kind, iid, hit = {}) {
      if (kind === 'lantern') return frameOf(lanternPivot, 'rotate', [0, 1, 0]);
      if (kind === 'pin' || kind === 'pinTick') {
        const pin = pinMeshes[pinIndex(iid, hit)];
        return pin ? frameOf(pin, 'linear', [0, 1, 0]) : null;
      }
      return null;
    },
    getDragInteraction: gesture,
    getInteractives: () => interactives,
    build(scene) { scene.add(root); },
    start() { this.reset(); },
    reset() {
      phase = 'parts';
      placed = {};
      selectedPartId = null;
      lanternPos = 0;
      pinSeated.clear();
      endingChosen = null;
      softFailCount = 0;
      badClicks = 0;
      hintLevel = 0;
      bodyGroup.position.x = 0;
      applySlots();
      lanternMount.visible = false;
      pinGroup.visible = true;
      applyLantern();
      applyPins();
      glyphTarget.visible = false;
      glyphFrame.visible = false;
      if (api.setSelectedPart) api.setSelectedPart(null);
      if (api.renderInventoryStrip) api.renderInventoryStrip(true);
      const inv = ownedIds();
      api.setObjective(
        inv.size < 9
          ? `아홉 놋쇠를 같은 문양의 방위 홈에 안치하시오. (보유 ${inv.size}/9)`
          : '방위 홈의 문양과 같은 부품을 안치하시오. 첫 핀은 아직 빠져 있소.',
      );
      api.setSteps('A', []);
      if (api.setOrderHint) api.setOrderHint(hint);
      api.toast('태극 옥좌 밀실 궤 — 방위·등롱·무정 눈금을 살피시오.', true);
    },
    handleInteract(kind, iid, userData) {
      if (kind === 'brief') {
        readBrief(userData && userData.endingId);
        return;
      }
      if (phase === 'finale' || phase === 'endings') return;
      if (kind === 'slot') onSlot(userData.dir);
      else if (kind === 'lantern') api.toast('등롱 테두리를 잡고 그림자가 움직이도록 돌리시오.');
      else if (kind === 'lanternConfirm') onConfirm();
      else if (kind === 'pin' || kind === 'pinTick') api.toast('핀을 아래로 밀어 앉히거나 위로 당겨 빼시오. 걸림쇠가 열리는지 살피시오.');
    },
    chooseEnding,
    readBrief,
    revealHint() {
      hintLevel = bumpHintLevel(hintLevel);
      requestHint(api, hintLevel, HINT_PACK);
    },
    get mistook() { return softFailCount > 0; },
    getState() {
      const found = foundIds();
      return {
        phase,
        hintLevel,
        lanternPos,
        pinCount: pinSeated.size,
        pinDepths: pinMeshes.map(p => (0.05 - p.position.y) / 0.13),
        lanternAngle: lanternPivot.rotation.y,
        pinGates: pinLinks.map(link => ({ from: link.from, to: link.to, open: pinSeated.has(link.from) })),
        seated: [0, 1, 2, 3].map((i) => pinSeated.has(i)),
        teachingMounted: pinSeated.has(TEACHING_PIN),
        shadowDist: readShadow().dist,
        shadowMatched: readShadow().matched,
        confirmVisible: confirmGroup.visible,
        placedCount: Object.keys(placed).length,
        placed: { ...placed },
        endingChosen,
        endingReady: {
          direct: evaluateEnding('direct', found).ok,
          envoy: evaluateEnding('envoy', found).ok,
          seal: evaluateEnding('seal', found).ok,
        },
      };
    },
    solve() {
      // Grant handled by caller; place all correctly
      const inv = ownedIds();
      if (inv.size < 9 && api.grantAllParts) api.grantAllParts();
      PARTS.forEach((p) => {
        placed[PART_SLOT[p.id]] = p.id;
      });
      applySlots();
      phase = 'lantern';
      lanternMount.visible = true;
      pinSeated.clear();
      lanternPos = 0;
      applyLantern();
      for (let i = 0; i < LANTERN_STEPS && readShadow().dist > SHADOW_TOL; i++) onLantern();
      onConfirm();
      PIN_ORDER.forEach((i) => {
        if (phase === 'pins') onPin(i);
      });
    },
    getMarkMeshes() {
      return [
        ...dirPlaques,
        wall,
        seatBody,
        targetCenter,
        shadowCenter,
        ...shadowTicks,
        ...pinMeshes,
      ];
    },
    dispose(scene) {
      scene.remove(root);
      disposeCraftRoot(root, mats);
      interactives.length = 0;
      if (api.renderInventoryStrip) api.renderInventoryStrip(false);
    },
  };
}
