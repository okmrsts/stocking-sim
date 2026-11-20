// The fixed mesh stays in world coordinates. The moving side may use a local frame.
export function createSweptVertexTest(geometry, offsetX = 0) {
  const points = geometry.getAttribute('position').array;
  const index = geometry.getIndex().array;
  const faces = [];
  for (let face = 0; face < index.length; face += 3) {
    const a = index[face] * 3, b = index[face + 1] * 3, c = index[face + 2] * 3;
    const low = [0, 1, 2].map(axis => Math.min(points[a + axis], points[b + axis], points[c + axis]));
    const high = [0, 1, 2].map(axis => Math.max(points[a + axis], points[b + axis], points[c + axis]));
    faces.push({ a, b, c, low, high });
  }

  function build(list) {
    const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
    for (const face of list) {
      for (let axis = 0; axis < 3; axis++) {
        low[axis] = Math.min(low[axis], face.low[axis]);
        high[axis] = Math.max(high[axis], face.high[axis]);
      }
    }
    if (list.length <= 10) return { low, high, faces: list };
    const span = high.map((value, axis) => value - low[axis]);
    const axis = span.indexOf(Math.max(...span));
    list.sort((a, b) => a.low[axis] + a.high[axis] - b.low[axis] - b.high[axis]);
    const half = list.length >> 1;
    return { low, high, left: build(list.slice(0, half)), right: build(list.slice(half)) };
  }

  const root = build(faces);
  const start = new Float64Array(3);
  const delta = new Float64Array(3);

  function overlaps(node) {
    let lo = 0, hi = 1;
    for (let axis = 0; axis < 3; axis++) {
      const origin = start[axis], step = delta[axis];
      if (Math.abs(step) < 1e-12) {
        if (origin < node.low[axis] || origin > node.high[axis]) return false;
        continue;
      }
      const first = (node.low[axis] - origin) / step, last = (node.high[axis] - origin) / step;
      lo = Math.max(lo, Math.min(first, last));
      hi = Math.min(hi, Math.max(first, last));
      if (lo > hi) return false;
    }
    return true;
  }

  function intersects({ a, b, c }) {
    const ex = points[b] - points[a], ey = points[b + 1] - points[a + 1], ez = points[b + 2] - points[a + 2];
    const fx = points[c] - points[a], fy = points[c + 1] - points[a + 1], fz = points[c + 2] - points[a + 2];
    const px = delta[1] * fz - delta[2] * fy, py = delta[2] * fx - delta[0] * fz, pz = delta[0] * fy - delta[1] * fx;
    const det = ex * px + ey * py + ez * pz;
    if (Math.abs(det) < 1e-15) return false;
    const x = start[0] - points[a], y = start[1] - points[a + 1], z = start[2] - points[a + 2];
    const u = (x * px + y * py + z * pz) / det;
    if (u < -1e-8 || u > 1 + 1e-8) return false;
    const qx = y * ez - z * ey, qy = z * ex - x * ez, qz = x * ey - y * ex;
    const v = (delta[0] * qx + delta[1] * qy + delta[2] * qz) / det;
    if (v < -1e-8 || u + v > 1 + 1e-8) return false;
    const t = (fx * qx + fy * qy + fz * qz) / det;
    return t > 1e-7 && t <= 1;
  }

  function hits(node) {
    if (!overlaps(node)) return false;
    if (!node.faces) return hits(node.left) || hits(node.right);
    for (const face of node.faces) if (intersects(face)) return true;
    return false;
  }

  return function firstCrossing(before, after, afterStride) {
    for (let i = 0; i < before.length / 3; i++) {
      const previous = i * 3, next = i * afterStride;
      start[0] = before[previous] + offsetX;
      start[1] = before[previous + 1];
      start[2] = before[previous + 2];
      delta[0] = after[next] - before[previous];
      delta[1] = after[next + 1] - before[previous + 1];
      delta[2] = after[next + 2] - before[previous + 2];
      if (Math.max(Math.abs(delta[0]), Math.abs(delta[1]), Math.abs(delta[2])) < 1e-7) continue;
      if (hits(root)) return i;
    }
    return -1;
  };
}
