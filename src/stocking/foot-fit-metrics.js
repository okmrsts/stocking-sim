export function measureFootFit(cloth, skin, footDistance, footLimitM) {
  const positions = cloth.getAttribute('position');
  const triangles = cloth.getIndex().array;
  const clothBounds = forefootBounds(positions);
  const skinBounds = forefootBounds(skin.getAttribute('position'));
  let samples = 0, insideSkin = 0, minFieldMm = Infinity, closestPointM;
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
  }
  return {
    clothWidthMm: clothBounds.widthMm,
    skinWidthMm: skinBounds.widthMm,
    tipOverhangMm: (clothBounds.maxZ - skinBounds.maxZ) * 1000,
    triangleCenters: { samples, insideSkin, minFieldMm, closestPointM }
  };
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
