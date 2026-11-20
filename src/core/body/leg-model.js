import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';
import { surfaceIndices } from '../geometry/grid.js';
import { createSweptSurface } from './swept-surface.js';
import { createFootField } from './foot-field.js';
import { createImplicitMesh } from './implicit-mesh.js';
import { withFootEnvelope } from './foot-contact-surface.js';

const gaussian = (value, center, width) => Math.exp(-Math.pow((value - center) / width, 2));

export function createLeg(profile, anatomy) {
  const skinSurface = createSweptSurface(profile, (arc, angle) => {
    const ankleBone = 0.093 * gaussian(arc, 0.273 + 0.008 * Math.sin(angle), 0.022) * Math.pow(Math.sin(angle), 6);
    const calf = 0.056 * gaussian(arc, 0.48, 0.10) * Math.sin(2 * angle);
    const knee = 0.062 * gaussian(arc, 0.626, 0.035) * Math.pow(Math.max(0, Math.cos(angle)), 5);
    const shin = 0.031 * gaussian(arc, 0.455, 0.13) * Math.pow(Math.max(0, Math.cos(angle)), 10);
    return 1 + ankleBone + calf + knee + shin;
  });
  const foot = createFootField(anatomy, skinSurface);
  const surface = withFootEnvelope(skinSurface, foot, anatomy);
  surface.footDistance = foot.sample;
  surface.footLimitM = foot.limit;
  surface.skinParts = () => [
    createLegGeometry(skinSurface, anatomy.skinJoinM - 0.0012),
    createImplicitMesh(foot.sample, [-0.061,-0.004,-0.063], [0.061,foot.limit,0.185], anatomy.skinGridM)
  ];
  return surface;
}

function createLegGeometry(surface, lowerArc, columns = 72, rows = 214) {
  const positions = [];
  const normals = [];
  const indices = surfaceIndices(columns, rows);
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const arc = lowerArc + (surface.length - lowerArc) * row / rows;
      const angle = 2 * Math.PI * column / columns;
      positions.push(...surface.point(arc, angle));
      normals.push(...surface.normal(arc, angle));
    }
  }
  // The thigh cap closes the upper transverse cut. The foot joins the other rim.
  for (const row of [rows]) {
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
