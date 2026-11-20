import { createTriangleSweep } from './triangle-sweep.js';

const directions = [
  [1,0,0], [0,1,0], [0,0,1], [1,1,0], [1,-1,0], [1,0,1], [1,0,-1], [0,1,1], [0,1,-1],
  [1,1,1], [1,-1,1], [1,1,-1], [1,-1,-1]
];
const directionCount = directions.length;
const boxSize = directionCount * 4;

// Refit the hierarchy on the positions of both ends of each proposed step.
export function createSweptSelfTest(geometry, canonicalVertex, settings) {
  const index = geometry.index.array;
  const position = geometry.attributes.position.array;
  const count = index.length / 3;
  const vertices = position.length / 3;
  const canonical = Uint32Array.from({ length: vertices }, (_, i) => canonicalVertex(i));
  const triangleSweep = createTriangleSweep(settings);
  const start = new Float64Array(18), velocity = new Float64Array(18);
  const change = new Float64Array(position.length);
  const moving = new Uint8Array(vertices);
  const faceBoxes = new Float32Array(count * boxSize);
  const centres = new Float64Array(count * 3);
  const changed = new Uint8Array(count);
  const order = Uint32Array.from({ length: count }, (_, i) => i);
  for (let face = 0; face < count; face++) {
    for (let axis = 0; axis < 3; axis++) {
      centres[3 * face + axis] = (position[3 * index[3 * face] + axis]
        + position[3 * index[3 * face + 1] + axis] + position[3 * index[3 * face + 2] + axis]) / 3;
    }
  }
  const nodes = [];
  function build(lo, hi) {
    let left = -1, right = -1;
    if (hi - lo > 4) {
      const lower = [Infinity, Infinity, Infinity], upper = [-Infinity, -Infinity, -Infinity];
      for (let i = lo; i < hi; i++) {
        for (let axis = 0; axis < 3; axis++) {
          const value = centres[3 * order[i] + axis];
          lower[axis] = Math.min(lower[axis], value);
          upper[axis] = Math.max(upper[axis], value);
        }
      }
      const spread = upper.map((value, axis) => value - lower[axis]);
      const axis = spread.indexOf(Math.max(...spread));
      order.subarray(lo, hi).sort((a, b) => centres[3 * a + axis] - centres[3 * b + axis]);
      const half = (lo + hi) >> 1;
      left = build(lo, half);
      right = build(half, hi);
    }
    return nodes.push({ lo, hi, left, right }) - 1;
  }
  const root = build(0, count);
  const boxes = new Float32Array(nodes.length * boxSize);
  const nodeChanged = new Uint8Array(nodes.length);
  let origin;
  const before = new Float32Array(vertices * directionCount);
  const after = new Float32Array(vertices * directionCount);

  function overlaps(a, i, b, j) {
    for (let axis = 0; axis < boxSize; axis += 4) {
      const x = i + axis, y = j + axis;
      if (a[x + 1] < b[y] && a[x + 3] < b[y + 2]) return false;
      if (b[y + 1] < a[x] && b[y + 3] < a[x + 2]) return false;
    }
    return true;
  }

  function contact(a, b) {
    if (!(changed[a] || changed[b]) || !overlaps(faceBoxes, a * boxSize, faceBoxes, b * boxSize)) return false;
    const p = 3 * a, q = 3 * b;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (canonical[index[p + i]] === canonical[index[q + j]]) return false;
      }
    }
    for (let i = 0; i < 6; i++) {
      const vertex = index[i < 3 ? p + i : q + i - 3] * 3;
      for (let axis = 0; axis < 3; axis++) {
        start[i * 3 + axis] = origin[vertex + axis];
        velocity[i * 3 + axis] = change[vertex + axis];
      }
    }
    return triangleSweep(start, velocity);
  }

  function walk(a, b) {
    if (!(nodeChanged[a] || nodeChanged[b]) || !overlaps(boxes, a * boxSize, boxes, b * boxSize)) return null;
    const u = nodes[a], v = nodes[b];
    if (u.left < 0 && v.left < 0) {
      for (let i = u.lo; i < u.hi; i++) {
        for (let j = a === b ? i + 1 : v.lo; j < v.hi; j++) {
          if (contact(order[i], order[j])) return [order[i], order[j]];
        }
      }
      return null;
    }
    if (a === b) return walk(u.left, u.left) ?? walk(u.left, u.right) ?? walk(u.right, u.right);
    if (v.left < 0 || (u.left >= 0 && u.hi - u.lo >= v.hi - v.lo)) {
      return walk(u.left, b) ?? walk(u.right, b);
    }
    return walk(a, v.left) ?? walk(a, v.right);
  }

  return function firstContact(previous, next) {
    origin = previous;
    let anyMotion = false;
    for (let i = 0; i < vertices; i++) {
      const point = i * 3;
      let displaced = false;
      for (let axis = 0; axis < 3; axis++) {
        const k = point + axis;
        change[k] = next[k] - previous[k];
        displaced ||= change[k] !== 0;
      }
      anyMotion ||= displaced;
      moving[i] = displaced;
      for (let d = 0; d < directionCount; d++) {
        const [x, y, z] = directions[d];
        const k = i * directionCount + d;
        before[k] = previous[point] * x + previous[point + 1] * y + previous[point + 2] * z;
        after[k] = next[point] * x + next[point + 1] * y + next[point + 2] * z;
      }
    }
    if (!anyMotion) return null;
    for (let face = 0; face < count; face++) {
      const a = index[3 * face], b = index[3 * face + 1], c = index[3 * face + 2];
      changed[face] = moving[a] | moving[b] | moving[c];
      const x = a * directionCount, y = b * directionCount, z = c * directionCount;
      for (let d = 0; d < directionCount; d++) {
        const i = face * boxSize + d * 4;
        faceBoxes[i] = Math.min(before[x + d], before[y + d], before[z + d]);
        faceBoxes[i + 1] = Math.max(before[x + d], before[y + d], before[z + d]);
        faceBoxes[i + 2] = Math.min(after[x + d], after[y + d], after[z + d]);
        faceBoxes[i + 3] = Math.max(after[x + d], after[y + d], after[z + d]);
      }
    }
    for (let i = 0; i < nodes.length; i++) {
      const { lo, hi, left, right } = nodes[i];
      const box = i * boxSize;
      nodeChanged[i] = 0;
      if (left < 0) {
        const first = order[lo];
        for (let axis = 0; axis < boxSize; axis++) boxes[box + axis] = faceBoxes[first * boxSize + axis];
        nodeChanged[i] = changed[first];
        for (let j = lo + 1; j < hi; j++) {
          const face = order[j];
          const k = face * boxSize;
          nodeChanged[i] |= changed[face];
          for (let axis = 0; axis < boxSize; axis += 2) {
            boxes[box + axis] = Math.min(boxes[box + axis], faceBoxes[k + axis]);
            boxes[box + axis + 1] = Math.max(boxes[box + axis + 1], faceBoxes[k + axis + 1]);
          }
        }
      } else {
        nodeChanged[i] = nodeChanged[left] | nodeChanged[right];
        for (let axis = 0; axis < boxSize; axis += 2) {
          boxes[box + axis] = Math.min(boxes[left * boxSize + axis], boxes[right * boxSize + axis]);
          boxes[box + axis + 1] = Math.max(boxes[left * boxSize + axis + 1], boxes[right * boxSize + axis + 1]);
        }
      }
    }
    return walk(root, root);
  };
}
