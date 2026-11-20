import assert from 'node:assert/strict';
import { tissueSections } from '../../src/config/body-regions.js';
import { tissue } from '../../src/config/stage1a.js';
import { createTissueMap } from '../../src/core/body/tissue-map.js';
import { updateTissueField } from '../../src/core/body/soft-tissue.js';

const map = createTissueMap(tissueSections);
const tau = 2 * Math.PI;
for (const height of [0.075, 0.325, 0.431, 0.647, 0.780]) {
  for (const angle of [-0.001, 0, 1.1, Math.PI, tau - 0.001]) {
    assert.ok(Math.abs(map(height, angle)[0] - map(height, angle + tau)[0]) < 1e-12);
  }
}
assert.ok(map(0.431, Math.PI)[0] > 3 * map(0.431, 0)[0]);
assert.ok(map(0.325, Math.PI)[0] > 3 * map(0.325, 0)[0]);
assert.ok(map(0.647, -Math.PI / 2)[0] > map(0.647, Math.PI / 2)[0]);
assert.ok(map(0.780, Math.PI)[0] > map(0.780, 0)[0]);

const columns = 64, rows = 360;
const arcs = Array.from({ length: rows + 1 }, (_, row) => row * 0.002);
const state = new Float32Array((rows + 1) * (columns + 1) * 16);
const frame = { columns, rows, arcs, state };
const sample = (arc, angle) => map(arc, angle);
const height = 0.32;
for (let i = 9; i < state.length; i += 16) state[i] = 3000;
const uncompressed = updateTissueField(frame, { ...tissue, startArcM: 0.1 }, sample, undefined, 0);
const config = { ...tissue, startArcM: 0.1 };
const early = updateTissueField(frame, config, sample, uncompressed, 0.05);
const late = updateTissueField(frame, config, sample, early, 0.40);
const inSteps = updateTissueField(frame, config, sample, uncompressed, 0.45);
assert.ok(early.sample(height, Math.PI) > early.sample(height, 0) * 2);
assert.ok(uncompressed.sample(height, Math.PI) === 0 && early.sample(height, Math.PI) > 0);
assert.ok(late.sample(height, Math.PI) > early.sample(height, Math.PI));
assert.ok(Math.abs(late.sample(height, Math.PI) - inSteps.sample(height, Math.PI)) < 1e-8);
assert.ok(late.sample(height, Math.PI) < map(height, Math.PI)[1]);
state.fill(0);
const released = updateTissueField(frame, config, sample, late, 0.45);
assert.ok(released.sample(height, Math.PI) < late.sample(height, Math.PI) * 0.1);
assert.ok(released.sample(height, Math.PI) > 0);

for (const [label, height] of [['Calf', 0.325], ['Knee', 0.431], ['Upper thigh', 0.647]]) {
  console.log(label, [0, Math.PI / 2, Math.PI, -Math.PI / 2].map(angle => 1000 * map(height, angle)[0]).join(', '));
}
console.log('Regional loading, bounded compression and time-dependent recovery verified.');
