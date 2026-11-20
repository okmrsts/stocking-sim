import { BufferGeometry, BufferAttribute } from 'three/webgpu';
import { surfaceIndices } from '../geometry/grid.js';

export function createClothGeometry(frame) {
  const { columns, rows, points, state, materialCoordsM } = frame;
  const positions = new Float32Array((points + 1) * 3);
  const coordinates = new Float32Array((points + 1) * 2);
  const fields = new Float32Array((points + 1) * 4);
  const details = new Float32Array((points + 1) * 4);
  const selfContact = new Float32Array(points + 1);
  const indices = surfaceIndices(columns, rows);
  coordinates.set(materialCoordsM);

  for (let node = 0; node < points; node++) {
    const pos = node * 16;
    positions.set(state.subarray(pos, pos + 3), 3 * node);
    fields.set(state.subarray(pos + 4, pos + 8), 4 * node);
    details.set(state.subarray(pos + 8, pos + 12), 4 * node);
    selfContact[node] = state[pos + 12];
  }

  for (let column = 0; column < columns; column++) {
    for (let axis = 0; axis < 3; axis++) {
      positions[points * 3 + axis] += positions[column * 3 + axis] / columns;
    }
    indices.push(points, column + 1, column);
  }
  coordinates[points * 2] = coordinates[columns * 2] * 0.5;
  fields.set(fields.subarray(0, 4), points * 4);
  details.set(details.subarray(0, 4), points * 4);

  const geometry = new BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('materialUV', new BufferAttribute(coordinates, 2));
  geometry.setAttribute('clothFields', new BufferAttribute(fields, 4));
  geometry.setAttribute('clothDetails', new BufferAttribute(details, 4));
  geometry.setAttribute('selfContact', new BufferAttribute(selfContact, 1));
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  for (let row = 0; row <= rows; row++) {
    const first = row * (columns + 1);
    const last = first + columns;
    const x = normals.getX(first) + normals.getX(last);
    const y = normals.getY(first) + normals.getY(last);
    const z = normals.getZ(first) + normals.getZ(last);
    const length = Math.max(1e-6, Math.hypot(x, y, z));
    normals.setXYZ(first, x / length, y / length, z / length);
    normals.setXYZ(last, x / length, y / length, z / length);
  }
  return geometry;
}

export function sampleCloth(frame, surface, arc, angle) {
  const row = Math.max(0, Math.min(frame.rows, Math.round(arc / frame.arcs.at(-1) * frame.rows)));
  const tau = 2 * Math.PI;
  const col = Math.round((((angle % tau) + tau) % tau) / tau * frame.columns) % frame.columns;
  const offset = (row * (frame.columns + 1) + col) * 16;
  const data = frame.state.subarray(offset, offset + 16);
  return {
    position: Array.from(data.subarray(0, 3)),
    normal: surface.normal(frame.arcs[row], tau * col / frame.columns),
    gapMm: data[3] * 1000,
    stretchHoop: data[4],
    stretchAxial: data[5],
    tensionHoopNpm: data[6],
    tensionAxialNpm: data[7],
    pressurePa: data[9],
    reinforcement: data[10],
    restRadiusM: data[11],
    selfContactCorrectionMm: data[12] * 1000,
    foldAmount: data[13]
  };
}
