import { Color, Float32BufferAttribute } from 'three/webgpu';

export function addTissueColors(geometry, tissueMap, { colorLow, colorMiddle, colorHigh, maxMmPerKpa }) {
  if (geometry.hasAttribute('color')) return;
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const stops = [colorLow, colorMiddle, colorHigh].map(color => new Color(color));
  const color = new Color();
  for (let id = 0; id < positions.count; id++) {
    const [responseM] = tissueMap.samplePoint(positions.getX(id), positions.getY(id), positions.getZ(id));
    const value = Math.min(2, (2 * 1000 * responseM) / maxMmPerKpa);
    const segment = Math.min(1, Math.floor(value));
    color.lerpColors(stops[segment], stops[segment + 1], value - segment);
    color.toArray(colors, id * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
}
