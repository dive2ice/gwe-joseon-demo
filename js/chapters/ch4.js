import { disposeChapterResources } from '../chapter-resources.js';
/**
 * Chapter 4 — 약장
 *
 * Discoverable rule: drawer travel drives the next latch; a fully open
 * drawer loads that latch until eased back. 약성패 order is a mnemonic;
 * the floor inscription names latch/load and the overwritten ②③.
 * Teaching: MID starts slightly ajar. Drag or tap; sweeping rest does
 * not auto-complete BOT.
 *
 * Soft-fail: blocked pulls → shake + drawer soft-reset after
 * SOFT_FAIL_AFTER spam. Failures never raise hintLevel or dump FULL.
 * Hints: explicit revealHint only — observe → relate → FULL, cap at 3.
 * Phase B: herb drawer → finale note.
 * Visual: Joseon yakjang — tall shallow wall cabinet, dense small-drawer grid, brass ring pulls.
 */
import { boxMesh, bevelBoxMesh, invisibleHit } from '../materials.js';

export const id = 4;
export const title = '약장';
export const blurb = '약성패와 옆 걸쇠를 읽고, 연 서랍을 밀어 하중을 푼 뒤 약재함을 찾으시오.';
export const steps = [
  { id: 'A', label: '서랍' },
  { id: 'B', label: '약재' },
  { id: 'C', label: '쪽지' },
];

/** Non-spoiler footer; FULL only via explicit revealHint ×3 */
export const hint = '서랍의 약성패와 서로 걸린 부분을 살피시오.';
/** Stage 1 (observation) — no drawer order */
export const HINT_PARTIAL = '서랍 옆 걸쇠와, 끝까지 열렸을 때 눌리는 부분을 살피시오.';
/** Stage 2 (relation) — no MID/TOP/BOT listing */
export const HINT_RELATION = '연 서랍을 조금 밀어 넣으면 하중이 풀리고, 옆 걸쇠는 열린 채로 남습니다.';
/** Spoiler: explicit drawer ids — stage 3+ only */
export const HINT_FULL = '가운데 → 위 → 아래: 각 칸을 연 뒤 조금 밀어 하중을 푸시오 — 그다음 숨은 약재 서랍';

/** Extension bands along drawer travel 0–1 */
export const LATCH_OUT = 0.55;
export const LOAD_ON = 0.82;
export const REST_EXT = 0.68;
const AJAR_OFFSET = 0.045;
const DRAWER_TRAVEL = 0.26;
export const AJAR_EXT = AJAR_OFFSET / DRAWER_TRAVEL;

export const FLOOR_INSCRIPTION = '걸쇠는 연 칸을 조금 밀어 하중을 푼 뒤에야 옆칸이 산다. 약성패의 둘째·셋째 글씨는 덧씌운 흔적이다.';

/** Correct pull sequence of drawer ids */
export const DRAWER_ORDER = ['MID', 'TOP', 'BOT'];

/** Wrong / locked pulls before soft-fail shake + recovery (hints stay independent) */
export const SOFT_FAIL_AFTER = 3;

const SOFT_FAIL_GUIDE = '막힌 까닭을 살펴보시오. 도움이 필요하면 힌트를 요청할 수 있소.';

/** Teaching drawer that starts slightly ajar */
export const TEACHING_DRAWER = 'MID';

export function create(api) {
  const { THREE, mats, animateVec3, shake } = api;
  const root = new THREE.Group();
  root.name = 'ch4_yakjang';

  let phase = 'drawers'; // drawers | herb | finale
  let softFailCount = 0;
  let badClicks = 0;
  let hintLevel = 0; // 0–3; only revealHint advances
  let mistookFlag = false;
  let lastFeel = null;
  let lastRumbleAt = -1e9;
  let craftEyeOn = false;
  let craftEyeTimer = null;
  const interactives = [];
  const drawers = {};
  let topLatch = null;
  let botLatch = null;

  const woodMat = mats.sliceWood || mats.woodRich || mats.wood;
  const woodDark = mats.sliceWoodDark || mats.woodDark;
  const woodAcc = mats.sliceWood || mats.woodAccent || woodMat;
  const brass = mats.sliceBrass || mats.brass;
  const brassB = mats.sliceBrassBright || mats.brassBright || brass;
  const paper = mats.slicePaper || mats.paper;
  const recess = woodDark.clone();
  recess.color.multiplyScalar(0.48);
  const iron = mats.iron;

  // ---- Tall shallow wall cabinet (Joseon yakjang proportions) ----
  const BODY_W = 0.78;
  const BODY_H = 1.28;
  // A 30cm tray retains 4cm of runner engagement at full 26cm travel.
  const BODY_D = 0.34;
  const bodyY0 = 0.08; // above feet
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Hollow construction: opened drawers reveal their trays and the cabinet's depth.
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.04, BODY_H - 0.04, 0.018, recess,
    0, bodyY0 + BODY_H / 2, -BODY_D / 2));
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W, 0.03, BODY_D, woodDark, 0, bodyY0 + 0.015, 0));
  // Side panels (slight inset articulation)
  bodyGroup.add(bevelBoxMesh(THREE, 0.028, BODY_H - 0.04, BODY_D, woodDark,
    -(BODY_W / 2 - 0.01), bodyY0 + BODY_H / 2, 0));
  // Right flank has a real lower opening for the lateral herb tray.
  bodyGroup.add(bevelBoxMesh(THREE, 0.028, 0.99, BODY_D, woodDark,
    BODY_W / 2 - 0.01, 0.845, 0));
  bodyGroup.add(bevelBoxMesh(THREE, 0.028, 0.055, BODY_D, woodDark,
    BODY_W / 2 - 0.01, bodyY0 + 0.0275, 0));
  [-1, 1].forEach(side => bodyGroup.add(bevelBoxMesh(THREE, 0.028, 0.215, 0.04, woodDark,
    BODY_W / 2 - 0.01, 0.2425, side * (BODY_D / 2 - 0.02))));
  // Back panel
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.06, BODY_H - 0.08, 0.02, woodDark,
    0, bodyY0 + BODY_H / 2, -BODY_D / 2 + 0.01));

  // Thick top frame rail
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W + 0.06, 0.055, BODY_D + 0.04, woodMat,
    0, bodyY0 + BODY_H + 0.02, 0));
  // Top crown mold (thin lip)
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W + 0.02, 0.02, BODY_D + 0.02, woodAcc,
    0, bodyY0 + BODY_H + 0.05, 0.005));

  // Mid shelf rail separating drawers from cupboard
  const CUPBOARD_H = 0.28;
  const drawerAreaBottom = bodyY0 + CUPBOARD_H + 0.04;
  const drawerAreaTop = bodyY0 + BODY_H - 0.06;
  bodyGroup.add(boxMesh(THREE, BODY_W - 0.04, 0.03, BODY_D + 0.01, woodMat,
    0, drawerAreaBottom - 0.015, 0.01));

  // Fine front stiles and a low plinth make the cabinet read as joined furniture.
  [-1, 1].forEach((sx) => {
    bodyGroup.add(bevelBoxMesh(THREE, 0.029, BODY_H - 0.045, 0.036, woodMat,
      sx * (BODY_W / 2 - 0.013), bodyY0 + BODY_H / 2, BODY_D / 2 + 0.005));
  });
  bodyGroup.add(bevelBoxMesh(THREE, BODY_W + 0.028, 0.026, BODY_D + 0.025, woodMat,
    0, bodyY0 + 0.005, 0, 0.004));

  // Shaped feet + center foot
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    bodyGroup.add(boxMesh(THREE, 0.07, 0.08, 0.06, woodDark,
      sx * (BODY_W / 2 - 0.08), 0.04, sz * (BODY_D / 2 - 0.04)));
  });
  bodyGroup.add(boxMesh(THREE, 0.1, 0.05, 0.05, woodDark, 0, 0.03, BODY_D / 2 - 0.03));

  // Yellow-brass corner brackets on carcass
  function cornerBracket(x, y, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.add(boxMesh(THREE, 0.08, 0.012, 0.03, brassB, 0.035, 0, 0));
    g.add(boxMesh(THREE, 0.03, 0.012, 0.08, brassB, 0, 0, 0.035));
    for (let i = 0; i < 2; i++) {
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), brass);
      riv.position.set(0.018 + i * 0.028, 0.008, 0.008);
      g.add(riv);
    }
    bodyGroup.add(g);
  }
  const frontZ = BODY_D / 2 - 0.01;
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + BODY_H - 0.08, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + BODY_H - 0.08, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, drawerAreaBottom + 0.02, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, drawerAreaBottom + 0.02, frontZ, -Math.PI / 2);
  cornerBracket(-BODY_W / 2 + 0.02, bodyY0 + 0.1, frontZ, 0);
  cornerBracket(BODY_W / 2 - 0.02, bodyY0 + 0.1, frontZ, -Math.PI / 2);

  // ---- 약성 처방 plaque (in-world rule: 중약 → 상단 귀중 → 하단 독·무거움) ----
  function makeRxPlaque(lines) {
    try {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 96;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3a2a14';
      ctx.fillRect(0, 0, 256, 96);
      ctx.strokeStyle = '#c9a84a';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, 252, 92);
      ctx.fillStyle = '#e8d9a8';
      ctx.font = 'bold 15px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('약재 · 처방 차례', 128, 18);
      ctx.font = '13px serif';
      lines.forEach((ln, i) => {
        if (i > 0) {
          ctx.fillStyle = '#6a5030';
          ctx.fillText(ln, 131, 43 + i * 18);
        }
        ctx.fillStyle = i === 0 ? '#f0e0b0' : '#c8b080';
        ctx.fillText(ln, 128, 42 + i * 18);
      });
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.55, metalness: 0.2,
        emissive: 0x1a1008, emissiveIntensity: 0.14,
      });
    } catch (_) {
      return brass;
    }
  }
  function makeFloorPlaque(lines) {
    try {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 110;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2a1c0c';
      ctx.fillRect(0, 0, 320, 110);
      ctx.strokeStyle = '#8a7040';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, 314, 104);
      ctx.fillStyle = '#d8c898';
      ctx.font = '12px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('장인의 덧새김', 160, 16);
      ctx.font = '13px serif';
      lines.forEach((ln, i) => {
        ctx.fillStyle = i === 2 ? '#c9a070' : '#e8d9a8';
        ctx.fillText(ln, 160, 42 + i * 20);
      });
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.7, metalness: 0.08,
        emissive: 0x1a1008, emissiveIntensity: 0.18,
      });
    } catch (_) {
      return mats.paper || brass;
    }
  }
  const rxMat = makeRxPlaque(['가운데 · 보통 약재', '위쪽 · 귀한 약재', '아래쪽 · 독하거나 무거운 약재']);
  const rxPlaque = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.15), rxMat);
  rxPlaque.position.set(0, bodyY0 + BODY_H + 0.058, frontZ + 0.02);
  // Slight tilt toward player for readability
  rxPlaque.rotation.x = -Math.PI / 2 + 0.35;
  bodyGroup.add(rxPlaque);
  // Brass frame under plaque
  bodyGroup.add(boxMesh(THREE, 0.46, 0.008, 0.04, brass, 0, bodyY0 + BODY_H + 0.04, frontZ + 0.01));

  // ---- Dense drawer grid (decorative + 3 interactive bands) ----
  // Layout: 8 rows × 3 cols; upper rows smaller, lower rows larger
  const COLS = 3;
  const ROWS = 8;
  const gridMarginX = 0.04;
  const gridW = BODY_W - gridMarginX * 2;
  const colGap = 0.012;
  const cellW = (gridW - colGap * (COLS - 1)) / COLS;
  const rowGap = 0.008;
  // Relative row heights (upper smaller → lower larger), sum = 1
  const rowWeights = [0.085, 0.09, 0.095, 0.11, 0.12, 0.13, 0.145, 0.155];
  const gridH = drawerAreaTop - drawerAreaBottom - 0.02;
  const totalWeight = rowWeights.reduce((a, b) => a + b, 0);
  const rowHeights = rowWeights.map((w) => (w / totalWeight) * (gridH - rowGap * (ROWS - 1)));

  // Interactive mapping: three highlighted drawers (center col) at TOP/MID/BOT bands
  // TOP = row 1 (0-indexed), MID = row 3, BOT = row 6
  const INTERACTIVE = {
    TOP: { row: 1, col: 1, label: '상' },
    MID: { row: 3, col: 1, label: '중' },
    BOT: { row: 6, col: 1, label: '하' },
  };
  const interactiveKey = {};
  Object.entries(INTERACTIVE).forEach(([id, v]) => {
    interactiveKey[`${v.row},${v.col}`] = id;
  });

  // One paper atlas for all drawer names; labels retain their own grain and ink wear.
  const herbLabels = ['인삼', '황기', '당귀', '천궁', '백출', '복령', '감초', '진피', '반하', '생강', '대추', '계지',
    '작약', '지황', '맥문동', '오미자', '육계', '방풍', '길경', '산수유', '택사', '치자', '숙지황', '박하'];
  const labelTexts = ['상', '중', '하', ...herbLabels];
  let labelMat = paper;
  try {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const ctx = c.getContext('2d');
    labelTexts.forEach((text, i) => {
      const x = (i % 8) * 128; const y = Math.floor(i / 8) * 64;
      ctx.fillStyle = '#bc9d67'; ctx.fillRect(x, y, 128, 64);
      ctx.fillStyle = '#d9c79f'; ctx.fillRect(x + 3, y + 4, 122, 56);
      for (let n = 0; n < 28; n++) {
        ctx.fillStyle = n % 3 ? 'rgba(91,63,28,0.07)' : 'rgba(255,240,202,0.16)';
        ctx.fillRect(x + 4 + (n * 31 + i * 7) % 118, y + 6 + (n * 17) % 50, 4 + n % 8, 1);
      }
      ctx.fillStyle = '#3c2d1e';
      ctx.font = i < 3 ? 'bold 37px serif' : text.length > 2 ? '25px serif' : '29px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, x + 64, y + 33, 112);
      ctx.fillStyle = '#934b36'; ctx.fillRect(x + 113, y + 48, 6, 6);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    labelMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93, metalness: 0 });
  } catch (_) { /* The untextured paper fallback preserves the controls. */ }
  function makeLabelMesh(text, w, h) {
    const geo = new THREE.PlaneGeometry(w, h);
    const i = Math.max(0, labelTexts.indexOf(text));
    const uv = geo.attributes.uv;
    for (let v = 0; v < uv.count; v++) {
      uv.setXY(v, ((i % 8) + 0.04 + uv.getX(v) * 0.92) / 8,
        1 - (Math.floor(i / 8) + 0.04 + (1 - uv.getY(v)) * 0.92) / 4);
    }
    return new THREE.Mesh(geo, labelMat);
  }
  let herbIdx = 0;

  function ringPull(mat, scale = 1) {
    const g = new THREE.Group();
    // Round brass ring (torus)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.014 * scale, 0.0035 * scale, 8, 16),
      mat,
    );
    ring.rotation.x = -0.18;
    ring.position.set(0, -0.01 * scale, 0.004 * scale);
    ring.castShadow = true;
    g.add(ring);
    // Mount plate behind ring
    const plate = bevelBoxMesh(THREE, 0.027 * scale, 0.022 * scale, 0.005 * scale, mat, 0, 0.005 * scale, -0.004, 0.0018);
    g.add(plate);
    // Tiny rivet
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.004 * scale, 6, 6), mat);
    riv.position.set(0, 0.005 * scale, 0.004);
    g.add(riv);
    return g;
  }

  // Build grid from top down
  let yCursor = drawerAreaTop - 0.01;
  const drawerFrontZ = BODY_D / 2 + 0.005;

  for (let r = 0; r < ROWS; r++) {
    const rh = rowHeights[r];
    const cy = yCursor - rh / 2;
    for (let c = 0; c < COLS; c++) {
      const cx = -gridW / 2 + cellW / 2 + c * (cellW + colGap);
      const key = `${r},${c}`;
      const iid = interactiveKey[key];

      if (iid) {
        // Interactive drawer band — pulls out as a group
        const g = new THREE.Group();
        g.name = 'ch4_drawer_' + iid;
        g.position.set(cx, cy, drawerFrontZ - 0.06);
        const face = bevelBoxMesh(THREE, cellW - 0.004, rh - 0.004, 0.024, woodMat,
          0, 0, 0.058, 0.003, r * 0.173);
        // Slender tray sides and a recessed base are visible as the drawer travels.
        [-1, 1].forEach((side) => {
          const wall = bevelBoxMesh(THREE, 0.009, rh - 0.013, 0.30, woodDark,
            side * (cellW / 2 - 0.011), -0.002, -0.102, 0.0015, r * 0.173);
          wall.name = 'ch4_tray_wall_' + iid + '_' + side;
          g.add(wall);
        });
        g.add(boxMesh(THREE, cellW - 0.02, 0.006, 0.30, woodDark, 0, -rh / 2 + 0.007, -0.102));
        g.add(boxMesh(THREE, cellW - 0.02, rh - 0.013, 0.009, woodDark, 0, -0.002, -0.247));
        face.userData = { id: iid, kind: 'drawer' };
        g.add(face);
        // Stronger brass ring pull (teaching MID: slightly brighter / worn)
        const pullMat = iid === TEACHING_DRAWER ? brassB.clone() : brassB;
        if (iid === TEACHING_DRAWER && pullMat.emissiveIntensity != null) {
          pullMat.emissiveIntensity = 0.15;
        }
        const pull = ringPull(pullMat, 1.35);
        pull.position.set(0, -rh * 0.15, 0.075);
        pull.traverse((m) => {
          if (m.isMesh) m.userData = { id: iid, kind: 'drawer' };
        });
        g.add(pull);
        // Engraved Korean band label plaque
        const plaque = makeLabelMesh(INTERACTIVE[iid].label, 0.05, Math.min(0.028, rh * 0.39));
        plaque.position.set(0, rh * 0.22, 0.072);
        plaque.userData = { id: iid, kind: 'drawer' };
        g.add(plaque);
        // Subtle highlight lip
        g.add(bevelBoxMesh(THREE, cellW - 0.014, 0.004, 0.026, woodAcc, 0, rh / 2 - 0.006, 0.057, 0.0008));

        const hit = invisibleHit(THREE, cellW + 0.02, rh + 0.02, 0.22, { id: iid, kind: 'drawer' });
        g.add(hit);
        root.add(g);
        interactives.push(hit, face, plaque);
        pull.traverse((m) => { if (m.isMesh) interactives.push(m); });
        const baseZ = drawerFrontZ - 0.06;
        const openZ = drawerFrontZ + 0.2;
        const travel = openZ - baseZ;
        drawers[iid] = {
          group: g,
          baseZ,
          ajarZ: baseZ + AJAR_OFFSET,
          openZ,
          restZ: baseZ + REST_EXT * travel,
          travel,
          ext: iid === TEACHING_DRAWER ? AJAR_EXT : 0,
          label: INTERACTIVE[iid].label,
          baseX: cx,
          baseY: cy,
        };
      } else {
        // Decorative readable drawer
        const face = bevelBoxMesh(THREE, cellW - 0.006, rh - 0.006, 0.04, woodMat,
          cx, cy, drawerFrontZ - 0.01, 0.0025, r * 0.173 + c * 0.287);
        bodyGroup.add(face);
        // Small quiet ring pull
        const pull = ringPull(brass, 0.75);
        pull.position.set(cx, cy - rh * 0.12, drawerFrontZ + 0.012);
        bodyGroup.add(pull);
        // Decorative herb label strip
        const label = herbLabels[herbIdx % herbLabels.length];
        herbIdx += 1;
        const plaque = makeLabelMesh(label, 0.058, Math.min(0.03, rh * 0.4));
        plaque.position.set(cx, cy + rh * 0.2, drawerFrontZ + 0.012);
        bodyGroup.add(plaque);
      }
    }
    // A shelf edge gives each recess a real shadow behind the drawer face.
    bodyGroup.add(boxMesh(THREE, gridW, 0.006, BODY_D - 0.02, woodDark,
      0, yCursor - rh - rowGap / 2, -0.005));
    yCursor -= rh + rowGap;
  }

  // Vertical stile separators (frame between cols)
  for (let c = 1; c < COLS; c++) {
    const sx = -gridW / 2 + c * (cellW + colGap) - colGap / 2;
    bodyGroup.add(boxMesh(THREE, 0.01, gridH + 0.02, 0.03, woodDark,
      sx, (drawerAreaBottom + drawerAreaTop) / 2, drawerFrontZ - 0.02));
  }

  function makeSideLatch() {
    const group = new THREE.Group();
    const barMat = brassB.clone ? brassB.clone() : brassB;
    const pegMat = iron.clone ? iron.clone() : iron;
    const plate = bevelBoxMesh(THREE, 0.028, 0.1, 0.036, brass, 0.07, 0, -0.012, 0.002);
    const bar = bevelBoxMesh(THREE, 0.14, 0.02, 0.028, barMat, 0, 0, 0.006, 0.002);
    const peg = bevelBoxMesh(THREE, 0.02, 0.06, 0.02, pegMat, 0.04, 0.04, 0.01, 0.002);
    group.add(plate, bar, peg);
    return { group, bar, peg };
  }
  const latchX = drawers.TOP.baseX + cellW * 0.5 + 0.018;
  const latchZ = drawerFrontZ + 0.02;
  topLatch = makeSideLatch();
  topLatch.group.position.set(latchX, drawers.TOP.baseY, latchZ);
  root.add(topLatch.group);
  botLatch = makeSideLatch();
  botLatch.group.position.set(latchX, drawers.BOT.baseY, latchZ);
  root.add(botLatch.group);
  bodyGroup.add(boxMesh(THREE, 0.01, Math.abs(drawers.TOP.baseY - drawers.MID.baseY) + 0.04, 0.01, brassB,
    latchX + 0.05, (drawers.TOP.baseY + drawers.MID.baseY) / 2, latchZ - 0.02));
  bodyGroup.add(boxMesh(THREE, 0.01, Math.abs(drawers.BOT.baseY - drawers.TOP.baseY) + 0.04, 0.01, brassB,
    latchX + 0.05, (drawers.BOT.baseY + drawers.TOP.baseY) / 2, latchZ - 0.02));

  const floorMat = makeFloorPlaque(['걸쇠는 연 칸을 조금 밀어', '하중을 푼 뒤에야 옆칸이 산다', '약성패 둘째·셋째는 덧씌운 글']);
  const floorInsc = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.12), floorMat);
  floorInsc.rotation.x = -Math.PI / 2 + 0.42;
  floorInsc.position.set(0, bodyY0 + 0.028, BODY_D / 2 + 0.045);
  floorInsc.userData = { id: 'FLOOR', kind: 'inscription' };
  root.add(floorInsc);
  const floorHit = invisibleHit(THREE, 0.42, 0.08, 0.18, { id: 'FLOOR', kind: 'inscription' }, 0, bodyY0 + 0.04, BODY_D / 2 + 0.05);
  root.add(floorHit);
  interactives.push(floorInsc, floorHit);

  // ---- Bottom cupboard doors (lock plate + swallowtail hinge hint) ----
  const doorY = bodyY0 + CUPBOARD_H / 2;
  const doorH = CUPBOARD_H - 0.04;
  const doorW = (BODY_W - 0.08) / 2;

  function makeCupboardDoor(sx) {
    const g = new THREE.Group();
    g.position.set(sx * (doorW / 2 + 0.01), doorY, drawerFrontZ - 0.01);
    g.add(bevelBoxMesh(THREE, doorW - 0.01, doorH, 0.035, woodDark, 0, 0, 0, 0.003));
    // Panel inset
    g.add(bevelBoxMesh(THREE, doorW - 0.055, doorH - 0.045, 0.012, woodMat, 0, 0, 0.018, 0.002, sx * 0.19));
    [-1, 1].forEach((side) => {
      g.add(bevelBoxMesh(THREE, 0.012, doorH - 0.026, 0.008, woodAcc, side * (doorW / 2 - 0.023), 0, 0.019, 0.001));
    });
    // Swallowtail-ish hinge (butterfly / 제비꼬리 경첩 hint)
    const hingeX = sx > 0 ? -doorW / 2 + 0.02 : doorW / 2 - 0.02;
    const hinge = new THREE.Group();
    hinge.position.set(hingeX, 0, 0.02);
    // Two triangular-ish plates via tapered boxes
    hinge.add(boxMesh(THREE, 0.045, 0.018, 0.008, brassB, sx * 0.02, 0.04, 0));
    hinge.add(boxMesh(THREE, 0.03, 0.014, 0.008, brassB, sx * 0.012, 0.04, 0));
    hinge.add(boxMesh(THREE, 0.045, 0.018, 0.008, brassB, sx * 0.02, -0.04, 0));
    hinge.add(boxMesh(THREE, 0.03, 0.014, 0.008, brassB, sx * 0.012, -0.04, 0));
    // Knuckle
    const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8), brass);
    // The cupboard hinge pin follows the vertical door seam.
    knuckle.position.set(0, 0, 0.005);
    hinge.add(knuckle);
    g.add(hinge);
    bodyGroup.add(g);
    return g;
  }
  makeCupboardDoor(-1);
  makeCupboardDoor(1);

  // Center lock plate between doors
  const lockPlate = boxMesh(THREE, 0.055, 0.07, 0.012, brassB, 0, doorY, drawerFrontZ + 0.01);
  bodyGroup.add(lockPlate);
  const lockKeyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.014, 8), iron);
  lockKeyhole.rotation.x = Math.PI / 2;
  lockKeyhole.position.set(0, doorY + 0.008, drawerFrontZ + 0.018);
  bodyGroup.add(lockKeyhole);
  // Drop handle on lock
  const dropRing = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 12), brass);
  dropRing.position.set(0, doorY - 0.018, drawerFrontZ + 0.02);
  bodyGroup.add(dropRing);

  // ---- Hidden herb drawer (locked lower/side compartment) ----
  const herb = new THREE.Group();
  herb.name = 'ch4_herb_tray';
  herb.position.set(BODY_W / 2 - 0.01, bodyY0 + CUPBOARD_H * 0.55, 0);
  herb.visible = false;
  root.add(herb);
  // Open tray runs along +X through the side aperture.
  herb.add(boxMesh(THREE, 0.29, 0.008, 0.22, woodDark, -0.13, -0.066, 0));
  [-1, 1].forEach(side => herb.add(boxMesh(THREE, 0.29, 0.13, 0.009, woodDark, -0.13, 0, side * 0.106)));
  herb.add(boxMesh(THREE, 0.009, 0.13, 0.22, woodDark, -0.27, 0, 0));
  herb.add(bevelBoxMesh(THREE, 0.022, 0.16, 0.245, woodMat, 0.016, 0, 0, 0.003));
  herb.add(boxMesh(THREE, 0.01, 0.04, 0.03, brassB, 0.032, 0, 0));
  const herbRing = ringPull(brass, 0.9);
  herbRing.position.set(0.042, 0, 0);
  herbRing.rotation.y = Math.PI / 2;
  herb.add(herbRing);
  // Contents
  const herbs = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mats.herb);
  herbs.position.set(-0.08, -0.02, 0.035);
  herb.add(herbs);
  herb.add(boxMesh(THREE, 0.1, 0.008, 0.08, paper, -0.18, -0.048, -0.02));
  const herbHit = invisibleHit(THREE, 0.22, 0.2, 0.35, { id: 'HERB', kind: 'herb' }, 0.05, 0, 0);
  herb.add(herbHit);
  interactives.push(herbHit);

  // Side seam hint (visible always as a locked panel outline on right flank)
  const sideSeam = boxMesh(THREE, 0.015, CUPBOARD_H - 0.06, BODY_D - 0.06, woodAcc,
    BODY_W / 2 - 0.005, doorY, 0);
  bodyGroup.add(sideSeam);
  bodyGroup.add(boxMesh(THREE, 0.02, 0.035, 0.012, brass,
    BODY_W / 2 + 0.005, doorY, BODY_D / 2 - 0.04));

  function extToZ(d) {
    return d.baseZ + d.ext * d.travel;
  }

  function latchOut(d) {
    return d.ext >= LATCH_OUT;
  }

  function loadOn(d) {
    return d.ext >= LOAD_ON;
  }

  function inRest(d) {
    return latchOut(d) && !loadOn(d);
  }

  function prevOf(did) {
    const i = DRAWER_ORDER.indexOf(did);
    return i > 0 ? DRAWER_ORDER[i - 1] : null;
  }

  function blockReason(did) {
    const prev = prevOf(did);
    if (!prev) return null;
    const p = drawers[prev];
    if (!latchOut(p)) return 'latch';
    if (loadOn(p)) return 'load';
    return null;
  }

  function canMove(did) {
    return phase === 'drawers' && !blockReason(did);
  }

  function setLatchVisual(latch, srcExt, next) {
    if (!latch) return;
    let withdrawn = Math.max(0, Math.min(1, (srcExt - 0.15) / 0.4));
    if (next && next.ext > 0.12) withdrawn = Math.max(withdrawn, 0.42);
    const loaded = Math.max(0, Math.min(1, (srcExt - LOAD_ON) / (1 - LOAD_ON)));
    latch.bar.position.x = -0.055 + withdrawn * 0.08;
    latch.peg.position.y = 0.045 - loaded * 0.075;
    if (latch.bar.material && latch.bar.material.emissiveIntensity != null) {
      latch.bar.material.emissiveIntensity = withdrawn > 0.85 && loaded < 0.25 ? 0.6 : 0.12;
    }
    if (latch.peg.material && latch.peg.material.emissiveIntensity != null) {
      latch.peg.material.emissiveIntensity = loaded > 0.5 ? 0.7 : 0.08;
    }
    if (craftEyeOn) {
      if (latch.bar.material && latch.bar.material.emissiveIntensity != null) {
        latch.bar.material.emissiveIntensity = 1.05;
      }
      if (latch.peg.material && latch.peg.material.emissiveIntensity != null) {
        latch.peg.material.emissiveIntensity = 1.05;
      }
    }
  }

  function updateMechanics() {
    setLatchVisual(topLatch, drawers.MID.ext, drawers.TOP);
    setLatchVisual(botLatch, drawers.TOP.ext, drawers.BOT);
  }

  function feel(kind, text) {
    lastFeel = { kind, text };
    if (api.announceFeel) api.announceFeel(kind, text);
  }

  function setExt(did, ext, { place = true, silent = false } = {}) {
    const d = drawers[did];
    const prev = d.ext;
    const wasLatch = prev >= LATCH_OUT;
    const wasLoad = prev >= LOAD_ON;
    d.ext = Math.max(0, Math.min(1, ext));
    if (place) d.group.position.set(d.baseX, d.baseY, extToZ(d));
    updateMechanics();
    if (silent) return;
    const nowLatch = d.ext >= LATCH_OUT;
    const nowLoad = d.ext >= LOAD_ON;
    if (!wasLatch && nowLatch) {
      if (api.playLatchClack) api.playLatchClack();
      feel('latch-out', '걸쇠가 빠집니다.');
    }
    if (!wasLoad && nowLoad) {
      if (api.playBrassScrape) api.playBrassScrape();
      feel('load-on', '하중이 걸쇠를 누릅니다.');
    }
    if (wasLoad && !nowLoad) {
      api.playThunk();
      feel('load-off', '하중이 풀립니다.');
    }
  }

  function applyExt(did, ext) {
    setExt(did, ext, { place: true });
  }

  function animateExt(did, ext, onDone) {
    const d = drawers[did];
    setExt(did, ext, { place: false });
    animateVec3(d.group.position, new THREE.Vector3(d.baseX, d.baseY, extToZ(d)), 280, onDone);
  }

  function maybeRevealHerb() {
    if (phase !== 'drawers') return;
    if (drawers.BOT.ext < LOAD_ON) return;
    phase = 'herb';
    herb.visible = true;
    sideSeam.visible = false;
    api.setObjective('측면에 드러난 약재 서랍을 여시오.');
    api.setSteps('B', ['A']);
    api.playUnlock();
    api.toast('하칸이 열리며 숨은 약재 서랍이 드러났습니다.', true);
  }

  function snapDrawer(did) {
    const e = drawers[did].ext;
    if (e >= (LOAD_ON + 1) / 2) applyExt(did, 1);
    else if (e >= LATCH_OUT) applyExt(did, REST_EXT);
    else if (did === TEACHING_DRAWER && e >= AJAR_EXT * 0.5) applyExt(did, AJAR_EXT);
    else applyExt(did, 0);
    maybeRevealHerb();
  }

  function resetDrawerPositions() {
    DRAWER_ORDER.forEach((did) => {
      setExt(did, did === TEACHING_DRAWER ? AJAR_EXT : 0, { place: true, silent: true });
    });
  }

  function softResetDrawers() {
    DRAWER_ORDER.forEach((did) => {
      if (latchOut(drawers[did])) return;
      setExt(did, did === TEACHING_DRAWER ? AJAR_EXT : 0, { place: true, silent: true });
    });
  }

  function softFailShake() {
    if (shake) shake(bodyGroup, 0.028, 340);
    else {
      const bx = bodyGroup.position.x;
      bodyGroup.position.x = bx + 0.022;
      setTimeout(() => { bodyGroup.position.x = bx; }, 80);
    }
  }

  function hintTextFor(level) {
    if (level >= 3) return HINT_FULL;
    if (level === 2) return HINT_RELATION;
    if (level === 1) return HINT_PARTIAL;
    return hint;
  }

  function applyOrderHint(text) {
    if (api.setOrderHint) api.setOrderHint(text);
    else if (api.orderHintEl) api.orderHintEl.innerHTML = text;
  }

  function onSoftFail() {
    softFailCount += 1;
    badClicks = 0;
    softFailShake();
    softResetDrawers();
    api.playWrong();
    api.vibrate([30, 40, 30, 40, 60]);
    api.toast(SOFT_FAIL_GUIDE);
  }

  function registerBadPull(did, msg) {
    badClicks += 1;
    mistookFlag = true;
    api.playWrong();
    api.vibrate(22);
    if (api.recoil && drawers[did]) api.recoil(drawers[did].group, 'z', -0.02, 240);
    softFailShake();
    feel('blocked', msg);
    if (badClicks >= SOFT_FAIL_AFTER) {
      onSoftFail();
    } else {
      api.toast(msg);
    }
  }

  function catchWhy(did) {
    const prev = prevOf(did);
    const reason = blockReason(did);
    const here = drawers[did].label;
    const there = prev ? drawers[prev].label : '';
    const msg = reason === 'load'
      ? `${there}칸이 끝까지 열려 ${here}칸 걸쇠를 누르고 있습니다. ${there}칸을 조금 밀어 넣으시오.`
      : `${here}칸 옆 걸쇠가 ${there}칸에 아직 걸려 있습니다.`;
    registerBadPull(did, msg);
  }

  function onDrawer(did) {
    if (phase !== 'drawers') return;
    if (!canMove(did)) {
      catchWhy(did);
      return;
    }
    const d = drawers[did];
    if (d.ext >= LOAD_ON - 0.001) {
      badClicks = 0;
      animateExt(did, REST_EXT);
      api.vibrate(22);
      api.toast(`${d.label}칸의 하중이 풀렸소.`, true);
      return;
    }
    if (inRest(d) && did !== 'BOT') {
      api.toast(`${d.label}칸은 하중을 푼 자리에 있습니다.`);
      return;
    }
    badClicks = 0;
    animateExt(did, 1, () => maybeRevealHerb());
    api.vibrate(28);
    if (did !== 'BOT') {
      api.toast(`${d.label}칸이 열렸소. 옆 걸쇠와 눌린 부분을 살피시오.`, true);
    }
  }

  function onHerb() {
    if (phase !== 'herb') {
      if (phase === 'drawers') api.toast('먼저 걸쇠와 하중이 풀린 서랍을 여시오.');
      return;
    }
    phase = 'finale';
    animateVec3(herb.position, new THREE.Vector3(BODY_W / 2 + 0.22, bodyY0 + CUPBOARD_H * 0.55, 0), 500, () => {
      api.setSteps('C', ['A', 'B']);
      api.setObjective('약재와 쪽지를 확인하시오.');
      api.playUnlock();
      api.vibrate([40, 30, 70]);
      api.showFinale({
        title: '약재함 · 처방전',
        body: '약성패는 중-상-하를 처방으로 적었으나, 바닥 덧새김은 같은 이치를 걸쇠와 하중으로 설명한다. 패의 둘째·셋째 글씨는 덧씌운 흔적이다. 쪽지: 「경대의 거울은 빛을 품는다. 빗을 감춘 함을 살피라」',
        footer: '— 내의원 비방 · 사천장 주해',
        epilogue: '제4장 약장 — 해제 완료',
      });
      if (api.recordEvidence) {
        api.recordEvidence('ch4-contradiction');
        api.recordEvidence('ch4-gyeongdae-note');
      }
      api.markCleared(id);
    });
    api.playClick();
  }

  function onInscription() {
    api.toast(FLOOR_INSCRIPTION, true);
    if (api.recordEvidence) api.recordEvidence('ch4-floor');
  }

  function toggleCraftEye() {
    if (craftEyeTimer) {
      clearTimeout(craftEyeTimer);
      craftEyeTimer = null;
    }
    craftEyeOn = true;
    updateMechanics();
    api.playClick();
    api.vibrate([20, 30, 20]);
    api.toast('장인의 안목 — 걸쇠와 눌리는 부분이 드러납니다.', true);
    craftEyeTimer = setTimeout(() => {
      craftEyeOn = false;
      craftEyeTimer = null;
      updateMechanics();
    }, 2800);
  }

  updateMechanics();

  return {
    id, title, blurb, steps, hint, root,
    getInteractives: () => interactives,
    build(scene) {
      scene.add(root);
      if (api.setCh4Lighting) api.setCh4Lighting(true);
    },
    start() { this.reset(); },
    reset() {
      phase = 'drawers';
      softFailCount = 0;
      badClicks = 0;
      hintLevel = 0;
      mistookFlag = false;
      lastFeel = null;
      craftEyeOn = false;
      if (craftEyeTimer) {
        clearTimeout(craftEyeTimer);
        craftEyeTimer = null;
      }
      resetDrawerPositions();
      herb.visible = false;
      sideSeam.visible = true;
      herb.position.set(BODY_W / 2 - 0.01, bodyY0 + CUPBOARD_H * 0.55, 0);
      bodyGroup.position.x = 0;
      api.setObjective('약성패와 서랍의 걸림을 살펴 여는 차례를 알아내시오.');
      api.setSteps('A', []);
      applyOrderHint(hint);
      api.toast('약장 — 약성패와 바닥 덧새김, 옆 걸쇠를 살피시오.', true);
    },
    getDragInteraction(kind, iid) {
      if (phase !== 'drawers' || kind !== 'drawer' || !drawers[iid]) return null;
      let startExt = drawers[iid].ext;
      let blocked = false;
      return {
        start() {
          startExt = drawers[iid].ext;
          blocked = false;
        },
        move(s) {
          if (!canMove(iid)) {
            if (!blocked) {
              blocked = true;
              catchWhy(iid);
            }
            return;
          }
          applyExt(iid, startExt + s.dy * 0.004);
          const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          if (now - lastRumbleAt > 320) {
            lastRumbleAt = now;
            if (api.playDrawerRumble) api.playDrawerRumble();
          }
        },
        end() {
          if (!canMove(iid)) return;
          snapDrawer(iid);
        },
        cancel() {
          setExt(iid, startExt, { place: true, silent: true });
        },
      };
    },
    handleInteract(kind, iid) {
      if (phase === 'finale') return;
      if (kind === 'inscription') onInscription();
      else if (kind === 'drawer') onDrawer(iid);
      else if (kind === 'herb') onHerb();
    },
    revealHint() {
      if (hintLevel < 3) hintLevel += 1;
      const text = hintTextFor(hintLevel);
      applyOrderHint(text);
      api.toast(hintLevel >= 3 ? ('힌트: ' + HINT_FULL) : ('힌트: ' + text), true);
      api.playClick();
    },
    get mistook() { return mistookFlag; },
    getState() {
      return {
        phase,
        ext: { MID: drawers.MID.ext, TOP: drawers.TOP.ext, BOT: drawers.BOT.ext },
        latchOut: { TOP: latchOut(drawers.MID), BOT: latchOut(drawers.TOP) },
        loadOn: { MID: loadOn(drawers.MID), TOP: loadOn(drawers.TOP) },
        rest: { MID: inRest(drawers.MID), TOP: inRest(drawers.TOP) },
        canMove: { MID: canMove('MID'), TOP: canMove('TOP'), BOT: canMove('BOT') },
        hintLevel,
        latchBarX: { TOP: topLatch.bar.position.x, BOT: botLatch.bar.position.x },
        loadPegY: { TOP: topLatch.peg.position.y, BOT: botLatch.peg.position.y },
        lastFeel,
        craftEyeOn,
      };
    },
    toggleCraftEye,
    solve() {
      if (phase === 'finale') return;
      setExt('MID', REST_EXT, { place: true, silent: true });
      setExt('TOP', REST_EXT, { place: true, silent: true });
      setExt('BOT', 1, { place: true, silent: true });
      maybeRevealHerb();
      onHerb();
    },
    dispose(scene) {
      if (api.setCh4Lighting) api.setCh4Lighting(false);
      if (craftEyeTimer) clearTimeout(craftEyeTimer);
      scene.remove(root);
      disposeChapterResources(root, mats);
      interactives.length = 0;
    },
  };
}
