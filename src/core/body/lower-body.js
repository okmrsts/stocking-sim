import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';
import { interpolate } from './swept-surface.js';

const tau = 2 * Math.PI;
const smooth = value => value * value * (3 - 2 * value);
const mix = (a, b, t) => a + (b - a) * t;

export function createLowerBodyGeometry(surface, startArc, config) {
  const { halfStanceM, thighJoinArc, waistSections, crotchDropM, crotchForwardM, navel } = config;
  const columns = 72, half = columns / 2;
  const positions = [], indices = [];
  const joined = [];
  const hipY = waistSections[0][0], waistY = waistSections.at(-1)[0];
  const [hipWidth, hipCenterZ, hipDepth] = waistSections[0].slice(1);
  const signed = (point, side) => [side * (point[0] + halfStanceM), point[1], point[2]];
  const append = point => (positions.push(...point) / 3) - 1;

  function stitch(a, b, reverse = false) {
    for (let column = 0; column < a.length; column++) {
      const next = (column + 1) % a.length;
      if (reverse) indices.push(a[column], b[column], a[next], a[next], b[column], b[next]);
      else indices.push(a[column], a[next], b[column], a[next], b[next], b[column]);
    }
  }

  const medial = column => column === 0 || column >= half;
  const loop = callback => Array.from({ length: columns }, (_, column) => callback(column, tau * column / columns));
  const hips = [1, -1].map(side => {
    let previous = null;
    for (let row = 0; row <= 160; row++) {
      const arc = mix(startArc, thighJoinArc, row / 160);
      const ring = loop((_, angle) => append(signed(surface.point(arc, angle), side)));
      if (previous) stitch(previous, ring, side < 0);
      previous = ring;
    }
    for (let row = 1; row <= 32; row++) {
      const t = row / 32;
      const ring = loop((column, angle) => {
        // Both inner thighs share the same sagittal seam. The outer arcs join the pelvis.
        if (row === 32 && side < 0 && medial(column)) return joined[column];
        const sine = Math.sin(angle), cosine = Math.cos(angle);
        const start = signed(surface.point(thighJoinArc, angle), side);
        const above = signed(surface.point(thighJoinArc + 0.045 * t, angle), side);
        const blend = smooth(t);
        // Approach the shared seam laterally so the two halves meet with a continuous tangent.
        const inner = 1 - smooth(Math.max(0, Math.min(1, sine / 0.50)));
        const lateral = blend - 0.8 * inner * t * t * (1 - t);
        const rise = t + inner * t * t * (1 - t);
        const saddle = Math.min(0, sine) ** 2;
        const id = append([
          mix(above[0], medial(column) ? 0 : side * hipWidth * sine, lateral),
          mix(start[1], hipY - saddle * crotchDropM, rise),
          mix(above[2], hipCenterZ + hipDepth * cosine + saddle * crotchForwardM, blend)
        ]);
        if (row === 32 && side > 0 && medial(column)) joined[column] = id;
        return id;
      });
      stitch(previous, ring, side < 0);
      previous = ring;
    }
    return previous;
  });

  let previous = [...hips[0].slice(0, half + 1), ...hips[1].slice(1, half).reverse()];
  for (let row = 1; row <= 52; row++) {
    const y = mix(hipY, waistY, row / 52);
    const [width, centerZ, depth] = interpolate(waistSections, y);
    const ring = loop((_, angle) => {
      const x = width * Math.sin(angle), front = Math.cos(angle);
      const dimple = navel.depthM * Math.max(0, front)
        * Math.exp(-((x / navel.widthM) ** 2) - (((y - navel.yM) / navel.heightM) ** 2));
      return append([x, y, centerZ + depth * front - dimple]);
    });
    stitch(previous, ring);
    previous = ring;
  }
  const top = append([0, waistY, waistSections.at(-1)[2]]);
  for (let column = 0; column < columns; column++) {
    indices.push(top, previous[column], previous[(column + 1) % columns]);
  }

  const geometry = new BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
