import { cross2, convexHull } from '../geometry/convex-hull.js';

export function createToeContactSlice(sample, z, pitch, width, height) {
  const rim = [];
  const dy = pitch * 2;
  for (let x = -width; x <= width; x += pitch) {
    let first = null, last = null;
    for (let y = 0; y <= height; y += dy) {
      if (sample(x, y, z) > 0) continue;
      first ??= y;
      last = y;
    }
    if (first === null) continue;
    rim.push([x, boundary(x, first, first - dy)], [x, boundary(x, last, last + dy)]);
  }
  const hull = convexHull(rim);
  if (hull.length < 3) return null;
  let twiceArea = 0, momentX = 0, momentY = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const area = cross2(...a, ...b);
    twiceArea += area;
    momentX += (a[0] + b[0]) * area;
    momentY += (a[1] + b[1]) * area;
  }
  const center = [momentX / (3 * twiceArea), momentY / (3 * twiceArea)];

  function boundary(x, inside, outside) {
    for (let iteration = 0; iteration < 7; iteration++) {
      const next = (inside + outside) / 2;
      if (sample(x, next, z) <= 0) inside = next;
      else outside = next;
    }
    return (inside + outside) / 2;
  }

  function radius(dx, dy) {
    let edgeDistance = Infinity;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i + 1) % hull.length];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const facing = cross2(dx, dy, ex, ey);
      if (facing <= 1e-9) continue;
      const rayDistance = cross2(a[0] - center[0], a[1] - center[1], ex, ey) / facing;
      edgeDistance = Math.min(edgeDistance, rayDistance);
    }
    return edgeDistance;
  }

  return { center, radius };
}
