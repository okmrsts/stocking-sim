export function measureFootFit(cloth, skin, footDistance, footLimitM) {
  const positions = cloth.getAttribute('position');
  const triangles = cloth.getIndex().array;
  const clothBounds = forefootBounds(positions);
  const skinPositions = skin.getAttribute('position');
  const skinBounds = forefootBounds(skinPositions);
  let samples = 0, insideSkin = 0, minFieldMm = Infinity, closestPointM;
  let bendSamples = 0, reversedAtBend = 0;
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i], b = triangles[i + 1], c = triangles[i + 2];
    const y = (positions.getY(a) + positions.getY(b) + positions.getY(c)) / 3;
    if (y > footLimitM - 0.003) continue;
    const x = (positions.getX(a) + positions.getX(b) + positions.getX(c)) / 3;
    const z = (positions.getZ(a) + positions.getZ(b) + positions.getZ(c)) / 3;
    const fieldMm = footDistance(x, y, z) * 1000;
    samples++;
    if (fieldMm < -0.1) insideSkin++;
    if (fieldMm < minFieldMm) {
      minFieldMm = fieldMm;
      closestPointM = [x, y, z];
    }
    if (y > 0.065 && y < 0.109 && z > 0.004) {
      bendSamples++;
      if (isReversed(positions, a, b, c, [x, y, z], footDistance)) reversedAtBend++;
    }
  }
  const skinTriangles = skin.getIndex().array;
  const instep = [0.065, 0.085, 0.100, 0.115].map(z => {
    const wornY = topAt(positions, triangles, z, footLimitM);
    const skinY = topAt(skinPositions, skinTriangles, z, footLimitM);
    return { zMm: z * 1000, verticalGapMm: (wornY - skinY) * 1000 };
  });
  return {
    clothWidthMm: clothBounds.widthMm,
    skinWidthMm: skinBounds.widthMm,
    tipOverhangMm: (clothBounds.maxZ - skinBounds.maxZ) * 1000,
    triangleCenters: { samples, insideSkin, minFieldMm, closestPointM },
    ankleBend: { samples: bendSamples, reversedTriangles: reversedAtBend },
    instep
  };
}

function isReversed(positions, a, b, c, point, sample) {
  const [x, y, z] = point;
  const step = 0.0001;
  const gx = sample(x + step, y, z) - sample(x - step, y, z);
  const gy = sample(x, y + step, z) - sample(x, y - step, z);
  const gz = sample(x, y, z + step) - sample(x, y, z - step);
  const ux = positions.getX(b) - positions.getX(a), vx = positions.getX(c) - positions.getX(a);
  const uy = positions.getY(b) - positions.getY(a), vy = positions.getY(c) - positions.getY(a);
  const uz = positions.getZ(b) - positions.getZ(a), vz = positions.getZ(c) - positions.getZ(a);
  return gx * (uy * vz - uz * vy) + gy * (uz * vx - ux * vz) + gz * (ux * vy - uy * vx) < 0;
}

function topAt(positions, triangles, z, limitY) {
  let top = -Infinity;
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i], b = triangles[i + 1], c = triangles[i + 2];
    const ax = positions.getX(a), az = positions.getZ(a);
    const ux = positions.getX(b) - ax, uz = positions.getZ(b) - az;
    const vx = positions.getX(c) - ax, vz = positions.getZ(c) - az;
    const area = ux * vz - vx * uz;
    if (Math.abs(area) < 1e-12) continue;
    const s = (-ax * vz - (z - az) * vx) / area;
    const t = ((z - az) * ux + ax * uz) / area;
    if (s < 0 || t < 0 || s + t > 1) continue;
    const y = (1 - s - t) * positions.getY(a) + s * positions.getY(b) + t * positions.getY(c);
    if (y < limitY) top = Math.max(top, y);
  }
  return top;
}

function forefootBounds(positions) {
  let minX = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    const z = positions.getZ(i);
    if (z < 0.10) continue;
    const x = positions.getX(i);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    maxZ = Math.max(maxZ, z);
  }
  return { widthMm: (maxX - minX) * 1000, maxZ };
}
