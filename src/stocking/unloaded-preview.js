import { createClothGeometry } from '../core/cloth/geometry.js';

export function createUnloadedGeometry(frame) {
  const { columns, rows, points, relaxedArc, relaxedRadiiM, reinforcementByRow } = frame;
  const state = new Float32Array(points * 16);
  const stride = columns + 1;
  let height = 0;
  for (let row = 0; row <= rows; row++) {
    const radius = relaxedRadiiM[row];
    if (row > 0) {
      const restLength = relaxedArc[row] - relaxedArc[row - 1];
      const radiusChange = radius - relaxedRadiiM[row - 1];
      // The meridian keeps its rest length through the tapered toe.
      height += Math.sqrt(Math.max(0, restLength ** 2 - radiusChange ** 2));
    }
    for (let column = 0; column <= columns; column++) {
      const offset = (row * stride + column) * 16;
      const angle = 2 * Math.PI * (column % columns) / columns;
      state[offset] = radius * Math.sin(angle);
      state[offset + 1] = height;
      state[offset + 2] = radius * Math.cos(angle);
      state[offset + 4] = state[offset + 5] = 1;
      state[offset + 10] = reinforcementByRow[row];
      state[offset + 11] = radius;
    }
  }
  return createClothGeometry({ ...frame, state });
}
