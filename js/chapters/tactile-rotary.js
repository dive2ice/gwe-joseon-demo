// Shared only by Ch3 and Ch6: rigid world frames and reversible tactile detents.
export const QUARTER = Math.PI / 2;
export const wrapStop = (angle, step = QUARTER) => ((Math.round(angle / step) % Math.round(Math.PI * 2 / step)) + Math.round(Math.PI * 2 / step)) % Math.round(Math.PI * 2 / step);
export function atStop(angle, stop, step = QUARTER) {
  return Math.abs(Math.atan2(Math.sin(angle - stop * step), Math.cos(angle - stop * step))) < 0.015;
}
export function gestureFrame(THREE, object, axis, type = 'rotate') {
  object.updateWorldMatrix(true, false);
  const origin = object.getWorldPosition(new THREE.Vector3());
  const direction = new THREE.Vector3(...axis).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion())).normalize();
  return { type, origin: origin.toArray(), axis: direction.toArray() };
}
export function rotaryDrag({ object, axis, step = QUARTER, allowed = () => true, commit, changed = () => {}, detent = () => {}, blocked = () => {} }) {
  const before = object.rotation[axis];
  const unlocked = allowed();
  let tick = Math.round(before / step);
  let started = false;
  function move(sample = {}) {
    if (!unlocked || !Number.isFinite(sample.turn)) return;
    object.rotation[axis] = before + sample.turn;
    const next = Math.round(object.rotation[axis] / step);
    if (tick !== next) { tick = next; detent(); }
    changed();
  }
  return {
    start(sample) { started = true; if (!unlocked) blocked(); else move(sample); },
    move,
    end(sample) {
      if (!started || !unlocked) return;
      move(sample);
      const stop = wrapStop(object.rotation[axis], step);
      object.rotation[axis] = stop * step;
      changed(); commit(stop);
    },
    cancel() { object.rotation[axis] = before; changed(); },
  };
}
export function pullDrag({ read, write, ready, confirm, threshold = 0.045, maximum = 0.07, blocked = () => {} }) {
  const before = read();
  const unlocked = ready();
  let distance = 0;
  let started = false;
  function move(sample = {}) {
    if (!Number.isFinite(sample.travel)) return;
    distance = Math.max(0, Math.min(maximum, sample.travel));
    write(before + Math.min(distance, unlocked ? maximum : 0.006));
  }
  return {
    start(sample) { started = true; move(sample); },
    move,
    end(sample) {
      if (!started) return;
      move(sample);
      if (unlocked && distance >= threshold) confirm();
      else { write(before); if (!unlocked && distance >= 0.012) blocked(); }
    },
    cancel() { write(before); },
  };
}
export const MOTIFS = ['달', '산', '물', '구름'];
export function stopMotif(index, stop, target) { return MOTIFS[((stop - target + index) % 4 + 4) % 4]; }
export function motifPlaque(THREE, text, fallback, width = 0.028, height = 0.028) {
  let material = fallback;
  try {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#261e15'; ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#ceb586'; ctx.font = '44px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 64, 34, 112);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.68, metalness: 0.2 });
  } catch (_) { /* The engraved tick remains usable without canvas. */ }
  // A double-sided textured plane mirrors its writing when viewed from behind.
  // Give each side its own outward-facing plane so both read left to right.
  const plaque = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(width, height);
  const front = new THREE.Mesh(geometry, material);
  const back = new THREE.Mesh(geometry, material);
  front.position.z = 0.00001;
  back.position.z = -0.00001;
  back.rotation.y = Math.PI;
  plaque.add(front, back);
  return plaque;
}
