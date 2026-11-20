import { interpolate } from './swept-surface.js';

const blend = (value, lo, hi) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

function smoothUnion(a, b, radius) {
  if (!radius || Math.abs(a - b) >= radius) return Math.min(a, b);
  const overlap = radius - Math.abs(a - b);
  return Math.min(a, b) - overlap * overlap / (4 * radius);
}

function ellipsoid(x, y, z, rx, ry, rz) {
  const qx = x / rx, qy = y / ry, qz = z / rz;
  const value = Math.sqrt(qx * qx + qy * qy + qz * qz);
  return (value - 1) * Math.min(rx, ry, rz);
}

export function createFootField(anatomy, leg) {
  const { sections, toes, ankleBase, malleoli, skinJoinM } = anatomy;
  const limit = leg.section(skinJoinM).y;
  const interval = 0.001;
  const size = Math.ceil((sections.at(-1)[0] - sections[0][0]) / interval);
  const foot = Array.from({ length: size + 1 }, (_, id) =>
    interpolate(sections, sections[0][0] + id * interval)
  );
  const ankle = Array.from({ length: Math.ceil(limit / interval) + 2 }, (_, id) => {
    const y = id * interval;
    let lo = 0.22, hi = skinJoinM + 0.008;
    for (let iteration = 0; iteration < 14; iteration++) {
      const mid = (lo + hi) / 2;
      if (leg.section(mid).y < y) lo = mid;
      else hi = mid;
    }
    const s = leg.section((lo + hi) / 2);
    const lower = interpolate(ankleBase, y);
    const weight = blend(y, 0.077, 0.103);
    return [s.x, s.z, s.width, s.depth].map((value, axis) => lower[axis] + (value - lower[axis]) * weight);
  });

  function footDistance(x, y, z) {
    const station = Math.max(0, Math.min(foot.length - 1.001, (z - sections[0][0]) / interval));
    const segment = Math.floor(station);
    const fraction = station - segment;
    const start = foot[segment], end = foot[segment + 1];
    const cx = start[0] + (end[0] - start[0]) * fraction;
    const radius = start[1] + (end[1] - start[1]) * fraction;
    const sole = start[2] + (end[2] - start[2]) * fraction;
    const dorsal = start[3] + (end[3] - start[3]) * fraction;
    const halfHeight = Math.max(0.001, (dorsal - sole) / 2);
    const u = (x - cx) / radius;
    const v = (y - (dorsal + sole) / 2) / halfHeight;
    let distance = Math.max(
      (Math.pow(Math.pow(Math.abs(u), 2.35) + Math.pow(Math.abs(v), 2.18), 1 / 2.24) - 1) * Math.min(radius, halfHeight),
      sections[0][0] - z, z - sections.at(-1)[0]
    );
    // The medial arch lifts the underside inward while the heel and ball remain planted.
    const arch = 0.013 * Math.exp(-Math.pow((z - 0.051) / 0.032, 2)) * blend(-x, 0.004, 0.032);
    if (y < 0.023 && arch > 0) distance = smoothMax(distance, sole + arch - y, 0.003);
    if (z > 0.099) {
      for (const [cx, cy, cz, rx, ry, rz, splay] of toes) {
        const dz = z - cz;
        const d = ellipsoid(x - cx - splay * dz, y - cy, dz, rx, ry, rz);
        distance = smoothUnion(distance, d, 0.004 * (1 - blend(z, cz - rz * 0.3, cz + rz * 0.60)));
      }
    }
    if (y > 0.012) {
      const level = Math.min(ankle.length - 1.01, y / interval);
      const index = Math.floor(level), t = level - index;
      const a = ankle[index], b = ankle[index + 1];
      const rx = a[2] + (b[2] - a[2]) * t, rz = a[3] + (b[3] - a[3]) * t;
      const u = (x - a[0] - (b[0] - a[0]) * t) / rx;
      const v = (z - a[1] - (b[1] - a[1]) * t) / rz;
      const tube = Math.max((Math.sqrt(u * u + v * v) - 1) * Math.min(rx, rz), 0.018 - y);
      distance = smoothUnion(distance, tube, 0.011 * blend(y, 0.012, 0.025) * (1 - blend(y, 0.096, 0.132)));
    }
    if (y > 0.043 && y < 0.098 && z > -0.035 && z < 0.009) {
      for (const [cx, cy, cz, rx, ry, rz] of malleoli) {
        distance = smoothUnion(distance, ellipsoid(x - cx, y - cy, z - cz, rx, ry, rz), 0.004);
      }
    }
    return Math.max(distance, 0.0018 - y);
  }

  return { sample: footDistance, limit };
}

function smoothMax(a, b, radius) {
  return -smoothUnion(-a, -b, radius);
}
