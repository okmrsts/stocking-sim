export const bodyProfile = [
  // arc coordinate, center X/Y/Z, medial-lateral radius, depth radius, forward axis pitch.
  [0.000, 0.016, 0.034, 0.169, 0.013, 0.010, 1.57],
  [0.020, 0.010, 0.036, 0.151, 0.040, 0.023, 1.57],
  [0.053, 0.007, 0.039, 0.121, 0.047, 0.028, 1.48],
  [0.087, 0.003, 0.045, 0.088, 0.044, 0.032, 1.42],
  [0.116, 0.000, 0.051, 0.058, 0.038, 0.034, 1.24],
  [0.146, 0.000, 0.062, 0.028, 0.035, 0.040, 1.04],
  [0.177, 0.000, 0.082, 0.002, 0.032, 0.043, 0.68],
  [0.209,-0.001, 0.112,-0.015, 0.032, 0.043, 0.28],
  [0.245,-0.002, 0.149,-0.015, 0.032, 0.036, 0.04],
  [0.281,-0.002, 0.185,-0.012, 0.034, 0.033,-0.06],
  [0.345,-0.001, 0.248,-0.009, 0.040, 0.039,-0.03],
  [0.410, 0.004, 0.313,-0.013, 0.051, 0.051, 0.04],
  [0.474, 0.009, 0.376,-0.017, 0.059, 0.058, 0.06],
  [0.529, 0.008, 0.432,-0.012, 0.056, 0.056,-0.07],
  [0.580, 0.003, 0.482,-0.002, 0.051, 0.049,-0.15],
  [0.620, 0.002, 0.522, 0.012, 0.052, 0.047,-0.21],
  [0.653, 0.001, 0.555, 0.018, 0.053, 0.049,-0.10],
  [0.695, 0.002, 0.597, 0.016, 0.056, 0.055, 0.05],
  [0.765, 0.009, 0.666, 0.010, 0.067, 0.064, 0.08],
  [0.846, 0.018, 0.745, 0.004, 0.080, 0.072, 0.08],
  [0.915, 0.024, 0.814,-0.001, 0.089, 0.080, 0.05],
  [0.983, 0.030, 0.880,-0.004, 0.091, 0.082, 0.02],
  [1.041, 0.034, 0.937,-0.004, 0.085, 0.075, 0.02],
  [1.067, 0.035, 0.957,-0.004, 0.073, 0.065, 0.02],
  [1.084, 0.035, 0.965,-0.004, 0.051, 0.044, 0.02],
  [1.096, 0.035, 0.971,-0.004, 0.009, 0.009, 0.02]
];

export const preset = Object.freeze({
  label: '20D 平編みニーハイ', denier: 20, fiberDensityKgM3: 1140, packingFraction: 0.70,
  topM: 0.884, toeEndM: 0.046, cuffWidthM: 0.029,
  relaxedRadiusM: 0.0268, relaxedToeRadiusM: 0.021, axialEase: 1.014,
  cuffStiffness: 1.55, cuffYarnCount: 2.15, toeYarnCount: 1.95,
  cellPitchM: [0.00047, 0.00045], dyeLinear: [0.026, 0.025, 0.036]
});

export const material = Object.freeze({
  radialClearanceM: 0.00045, wrinklingWavelengthM: 0.012, compressionThreshold: 0.011,
  maxWrinkleAmplitudeM: 0.00185, poisson: 0.075, hoopModulusNpm: 22,
  axialModulusNpm: 18, hoopHardening: 0.9, axialHardening: 2.5
});

export const meshLevels = Object.freeze([
  { id: 'low', columns: 40, rows: 220 },
  { id: 'standard', columns: 64, rows: 352 },
  { id: 'high', columns: 88, rows: 484 }
]);

export const diagnostics = Object.freeze({ tensionNpmMax: 400, strainMax: 2.1, gapMmMax: 3.5 });

export const renderConfig = Object.freeze({
  maxPixelRatio: 1.6, background: 0xe5dfd9, skin: 0xf1c7b2,
  warmLight: 0xffefda, coolLight: 0xf5f0ff
});
