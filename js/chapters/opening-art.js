/** Owned surface finishing and small craft details for the opening three chapters. */
export function createOpeningArt(THREE, shared) {
  const retained = new Set();
  const timers = new Set();
  const intervals = new Set();
  let alive = true;
  const keep = (resource) => { if (resource) retained.add(resource); return resource; };
  const lacquer = keep(new THREE.MeshPhysicalMaterial({
    color: 0x171b19, roughness: 0.29, metalness: 0.08,
    clearcoat: 0.88, clearcoatRoughness: 0.2,
    envMapIntensity: 0.9, bumpMap: (shared.sliceWoodDark || shared.woodDark)?.bumpMap || null,
    bumpScale: 0.00045,
  }));
  lacquer.name = 'opening_black_lacquer';
  const nacre = keep(new THREE.MeshPhysicalMaterial({
    color: 0xc8d8cc, roughness: 0.24, metalness: 0.12,
    iridescence: 0.88, iridescenceIOR: 1.32, iridescenceThicknessRange: [130, 410],
    clearcoat: 0.65, clearcoatRoughness: 0.15, envMapIntensity: 1.05,
    emissive: 0x10251f, emissiveIntensity: 0.06,
  }));
  nacre.name = 'opening_mother_of_pearl';
  try {
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c3cfc5'; ctx.fillRect(0, 0, 256, 256);
    for (let n = 0; n < 43; n++) {
      ctx.strokeStyle = n % 3 === 0 ? 'rgba(106,139,151,0.2)' : 'rgba(243,232,204,0.28)';
      ctx.lineWidth = 1 + n % 3; ctx.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const y = n * 6 + Math.sin(x * 0.023 + n * 0.26) * 12 + Math.sin(x * 0.062 + n) * 2;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const map = keep(new THREE.CanvasTexture(canvas));
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    nacre.map = map;
  } catch { /* A canvas-free host keeps the same physical finish. */ }
  const paper = keep((shared.slicePaper || shared.hanji || shared.paper || lacquer).clone());
  paper.name = 'opening_hanji';
  paper.roughness = 0.98; paper.metalness = 0;

  function finishGltf(root) {
    const replacements = new Map();
    root.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.material) return;
      const finish = (source) => {
        if (replacements.has(source)) return replacements.get(source);
        keep(source);
        const material = keep(new THREE.MeshPhysicalMaterial());
        THREE.MeshStandardMaterial.prototype.copy.call(material, source);
        const name = source.name || '';
        const metal = /brass|iron/i.test(name);
        material.roughness = /iron/i.test(name) ? 0.62 : metal ? 0.43 : /dark/i.test(name) ? 0.7 : 0.64;
        material.metalness = metal ? 0.88 : 0;
        material.clearcoat = metal ? 0.1 : 0.18;
        material.clearcoatRoughness = metal ? 0.3 : 0.42;
        material.envMapIntensity = metal ? 0.95 : 0.65;
        material.name = name;
        replacements.set(source, material);
        return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(finish) : finish(mesh.material);
    });
  }
  function clearTimers() {
    for (const timer of timers) clearTimeout(timer);
    for (const timer of intervals) clearInterval(timer);
    timers.clear(); intervals.clear();
  }
  function dispose(root) {
    alive = false;
    clearTimers();
    const sharedMaterials = new Set(Object.values(shared).filter((m) => m?.isMaterial));
    const sharedTextures = new Set();
    for (const material of sharedMaterials) for (const value of Object.values(material)) if (value?.isTexture) sharedTextures.add(value);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    const collect = (value) => {
      if (!value) return;
      if (value.isBufferGeometry) geometries.add(value);
      if (value.isMaterial && !sharedMaterials.has(value)) {
        materials.add(value);
        for (const [key, texture] of Object.entries(value)) {
          if (key !== 'envMap' && texture?.isTexture && !sharedTextures.has(texture)) textures.add(texture);
        }
      }
      if (value.isTexture && !sharedTextures.has(value)) textures.add(value);
    };
    root?.traverse((obj) => {
      collect(obj.geometry);
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(collect);
      if (obj.isLight && obj.shadow?.map) obj.shadow.map.dispose();
    });
    retained.forEach(collect);
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    retained.clear();
  }
  return {
    lacquer, nacre, paper, keep, finishGltf, dispose, clearTimers,
    get alive() { return alive; },
    later(callback, ms) {
      const timer = setTimeout(() => { timers.delete(timer); if (alive) callback(); }, ms);
      timers.add(timer); return timer;
    },
    every(callback, ms) {
      const timer = setInterval(() => { if (alive) callback(); }, ms);
      intervals.add(timer); return timer;
    },
  };
}

/** Flush nacre plum spray, on the front apron rather than the puzzle surface. */
export function addNacreSpray(THREE, parent, material, x, y, z, width = 0.74) {
  const group = new THREE.Group();
  group.name = 'ch2_inlaid_plum'; group.position.set(x, y, z);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-width * 0.48, -0.022, 0), new THREE.Vector3(-width * 0.15, 0.003, 0),
    new THREE.Vector3(width * 0.16, 0.028, 0), new THREE.Vector3(width * 0.48, 0.018, 0),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.0019, 5, false), material));
  for (let i = 0; i < 7; i++) {
    const p = curve.getPoint(0.08 + i * 0.13);
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0); leaf.quadraticCurveTo(0.026, 0.006, 0.03, 0.031);
    leaf.quadraticCurveTo(0.004, 0.027, 0, 0);
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(leaf, 10), material);
    mesh.position.copy(p); mesh.rotation.z = i % 2 ? 0.8 : -2.3;
    group.add(mesh);
    if (i === 1 || i === 5) {
      for (let petal = 0; petal < 5; petal++) {
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.007, 10), material);
        const a = petal * Math.PI * 2 / 5;
        dot.position.set(p.x + Math.cos(a) * 0.01, p.y + 0.032 + Math.sin(a) * 0.01, 0.001);
        group.add(dot);
      }
    }
  }
  parent.add(group);
  return group;
}
