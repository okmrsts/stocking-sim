// All vertices travel linearly over a proposed step. A fixed axis that
// separates both endpoints with the same ordering separates the entire step.
export function createTriangleSweep({ maximumDepth = 11, paddingM = 1e-9 } = {}) {
  const mid = new Float64Array(18);
  const left = new Float64Array(18);
  const right = new Float64Array(18);
  const edges = new Float64Array(18);
  const normals = new Float64Array(6);
  const cross = (a, i, b, j, out, k) => {
    out[k] = a[i + 1] * b[j + 2] - a[i + 2] * b[j + 1];
    out[k + 1] = a[i + 2] * b[j] - a[i] * b[j + 2];
    out[k + 2] = a[i] * b[j + 1] - a[i + 1] * b[j];
  };
  const axis = new Float64Array(3);

  function orientedGap(points, x, y, z, reverse) {
    const a = points[0] * x + points[1] * y + points[2] * z;
    const b = points[3] * x + points[4] * y + points[5] * z;
    const c = points[6] * x + points[7] * y + points[8] * z;
    const d = points[9] * x + points[10] * y + points[11] * z;
    const e = points[12] * x + points[13] * y + points[14] * z;
    const f = points[15] * x + points[16] * y + points[17] * z;
    return reverse ? Math.min(a, b, c) - Math.max(d, e, f) : Math.min(d, e, f) - Math.max(a, b, c);
  }

  function testAxis(x, y, z) {
    const scale = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
    if (scale < 1e-22) return 0;
    const pad = scale * paddingM;
    const reverse = orientedGap(mid, x, y, z, false) <= pad;
    if (reverse && orientedGap(mid, x, y, z, true) <= pad) return 0;
    return orientedGap(left, x, y, z, reverse) > pad && orientedGap(right, x, y, z, reverse) > pad ? 2 : 1;
  }

  function split(start, velocity, lo, hi, depth) {
    for (let i = 0; i < 18; i++) {
      left[i] = start[i] + lo * velocity[i];
      right[i] = start[i] + hi * velocity[i];
      mid[i] = (left[i] + right[i]) * 0.5;
    }
    let separatedAtMid = false;
    for (let direction = 0; direction < 3; direction++) {
      const relation = testAxis(+(direction === 0), +(direction === 1), +(direction === 2));
      if (relation === 2) return false;
      separatedAtMid ||= relation === 1;
    }
    for (let i = 0; i < 18; i += 3) {
      const next = i % 9 === 6 ? i - 6 : i + 3;
      for (let k = 0; k < 3; k++) edges[i + k] = mid[next + k] - mid[i + k];
    }
    cross(edges, 0, edges, 3, normals, 0);
    cross(edges, 9, edges, 12, normals, 3);
    for (let i = 0; i < 6; i += 3) {
      const relation = testAxis(normals[i], normals[i + 1], normals[i + 2]);
      if (relation === 2) return false;
      separatedAtMid ||= relation === 1;
    }
    for (let i = 0; i < 18; i += 3) {
      // In-plane normals also separate disjoint coplanar faces.
      cross(edges, i, normals, i < 9 ? 0 : 3, axis, 0);
      const relation = testAxis(axis[0], axis[1], axis[2]);
      if (relation === 2) return false;
      separatedAtMid ||= relation === 1;
    }
    for (let i = 0; i < 9; i += 3) {
      for (let j = 9; j < 18; j += 3) {
        cross(edges, i, edges, j, axis, 0);
        const relation = testAxis(axis[0], axis[1], axis[2]);
        if (relation === 2) return false;
        separatedAtMid ||= relation === 1;
      }
    }
    // Reject unresolved intervals rather than allowing potential tunnelling.
    if (!separatedAtMid || depth === maximumDepth) return true;
    const half = (lo + hi) * 0.5;
    return split(start, velocity, lo, half, depth + 1) || split(start, velocity, half, hi, depth + 1);
  }

  return (start, velocity) => split(start, velocity, 0, 1, 0);
}
