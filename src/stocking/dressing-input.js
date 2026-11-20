import { material } from '../config/stage1a.js';
import { normalize } from '../core/body/swept-surface.js';

export function createDressingInput(frame, surface, relaxedGeometry) {
  const relaxed = relaxedGeometry.getAttribute('position');
  const nodes = new Float32Array((frame.points + 1) * 20);
  const stride = frame.columns + 1;
  const centre = [0, 0, 0];
  for (let row = 0; row <= frame.rows; row++) {
    const arc = frame.arcs[row];
    const ring = Array.from({ length: frame.columns }, (_, column) =>
      surface.point(arc, 2 * Math.PI * column / frame.columns));
    const midpoint = [0, 1, 2].map(axis =>
      ring.reduce((sum, point) => sum + point[axis] / frame.columns, 0));
    for (let column = 0; column <= frame.columns; column++) {
      const index = row * stride + column;
      const angle = 2 * Math.PI * (column % frame.columns) / frame.columns;
      const reference = ring[column % frame.columns];
      // Growing a section in its own plane keeps toe sections in order.
      const normal = normalize(reference.map((value, axis) => value - midpoint[axis]));
      const point = reference.map((value, axis) => value + normal[axis] * material.radialClearanceM);
      if (row === 0 && column < frame.columns) {
        for (let axis = 0; axis < 3; axis++) centre[axis] += point[axis] / frame.columns;
      }
      nodes.set([
        ...point, arc, ...normal, angle,
        relaxed.getX(index), relaxed.getY(index), relaxed.getZ(index), frame.relaxedArc[row],
        frame.reinforcementByRow[row], frame.relaxedRadiiM[row], frame.input[index * 16 + 12], 0,
        ...frame.state.subarray(index * 16, index * 16 + 4)
      ], index * 20);
    }
  }
  nodes.set(centre, frame.points * 20);
  return { frame, nodes };
}
