import { DoubleSide, MeshBasicNodeMaterial, Vector2, Vector3, Vector4 } from 'three/webgpu';
import { attribute, cameraPosition, normalWorld, positionWorld, uniform, wgslFn } from 'three/tsl';
import { fabricShader } from './plain-knit.wgsl.js';

export function yarnRadiusM(denier, densityKgM3, packingFraction) {
  return Math.sqrt((denier * 0.001 / 9000) / (Math.PI * densityKgM3 * packingFraction));
}

export function createTextileMaterial(optics, diagnostics) {
  const mode = uniform(0);
  const pitch = uniform(new Vector2());
  const netPitch = uniform(new Vector2());
  const data = uniform(new Vector4());
  const tint = uniform(new Vector3());

  function setOptics(next) {
    const radius = yarnRadiusM(next.denier, next.fiberDensityKgM3, next.packingFraction);
    const bundle = next.net ? yarnRadiusM(next.net.bundleDenier, next.fiberDensityKgM3, next.packingFraction) : 0;
    pitch.value.fromArray(next.cellPitchM);
    netPitch.value.fromArray(next.net?.cellPitchM ?? next.cellPitchM);
    data.value.set(radius, next.relaxedRadiusM, Number(Boolean(next.net)), bundle);
    tint.value.fromArray(next.dyeLinear);
    return { radiusM: radius, netRadiusM: bundle };
  }
  const initial = setOptics(optics);
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true });
  material.fragmentNode = wgslFn(fabricShader)({
    materialUV: attribute('materialUV', 'vec2'),
    fields: attribute('clothFields', 'vec4'),
    cloth: attribute('clothDetails', 'vec4'),
    contactM: attribute('selfContact', 'float'),
    worldNormal: normalWorld,
    eye: cameraPosition.sub(positionWorld),
    pitch, netPitch, data, tint,
    mode,
    maxima: uniform(new Vector4(diagnostics.tensionNpmMax, diagnostics.strainMax, diagnostics.gapMmMax,
      diagnostics.selfContactMmMax))
  });
  return { material, mode, ...initial, setOptics };
}

export function normalOpacity(sample, optics, radiusM) {
  const [u, v] = optics.cellPitchM;
  const x = Math.max(0.00008, u * sample.stretchHoop * sample.restRadiusM / optics.relaxedRadiusM);
  const y = Math.max(0.00008, v * sample.stretchAxial);
  const length = 2 * (Math.hypot(x * 0.26, y * 0.22) + Math.hypot(x * 0.09, y * 0.40))
    + Math.hypot(x, y * 0.25);
  const plain = 1 - Math.exp(-0.93 * 2 * radiusM * length * sample.reinforcement / (x * y) - 0.018);
  if (!optics.net) return plain;
  const [a, b] = optics.net.cellPitchM;
  const bundle = yarnRadiusM(optics.net.bundleDenier, optics.fiberDensityKgM3, optics.packingFraction);
  const width = Math.min(0.96, 2 * bundle * Math.hypot(u / (x * a), v / (y * b)));
  const net = (1 - (1 - width) ** 2) * (1 - Math.exp(-2.65));
  const transition = Math.max(0, Math.min(1, (sample.reinforcement - 1.04) / 0.35));
  const solid = transition * transition * (3 - 2 * transition);
  return net + (plain - net) * solid;
}
