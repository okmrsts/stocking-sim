async function inspectFit() {
  const app = window.stockingStage1a;
  const { joined, surface, dimensions } = app;
  const values = {
    garment: app.garment, yarn: app.yarn, opacity: {
      thigh: app.samples.thigh.normalOpacity, ankle: app.samples.ankle.normalOpacity,
      toe: app.samples.toe.normalOpacity, tensionCorrelation: app.tensionOpacity.pearson
    },
    foot: app.footFit, initial: app.initial, runtime: app.result
  };
  if (!joined) return values;
  const { createPelvisField } = await import('/src/core/body/pelvis-field.js');
  const { resolveBodyShape } = await import('/src/stocking/body-shape.js');
  const field = createPelvisField(surface, resolveBodyShape(dimensions).pelvis);
  const positions = joined.attributes.position.array, indices = joined.index.array;
  const welded = new Map();
  const vertex = (x, y, z) => (Math.round(x * 1e7) + ',' + Math.round(y * 1e7) + ',' + Math.round(z * 1e7));
  const classes = new Uint32Array(positions.length / 3);
  for (let i = 0; i < classes.length; i++) {
    const key = vertex(...positions.subarray(i * 3, i * 3 + 3));
    if (!welded.has(key)) welded.set(key, i);
    classes[i] = welded.get(key);
  }
  const roots = classes.slice();
  function root(id) {
    while (roots[id] !== id) {
      roots[id] = roots[roots[id]];
      id = roots[id];
    }
    return id;
  }
  const edges = new Map();
  let pelvisSamples = 0, insidePelvis = 0, minFieldMm = Infinity, degenerate = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.subarray(i, i + 3);
    const [p, q, r] = [classes[a], classes[b], classes[c]];
    if (p === q || q === r || r === p) {
      degenerate++;
      continue;
    }
    roots[root(q)] = root(p);
    roots[root(r)] = root(p);
    for (const [from, to] of [[p, q], [q, r], [r, p]]) {
      const key = Math.min(from, to) * classes.length + Math.max(from, to);
      const edge = edges.get(key) ?? { count: 0, balance: 0, from, to };
      edge.count++;
      edge.balance += from < to ? 1 : -1;
      edges.set(key, edge);
    }
    const centre = [0, 1, 2].map(axis => (positions[a * 3 + axis] + positions[b * 3 + axis]
      + positions[c * 3 + axis]) / 3);
    if (centre[1] >= field.startY + 0.002) {
      pelvisSamples++;
      const distance = field.sample(...centre) * 1000;
      minFieldMm = Math.min(distance, minFieldMm);
      if (distance < -0.1) insidePelvis++;
    }
  }
  const boundaries = [...edges.values()].filter(edge => edge.count === 1);
  return {
    ...values, vertices: classes.length, triangles: indices.length / 3,
    topology: {
      components: new Set([...welded.values()].map(root)).size,
      openEdges: boundaries.length,
      waistEdgesOnly: boundaries.every(({ from, to }) =>
        Math.abs(positions[from * 3 + 1] - 0.913) < 1e-6 && Math.abs(positions[to * 3 + 1] - 0.913) < 1e-6),
      nonManifold: [...edges.values()].filter(edge => edge.count > 2).length,
      inconsistent: [...edges.values()].filter(({ count, balance }) => count === 2 && balance !== 0).length,
      degenerate
    },
    pelvis: { samples: pelvisSamples, inside: insidePelvis, minFieldMm }
  };
}
module.exports = { inspectFit };
