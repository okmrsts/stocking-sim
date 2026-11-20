function measureCuff() {
  const app = window.stockingStage1a;
  const { bare, loaded, textile, halfStanceM, tissueField } = app.lowerBody;
  const garment = textile.children[0].geometry;
  const position = garment.getAttribute('position').array;
  const index = garment.getIndex().array;
  const material = garment.getAttribute('materialUV');
  const bandStartY = 0.640, rimStartY = 0.670;
  const pitch = 0.004;
  let upperY = 0;
  for (let i = 1; i < position.length; i += 3) upperY = Math.max(upperY, position[i]);

  // Intersect the actual rendered triangles with a horizontal ray from inside the leg.
  function sections(geometry) {
    const coords = geometry.getAttribute('position').array;
    const faces = geometry.getIndex().array;
    const bins = Array.from({ length: Math.ceil((0.73 - bandStartY) / pitch) }, () => []);
    for (let i = 0; i < faces.length; i += 3) {
      const a = 3 * faces[i], b = 3 * faces[i + 1], c = 3 * faces[i + 2];
      if (Math.max(coords[a], coords[b], coords[c]) <= 0) continue;
      const low = Math.max(0, Math.floor((Math.min(coords[a+1], coords[b+1], coords[c+1]) - bandStartY) / pitch));
      const high = Math.min(bins.length - 1, Math.floor((Math.max(coords[a+1], coords[b+1], coords[c+1]) - bandStartY) / pitch));
      for (let k = low; k <= high; k++) bins[k].push([a,b,c]);
    }
    return function radius(y, dx, dz) {
      const faces = bins[Math.floor((y - bandStartY) / pitch)];
      let nearest = Infinity;
      for (const face of faces) {
        const crossing = [];
        for (let j = 0; j < 3; j++) {
          const a = face[j], b = face[(j + 1) % 3];
          const ya = coords[a+1] - y, yb = coords[b+1] - y;
          if ((ya < 0) === (yb < 0)) continue;
          const t = ya / (ya - yb);
          crossing.push([coords[a] + t * (coords[b] - coords[a]) - halfStanceM,
            coords[a+2] + t * (coords[b+2] - coords[a+2])]);
        }
        if (crossing.length !== 2) continue;
        const [[ax, az], [bx, bz]] = crossing;
        const sideA = ax * dz - az * dx, sideB = bx * dz - bz * dx;
        if ((sideA < 0) === (sideB < 0)) continue;
        const t = sideA / (sideA - sideB);
        const hit = dx * (ax + t * (bx - ax)) + dz * (az + t * (bz - az));
        if (hit >= 0) nearest = Math.min(hit, nearest);
      }
      return nearest;
    };
  }

  const skinRadius = sections(loaded);
  const bareRadius = sections(bare);
  const band = { samples: 0, throughSkin: 0, minimumMm: Infinity, maximumMm: -Infinity };
  const rim = { ...band };
  const rear = { maximumOutwardMm: 0, maximumInwardMm: 0 };
  const ring = { ...band };
  function add(stats, gapMm) {
    stats.samples++;
    if (gapMm < -1e-4) stats.throughSkin++;
    stats.minimumMm = Math.min(stats.minimumMm, gapMm);
    stats.maximumMm = Math.max(stats.maximumMm, gapMm);
  }

  const triangleSamples = [[1/3, 1/3, 1/3], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]];
  for (let i = 0; i < index.length; i += 3) {
    const points = [index[i], index[i+1], index[i+2]].map(id => 3 * id);
    if (points.every(id => position[id+1] < bandStartY)) continue;
    for (const weights of triangleSamples) {
      const [x, y, z] = [0, 1, 2].map(axis => points.reduce((sum, id, p) => sum + weights[p] * position[id + axis], 0));
      if (y < bandStartY) continue;
      const r = Math.hypot(x,z);
      const gapMm = 1000 * (r - skinRadius(y,x/r,z/r));
      add(band, gapMm);
      if (y >= rimStartY) add(rim, gapMm);
    }
  }
  // Skip the toe-cap center appended after the last circumferential ring.
  const lastNode = material.count - 2;
  const rimArc = material.getY(lastNode);
  for (let node = lastNode; node >= 0 && material.getY(node) === rimArc; node--) {
    const [x,y,z] = position.subarray(node * 3, node * 3 + 3);
    const r = Math.hypot(x,z);
    add(ring, 1000 * (r - skinRadius(y,x/r,z/r)));
  }
  const tissue = [];
  for (let y = 0.650; y <= 0.720; y += 0.001) {
    const offsetMm = 1000 * (skinRadius(y,0,-1) - bareRadius(y,0,-1));
    if (y >= upperY) {
      rear.maximumOutwardMm = Math.max(rear.maximumOutwardMm, offsetMm);
      rear.maximumInwardMm = Math.max(rear.maximumInwardMm, -offsetMm);
    }
    tissue.push([Math.round(y * 1000), Math.round(offsetMm * 100) / 100]);
  }
  return { band, rim, ring, rear, upperY, pressurePa: app.samples.cuff.pressurePa,
    compressionMm: tissueField.sample(0.844, 0.2) * 1000, profile: tissue };
}
module.exports = { measureCuff };
