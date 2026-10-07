/** Dispose chapter-owned GPU resources, preserving the shared material palette. */
export function disposeChapterResources(root, sharedMaterials) {
  const shared = new Set(Object.values(sharedMaterials).filter(m => m?.isMaterial));
  const sharedTextures = new Set();
  for (const material of shared) for (const value of Object.values(material)) if (value?.isTexture) sharedTextures.add(value);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material || shared.has(material)) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture && !sharedTextures.has(value)) textures.add(value);
    }
  });
  for (const value of geometries) value.dispose();
  for (const value of materials) value.dispose();
  for (const value of textures) value.dispose();
}
