/** Geometry details owned by the late-campaign chapters; no puzzle state or answers. */
import { bevelBoxMesh } from '../materials.js';

export function faceRing(THREE, parent, radius, tube, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 64), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function insetFrame(THREE, parent, w, h, material, x, y, z, rail = 0.009) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  for (const sy of [-1, 1]) group.add(bevelBoxMesh(THREE, w, rail, rail, material, 0, sy * h / 2, 0, rail / 4));
  for (const sx of [-1, 1]) group.add(bevelBoxMesh(THREE, rail, h, rail, material, sx * w / 2, 0, 0, rail / 4));
  parent.add(group);
  return group;
}

export function screwHead(THREE, parent, material, dark, x, y, z, radius = 0.006) {
  const head = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.003, 12), material);
  head.rotation.x = Math.PI / 2;
  head.position.set(x, y, z);
  head.castShadow = head.receiveShadow = true;
  parent.add(head);
  parent.add(bevelBoxMesh(THREE, radius * 1.15, radius * 0.15, 0.001, dark, x, y, z + 0.002));
}

/** Low relief on the timber, kept outside every rule plaque and moving assembly. */
export function cloudRelief(THREE, parent, material, x, y, z, scale = 1, mirror = 1) {
  const points = [[-0.13,0],[-0.10,0.04],[-0.055,0.042],[-0.025,0.014],[0,0.018],[0.027,0.048],[0.064,0.04],[0.09,0.008],[0.13,0.014]]
    .map(([px,py]) => new THREE.Vector3(px * scale * mirror, py * scale, 0));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 28, 0.003 * scale, 5, false), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Circular inlay with a continuous S seam, instead of overlapping coin shapes. */
export function taegeukInlay(THREE, parent, red, blue, radius, x, y, z) {
  const group = new THREE.Group();
  group.name = 'taegeuk-inlay';
  group.position.set(x, y, z);
  group.add(new THREE.Mesh(new THREE.CircleGeometry(radius, 64), red));
  const shape = new THREE.Shape();
  shape.moveTo(0, radius);
  shape.absarc(0, 0, radius, Math.PI / 2, Math.PI * 1.5, true);
  shape.absarc(0, -radius / 2, radius / 2, -Math.PI / 2, Math.PI / 2, true);
  shape.absarc(0, radius / 2, radius / 2, -Math.PI / 2, Math.PI / 2, false);
  shape.closePath();
  const half = new THREE.Mesh(new THREE.ShapeGeometry(shape, 32), blue);
  half.position.z = 0.0006;
  group.add(half);
  parent.add(group);
  return group;
}

/** Cloned materials can share palette textures. Dispose only chapter-owned resources. */
export function disposeCraftRoot(root, mats) {
  const sharedMaterials = new Set(Object.values(mats));
  const sharedTextures = new Set();
  for (const material of sharedMaterials) {
    for (const value of Object.values(material || {})) if (value?.isTexture) sharedTextures.add(value);
  }
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!material || sharedMaterials.has(material)) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture && !sharedTextures.has(value)) textures.add(value);
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
}
