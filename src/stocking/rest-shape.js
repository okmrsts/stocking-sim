const tau = 2 * Math.PI;
const gaussian = (value, center, width) => Math.exp(-Math.pow((value - center) / width, 2));
const smoothstep = (value, lo, hi) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

export function createKneeHighInput(surface, garment, level) {
  const { columns, rows } = level;
  const size = (columns + 1) * (rows + 1);
  const pairs = new Float32Array(size * 2);
  const input = new Float32Array(size * 16);
  const sampleStrideM = garment.topM / rows;
  const relaxedArc = new Float32Array(rows + 1);
  const arcs = Array.from({ length: rows + 1 }, (_, row) => row * sampleStrideM);
  const ease = arc => garment.axialEase + garment.axialEaseZones.reduce(
    (lengthRatio, zone) => lengthRatio + zone.lengthRatioDelta * gaussian(arc, zone.arcM, zone.widthM), 0
  );

  for (let row = 0; row <= rows; row++) {
    const arc = arcs[row];
    const rowEase = ease(arc);
    if (row) relaxedArc[row] = relaxedArc[row - 1] + ease(arc - sampleStrideM / 2) * sampleStrideM;
    const upperBand = smoothstep(arc, garment.topM - garment.cuffWidthM - 0.004, garment.topM - garment.cuffWidthM + 0.004);
    const reinforcedToe = 1 - smoothstep(arc, garment.toeEndM - 0.009, garment.toeEndM + 0.008);
    const reinforcement = 1 + (garment.cuffYarnCount - 1) * upperBand + (garment.toeYarnCount - 1) * reinforcedToe;

    // The toe of the unloaded sock narrows to close the end.
    const toeTaper = 0.52 + 0.48 * smoothstep(arc, 0, 0.030);
    const unloadedRadius = (garment.relaxedToeRadiusM
      + (garment.relaxedRadiusM - garment.relaxedToeRadiusM) * smoothstep(arc, 0.060, 0.220)) * toeTaper;

    for (let col = 0; col <= columns; col++) {
      const theta = tau * (col % columns) / columns;
      const node = row * (columns + 1) + col;
      const pos = surface.point(arc, theta);
      const normal = surface.normal(arc, theta);
      const circum = tau * garment.relaxedRadiusM * col / columns;

      // The two local derivatives measure actual contact-surface distances.
      const dc = distance(surface.point(arc, theta + 0.003), surface.point(arc, theta - 0.003)) / 0.006;
      const lo = Math.max(0, arc - 0.0006);
      const hi = arc + 0.0006;
      const ds = distance(surface.point(hi, theta), surface.point(lo, theta)) / (hi - lo);
      const hem = smoothstep(arc, 0.251, 0.295) * (1 - smoothstep(arc, garment.topM - garment.cuffWidthM - 0.009, garment.topM));
      input.set([
        ...pos, arc, ...normal, theta,
        dc / unloadedRadius, ds / rowEase, hem, reinforcement,
        1 + (garment.cuffStiffness - 1) * upperBand + 0.22 * reinforcedToe,
        dc, unloadedRadius, rowEase
      ], node * 16);
      pairs.set([circum, relaxedArc[row]], node * 2);
    }
  }
  return { input, materialCoordsM: pairs, columns, rows, relaxedArc, arcs };
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
