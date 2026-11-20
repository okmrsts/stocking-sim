import { blend, mix, sampleProfile } from './foot-profiles.js';
import { createAnkleField } from './ankle-field.js';
import { createToeField } from './toe-field.js';

export function createFootField(anatomy, leg) {
  const { sections, toes, skinJoinM, samplePitchM, ball, floorM, arch, navicular, heelPad } = anatomy;
  const limit = leg.section(skinJoinM).y;
  const tipZ = Math.max(...toes.map(toe => toe.tip[1]));
  const end = sections.at(-1)[0];
  const start = sections[0][0];
  const footSection = sampleProfile(sections, samplePitchM);
  const addDigits = createToeField(toes);
  const addAnkle = createAnkleField(anatomy, leg, limit);
  const ballSlope = 1 / Math.tan(ball.angle);

  function sample(x, y, z) {
    // The first metatarsal head is more anterior than the fifth.
    const station = z + ballSlope * x * blend(z, ...ball.blendZM);
    const [medial, lateral, base, dorsal, ridge] = footSection(station);
    const halfWidth = (lateral - medial) / 2;
    const center = (lateral + medial) / 2;
    const across = (x - center) / halfWidth;
    const lift = arch.riseM * Math.exp(-(((z - arch.centerZM) / arch.widthM) ** 2))
      * blend(-across, ...arch.medialWeight);
    const sole = base + lift;
    const halfHeight = Math.max(0.001, (dorsal - sole) / 2);
    const vertical = (y - (dorsal + sole) / 2) / halfHeight;
    // A relatively flat plantar half and a dorsum whose crest favors the medial side.
    const navicularRelief = navicular.prominenceM * Math.exp(-(((y - navicular.centerYM) / navicular.spreadYM) ** 2)
      - (((z - navicular.centerZM) / navicular.spreadZM) ** 2)) * blend(-across, 0.30, 0.78);
    const crosswise = (x - center) / (halfWidth + navicularRelief) + Math.max(0, vertical) * ridge;
    const power = vertical < 0 ? 2.85 : 2.10;
    const section = (Math.pow(Math.abs(crosswise) ** power + Math.abs(vertical) ** power, 1 / power) - 1)
      * Math.min(halfWidth, halfHeight);
    let distance = Math.max(section, start - station, station - end);
    if (z < heelPad.blendZM[1]) {
      const [cx, cy, cz] = heelPad.centerM;
      const [rx, ry, rz] = heelPad.radiiM;
      const pad = (Math.hypot((x - cx) / rx, (y - cy) / ry, (z - cz) / rz) - 1) * Math.min(rx, ry, rz);
      distance = mix(pad, distance, blend(z, ...heelPad.blendZM));
    }
    if (z > 0.085 && y < 0.040) distance = addDigits(distance, x, y, z);
    distance = addAnkle(distance, x, y, z);
    return Math.max(distance, floorM - y);
  }

  return { sample, limit, tipZ };
}
