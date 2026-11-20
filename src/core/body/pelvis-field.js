import { interpolate } from './swept-surface.js';
import { foldInset, includeGlutealVolume, posteriorInset } from './gluteal-field.js';

const tau = 2 * Math.PI;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const gaussian = (value, width) => Math.exp(-((value / width) ** 2));

function smoothMinimum(a, b, radius) {
  const overlap = Math.max(0, radius - Math.abs(a - b));
  return Math.min(a, b) - overlap * overlap / (4 * radius);
}

export function createPelvisField(surface, config) {
  const { pelvisSections, halfStanceM, joinArc, crotchY, crotchZ, thighRootY, pelvisBlendM, navel, gluteal } = config;
  const startY = surface.section(joinArc).y;
  const topY = pelvisSections.at(-1)[0];
  const rows = Math.ceil((topY - startY) / 0.002);
  const step = (topY - startY) / rows;
  const columns = 128;
  const angleStep = tau / columns;
  const radii = new Float32Array((rows + 1) * columns);
  const body = [], centers = [];
  for (let row = 0; row <= rows; row++) {
    const y = startY + row * step;
    const arc = arcAtHeight(surface, joinArc, y);
    const { x, z } = surface.section(arc);
    centers.push([x + halfStanceM, z]);
    body.push(interpolate(pelvisSections, y));
    const polar = Array.from({ length: 256 }, (_, i) => {
      const p = surface.point(arc, tau * i / 256);
      const dx = p[0] - x, dz = p[2] - z;
      return [(Math.atan2(dx, dz) + tau) % tau, Math.hypot(dx, dz)];
    }).sort((a, b) => a[0] - b[0]);
    polar.unshift([polar.at(-1)[0] - tau, polar.at(-1)[1]]);
    polar.push([polar[1][0] + tau, polar[1][1]]);
    let segment = 0;
    for (let col = 0; col < columns; col++) {
      const angle = col * angleStep;
      while (polar[segment + 1][0] < angle) segment++;
      const [a, start] = polar[segment], [b, end] = polar[segment + 1];
      radii[row * columns + col] = mix(start, end, (angle - a) / (b - a));
    }
  }

  function sample(x, y, z) {
    z -= foldInset(x, y, z, gluteal);
    const row = clamp((y - startY) / step, 0, rows);
    const i = Math.min(rows - 1, Math.floor(row)), t = row - i;
    const absoluteX = Math.abs(x);

    const a = body[i], b = body[i + 1];
    const halfWidth = mix(a[0], b[0], t);
    const front = mix(a[1], b[1], t);
    const back = mix(a[2], b[2], t);
    const exponent = mix(a[3], b[3], t);
    const centerZ = (front + back) / 2;
    const depth = (front - back) / 2;
    const zComponent = (z - centerZ) / depth;
    const frontDetail = zComponent > 0 ? navel : gluteal.cleft;
    const indentation = frontDetail.depthM * gaussian(x, frontDetail.widthM)
      * gaussian(y - frontDetail.yM, frontDetail.heightM) * Math.min(1, Math.abs(zComponent) ** 4);
    const torso = (Math.pow(Math.pow(absoluteX / halfWidth, exponent) + Math.pow(Math.abs(zComponent), exponent), 1 / exponent) - 1)
      * depth + indentation + posteriorInset(y, z, gluteal);
    const span = z >= crotchZ ? front - crotchZ : crotchZ - back;
    const endLift = z >= crotchZ ? 0.030 : 0.043;
    const undersideY = crotchY + endLift * Math.pow(clamp(Math.abs(z - crotchZ) / span, 0, 1.3), 1.55)
      + 0.018 * (absoluteX / halfWidth) ** 2;
    const pelvis = -smoothMinimum(-torso, y - undersideY, 0.035);
    if (y > thighRootY + pelvisBlendM) return includeGlutealVolume(pelvis, x, y, z, gluteal);

    const thighX = mix(centers[i][0], centers[i + 1][0], t);
    const thighZ = mix(centers[i][1], centers[i + 1][1], t);
    const dz = z - thighZ;
    function thigh(dx) {
      const angle = (Math.atan2(dx, dz) + tau) % tau / angleStep;
      const col = Math.floor(angle) % columns, next = (col + 1) % columns, w = angle % 1;
      const r = mix(mix(radii[i * columns + col], radii[i * columns + next], w),
        mix(radii[(i + 1) * columns + col], radii[(i + 1) * columns + next], w), t);
      return -smoothMinimum(r - Math.hypot(dx, dz), thighRootY - y, 0.016);
    }
    const right = thigh(absoluteX - thighX);
    // Limit the medial blend to the region where the inner thighs approach the pelvis.
    const unionRadius = 0.003 + 0.014 * clamp((y - (crotchY - 0.028)) / 0.042, 0, 1);
    const legs = absoluteX < 0.035 ? smoothMinimum(right, thigh(-absoluteX - thighX), unionRadius) : right;
    return includeGlutealVolume(smoothMinimum(legs, pelvis, pelvisBlendM), x, y, z, gluteal);
  }

  return { sample, startY, topY };
}

function arcAtHeight(surface, first, height) {
  let lo = first, hi = surface.length;
  for (let step = 0; step < 18; step++) {
    const mid = (lo + hi) / 2;
    if (surface.section(mid).y < height) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
