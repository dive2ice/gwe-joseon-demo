/** Shared procedural materials — Ch1 gets richer wood/brass canvases. */
import * as THREE from 'three';
import { applyBakedSurface } from './blender-surfaces.js';

function makeCanvas(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  paint(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Soft pine / zelkova grain with plank seams */
export function makeWoodMap(seed = 1, tone = '#b08958') {
  return makeCanvas(256, (ctx, size) => {
    ctx.fillStyle = tone;
    ctx.fillRect(0, 0, size, size);
    // base noise streaks
    for (let i = 0; i < 90; i++) {
      const y = ((i * 37 + seed * 13) % size);
      const a = 0.04 + ((i * 17) % 10) / 100;
      ctx.strokeStyle = `rgba(40, 22, 8, ${a})`;
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < size; x += 8) {
        const wobble = Math.sin((x + seed * 9) * 0.04 + i) * 3
          + Math.sin((x + i) * 0.11) * 1.5;
        ctx.lineTo(x, y + wobble);
      }
      ctx.stroke();
    }
    // darker growth rings / knots hints
    for (let k = 0; k < 4; k++) {
      const cx = (seed * 41 + k * 70) % size;
      const cy = (seed * 23 + k * 55) % size;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18);
      g.addColorStop(0, 'rgba(60, 35, 12, 0.35)');
      g.addColorStop(1, 'rgba(60, 35, 12, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 20, cy - 20, 40, 40);
    }
    // faint plank seam
    ctx.strokeStyle = 'rgba(30, 16, 6, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size * 0.5, 0);
    ctx.lineTo(size * 0.5, size);
    ctx.stroke();
  });
}

/** Subtle bump-ish grayscale from grain (used as bumpMap) */
export function makeWoodBump(seed = 2) {
  return makeCanvas(128, (ctx, size) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 60; i++) {
      const y = (i * 19 + seed) % size;
      const v = 90 + (i % 7) * 12;
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < size; x += 6) {
        ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 2);
      }
      ctx.stroke();
    }
  });
}

/** Hanji fiber. The rub sheet reads this; other paper props keep `paper`. */
export function makeHanjiMap() {
  return makeCanvas(256, (ctx, size) => {
    ctx.fillStyle = '#f3ead4';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 70; i++) {
      const y = (i * 29) % size;
      ctx.strokeStyle = `rgba(90, 70, 40, ${0.04 + (i % 5) / 80})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < size; x += 10) {
        ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 2);
      }
      ctx.stroke();
    }
  });
}

/** Sumi grain for the ink that a rub leaves on hanji. */
export function makeInkMap() {
  return makeCanvas(128, (ctx, size) => {
    ctx.fillStyle = '#1a120c';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(40, 28, 18, ${0.15 + (i % 4) / 20})`;
      ctx.fillRect((i * 19) % size, (i * 11) % size, 18, 3);
    }
  });
}

/** Glyphs the rub reveals. Null when the canvas cannot draw; opacity still gates the mesh. */
export function makeInkWritingMap(text) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.fillText !== 'function') return null;
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = '#140e0a';
    ctx.font = '44px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text || ''), 256, 64);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  } catch {
    return null;
  }
}

/** Aged brass / bronze plate */
export function makeBrassMap(seed = 3) {
  return makeCanvas(128, (ctx, size) => {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#c9a84a');
    g.addColorStop(0.45, '#8a6e30');
    g.addColorStop(1, '#6a5420');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${180 + (i % 40)}, ${140 + (i % 30)}, ${40}, ${0.04 + (i % 5) / 80})`;
      ctx.fillRect((i * 17 + seed) % size, (i * 29) % size, 12, 8);
    }
    // patina freckles
    for (let i = 0; i < 25; i++) {
      ctx.fillStyle = 'rgba(40, 70, 40, 0.08)';
      ctx.beginPath();
      ctx.arc((i * 47 + seed) % size, (i * 31) % size, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  });
}


/** Representative-slice materials. Data channels stay linear; colour is sRGB. */
function makeSliceSurface(size, sample, dataMap = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rgb = sample(x / size, y / size, x, y);
      const i = (y * size + x) * 4;
      pixels.data[i] = rgb[0];
      pixels.data[i + 1] = rgb[1];
      pixels.data[i + 2] = rgb[2];
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = dataMap ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function createSliceMaterials() {
  let woodColor, woodData, brassColor, brassData, paperColor;
  const tau = Math.PI * 2;
  // Periodic fields avoid a visible join on narrow rails and large door panels.
  const woodField = (u, v) => {
    const warp = 0.52 * Math.sin(u * tau) + 0.22 * Math.sin(u * tau * 3 + v * tau * 2);
    const ring = Math.sin(v * tau * 34 + warp * 4.5);
    const pore = Math.pow(Math.max(0, Math.sin(v * tau * 117 + warp * 8)), 12);
    const broad = Math.sin(v * tau * 3 + Math.sin(u * tau) * 0.6);
    return { ring, pore, broad };
  };
  const brassField = (u, v) => {
    const cloud = Math.sin(u * tau * 3 + Math.sin(v * tau * 2)) * Math.cos(v * tau * 4 + u * tau);
    const patina = Math.max(0, cloud - 0.35);
    const brush = Math.sin(v * tau * 93 + Math.sin(u * tau * 4)) * 1.6;
    return { cloud, patina, brush };
  };
  try {
    woodColor = makeSliceSurface(512, (u, v) => {
      const { ring, pore, broad } = woodField(u, v);
      const grain = ring * 6.5 - pore * 17 + broad * 8;
      return [133 + grain, 86 + grain * 0.74, 49 + grain * 0.45];
    });
    // R is bump height, G is roughness. Reusing a packed linear map saves a texture.
    woodData = makeSliceSurface(512, (u, v) => {
      const { ring, pore, broad } = woodField(u, v);
      return [139 + ring * 4 - pore * 29, 167 + pore * 31 + broad * 10, 128];
    }, true);
    brassColor = makeSliceSurface(256, (u, v) => {
      const { cloud, patina, brush } = brassField(u, v);
      return [183 + cloud * 12 - patina * 77 + brush, 147 + cloud * 9 - patina * 43 + brush, 84 + cloud * 6 - patina * 14];
    });
    brassData = makeSliceSurface(256, (u, v) => {
      const { cloud, patina, brush } = brassField(u, v);
      return [132 + brush * 1.5 - patina * 15, 117 + patina * 88 + cloud * 9, 128];
    }, true);
    paperColor = makeSliceSurface(256, (u, v, x, y) => {
      const fiber = Math.sin(v * tau * 113 + Math.sin(u * tau * 3)) * 2;
      const fleck = ((x * 73 + y * 151 + x * y * 7) % 37) / 37;
      const n = fiber + fleck * 6;
      return [215 + n, 197 + n, 160 + n];
    });
  } catch (_) {
    // Canvas-free module tests and WebGL fallback keep the same material contract.
  }
  applyBakedSurface(woodColor, 'wood-color');
  applyBakedSurface(woodData, 'wood-data');
  applyBakedSurface(brassColor, 'brass-color');
  applyBakedSurface(brassData, 'brass-data');
  const woodMaps = woodColor ? { map: woodColor, bumpMap: woodData, roughnessMap: woodData, bumpScale: 0.0014 } : {};
  const brassMaps = brassColor ? { map: brassColor, roughnessMap: brassData, bumpMap: brassData, bumpScale: 0.0003 } : {};
  return {
    sliceWood: new THREE.MeshPhysicalMaterial({
      color: woodColor ? 0xffffff : 0x855631, roughness: 1, metalness: 0,
      clearcoat: 0.22, clearcoatRoughness: 0.4, ...woodMaps,
    }),
    sliceWoodDark: new THREE.MeshPhysicalMaterial({
      color: woodColor ? 0xada394 : 0x543b29, roughness: 1, metalness: 0,
      clearcoat: 0.14, clearcoatRoughness: 0.48, ...woodMaps,
    }),
    sliceBrass: new THREE.MeshStandardMaterial({
      color: brassColor ? 0xdfd9bf : 0x9f8050, roughness: 0.94, metalness: 0.86, ...brassMaps,
    }),
    sliceBrassBright: new THREE.MeshStandardMaterial({
      color: brassColor ? 0xffffff : 0xbd995e, roughness: 0.69, metalness: 0.88,
      emissive: 0x291b08, emissiveIntensity: 0.04, ...brassMaps,
    }),
    sliceMirror: new THREE.MeshPhysicalMaterial({
      color: 0xb9c5c3, roughness: 0.115, metalness: 0.96,
      clearcoat: 0.55, clearcoatRoughness: 0.055,
    }),
    slicePaper: new THREE.MeshStandardMaterial({
      color: paperColor ? 0xffffff : 0xd7c5a0, roughness: 0.94, metalness: 0,
      ...(paperColor ? { map: paperColor } : {}),
    }),
  };
}

/** Small edge radii catch light without changing the game's shared BoxGeometry. */
export function bevelBoxMesh(THREE, w, h, d, mat, x = 0, y = 0, z = 0, radius = 0.003, grainOffset = 0) {
  const r = Math.min(radius, w * 0.2, h * 0.2, d * 0.2);
  const geo = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3);
  const pos = geo.attributes.position;
  const normals = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const half = [w / 2, h / 2, d / 2];
  for (let i = 0; i < pos.count; i++) {
    const raw = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const face = [normals.getX(i), normals.getY(i), normals.getZ(i)];
    const point = raw.map((v, a) => Math.sign(v) * (Math.abs(v) > 0.3 ? half[a] : half[a] - r));
    const core = point.map((v, a) => Math.max(-half[a] + r, Math.min(half[a] - r, v)));
    const n = new THREE.Vector3(point[0] - core[0], point[1] - core[1], point[2] - core[2]).normalize();
    pos.setXYZ(i, core[0] + n.x * r, core[1] + n.y * r, core[2] + n.z * r);
    normals.setXYZ(i, n.x, n.y, n.z);
    // Physical-sized UVs retain fine grain instead of stretching one tile per object.
    const a = Math.abs(face[0]) > 0.5 ? d : w;
    const b = Math.abs(face[1]) > 0.5 ? d : h;
    const u = uv.getX(i); const v = uv.getY(i);
    const vertical = b > a * 2;
    uv.setXY(i, (vertical ? v * b : u * a) / 0.52 + grainOffset,
      (vertical ? u * a : v * b) / 0.52 + grainOffset * 0.37);
  }
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export function createMaterials() {
  let woodMap; let woodBump; let woodDarkMap; let brassMap; let hanjiMap; let inkMap;
  try {
    hanjiMap = makeHanjiMap();
    inkMap = makeInkMap();
    woodMap = makeWoodMap(1, '#b08958');
    woodMap.repeat.set(2, 1.5);
    woodBump = makeWoodBump(2);
    woodBump.repeat.set(2, 1.5);
    woodDarkMap = makeWoodMap(7, '#7a5a38');
    woodDarkMap.repeat.set(1.5, 1.2);
    brassMap = makeBrassMap(3);
  } catch (_) {
    woodMap = woodBump = woodDarkMap = brassMap = hanjiMap = inkMap = null;
  }

  const woodOpts = woodMap
    ? { map: woodMap, bumpMap: woodBump, bumpScale: 0.035 }
    : {};
  const woodDarkOpts = woodDarkMap
    ? { map: woodDarkMap, bumpMap: woodBump, bumpScale: 0.028 }
    : {};
  const brassOpts = brassMap ? { map: brassMap } : {};

  return {
    ...createSliceMaterials(),
    wood: new THREE.MeshStandardMaterial({
      color: 0xb08958, roughness: 0.72, metalness: 0.05, ...woodOpts,
    }),
    woodDark: new THREE.MeshStandardMaterial({
      color: 0x8a6840, roughness: 0.78, metalness: 0.04, ...woodDarkOpts,
    }),
    woodAccent: new THREE.MeshStandardMaterial({
      color: 0xc9a06a, roughness: 0.65, metalness: 0.06,
      emissive: 0x2a1808, emissiveIntensity: 0.15, ...woodOpts,
    }),
    woodRich: new THREE.MeshStandardMaterial({
      color: 0xc4a06a, roughness: 0.58, metalness: 0.08,
      emissive: 0x1a1008, emissiveIntensity: 0.08, ...woodOpts,
    }),
    lacquer: new THREE.MeshStandardMaterial({
      color: 0x1a1210, roughness: 0.35, metalness: 0.15,
    }),
    nacre: new THREE.MeshStandardMaterial({
      color: 0xd8e8e0, roughness: 0.25, metalness: 0.55,
      emissive: 0x204030, emissiveIntensity: 0.25,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0x8a6e30, roughness: 0.35, metalness: 0.85, ...brassOpts,
    }),
    brassBright: new THREE.MeshStandardMaterial({
      color: 0xb8954a, roughness: 0.28, metalness: 0.9,
      emissive: 0x3a2808, emissiveIntensity: 0.2, ...brassOpts,
    }),
    brassPin: new THREE.MeshStandardMaterial({
      color: 0xd4b060, roughness: 0.32, metalness: 0.92,
      emissive: 0x4a3010, emissiveIntensity: 0.25, ...brassOpts,
    }),
    iron: new THREE.MeshStandardMaterial({
      color: 0x3a3a3c, roughness: 0.55, metalness: 0.7,
    }),
    paper: new THREE.MeshStandardMaterial({
      color: 0xe8d9b8, roughness: 0.9, metalness: 0,
    }),
    hanji: new THREE.MeshStandardMaterial({
      color: hanjiMap ? 0xffffff : 0xf3ead4, roughness: 0.96, metalness: 0,
      ...(hanjiMap ? { map: hanjiMap } : {}),
    }),
    sumi: new THREE.MeshStandardMaterial({
      color: inkMap ? 0xffffff : 0x1a120c, roughness: 0.62, metalness: 0,
      transparent: true, opacity: 1, depthWrite: false,
      ...(inkMap ? { map: inkMap } : {}),
    }),
    floor: new THREE.MeshStandardMaterial({
      color: 0x1a1410, roughness: 0.95, metalness: 0,
    }),
    wall: new THREE.MeshStandardMaterial({
      color: 0x12100e, roughness: 1, metalness: 0,
    }),
    mirror: new THREE.MeshStandardMaterial({
      color: 0xc8d0d8, roughness: 0.12, metalness: 0.95,
      emissive: 0x203040, emissiveIntensity: 0.15,
    }),
    beam: new THREE.MeshStandardMaterial({
      color: 0xffe8a0, roughness: 0.4, metalness: 0,
      emissive: 0xffcc66, emissiveIntensity: 0.9, transparent: true, opacity: 0.75,
    }),
    lampFlame: new THREE.MeshStandardMaterial({
      color: 0xffcc66, roughness: 1, metalness: 0,
      emissive: 0xffaa44, emissiveIntensity: 1.4,
      transparent: true, opacity: 0.85, depthWrite: false,
    }),
    craftMark: new THREE.MeshStandardMaterial({
      color: 0xffe8a0, roughness: 1, metalness: 0,
      emissive: 0xffcc66, emissiveIntensity: 0,
      transparent: true, opacity: 0, depthWrite: false,
    }),
    herb: new THREE.MeshStandardMaterial({
      color: 0x5a7a40, roughness: 0.85, metalness: 0,
    }),
    star: new THREE.MeshStandardMaterial({
      color: 0xf0e8c0, roughness: 0.3, metalness: 0.4,
      emissive: 0x806020, emissiveIntensity: 0.5,
    }),
    bangBlue: new THREE.MeshStandardMaterial({ color: 0x2a4a8a, roughness: 0.4, metalness: 0.3, emissive: 0x102040, emissiveIntensity: 0.2 }),
    bangRed: new THREE.MeshStandardMaterial({ color: 0x8a2020, roughness: 0.4, metalness: 0.3, emissive: 0x401010, emissiveIntensity: 0.2 }),
    bangYellow: new THREE.MeshStandardMaterial({ color: 0xc8a020, roughness: 0.4, metalness: 0.3, emissive: 0x403010, emissiveIntensity: 0.2 }),
    bangWhite: new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.4, metalness: 0.3, emissive: 0x303028, emissiveIntensity: 0.15 }),
    bangBlack: new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.4, metalness: 0.35, emissive: 0x080808, emissiveIntensity: 0.1 }),
  };
}

export function boxMesh(THREE, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function invisibleHit(THREE, w, h, d, userData, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  m.position.set(x, y, z);
  m.userData = userData;
  return m;
}
