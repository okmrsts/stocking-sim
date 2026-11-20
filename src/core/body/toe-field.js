import { blend, mix, smoothUnion } from './foot-profiles.js';

export function createToeField(toes) {
  const profiles = toes.map(toe => {
    const [rootX, rootZ] = toe.root, [tipX, tipZ] = toe.tip;
    const depth = tipZ - rootZ;
    return { ...toe, rootX, rootZ, tipX, tipZ, depth };
  });

  return function addDigits(field, x, y, z) {
    for (const toe of profiles) {
      if (z < toe.rootZ - 0.003 || z > toe.tipZ + 0.003) continue;
      const s = Math.max(0, Math.min(1, (z - toe.rootZ) / toe.depth));
      const cx = mix(toe.rootX, toe.tipX, s);
      if (Math.abs(x - cx) > toe.width + 0.005) continue;
      // The proximal body, joints and distal pad have different surface profiles.
      let jointRelief = 0;
      for (const joint of toe.joints) jointRelief += Math.exp(-(((s - joint) / 0.038) ** 2));
      const cap = Math.max(0.023, Math.sqrt(Math.max(0, 1 - (Math.max(0, s - toe.pad) / (1 - toe.pad)) ** 2)));
      const rootTaper = 0.56 + 0.44 * blend(s, 0, 0.31);
      const width = toe.width * cap * rootTaper
        * (1 - 0.13 * blend(s, 0.10, 0.72) + 0.075 * blend(s, 0.73, toe.pad));
      const bottom = toe.bottom + 0.004 * (1 - blend(s, 0.18, 0.68));
      const top = bottom + toe.height * (1.13 - 0.28 * blend(s, 0, 0.76) - 0.052 * jointRelief);
      const halfHeight = (top - bottom) / 2 * cap;
      const u = (x - cx) / width, v = (y - (top + bottom) / 2) / halfHeight;
      const section = (Math.sqrt(u * u + v * v) - 1) * Math.min(width, halfHeight);
      const digit = Math.max(section, toe.rootZ - z, z - toe.tipZ);
      const web = 0.0038 * blend(s, 0, 0.19) * (1 - blend(s, 0.40, 0.63));
      field = web > 0 ? smoothUnion(field, digit, web) : Math.min(field, digit);
    }
    return field;
  };
}
