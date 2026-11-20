import { interpolate } from './swept-surface.js';
import { blend, mix, smoothUnion } from './foot-profiles.js';

export function createAnkleField(anatomy, leg, limit) {
  const { ankleBase, malleoli, achilles, skinJoinM, samplePitchM: pitch } = anatomy;
  const count = Math.ceil(limit / pitch) + 1;
  const sections = Array.from({ length: count + 1 }, (_, index) => {
    const y = index * pitch;
    let lo = 0.22, hi = skinJoinM + 0.008;
    for (let iteration = 0; iteration < 14; iteration++) {
      const mid = (lo + hi) / 2;
      if (leg.section(mid).y < y) lo = mid;
      else hi = mid;
    }
    const s = leg.section((lo + hi) / 2);
    const lower = interpolate(ankleBase, y);
    const weight = blend(y, 0.093, limit - 0.009);
    return [s.x, s.z, s.width, s.depth].map((value, axis) => mix(lower[axis], value, weight));
  });

  return function addAnkle(field, x, y, z) {
    if (y < 0.015 || z > 0.063) return field;
    const row = Math.max(0, Math.min(count, y / pitch));
    const index = Math.min(count - 1, Math.floor(row)), t = row - index;
    const a = sections[index], b = sections[index + 1];
    const rx = mix(a[2], b[2], t), rz = mix(a[3], b[3], t);
    const dx = x - mix(a[0], b[0], t);
    const dz = z - mix(a[1], b[1], t);
    const tendon = achilles.prominenceM * Math.exp(-(((y - achilles.centerYM) / achilles.heightM) ** 2)
      - (((x - achilles.centerXM) / achilles.halfWidthM) ** 2)) * blend(-dz, 0.008, 0.023)
      * (1 - blend(y, limit - 0.032, limit - 0.004));
    const [side, cy, cz, relief, sy, sz] = malleoli[dx < 0 ? 1 : 0];
    const malleolus = relief * Math.exp(-(((y - cy) / sy) ** 2) - (((z - cz) / sz) ** 2))
      * blend(side * dx, 0, rx * 0.70) * (1 - blend(y, limit - 0.023, limit - 0.004));
    const u = dx / (rx + malleolus);
    const v = (dz + tendon) / rz;
    const tube = Math.max((Math.sqrt(u * u + v * v) - 1) * Math.min(rx, rz), 0.019 - y);
    const seam = 0.010 * blend(y, 0.015, 0.035) * (1 - blend(y, 0.086, 0.125));
    return seam > 0 ? smoothUnion(field, tube, seam) : Math.min(field, tube);
  };
}
