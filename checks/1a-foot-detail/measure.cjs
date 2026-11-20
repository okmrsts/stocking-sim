async function measureFootAnatomy() {
  const { foot, nails } = window.stockingStage1a.lowerBody;
  const { footAnatomy } = await import('/src/config/foot-anatomy.js');
  const xyz = foot.getAttribute('position').array;
  const faces = foot.getIndex().array;
  foot.computeBoundingBox();
  const { min, max } = foot.boundingBox;
  const length = max.z - min.z;

  function cut(project, offset) {
    const segments = [];
    for (let t = 0; t < faces.length; t += 3) {
      const intersections = [];
      for (let side = 0; side < 3; side++) {
        const a = 3 * faces[t + side], b = 3 * faces[t + (side + 1) % 3];
        const before = project(xyz[a], xyz[a + 1], xyz[a + 2]) - offset;
        const after = project(xyz[b], xyz[b + 1], xyz[b + 2]) - offset;
        if ((before < 0) === (after < 0)) continue;
        const ratio = before / (before - after);
        intersections.push([0, 1, 2].map(k => xyz[a + k] + ratio * (xyz[b + k] - xyz[a + k])));
      }
      if (intersections.length === 2) segments.push(intersections);
    }
    return segments;
  }

  const acrossZ = (x, y, z) => z, acrossX = x => x, acrossY = (x, y) => y;
  const extent = values => Math.max(...values) - Math.min(...values);
  const slope = 1 / Math.tan(footAnatomy.ball.angle);
  const ball = cut((x, y, z) => z + slope * x, 0.106);
  const ballWidth = extent(ball.flat().map(([x, , z]) => (x - slope * z) / Math.hypot(1, slope)));
  const ballProjectedWidth = extent(ball.flat().map(([x]) => x));
  const ballGirth = ball.reduce((sum, [a, b]) => sum + Math.hypot(...a.map((value, axis) => value - b[axis])), 0);
  const instep = cut(acrossZ, min.z + 0.50 * length).flat();
  const heel = cut(acrossZ, min.z + 0.16 * length).flat().filter(p => p[1] < 0.046);
  const medialArch = cut(acrossZ, 0.046).flat();
  const underside = x => Math.min(...medialArch.filter(p => Math.abs(p[0] - x) < 0.002).map(p => p[1]));
  const malleoli = footAnatomy.malleoli.map(([side, cy, cz]) => {
    let peak;
    for (let i = 0; i < xyz.length; i += 3) {
      const x = xyz[i], y = xyz[i + 1], z = xyz[i + 2];
      if (Math.abs(y - cy) > 0.011 || Math.abs(z - cz) > 0.011) continue;
      if (!peak || side * x > side * peak[0]) peak = [x, y, z];
    }
    return (peak[1] - min.y) * 1000;
  });
  const tendonZ = y => Math.min(...cut(acrossY, y).flat().filter(p => Math.abs(p[0]) < 0.008).map(p => p[2]));
  const toes = footAnatomy.toes.map(({ root, tip, pad }) => {
    const [x, tipZ] = tip;
    const longestZ = Math.max(...cut(acrossX, x).flat().map(p => p[2]));
    const z = root[1] + pad * (tipZ - root[1]);
    const points = cut(acrossZ, z).flat().filter(p => Math.abs(p[0] - x) < 0.012);
    return { heelToTipMm: 1000 * (longestZ - min.z), padHeightMm: 1000 * extent(points.map(p => p[1])) };
  });

  function findGap(first, next) {
    let widest = 0;
    for (let delta = 0.001; delta <= 0.008; delta += 0.0005) {
      const z = Math.min(first.tip[1], next.tip[1]) - delta;
      const spans = cut(acrossZ, z).map(([a, b]) => [Math.min(a[0], b[0]), Math.max(a[0], b[0])])
        .sort((a, b) => a[0] - b[0]);
      const occupied = [];
      for (const span of spans) {
        const end = occupied.at(-1);
        if (end && span[0] <= end[1] + 1e-7) end[1] = Math.max(end[1], span[1]);
        else occupied.push(span);
      }
      const a = occupied.find(span => span[0] <= first.tip[0] && span[1] >= first.tip[0]);
      const b = occupied.find(span => span[0] <= next.tip[0] && span[1] >= next.tip[0]);
      if (a && b) widest = Math.max(widest, b[0] - a[1]);
    }
    return widest * 1000;
  }

  return {
    lengthMm: length * 1000,
    heelBreadthMm: 1000 * extent(heel.map(p => p[0])),
    ballCutBreadthMm: 1000 * ballWidth,
    ballProjectedBreadthMm: 1000 * ballProjectedWidth,
    ballCutGirthMm: 1000 * ballGirth,
    instepHeightMm: 1000 * (Math.max(...instep.map(p => p[1])) - min.y),
    medialArchLiftMm: 1000 * (underside(-0.017) - underside(0.018)),
    achillesInsetMm: 1000 * (tendonZ(0.085) - tendonZ(0.027)),
    lateralMalleolusMm: malleoli[0],
    medialMalleolusMm: malleoli[1],
    toes,
    gapsMm: footAnatomy.toes.slice(1).map((toe, i) => findGap(footAnatomy.toes[i], toe)),
    nailTriangles: nails.getIndex().count / 3
  };
}

module.exports = { measureFootAnatomy };
