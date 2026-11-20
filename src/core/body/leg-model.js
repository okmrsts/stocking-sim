import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';
import { surfaceIndices } from '../geometry/grid.js';
import { createSweptSurface } from './swept-surface.js';

const gaussian = (value, center, width) => Math.exp(-Math.pow((value - center) / width, 2));

export function createLeg(profile) {
  return createSweptSurface(profile, (arc, angle) => {
    const ankleBone = 0.093 * gaussian(arc, 0.24, 0.018) * Math.pow(Math.sin(angle), 6);
    const calf = 0.056 * gaussian(arc, 0.46, 0.087) * Math.sin(2 * angle);
    const knee = 0.062 * gaussian(arc, 0.635, 0.030) * Math.pow(Math.max(0, Math.cos(angle)), 5);
    const arch = -0.14 * gaussian(arc, 0.111, 0.033) * Math.pow(Math.max(0, -Math.cos(angle)), 3)
      * (0.60 + 0.40 * Math.sin(angle));
    return 1 + ankleBone + calf + knee + arch;
  });
}

export function createLegGeometry(surface, columns = 84, rows = 264) {
  const positions = [];
  const normals = [];
  const indices = surfaceIndices(columns, rows);
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const arc = surface.length * row / rows;
      const angle = 2 * Math.PI * column / columns;
      positions.push(...surface.point(arc, angle));
      normals.push(...surface.normal(arc, angle));
    }
  }
  // Small flat end faces use the same perimeter and an averaged center.
  for (const row of [0, rows]) {
    const offset = row * (columns + 1);
    const centerId = positions.length / 3;
    const center = [0, 0, 0];
    for (let column = 0; column < columns; column++) {
      for (let coordinate = 0; coordinate < 3; coordinate++) {
        center[coordinate] += positions[(offset + column) * 3 + coordinate] / columns;
      }
    }
    positions.push(...center);
    normals.push(0, row === 0 ? 0 : 1, row === 0 ? 1 : 0);
    for (let column = 0; column < columns; column++) {
      const a = offset + column;
      if (row === 0) indices.push(centerId, a + 1, a);
      else indices.push(centerId, a, a + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return geometry;
}
