// Run in the browser against the actual indexed render surface.
function inspectMesh() {
  const app = window.stockingStage1a;
  const mesh = app.lowerBody.textile.children[0].geometry;
  const positions = mesh.attributes.position.array;
  const indices = mesh.index.array;
  const columns = 64;
  const last = mesh.attributes.position.count - 1;
  const cell = 0.005;
  const bins = new Map();
  const seen = new Int32Array(indices.length / 3).fill(-1);
  const faces = [];
  const samples = [];
  let footCentres = 0, insideFoot = 0, selfCrossings = 0;
  const virtualId = index => index < last && index % (columns + 1) === columns ? index - columns : index;
  const coords = index => Array.from(positions.subarray(index * 3, index * 3 + 3));
  const edgeCrosses = (origin, target, [a, b, c]) => {
    const dx = target[0] - origin[0], dy = target[1] - origin[1], dz = target[2] - origin[2];
    const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
    const fx = c[0] - a[0], fy = c[1] - a[1], fz = c[2] - a[2];
    const px = dy * fz - dz * fy, py = dz * fx - dx * fz, pz = dx * fy - dy * fx;
    const determinant = ex * px + ey * py + ez * pz;
    if (Math.abs(determinant) < 1e-14) return false;
    const x = origin[0] - a[0], y = origin[1] - a[1], z = origin[2] - a[2];
    const u = (x * px + y * py + z * pz) / determinant;
    if (u <= 1e-5 || u >= 1 - 1e-5) return false;
    const qx = y * ez - z * ey, qy = z * ex - x * ez, qz = x * ey - y * ex;
    const v = (dx * qx + dy * qy + dz * qz) / determinant;
    if (v <= 1e-5 || u + v >= 1 - 1e-5) return false;
    const t = (fx * qx + fy * qy + fz * qz) / determinant;
    return t > 1e-5 && t < 1 - 1e-5;
  };
  function anyEdge(first, second) {
    return edgeCrosses(first[0], first[1], second)
      || edgeCrosses(first[1], first[2], second)
      || edgeCrosses(first[2], first[0], second);
  }
  for (let j = 0; j < indices.length; j += 3) {
    const id = j / 3;
    const input = [indices[j], indices[j + 1], indices[j + 2]];
    const vertices = input.map(coords);
    const ids = input.map(virtualId);
    const lo = [0, 1, 2].map(axis => Math.min(...vertices.map(point => point[axis])));
    const hi = [0, 1, 2].map(axis => Math.max(...vertices.map(point => point[axis])));
    const [x, y, z] = [0, 1, 2].map(axis => vertices.reduce((sum, p) => sum + p[axis] / 3, 0));
    if (y < app.surface.footLimitM - 0.003 && z < 0.181) {
      footCentres++;
      if (app.surface.footDistance(x, y, z) < -0.0001) insideFoot++;
    }
    faces[id] = { ids, vertices, lo, hi };
    for (let ix = Math.floor(lo[0] / cell); ix <= Math.floor(hi[0] / cell); ix++) {
      for (let iy = Math.floor(lo[1] / cell); iy <= Math.floor(hi[1] / cell); iy++) {
        for (let iz = Math.floor(lo[2] / cell); iz <= Math.floor(hi[2] / cell); iz++) {
          const key = (ix + 256) + 512 * (iy + 256) + 262144 * (iz + 256);
          let prior = bins.get(key);
          if (!prior) bins.set(key, prior = []);
          for (const earlier of prior) {
            if (seen[earlier] === id) continue;
            seen[earlier] = id;
            const face = faces[earlier];
            if (ids.some(index => face.ids.includes(index))) continue;
            if (lo.some((lower, axis) => lower > face.hi[axis] || hi[axis] < face.lo[axis])) continue;
            if (anyEdge(vertices, face.vertices) || anyEdge(face.vertices, vertices)) {
              selfCrossings++;
              if (samples.length < 5) samples.push({ point: [x, y, z], faces: [id, earlier] });
            }
          }
          prior.push(id);
        }
      }
    }
  }
  return { footCentres, insideFoot, selfCrossings, samples };
}
module.exports = { inspectMesh };
