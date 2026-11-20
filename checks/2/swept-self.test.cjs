const assert = require('node:assert/strict');
const { test } = require('node:test');

function mesh(positions, index = [0, 1, 2, 3, 4, 5]) {
  return { index: { array: index }, attributes: { position: { array: Float64Array.from(positions) } } };
}

test('detects a face crossing with clear start and end poses', async () => {
  const { createSweptSelfTest } = await import('../../src/core/geometry/swept-self.js');
  const initial = [0,-2,-1, 0,2,-1, 0,0,2, -1,-0.5,0, -0.7,0.5,0, -1.2,0.5,0];
  const testStep = createSweptSelfTest(mesh(initial), id => id);
  const final = initial.map((x, i) => i >= 9 && i % 3 === 0 ? x + 2 : x);
  assert.ok(testStep(initial, final));
  assert.ok(testStep(final, initial));
  assert.equal(testStep(initial, initial), null);
});

test('detects coplanar edge crossings and clears a narrow separated sweep', async () => {
  const { createTriangleSweep } = await import('../../src/core/geometry/triangle-sweep.js');
  const sweep = createTriangleSweep();
  const initial = [0,0,0, 1,0,0, 0,1,0, -2,0.3,0, -1.5,0.3,0, -2,0.8,0];
  const velocity = [0,0,0, 0,0,0, 0,0,0, 4,0,0, 4,0,0, 4,0,0];
  assert.equal(sweep(initial, velocity), true);
  for (const offset of [11, 14, 17]) initial[offset] = 1e-6;
  assert.equal(sweep(initial, velocity), false);
});

test('faces that share a welded seam are adjacent', async () => {
  const { createSweptSelfTest } = await import('../../src/core/geometry/swept-self.js');
  const initial = [0,0,0, 1,0,0, 0,1,0, 0,0,0, 1,0,0, 0,-1,0];
  const testStep = createSweptSelfTest(mesh(initial), id => id === 3 ? 0 : id === 4 ? 1 : id);
  const final = [...initial];
  final[17] = 0.2;
  assert.equal(testStep(initial, final), null);
});
