/** Furniture details for Chapters 6–8. No puzzle positions or state live here. */
import { bevelBoxMesh } from './materials.js';

export function craftPalette(THREE, mats, chapter = 6) {
  const wood = (mats.sliceWood || mats.woodRich || mats.wood).clone();
  wood.color.multiply(new THREE.Color(({6:0xc3b9a6,7:0xb19a88,8:0xc4b19b})[chapter] || 0xc3b9a6));
  const dark = (mats.sliceWoodDark || mats.woodDark).clone();
  dark.color.multiply(new THREE.Color(0xc7bcb0));
  const brass = mats.sliceBrass || mats.brass;
  const bright = mats.sliceBrassBright || mats.brassBright || brass;
  const paper = mats.slicePaper || mats.paper;
  const lacquer = new THREE.MeshPhysicalMaterial({
    color: 0x241b18, roughness: 0.39, metalness: 0,
    clearcoat: 0.55, clearcoatRoughness: 0.25,
  });
  return { wood, dark, brass, bright, paper, lacquer };
}

export function addRaisedPanel(THREE, parent, wood, dark, w, h, z, y) {
  const panel = bevelBoxMesh(THREE, w, h, 0.012, wood, 0, y, z, 0.002);
  parent.add(panel);
  [-1, 1].forEach((side) => {
    parent.add(bevelBoxMesh(THREE, w + 0.026, 0.012, 0.014, dark, 0, y + side * (h / 2 + 0.009), z, 0.0018));
    parent.add(bevelBoxMesh(THREE, 0.012, h, 0.014, dark, side * (w / 2 + 0.009), y, z, 0.0018));
  });
}

export function makeSealLacquer(THREE) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x71372c, roughness: 0.48, metalness: 0,
    clearcoat: 0.24, clearcoatRoughness: 0.34,
  });
  try {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#a58173'; ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 250; i++) {
      ctx.fillStyle = i % 4 ? 'rgba(49,24,17,0.08)' : 'rgba(242,207,174,0.13)';
      ctx.fillRect((i * 47) % 128, (i * 71) % 128, 2 + i % 5, 1);
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
    mat.map = tex;
  } catch (_) { /* Real materials remain usable without a 2D canvas. */ }
  return mat;
}

/** A quiet, continuous mountain painting across the three paper leaves. */
export function makeScreenPaper(THREE, fallback) {
  try {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d4c4a4'; ctx.fillRect(0, 0, 512, 512);
    for (let n = 0; n < 1600; n++) {
      ctx.fillStyle = n % 3 ? 'rgba(91,73,44,0.04)' : 'rgba(255,245,213,0.15)';
      ctx.fillRect((n * 109) % 512, (n * 199) % 512, 3 + n % 13, 1);
    }
    // Sparse mineral-pigment mountain washes leave the upper field calm.
    const ridge = (base, amplitude, phase, fill) => {
      ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(0, 512);
      for (let x = 0; x <= 512; x += 4) {
        const crest = Math.pow(Math.abs(Math.sin(x * 0.013 + phase)), 1.35);
        const serration = Math.sin(x * 0.11 + phase) * 3 + Math.sin(x * 0.041) * 7;
        ctx.lineTo(x, base - amplitude * crest + serration);
      }
      ctx.lineTo(512, 512); ctx.closePath(); ctx.fill();
    };
    ridge(380, 180, 0.5, '#b7b9a2');
    ridge(434, 161, 1.3, '#879582');
    ridge(481, 128, 2.5, '#647b70');
    ctx.strokeStyle = 'rgba(220,214,184,0.55)'; ctx.lineWidth = 1.2;
    for (let n = 0; n < 12; n++) {
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 8) {
        const y = 435 + n * 6 + Math.sin(x * 0.022 + n * 0.6) * 3;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // One faded studio seal is decoration, kept away from the active ink ends.
    ctx.fillStyle = 'rgba(131,66,45,0.65)'; ctx.fillRect(453, 90, 18, 24);
    ctx.strokeStyle = '#cbb897'; ctx.lineWidth = 1;
    ctx.strokeRect(457, 94, 10, 16);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, side: THREE.FrontSide });
  } catch (_) { return fallback; }
}

export function screenLeaf(THREE, material, index, w, h) {
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (index + uv.getX(i)) / 3);
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

/** Dispose per-visit art, preserving shared palette maps used by other chapters. */
export function disposeCraftRoot(root, mats, extraOwned = []) {
  const sharedMaterials = new Set(Object.values(mats).filter((m) => m?.isMaterial));
  const sharedTextures = new Set();
  sharedMaterials.forEach((mat) => Object.values(mat).forEach((value) => {
    if (value?.isTexture) sharedTextures.add(value);
  }));
  const geometries = new Set(); const materials = new Set(extraOwned); const textures = new Set();
  root.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    (Array.isArray(node.material) ? node.material : [node.material]).forEach((mat) => {
      if (mat && !sharedMaterials.has(mat)) materials.add(mat);
    });
  });
  materials.forEach((mat) => Object.values(mat).forEach((value) => {
    if (value?.isTexture && !sharedTextures.has(value)) textures.add(value);
  }));
  geometries.forEach((g) => g.dispose());
  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
}
