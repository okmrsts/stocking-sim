const clampUnit = value => Math.max(0, Math.min(1, value));
const gaussian = (value, width) => Math.exp(-((value / width) ** 2));

function transition(value, start, end) {
  const t = clampUnit((value - start) / (end - start));
  return t ** 3 * (t * (6 * t - 15) + 10);
}

function smoothMinimum(a, b, radius) {
  const overlap = Math.max(0, 1 - Math.abs(a - b) / radius);
  return Math.min(a, b) - radius * overlap ** 3 / 6;
}

export function posteriorInset(y, z, config) {
  const [bottom, top] = config.torsoTransitionYM;
  const [front, back] = config.torsoTransitionDepthM;
  return config.lowerTorsoInsetM * (1 - transition(y, bottom, top)) * transition(-z, front, back);
}

export function foldInset(x, y, z, { fold }) {
  const lateral = Math.abs(x);
  const [innerStart, innerEnd] = fold.insideXM;
  const [outerStart, outerEnd] = fold.outsideXM;
  const [front, back] = fold.posteriorDepthM;
  const reach = transition(lateral, innerStart, innerEnd) * (1 - transition(lateral, outerStart, outerEnd));
  const creaseY = fold.yM + (lateral - fold.centerXM) * fold.risePerM;
  return fold.depthM * reach * gaussian(y - creaseY, fold.widthM) * transition(-z, front, back);
}

export function includeGlutealVolume(field, x, y, z, config) {
  const { lobeCenterM: [cx, cy, cz], lobeRadiiM: [rx, ry, rz], sagittalSlope, blendM,
    midlineBlendM, lobeFrontZM, lobeFrontBlendM } = config;
  const lateral = Math.abs(x);
  const vertical = (y - cy) / ry;
  const posterior = (z - cz - (y - cy) * sagittalSlope) / rz;
  const nearLobe = (Math.hypot((lateral - cx) / rx, vertical, posterior) - 1) * rz;
  const farLobe = (Math.hypot((lateral + cx) / rx, vertical, posterior) - 1) * rz;
  const lobe = smoothMinimum(nearLobe, farLobe, midlineBlendM);
  // Keep the lobe behind the frontal half of the pelvis.
  const posteriorLobe = -smoothMinimum(-lobe, lobeFrontZM - z, lobeFrontBlendM);
  return smoothMinimum(field, posteriorLobe, blendM);
}
