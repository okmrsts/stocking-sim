import { cross, difference, normalize } from './swept-surface.js';
import { createToeContactSlice } from './toe-contact-slice.js';

const period = 2 * Math.PI;
const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const mixPoint = (a, b, t) => a.map((value, axis) => mix(value, b[axis], t));

export function withFootEnvelope(leg, foot, { skinJoinM: joinArc, bounds, contact }) {
  const rows = 132, columns = 128;
  const fitted = [];
  const { tipZ } = foot;
  const width = Math.max(-bounds.lower[0], bounds.upper[0]);
  const height = contact.forefootSamplingHeightM;
  const frontReduction = leg.section(0).z - tipZ - contact.toeTipExtraM;
  const insetZ = tipZ - contact.samplePitchM;
  // Span small changes between adjacent toe tips before triangulating the cloth.
  const toeField = (x, y, z) => {
    const field = foot.sample(x, y, z);
    return field <= 0 ? field : Math.min(field, foot.sample(x, y, z - contact.toeBridgeM));
  };
  for (let row = 0; row <= rows; row++) {
    const arc = joinArc * row / rows;
    const { x, y, z } = leg.section(arc);
    const center = [x, y, z];
    const zFit = z - frontReduction * (1 - smooth(arc / contact.toeCapBlendM));
    const toeWeight = smooth((zFit - contact.forefootStartZM) / contact.forefootBlendM);
    const footWeight = 1 - smooth((arc - (joinArc - 0.031)) / 0.031);
    const toeSlice = toeWeight ? createToeContactSlice(
      toeField, Math.min(zFit, insetZ), contact.samplePitchM, width, height
    ) : null;
    for (let col = 0; col < columns; col++) {
      const angle = period * col / columns;
      let toe;
      if (toeSlice) {
        // Distribute columns over the broad, shallow forefoot instead of clustering at its sides.
        const xDirection = Math.sin(angle) * toeSlice.aspect, yDirection = Math.cos(angle);
        const directionLength = Math.hypot(xDirection, yDirection);
        const dx = xDirection / directionLength, dy = yDirection / directionLength;
        const taper = 1 - 0.58 * smooth((zFit - insetZ) / (tipZ + contact.toeTipExtraM - insetZ));
        const radius = taper * toeSlice.radius(dx, dy) + contact.toeClearanceM;
        toe = [toeSlice.center[0] + dx * radius, toeSlice.center[1] + dy * radius, zFit];
      }
      if (toe && toeWeight === 1) {
        fitted.push(toe);
        continue;
      }

      const base = leg.point(arc, angle);
      const delta = difference(base, center);
      const radius = Math.hypot(...delta);
      const direction = delta.map(value => value / radius);
      const ray = gap => center.map((coordinate, axis) => coordinate + gap * direction[axis]);
      const skinRadius = outerSkinRadius(foot.sample, ray) ?? radius * 0.8;
      const transitionClearance = 4 * toeWeight * (1 - toeWeight) * contact.blendClearanceM;
      const footPoint = ray(mix(radius, skinRadius + contact.footClearanceM, footWeight) + transitionClearance);
      if (toe) {
        // Preserve the clearance at the transition between the tilted and axial cuts.
        const outward = normalize([toe[0] - toeSlice.center[0], toe[1] - toeSlice.center[1], 0]);
        toe = toe.map((value, axis) => value + transitionClearance * outward[axis]);
      }
      fitted.push(toe ? mixPoint(footPoint, toe, toeWeight) : footPoint);
    }
  }

  function ringPoint(row, column) {
    return fitted[row * columns + (column % columns)];
  }

  function point(arc, angle) {
    if (arc >= joinArc) return leg.point(arc, angle);
    const row = Math.max(0, arc) / joinArc * rows;
    const col = (((angle % period) + period) % period) / period * columns;
    const i = Math.min(rows - 1, Math.floor(row)), j = Math.floor(col);
    const u = row - i, v = col - j;
    const a = mixPoint(ringPoint(i, j), ringPoint(i, j + 1), v);
    const b = mixPoint(ringPoint(i + 1, j), ringPoint(i + 1, j + 1), v);
    return mixPoint(a, b, u);
  }

  function normal(arc, angle) {
    if (arc >= joinArc + 0.001) return leg.normal(arc, angle);
    const dc = difference(point(arc, angle + 0.009), point(arc, angle - 0.009));
    const ds = difference(point(arc + 0.0008, angle), point(Math.max(0, arc - 0.0008), angle));
    return normalize(cross(dc, ds));
  }
  return { ...leg, point, normal };
}

function outerSkinRadius(sample, ray) {
  let outside = 0.103;
  for (let inside = 0.099; inside >= 0; inside -= 0.004) {
    if (sample(...ray(inside)) <= 0) {
      for (let step = 0; step < 10; step++) {
        const mid = (inside + outside) / 2;
        if (sample(...ray(mid)) <= 0) inside = mid;
        else outside = mid;
      }
      return outside;
    }
    outside = inside;
  }
  return null;
}
