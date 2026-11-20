const assert = require('node:assert/strict');
const { test } = require('node:test');

test('finds a crossing between two poses on opposite sides of a surface', async () => {
  const { createSweptVertexTest } = await import('../../src/core/geometry/swept-vertices.js');
  const geometry = {
    getAttribute: () => ({ array: [0.9, -0.1, 0, 1.1, -0.1, 0, 1, 0.1, 0] }),
    getIndex: () => ({ array: [0, 1, 2] })
  };
  const crossing = createSweptVertexTest(geometry, 1);
  assert.equal(crossing([0, 0, 0.02], [0, 0, -0.02, 0], 4), 0);
  assert.equal(crossing([0, 0, -0.02], [0, 0, 0.02, 0], 4), 0);
  assert.equal(crossing([0, 0, 0.02], [0, 0, 0.01, 0], 4), -1);
  assert.equal(crossing([0.2, 0, 0.02], [0.2, 0, -0.02, 0], 4), -1);
});
