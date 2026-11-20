import { sampleCloth } from '../core/cloth/geometry.js';
import { normalOpacity } from '../core/textile/material.js';

const sampleSites = [
  ['thigh', 0.799, 0.31], ['ankle', 0.253, 0.31], ['cuff', 0.877, 0.20],
  ['toe', 0.031, 0.12], ['kneeFront', 0.626, 0.0], ['kneeBack', 0.626, Math.PI]
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
  for (let index = 0; index < frame.points; index++) {
    const base = index * 12;
    const arc = frame.arcs[Math.floor(index / (frame.columns + 1))];
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
    samples, tensionOpacity, yarnDiameterMicrometers: radiusM * 2e6,
    gaps: { ankleFront: gapRange(0.255, 0.018, 0.31), kneeRear: gapRange(0.631, 0.019, Math.PI) }
  };
}
