import { material, preset } from './stage1a.js';

const upper = Object.freeze({
  waistY: 0.913, hemWidthM: 0.035, gridM: 0.0064, clearanceM: 0.0018, joinFadeM: 0.023,
  relaxedRadiusM: 0.067, dyeReinforcement: 1.16, bandYarnCount: 2.18
});

export const garments = Object.freeze({
  'knee-high': { ...preset, id: 'knee-high', material },
  pantyhose: {
    ...preset, id: 'pantyhose', label: '20D 平編みパンスト', upper, cuffYarnCount: 1, cuffStiffness: 1,
    material
  },
  tights: {
    ...preset, id: 'tights', label: '60D タイツ', upper, cuffYarnCount: 1, cuffStiffness: 1,
    denier: 60, relaxedRadiusM: 0.026, relaxedToeRadiusM: 0.020,
    toeYarnCount: 1.45, cellPitchM: [0.00045, 0.00044], dyeLinear: [0.017, 0.018, 0.023],
    material: { ...material, hoopModulusNpm: 31, axialModulusNpm: 28, fineWrinkleAmplitudeM: 0.00052 }
  },
  fishnet: {
    ...preset, id: 'fishnet', label: '網タイツ', upper: { ...upper, dyeReinforcement: 1.50 },
    net: { cellPitchM: [0.0036, 0.0050], bundleDenier: 280 },
    cuffYarnCount: 1, cuffStiffness: 1, toeYarnCount: 1.58,
    relaxedRadiusM: 0.025, relaxedToeRadiusM: 0.019, dyeLinear: [0.020, 0.018, 0.023],
    material: { ...material, hoopModulusNpm: 16, axialModulusNpm: 15 }
  }
});

export function textileOptics(garment) {
  const circumference = 2 * Math.PI * garment.relaxedRadiusM;
  const closedPitch = pitch => circumference / Math.round(circumference / pitch);
  return {
    ...garment,
    cellPitchM: [closedPitch(garment.cellPitchM[0]), garment.cellPitchM[1]],
    net: garment.net && {
      ...garment.net, cellPitchM: [closedPitch(garment.net.cellPitchM[0]), garment.net.cellPitchM[1]]
    }
  };
}
