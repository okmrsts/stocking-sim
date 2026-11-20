import { bodyProfile, lowerBodyConfig } from '../config/leg-anatomy.js';
import { bodyDimensions, shapeZones, tissueSections } from '../config/body-regions.js';
import { interpolate } from '../core/body/swept-surface.js';
import { createTissueMap, smoothRange } from '../core/body/tissue-map.js';

const regionalTissue = createTissueMap(tissueSections);
const mix = (a, b, t) => a + (b - a) * t;

export function resolveBodyShape(values = {}) {
  const dimensions = Object.fromEntries(bodyDimensions.map(({ id, min, max }) => {
    const value = Number.isFinite(values[id]) ? Math.round(values[id]) : 100;
    return [id, Math.max(min, Math.min(max, value))];
  }));
  const { waist, hips, glutes, thighs, calves, ankles } = dimensions;
  const weight = (id, gain) => (id / 100 - 1) * gain;
  const bump = (y, start, peak, end) => smoothRange(y, start, peak) * (1 - smoothRange(y, peak, end));

  const profile = bodyProfile.map(([arc, x, y, z, width, depth, pitch]) => {
    // Fit both leg envelopes from the same scaled cross-sections.
    const thighWeight = smoothRange(y, ...shapeZones.thighEntry) * (1 - smoothRange(y, ...shapeZones.thighExit));
    const thighScale = weight(thighs, thighWeight);
    const scale = 1 + weight(ankles, bump(y, ...shapeZones.ankle))
      + weight(calves, bump(y, ...shapeZones.calf))
      + thighScale;
    // Hold the inner thigh approximately fixed as the outer contour expands.
    return [arc, x + width * thighScale, y, z, width * scale, depth * scale, pitch];
  });
  const config = lowerBodyConfig;
  const lobe = config.gluteal;
  const [cx, cy, cz] = lobe.lobeCenterM;
  const [rx, ry, rz] = lobe.lobeRadiiM;
  const pelvis = {
    ...config,
    pelvisSections: config.pelvisSections.map(([y, width, front, back, exponent]) => {
      const waistWeight = smoothRange(y, ...shapeZones.waist);
      const hipWeight = smoothRange(y, ...shapeZones.pelvis) * (1 - waistWeight);
      const fullness = bump(y, ...shapeZones.glutes);
      const waistDepth = weight(waist, shapeZones.waistDepthWeight * waistWeight);
      return [y, width * (1 + weight(hips, hipWeight) + weight(waist, waistWeight)),
        front * (1 + waistDepth),
        back * (1 + weight(glutes, shapeZones.pelvisRearWeight * fullness) + waistDepth), exponent];
    }),
    gluteal: {
      ...lobe,
      lobeCenterM: [cx * (1 + weight(hips, shapeZones.lobeSpacingWeight)), cy, cz - weight(glutes, shapeZones.lobeRearShiftM)],
      lobeRadiiM: [rx * (1 + weight(hips, shapeZones.lobeWidthWeight)), ry, rz * (1 + weight(glutes, shapeZones.lobeDepthWeight))]
    }
  };

  return { dimensions, profile, pelvis };
}

export function createBodyTissue(shape, legSurface) {
  // Precompute section centers in world height for coloring both skin meshes.
  const pitch = 0.002;
  const sections = Array.from({ length: Math.ceil(shape.pelvis.pelvisSections.at(-1)[0] / pitch) + 1 }, (_, row) => {
    const y = row * pitch;
    let low = 0, high = legSurface.length;
    for (let i = 0; i < 16; i++) {
      const middle = (low + high) / 2;
      if (legSurface.section(middle).y < y) low = middle;
      else high = middle;
    }
    const leg = legSurface.section((low + high) / 2);
    const join = smoothRange(y, 0.725, 0.825);
    const [, front, back] = interpolate(shape.pelvis.pelvisSections, y);
    return [mix(leg.x + shape.pelvis.halfStanceM, 0, join), mix(leg.z, (front + back) / 2, join),
      mix(leg.width, shape.pelvis.pelvisSections[2][1], join), mix(leg.depth, (front - back) / 2, join)];
  });

  function samplePoint(x, y, z) {
    const row = Math.max(0, Math.min(sections.length - 2, Math.floor(y / pitch)));
    const weight = Math.max(0, Math.min(1, y / pitch - row));
    const first = sections[row], second = sections[row + 1];
    const angle = Math.atan2((Math.abs(x) - mix(first[0], second[0], weight)) / mix(first[2], second[2], weight),
      (z - mix(first[1], second[1], weight)) / mix(first[3], second[3], weight));
    const forefoot = smoothRange(z, 0.025, 0.060) * (1 - smoothRange(y, 0.035, 0.071));
    const value = regionalTissue(y, angle);
    if (forefoot === 0) return value;
    const front = regionalTissue(y, 0);
    return value.map((channel, index) => mix(channel, front[index], forefoot));
  }

  return {
    samplePoint,
    sampleLeg: (height, angle) => regionalTissue(height, angle)
  };
}
