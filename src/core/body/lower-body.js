import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';
import { createImplicitMesh } from './implicit-mesh.js';
import { createPelvisField } from './pelvis-field.js';

const tau = 2 * Math.PI;
const mix = (a, b, t) => a + (b - a) * t;

export function createLowerBodyGeometry(surface, foot, startArc, config) {
  const { halfStanceM, joinArc, pelvisSections, skinPitchM } = config;
  const upper = createPelvisField(surface, config);
  const halfWidth = Math.max(...pelvisSections.map(section => section[1]));
  const pelvis = createImplicitMesh(upper.sample,
    [-halfWidth - 0.032, upper.startY, -0.166],
    [halfWidth + 0.032, upper.topY, 0.124], skinPitchM);
  const positions = [...pelvis.getAttribute('position').array];
  const normals = [...pelvis.getAttribute('normal').array];
  const indices = [...pelvis.getIndex().array];
  pelvis.dispose();
  const join = surface.section(joinArc);
  const ankle = surface.section(startArc);
  const footPositions = foot.getAttribute('position');
  const footNormals = foot.getAttribute('normal');
  const footIndices = foot.getIndex().array;
  const columns = 72, rows = 138;
  const waist = [], boundaries = { 1: [], [-1]: [] };

  // Find the two open rims at the horizontal thigh sections and the cut at the navel.
  for (let id = 0; id < positions.length / 3; id++) {
    const [x, y, z] = positions.slice(id * 3, id * 3 + 3);
    if (Math.abs(y - upper.topY) < 1e-7) {
      const top = pelvisSections.at(-1);
      waist.push({ id, angle: polar(x, z - (top[2] + top[3]) / 2) });
    }
    if (Math.abs(y - upper.startY) < 1e-7) {
      const side = x >= 0 ? 1 : -1;
      const angle = polar((side * x - halfStanceM - join.x) / join.width, (z - join.z) / join.depth);
      boundaries[side].push({ id, angle });
    }
  }

  function append(point, normal) {
    normals.push(...normal);
    return (positions.push(...point) / 3) - 1;
  }

  const face = (a, b, c, side) => {
    if (side > 0) indices.push(a, b, c);
    else indices.push(a, c, b);
  };
  const angularRing = ids => ids.map((id, column) => ({ id, angle: tau * column / ids.length }));
  for (const side of [1, -1]) {
    const footOffset = positions.length / 3;
    const ankleRim = [];
    for (let i = 0; i < footPositions.count; i++) {
      const x = footPositions.getX(i), y = footPositions.getY(i), z = footPositions.getZ(i);
      const onRim = Math.abs(y - ankle.y) < 1e-7;
      const angle = onRim ? polar((x - ankle.x) / ankle.width, (z - ankle.z) / ankle.depth) : 0;
      const [nx, ny, nz] = onRim ? surface.normal(startArc, angle)
        : [footNormals.getX(i), footNormals.getY(i), footNormals.getZ(i)];
      const id = append([side * (halfStanceM + x), y, z], [side * nx, ny, nz]);
      if (onRim) ankleRim.push({ id, angle });
    }
    for (let i = 0; i < footIndices.length; i += 3) {
      face(footOffset + footIndices[i], footOffset + footIndices[i + 1], footOffset + footIndices[i + 2], side);
    }
    ankleRim.sort((a, b) => a.angle - b.angle);
    let previous;
    for (let row = 1; row < rows; row++) {
      const arc = mix(startArc, joinArc, row / rows);
      const ring = Array.from({ length: columns }, (_, column) => {
        const angle = tau * column / columns;
        const [x, y, z] = surface.point(arc, angle);
        const [nx, ny, nz] = surface.normal(arc, angle);
        return append([side * (halfStanceM + x), y, z], [side * nx, ny, nz]);
      });
      if (previous) {
        for (let col = 0; col < columns; col++) {
          const next = (col + 1) % columns;
          face(previous[col], previous[next], ring[col], side);
          face(previous[next], ring[next], ring[col], side);
        }
      } else stitchRings(ankleRim, angularRing(ring), (a, b, c) => face(a, b, c, side));
      previous = ring;
    }
    const boundary = boundaries[side].sort((a, b) => a.angle - b.angle);
    if (boundary.length < columns) throw Error('The upper thigh surface did not produce a continuous rim.');
    for (const { id, angle } of boundary) {
      const [nx, ny, nz] = surface.normal(joinArc, angle);
      normals[id * 3] = side * nx;
      normals[id * 3 + 1] = ny;
      normals[id * 3 + 2] = nz;
    }
    stitchRings(angularRing(previous), boundary, (a, b, c) => face(a, b, c, side));
  }

  const top = pelvisSections.at(-1);
  const center = append([0, upper.topY, (top[2] + top[3]) / 2], [0, 1, 0]);
  waist.sort((a, b) => a.angle - b.angle);
  for (let i = 0; i < waist.length; i++) indices.push(center, waist[i].id, waist[(i + 1) % waist.length].id);

  const geometry = new BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return geometry;
}

function polar(x, z) {
  return (Math.atan2(x, z) + tau) % tau;
}

function stitchRings(lower, upper, face) {
  if (!lower.length || !upper.length) throw Error('A skin surface did not produce a complete seam.');
  let lowerStep = 0, upperStep = 0;
  let a = lower.at(-1).id, b = upper.at(-1).id;
  while (lowerStep < lower.length || upperStep < upper.length) {
    const nextLowerAngle = lower[lowerStep]?.angle ?? Infinity;
    const nextUpperAngle = upper[upperStep]?.angle ?? Infinity;
    if (nextLowerAngle <= nextUpperAngle) {
      const next = lower[lowerStep].id;
      face(a, next, b);
      a = next;
      lowerStep++;
    } else {
      const next = upper[upperStep].id;
      face(a, next, b);
      b = next;
      upperStep++;
    }
  }
}
