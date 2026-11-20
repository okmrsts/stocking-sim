import { sampleCloth } from '../core/cloth/geometry.js';
import { normalOpacity } from '../core/textile/material.js';

const sampleSites = [
  ['thigh', 0.772, 0.31], ['ankle', 0.358, 0.31], ['cuff', 0.844, 0.20],
  ['toe', 0.031, 0.12], ['kneeFront', 0.617, 0.0], ['kneeBack', 0.617, Math.PI]
];

export function collectFitMetrics(frame, surface, optics, radiusM) {
  const samples = Object.fromEntries(sampleSites.map(([name, arc, angle]) => {
    const sample = sampleCloth(frame, surface, arc, angle);
    return [name, { ...sample, normalOpacity: normalOpacity(sample, optics, radiusM) }];
  }));
  function gapRange(arcCenter, halfWidth, angle) {
    const values = frame.arcs.filter(arc => Math.abs(arc - arcCenter) <= halfWidth)
      .map(arc => sampleCloth(frame, surface, arc, angle).gapMm);
    return { minMm: Math.min(...values), maxMm: Math.max(...values), samples: values.length };
  }
  const relation = [];
  let contactPoints = 0, maxCorrectionMm = 0, reversedPoints = 0;
  let footPoints = 0, footInsideSkin = 0, minFootFieldMm = Infinity, closestFootPointM;
  for (let index = 0; index < frame.points; index++) {
    if (index % (frame.columns + 1) === frame.columns) continue;
    const base = index * 16;
    const contactMm = frame.state[base + 12] * 1000;
    if (contactMm > 0.001) contactPoints++;
    reversedPoints += frame.state[base + 14];
    maxCorrectionMm = Math.max(maxCorrectionMm, contactMm);
    const arc = frame.arcs[Math.floor(index / (frame.columns + 1))];
    const [x, y, z] = frame.state.subarray(base, base + 3);
    if (arc < 0.30 && y <= surface.footLimitM) {
      const distance = surface.footDistance(x, y, z) * 1000;
      footPoints++;
      if (distance < -0.1) footInsideSkin++;
      if (distance < minFootFieldMm) {
        minFootFieldMm = distance;
        closestFootPointM = [x, y, z];
      }
    }
    const reinforcement = frame.state[base + 10];
    if (arc < 0.22 || reinforcement > 1.001) continue;
    const state = {
      stretchHoop: frame.state[base + 4], stretchAxial: frame.state[base + 5],
      reinforcement, restRadiusM: frame.state[base + 11]
    };
    relation.push([frame.state[base + 6], normalOpacity(state, optics, radiusM)]);
  }
  const sums = relation.reduce(([x, y], [a, b]) => [x + a, y + b], [0, 0]);
  const means = sums.map(sum => sum / relation.length);
  let xx = 0, yy = 0, xy = 0;
  for (const [tension, opacity] of relation) {
    const a = tension - means[0];
    const b = opacity - means[1];
    xx += a * a;
    yy += b * b;
    xy += a * b;
  }
  const tensionOpacity = { samples: relation.length, pearson: xy / Math.sqrt(xx * yy) };
  return {
    samples, tensionOpacity, selfContact: { contactPoints, maxCorrectionMm, reversedPoints },
    footContact: { footPoints, footInsideSkin, minFootFieldMm, closestFootPointM }, yarnDiameterMicrometers: radiusM * 2e6,
    gaps: { ankleFront: gapRange(0.324, 0.022, 0.31), kneeRear: gapRange(0.622, 0.021, Math.PI) }
  };
}
