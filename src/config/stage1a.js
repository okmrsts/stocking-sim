export { bodyProfile, footAnatomy } from './leg-anatomy.js';

export const preset = Object.freeze({
  label: '20D 平編みニーハイ', denier: 20, fiberDensityKgM3: 1140, packingFraction: 0.70,
  topM: 0.849, toeEndM: 0.061, cuffWidthM: 0.029,
  relaxedRadiusM: 0.0268, relaxedToeRadiusM: 0.021, axialEase: 1.014,
  cuffStiffness: 1.55, cuffYarnCount: 2.15, toeYarnCount: 1.95,
  cellPitchM: [0.00047, 0.00045], dyeLinear: [0.026, 0.025, 0.036]
});

export const material = Object.freeze({
  radialClearanceM: 0.00060, wrinklingWavelengthM: 0.024, compressionThreshold: 0.011,
  maxWrinkleAmplitudeM: 0.00275, selfClearanceM: 0.00042, selfContactIterations: 4, poisson: 0.075, hoopModulusNpm: 22,
  axialModulusNpm: 18, hoopHardening: 0.9, axialHardening: 2.5
});

export const meshLevels = Object.freeze([
  { id: 'low', columns: 40, rows: 220 },
  { id: 'standard', columns: 64, rows: 352 },
  { id: 'high', columns: 88, rows: 484 }
]);

export const diagnostics = Object.freeze({ tensionNpmMax: 400, strainMax: 2.1, gapMmMax: 3.5, selfContactMmMax: 1.5 });

export const renderConfig = Object.freeze({
  maxPixelRatio: 1.6, background: 0xe5dfd9, skin: 0xf1c7b2,
  warmLight: 0xffefda, coolLight: 0xf5f0ff
});
