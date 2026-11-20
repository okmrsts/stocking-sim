import { cross, difference, normalize } from './swept-surface.js';

const tau = 2 * Math.PI;
const mix = (a, b, t) => a + (b - a) * t;

export function wrapCompliantSurface(surface, field) {
  function point(arc, angle) {
    const base = surface.point(arc, angle);
    const depth = field.sample(arc, angle);
    if (depth === 0) return base;
    const { x, y, z } = surface.section(arc);
    const radial = normalize(difference(base, [x, y, z]));
    return base.map((coordinate, axis) => coordinate - depth * radial[axis]);
  }

  function normal(arc, angle) {
    if (arc < field.startArcM || arc >= field.endArcM) return surface.normal(arc, angle);
    const around = difference(point(arc, angle + 0.006), point(arc, angle - 0.006));
    const along = difference(point(arc + 0.0008, angle), point(arc - 0.0008, angle));
    return normalize(cross(around, along));
  }

  return { ...surface, point, normal };
}

export function updateTissueField(frame, config, sampleTissue, previous, elapsedS) {
  const { columns, rows, arcs, state } = frame;
  const { startArcM, spreadM, angularSpreadRad, relaxation, timeConstantS } = config;
  const blend = elapsedS === undefined ? relaxation : -Math.expm1(-Math.max(0, elapsedS) / timeConstantS);
  const step = arcs[1] - arcs[0];
  const extraRows = Math.ceil(3 * spreadM / step);
  const count = rows + extraRows + 1;
  const depths = new Float32Array(count * columns);
  const angular = kernel(angularSpreadRad / (tau / columns));
  const axial = kernel(spreadM / step);
  for (let row = 0; row <= rows; row++) {
    if (arcs[row] <= startArcM) continue;
    for (let col = 0; col < columns; col++) {
      let pressurePa = 0;
      for (const [offset, weight] of angular) {
        const index = row * (columns + 1) + (col + offset + columns) % columns;
        pressurePa += Math.max(0, state[index * 16 + 9]) * weight;
      }
      const [responseM, maxM] = sampleTissue(arcs[row], col * tau / columns);
      depths[row * columns + col] = maxM > 0 ? maxM * -Math.expm1(-(pressurePa / 1000) * responseM / maxM) : 0;
    }
  }

  const values = new Float32Array(depths.length);
  function along(row, col, weights) {
    let depth = 0;
    for (const [offset, weight] of weights) depth += (depths[(row + offset) * columns + col] ?? 0) * weight;
    return depth;
  }
  for (let row = 0; row < count; row++) {
    const arc = row * step;
    const gate = Math.max(0, Math.min(1, (arc - startArcM) / config.startFadeM));
    for (let col = 0; col < columns; col++) {
      const angle = col * tau / columns;
      // Spread the inward response across the edge of an applied load.
      const depth = along(row, col, axial);
      values[row * columns + col] = mix(previous?.sample(arc, angle) ?? 0,
        gate * gate * (3 - 2 * gate) * depth, blend);
    }
  }

  function sample(arc, angle) {
    if (arc <= startArcM || arc >= (count - 1) * step) return 0;
    const row = arc / step;
    const col = ((((angle % tau) + tau) % tau) / tau) * columns;
    const i = Math.min(count - 2, Math.floor(row)), j = Math.floor(col) % columns;
    const next = (j + 1) % columns;
    return mix(
      mix(values[i * columns + j], values[i * columns + next], col - Math.floor(col)),
      mix(values[(i + 1) * columns + j], values[(i + 1) * columns + next], col - Math.floor(col)), row - i
    );
  }

  return { sample, startArcM, endArcM: (count - 1) * step };
}

function kernel(sigma) {
  const radius = Math.ceil(3 * sigma);
  const weights = Array.from({ length: 2 * radius + 1 }, (_, i) => Math.exp(-0.5 * (((i - radius) / sigma) ** 2)));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((weight, i) => [i - radius, weight / sum]);
}
