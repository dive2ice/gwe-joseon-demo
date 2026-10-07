/** Visual light paths for the dressing-table slice. Puzzle predicates stay in Ch5. */
export function createLightSegment(THREE, name, radius) {
  const group = new THREE.Group();
  group.name = name;
  const make = (r, opacity) => new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 1, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd29a, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }),
  );
  group.add(make(radius, 0.24), make(radius * 3.5, 0.035));
  return group;
}

export function placeLightSegment(THREE, segment, start, end, opacity) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  segment.visible = length > 1e-6;
  segment.position.copy(start).add(end).multiplyScalar(0.5);
  segment.scale.set(1, length, 1);
  if (length > 1e-6) segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.divideScalar(length));
  segment.children[0].material.opacity = opacity;
  segment.children[1].material.opacity = opacity * 0.13;
  // Read-only observability for geometry QA; never used as puzzle state.
  segment.userData.start = start.toArray();
  segment.userData.end = end.toArray();
}

export function lightPathEndpoint(THREE, receiver, { lampError, yawError, horizontal }) {
  const end = receiver.clone();
  // Within the existing +/-1 bands the spot falls on the paper; outside it
  // moves beyond that paper. Keep the same continuous displacement on either side.
  end.x += yawError * (horizontal ? 0.07 : 0.05);
  if (horizontal) end.z += lampError * 0.05;
  else end.y += lampError * 0.07;
  return end;
}

export function splitAtPlaneZ(THREE, start, end, planeZ) {
  const dz = end.z - start.z;
  if (Math.abs(dz) < 1e-7) return null;
  const t = (planeZ - start.z) / dz;
  return t > 0 && t < 1 ? new THREE.Vector3().lerpVectors(start, end, t) : null;
}
