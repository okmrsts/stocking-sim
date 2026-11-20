import { footAnatomy } from '../config/leg-anatomy.js';
import { material, meshLevels, preset, tissue } from '../config/stage1a.js';
import { createLeg } from '../core/body/leg-model.js';
import { createLowerBodyGeometry } from '../core/body/lower-body.js';
import { updateTissueField, wrapCompliantSurface } from '../core/body/soft-tissue.js';
import { createClothGeometry } from '../core/cloth/geometry.js';
import { createKneeHighInput } from './rest-shape.js';
import { createBodyTissue, resolveBodyShape } from './body-shape.js';

export async function buildFitting(values, solve, repeats) {
  const { dimensions, profile, pelvis } = resolveBodyShape(values);
  const leg = createLeg(profile, footAnatomy);
  const tissueMap = createBodyTissue({ pelvis }, leg.skinSurface);
  const heights = new Map();
  const sampleTissue = (arc, angle) => {
    if (!heights.has(arc)) heights.set(arc, leg.section(arc).y);
    return tissueMap.sampleLeg(heights.get(arc), angle);
  };
  const standard = meshLevels.find(level => level.id === 'standard');
  let surface = leg;
  let tissueField;
  async function measureSolve(level, samples) {
    const start = performance.now();
    const input = createKneeHighInput(surface, preset, level);
    const prepareMs = performance.now() - start;
    const fitted = await solve(input, material, samples);
    return { fitted, prepareMs };
  }

  for (let pass = 0; pass < tissue.passes; pass++) {
    const { fitted } = await measureSolve(standard, 0);
    tissueField = updateTissueField(fitted, tissue, sampleTissue, tissueField);
    surface = wrapCompliantSurface(leg, tissueField);
  }
  const initial = await measureSolve(standard, repeats);
  const frame = initial.fitted;
  const foot = leg.createFootGeometry();
  const skinStart = footAnatomy.skinJoinM;
  const body = {
    foot, halfStanceM: pelvis.halfStanceM, tissueMap,
    bare: createLowerBodyGeometry(leg.skinSurface, foot, skinStart, pelvis),
    loaded: createLowerBodyGeometry(wrapCompliantSurface(leg.skinSurface, tissueField), foot, skinStart, pelvis)
  };
  return { body, dimensions, surface, tissueField, frame, initial, measureSolve, geometry: createClothGeometry(frame) };
}

export function disposeFitting({ geometry, body }) {
  geometry.dispose();
  body.bare.dispose();
  body.loaded.dispose();
  body.foot.dispose();
}
