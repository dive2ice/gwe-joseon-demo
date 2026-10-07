/** CSS pixel displacement -> world-axis movement, using the camera at pointer-down. */
export function alongAxis(x, y, axis, fallback = { x: 0, y: 1 }) {
  const length2 = axis.x * axis.x + axis.y * axis.y;
  // Nearly end-on axes cannot be inverted stably; use a fixed accessible screen gesture.
  if (length2 < 1600) return (x * fallback.x + y * fallback.y) / 260;
  return (x * axis.x + y * axis.y) / length2;
}

export function onPlane(x, y, axisX, axisZ) {
  const det = axisX.x * axisZ.y - axisZ.x * axisX.y;
  if (Math.abs(det) < 1800) return { x: x / 400, z: y / 400 };
  return { x: (x * axisZ.y - axisZ.x * y) / det, z: (axisX.x * y - x * axisX.y) / det };
}
