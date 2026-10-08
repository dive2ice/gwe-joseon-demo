/** The archive uses the campaign's baked surfaces and physical mechanism frames. */
export function mechanismFrame(THREE, object, type, localAxis) {
  object.updateWorldMatrix(true, false);
  return {
    type,
    origin: object.getWorldPosition(new THREE.Vector3()),
    axis: new THREE.Vector3(...localAxis).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion())),
  };
}

export function archivePalette(mats) {
  return {
    wood: mats.sliceWood || mats.woodRich || mats.wood,
    dark: mats.sliceWoodDark || mats.woodDark,
    brass: mats.sliceBrass || mats.brass,
    bright: mats.sliceBrassBright || mats.brassBright || mats.brass,
  };
}

export function archiveLacquer(THREE, dark, color) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: .3, metalness: .06, clearcoat: .8, clearcoatRoughness: .2,
    bumpMap: dark.bumpMap || null, bumpScale: .0004,
  });
}

export function archiveCloth(THREE, source) {
  const material = source.clone();
  material.roughness = .95; material.metalness = 0;
  try {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c4c4c4'; ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 4) {
      ctx.fillStyle = i % 8 ? '#adadad' : '#dddddd'; ctx.fillRect(i, 0, 1, 128);
      ctx.fillStyle = '#b8b8b8'; ctx.fillRect(0, i, 128, 1);
    }
    material.bumpMap = new THREE.CanvasTexture(canvas);
    material.bumpMap.wrapS = material.bumpMap.wrapT = THREE.RepeatWrapping;
    material.bumpMap.repeat.set(3, 3); material.bumpScale = .0007;
  } catch { /* Geometry and matte finish remain usable without a canvas. */ }
  return material;
}
