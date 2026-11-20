import { cross, difference, interpolate, normalize } from './swept-surface.js';

const period = 2 * Math.PI;
const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function withFootEnvelope(leg, foot, { skinJoinM: joinArc, toeEnvelope }) {
  const rows = 132, columns = 128;
  const contact = [];
  for (let row = 0; row <= rows; row++) {
    const arc = joinArc * row / rows;
    const { x, y, z } = leg.section(arc);
    const center = [x, y, z];
    const toe = interpolate(toeEnvelope, z);
    const toeWeight = smooth((z - 0.096) / 0.028);
    const weight = 1 - smooth((arc - (joinArc - 0.031)) / 0.031);
    for (let col = 0; col < columns; col++) {
      const angle = period * col / columns;
      const base = leg.point(arc, angle);
      const delta = difference(base, center);
      const radius = Math.hypot(...delta);
      const direction = delta.map(value => value / radius);
      const ray = gap => center.map((coordinate, axis) => coordinate + gap * direction[axis]);
      let hit = null;
      let outside = 0.103;
      for (let inside = 0.099; inside >= 0; inside -= 0.004) {
        if (foot.sample(...ray(inside), true) <= 0) {
          for (let step = 0; step < 10; step++) {
            const mid = (inside + outside) / 2;
            if (foot.sample(...ray(mid), true) <= 0) inside = mid;
            else outside = mid;
          }
          hit = outside;
          break;
        }
        outside = inside;
      }
      // The close seam at the toes shrinks around the tip of the longest toe.
      const fitted = radius + ((hit ?? radius * 0.8) + 0.0008 - radius) * weight;
      const rounded = toeWeight > 0 ? toeRadius(center, direction, toe) : fitted;
      const meshAllowance = 0.0012 * smooth(arc / 0.014) * weight;
      contact.push(fitted + (rounded - fitted) * toeWeight + meshAllowance);
    }
  }

  // Smooth the shallow toe clefts while keeping the ball and heel dimensions.
  function radiusAt(row, col) {
    const i = (col + columns) % columns;
    return (contact[row * columns + (i + columns - 1) % columns]
      + 2 * contact[row * columns + i] + contact[row * columns + (i + 1) % columns]) / 4;
  }

  function point(arc, angle) {
    const base = leg.point(arc, angle);
    if (arc >= joinArc) return base;
    const { x, y, z } = leg.section(arc);
    const center = [x, y, z];
    const delta = difference(base, center);
    const length = Math.hypot(...delta);
    const row = Math.max(0, arc) / joinArc * rows;
    const col = (((angle % period) + period) % period) / period * columns;
    const i = Math.floor(row), j = Math.floor(col);
    const u = row - i, v = col - j;
    const a = radiusAt(i, j) * (1 - v) + radiusAt(i, j + 1) * v;
    const b = radiusAt(Math.min(rows,i + 1),j) * (1 - v) + radiusAt(Math.min(rows,i + 1),j + 1) * v;
    const radius = a * (1 - u) + b * u;
    return center.map((coordinate, axis) => coordinate + delta[axis] * radius / length);
  }

  function normal(arc, angle) {
    if (arc >= joinArc + 0.001) return leg.normal(arc, angle);
    const dc = difference(point(arc, angle + 0.009), point(arc, angle - 0.009));
    const ds = difference(point(arc + 0.0008, angle), point(Math.max(0, arc - 0.0008), angle));
    return normalize(cross(dc, ds));
  }
  return { ...leg, point, normal };
}

function toeRadius(center, direction, [x, width, sole, dorsal]) {
  const mid = (sole + dorsal) / 2;
  const height = (dorsal - sole) / 2;
  let lo = 0, hi = 0.078;
  for (let iteration = 0; iteration < 16; iteration++) {
    const gap = (lo + hi) / 2;
    const u = (center[0] + gap * direction[0] - x) / width;
    const v = (center[1] + gap * direction[1] - mid) / height;
    if (u ** 4 + v ** 4 <= 1) lo = gap;
    else hi = gap;
  }
  return (lo + hi) / 2;
}
