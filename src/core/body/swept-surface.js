function limitedSlope(before, after) {
  if (before * after <= 0) return 0;
  return 2 * before * after / (before + after);
}

function interpolate(profile, arc) {
  let index = 0;
  while (index < profile.length - 2 && arc > profile[index + 1][0]) index++;
  const left = profile[index];
  const right = profile[index + 1];
  const prev = profile[Math.max(index - 1, 0)];
  const next = profile[Math.min(index + 2, profile.length - 1)];
  const span = right[0] - left[0];
  const t = Math.max(0, Math.min(1, (arc - left[0]) / span));
  const h = t * t * (3 - 2 * t);
  return left.slice(1).map((value, off) => {
    const channel = off + 1;
    const velocity = (right[channel] - value) / span;
    const lo = left === prev ? velocity : limitedSlope(velocity, (value - prev[channel]) / (left[0] - prev[0]));
    const hi = right === next ? velocity : limitedSlope(velocity, (next[channel] - right[channel]) / (next[0] - right[0]));
    return value + (right[channel] - value) * h + span * t * (1 - t) * (lo * (1 - t) - hi * t);
  });
}

export function createSweptSurface(profile, contour = () => 1) {
  function section(arc) {
    const [x, y, z, width, depth, pitch] = interpolate(profile, arc);
    return { x, y, z, width, depth, pitch };
  }

  function point(arc, angle) {
    const { x, y, z, width, depth, pitch } = section(arc);
    const scale = contour(arc, angle);
    const cross = scale * width * Math.sin(angle);
    const front = scale * depth * Math.cos(angle);
    return [x + cross, y + Math.sin(pitch) * front, z + Math.cos(pitch) * front];
  }

  function normal(arc, angle) {
    const dc = difference(point(arc, angle + 0.002), point(arc, angle - 0.002));
    const ds = difference(point(arc + 0.0002, angle), point(arc - 0.0002, angle));
    return normalize(cross(dc, ds));
  }

  return { point, normal, length: profile.at(-1)[0] };
}

export function difference(a, b) {
  return a.map((value, index) => value - b[index]);
}

export function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function normalize(values) {
  const magnitude = Math.hypot(...values);
  return magnitude > 0 ? values.map(value => value / magnitude) : [0, 0, 1];
}
