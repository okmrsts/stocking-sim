import { DoubleSide, MeshBasicNodeMaterial, Vector2, Vector3, Vector4 } from 'three/webgpu';
import { attribute, cameraPosition, normalWorld, positionWorld, uniform, wgslFn } from 'three/tsl';
import { fabricShader } from './plain-knit.wgsl.js';

export function yarnRadiusM(denier, densityKgM3, packingFraction) {
  return Math.sqrt((denier * 0.001 / 9000) / (Math.PI * densityKgM3 * packingFraction));
}

export function createTextileMaterial(optics, diagnostics) {
  const radiusM = yarnRadiusM(optics.denier, optics.fiberDensityKgM3, optics.packingFraction);
  const mode = uniform(0);
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true });
  material.fragmentNode = wgslFn(fabricShader)({
    materialUV: attribute('materialUV', 'vec2'),
    fields: attribute('clothFields', 'vec4'),
    cloth: attribute('clothDetails', 'vec4'),
    contactM: attribute('selfContact', 'float'),
    worldNormal: normalWorld,
    eye: cameraPosition.sub(positionWorld),
    pitch: uniform(new Vector2(...optics.cellPitchM)),
    data: uniform(new Vector4(radiusM, optics.relaxedRadiusM, 0, 0)),
    tint: uniform(new Vector3(...optics.dyeLinear)),
    mode,
    maxima: uniform(new Vector4(diagnostics.tensionNpmMax, diagnostics.strainMax, diagnostics.gapMmMax,
      diagnostics.selfContactMmMax))
  });
  return { material, mode, radiusM };
}

export function normalOpacity(sample, optics, radiusM) {
  const [u, v] = optics.cellPitchM;
  const x = Math.max(0.00008, u * sample.stretchHoop * sample.restRadiusM / optics.relaxedRadiusM);
  const y = Math.max(0.00008, v * sample.stretchAxial);
  const length = 2 * (Math.hypot(x * 0.26, y * 0.22) + Math.hypot(x * 0.09, y * 0.40))
    + Math.hypot(x, y * 0.25);
  return 1 - Math.exp(-0.93 * 2 * radiusM * length * sample.reinforcement / (x * y) - 0.018);
}
