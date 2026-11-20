import { interpolate } from './swept-surface.js';

export const mix = (a, b, t) => a + (b - a) * t;

export function blend(value, low, high) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

export function smoothUnion(a, b, radius) {
  const amount = Math.max(0, radius - Math.abs(a - b));
  return Math.min(a, b) - amount * amount / (4 * radius);
}

export function sampleProfile(stations, pitch) {
  const first = stations[0][0], last = stations.at(-1)[0];
  const count = Math.ceil((last - first) / pitch);
  const step = (last - first) / count;
  const values = Array.from({ length: count + 1 }, (_, i) => interpolate(stations, first + i * step));
  return coordinate => {
    const row = Math.max(0, Math.min(count, (coordinate - first) / step));
    const index = Math.min(count - 1, Math.floor(row));
    const t = row - index;
    return values[index].map((value, axis) => mix(value, values[index + 1][axis], t));
  };
}
