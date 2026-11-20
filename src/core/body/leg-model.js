import { createSweptSurface } from './swept-surface.js';
import { createFootField } from './foot-field.js';
import { createImplicitMesh } from './implicit-mesh.js';
import { withFootEnvelope } from './foot-contact-surface.js';
import { createFootNails } from './foot-nails.js';

const gaussian = (value, center, width) => Math.exp(-Math.pow((value - center) / width, 2));

export function createLeg(profile, anatomy) {
  const skinSurface = createSweptSurface(profile, (arc, angle) => {
    const sine = Math.sin(angle), cosine = Math.cos(angle);
    const front = Math.max(0, cosine), rear = Math.max(0, -cosine);
    const gastrocnemius = rear ** 2 * (
      0.055 * gaussian(arc, 0.516, 0.063) * gaussian(sine, -0.43, 0.38)
      + 0.043 * gaussian(arc, 0.536, 0.055) * gaussian(sine, 0.43, 0.40)
    );
    const patella = 0.115 * gaussian(arc, 0.606, 0.027) * front ** 12;
    const poplitealFossa = 0.023 * gaussian(arc, 0.610, 0.029) * rear ** 16;
    const tibia = 0.039 * gaussian(arc, 0.449, 0.127) * front ** 16;
    const vastusMedialis = 0.026 * gaussian(arc, 0.672, 0.041) * front ** 2 * gaussian(sine, -0.54, 0.32);
    return 1 + gastrocnemius + patella - poplitealFossa + tibia + vastusMedialis;
  });
  const foot = createFootField(anatomy, skinSurface);
  return {
    ...withFootEnvelope(skinSurface, foot, anatomy),
    skinSurface,
    footDistance: foot.sample,
    footLimitM: foot.limit,
    createFootNails: () => createFootNails(anatomy.toes, foot.sample),
    createFootGeometry: () => createImplicitMesh(
      foot.sample, anatomy.bounds.lower, [anatomy.bounds.upper[0], foot.limit, anatomy.bounds.upper[1]], anatomy.skinGridM
    )
  };
}
