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
  return {
    ...withFootEnvelope(skinSurface, foot, anatomy),
    skinSurface,
    footDistance: foot.sample,
    footLimitM: foot.limit,
    createFootGeometry: () => createImplicitMesh(
      foot.sample, [-0.061, -0.004, -0.063], [0.061, foot.limit, 0.185], anatomy.skinGridM
    )
  };
}
