export const cross2 = (ax, ay, bx, by) => ax * by - ay * bx;

export function convexHull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  function chain(ordered) {
    const path = [];
    for (const p of ordered) {
      while (path.length >= 2) {
        const a = path.at(-2), b = path.at(-1);
        if (cross2(b[0] - a[0], b[1] - a[1], p[0] - b[0], p[1] - b[1]) > 0) break;
        path.pop();
      }
      path.push(p);
    }
    return path.slice(0, -1);
  }
  return [...chain(sorted), ...chain(sorted.reverse())];
}
