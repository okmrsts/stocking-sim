export { bodyProfile, footAnatomy } from './leg-anatomy.js';

export const preset = Object.freeze({
  label: '20D 平編みニーハイ', denier: 20, fiberDensityKgM3: 1140, packingFraction: 0.70,
  topM: 0.849, toeEndM: 0.061, cuffWidthM: 0.029,
  relaxedRadiusM: 0.0240, relaxedToeRadiusM: 0.0184, axialEase: 0.941,
  axialEaseZones: [
    { arcM: 0.108, widthM: 0.073, lengthRatioDelta: -0.030 },
    { arcM: 0.320, widthM: 0.035, lengthRatioDelta: 0.060 },
    { arcM: 0.621, widthM: 0.035, lengthRatioDelta: -0.025 }
  ],
  cuffStiffness: 1.55, cuffYarnCount: 2.15, toeYarnCount: 1.95,
  cellPitchM: [0.00047, 0.00045], dyeLinear: [0.026, 0.025, 0.036]
});

export const material = Object.freeze({
  radialClearanceM: 0.00042, wrinklingWavelengthM: 0.024, compressionThreshold: 0.011,
  maxWrinkleAmplitudeM: 0.00275, selfClearanceM: 0.00042, selfContactIterations: 4, poisson: 0.075, hoopModulusNpm: 22,
  axialModulusNpm: 18, hoopHardening: 0.9, axialHardening: 2.5
});

export const meshLevels = Object.freeze([
  { id: 'low', columns: 40, rows: 220 },
  { id: 'standard', columns: 64, rows: 352 },
  { id: 'high', columns: 88, rows: 484 }
]);

export const diagnostics = Object.freeze({ tensionNpmMax: 400, strainMax: 2.1, gapMmMax: 3.5, selfContactMmMax: 1.5 });

export const lowerBodyConfig = Object.freeze({
  halfStanceM: 0.095,
  thighJoinArc: 0.912,
  crotchDropM: 0.080,
  crotchForwardM: 0.041,
  // Y, half-width, Z center, front/back radius.
  waistSections: [
    [0.842, 0.190, -0.026, 0.108],
    [0.875, 0.186, -0.026, 0.108],
    [0.921, 0.169, -0.023, 0.097],
    [0.969, 0.145, -0.012, 0.084],
    [1.024, 0.133, -0.006, 0.081],
    [1.037, 0.132, -0.006, 0.080]
  ],
  navel: { yM: 1.018, depthM: 0.0045, widthM: 0.009, heightM: 0.0055 }
});

export const tissue = Object.freeze({
  // Material arc, inward displacement per kPa, saturation depth.
  compliance: [
    [0.310, 0,       0.0010],
    [0.368, 0.00022, 0.0013],
    [0.494, 0.00046, 0.0032],
    [0.615, 0.00023, 0.0018],
    [0.756, 0.00108, 0.0075],
    [0.835, 0.00175, 0.0100]
  ],
  passes: 3, spreadM: 0.0048, angularSpreadRad: 0.17,
  recoverySpreadM: 0.017, startFadeM: 0.038, shoulderReturn: 0.32, relaxation: 0.68
});

export const comparisonConfig = Object.freeze({ heightM: 1.24, minHeightM: 1.11, minWidthM: 0.86, cameraDistanceM: 2.4 });

export const renderConfig = Object.freeze({
  maxPixelRatio: 1.6, background: 0xe5dfd9, skin: 0xf1c7b2,
  warmLight: 0xffefda, coolLight: 0xf5f0ff
});
