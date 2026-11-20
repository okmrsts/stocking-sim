import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';
import { mix } from './foot-profiles.js';

export function createFootNails(toes, skinField) {
  const positions = [], indices = [];
  const sectors = 28, rings = 5;
  for (const toe of toes) {
    const [length, breadth] = toe.nail;
    const centerZ = toe.tip[1] - length * 0.63;
    const depth = toe.tip[1] - toe.root[1];

    function vertex(radius, angle) {
      const sine = Math.sin(angle), cosine = Math.cos(angle);
      const z = centerZ + length * radius * Math.sign(sine) * Math.abs(sine) ** 0.78 / 2;
      const centerX = mix(toe.root[0], toe.tip[0], (z - toe.root[1]) / depth);
      const x = centerX + breadth * radius * Math.sign(cosine) * Math.abs(cosine) ** 0.78 / 2;
      let low = toe.bottom + toe.height * 0.46, high = 0.047;
      for (let i = 0; i < 14; i++) {
        const y = (low + high) / 2;
        if (skinField(x, y, z) <= 0) low = y;
        else high = y;
      }
      return positions.push(x, high + 0.00006 + 0.00020 * (1 - radius * radius), z) / 3 - 1;
    }

    const center = vertex(0, 0);
    const first = center + 1;
    for (let ring = 1; ring <= rings; ring++) {
      for (let sector = 0; sector < sectors; sector++) vertex(ring / rings, 2 * Math.PI * sector / sectors);
    }
    for (let sector = 0; sector < sectors; sector++) {
      const next = (sector + 1) % sectors;
      indices.push(center, first + next, first + sector);
      for (let ring = 1; ring < rings; ring++) {
        const low = first + sectors * (ring - 1), high = low + sectors;
        indices.push(low + sector, high + next, high + sector, low + sector, low + next, high + next);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
