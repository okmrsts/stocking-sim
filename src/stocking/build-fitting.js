import { footAnatomy } from '../config/foot-anatomy.js';
import { meshLevels, preset, material, tissue } from '../config/stage1a.js';
import { createLeg } from '../core/body/leg-model.js';
import { createLowerBodyGeometry } from '../core/body/lower-body.js';
import { updateTissueField, wrapCompliantSurface } from '../core/body/soft-tissue.js';
import { createClothGeometry } from '../core/cloth/geometry.js';
import { createStockingLegInput } from './rest-shape.js';
import { createWaistShell } from './waist-shell.js';
import { createBodyTissue, resolveBodyShape } from './body-shape.js';

export async function buildFitting(values, solve, repeats, garment = { ...preset, material }) {
  const { dimensions, profile, pelvis } = resolveBodyShape(values);
  const leg = createLeg(profile, footAnatomy);
  const tissueMap = createBodyTissue({ pelvis }, leg.skinSurface);
  const heights = new Map();
  const sampleTissue = (arc, angle) => {
    if (!heights.has(arc)) heights.set(arc, leg.section(arc).y);
    return tissueMap.sampleLeg(heights.get(arc), angle);
  };
  const legPattern = garment.upper ? { ...garment, topM: pelvis.joinArc } : garment;
  const standard = meshLevels.find(level => level.id === 'standard');
  let surface = leg;
  let tissueField;
  async function measureSolve(level, samples) {
    const start = performance.now();
    const input = createStockingLegInput(surface, legPattern, level);
    const prepareMs = performance.now() - start;
    const fitted = await solve(input, garment.material, samples);
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
    foot, nails: leg.createFootNails(), halfStanceM: pelvis.halfStanceM, tissueMap,
    bare: createLowerBodyGeometry(leg.skinSurface, foot, skinStart, pelvis),
    loaded: createLowerBodyGeometry(wrapCompliantSurface(leg.skinSurface, tissueField), foot, skinStart, pelvis)
  };
  const geometry = createClothGeometry(frame);
  const assemble = (legFrame, legGeometry) => garment.upper
    ? createWaistShell(surface, pelvis, garment, legFrame, legGeometry) : null;
  return { body, dimensions, surface, tissueField, frame, initial, measureSolve, geometry,
    joined: assemble(frame, geometry), assemble, garment };
}

export function disposeFitting({ geometry, joined, body }) {
  geometry.dispose();
  joined?.dispose();
  body.bare.dispose();
  body.loaded.dispose();
  body.foot.dispose();
  body.nails.dispose();
}
