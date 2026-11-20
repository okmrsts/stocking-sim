export const shellShader = /* wgsl */ `
struct PointInput {
  surfacePoint: vec4<f32>,
  surfaceNormal: vec4<f32>,
  contactMetric: vec4<f32>,
  restProperties: vec4<f32>,
}

struct PointResult {
  position: vec4<f32>,
  fields: vec4<f32>,
  details: vec4<f32>,
}

struct Controls {
  mesh: vec4<u32>,
  shell: vec4<f32>,
  elasticity: vec4<f32>,
  hardening: vec4<f32>,
}

@group(0) @binding(0) var<storage, read> source: array<PointInput>;
@group(0) @binding(1) var<storage, read_write> displaced: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> result: array<PointResult>;
@group(0) @binding(3) var<uniform> config: Controls;

const tau: f32 = 6.283185307;

@compute @workgroup_size(64)
fn fit(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= config.mesh.x) { return; }
  let p = source[id.x];
  let stretchHoop = p.contactMetric.x;
  let stretchAxial = p.contactMetric.y;
  let ease = max(0.0, 1.0 - stretchAxial);
  let threshold = config.shell.z + 0.017 * max(0.0, stretchHoop - 1.0);
  // For w = A/2 (1 + cos(2 pi s/L)), mean excess length is (A pi/L)^2/4.
  let amplitude = min(config.shell.w, 4.0 * config.shell.y / tau * sqrt(max(0.0, ease - threshold)))
    * p.contactMetric.z;
  let phase = tau * p.surfacePoint.w / config.shell.y + 0.48 * sin(p.surfaceNormal.w * 2.0);
  let gap = config.shell.x + amplitude * (0.5 + 0.5 * cos(phase));
  displaced[id.x] = vec4<f32>(p.surfacePoint.xyz + p.surfaceNormal.xyz * gap, gap);
}

fn lengthRatio(lo: u32, hi: u32, metric: f32) -> f32 {
  let original = max(1e-6, length(source[hi].surfacePoint.xyz - source[lo].surfacePoint.xyz));
  let current = length(displaced[hi].xyz - displaced[lo].xyz);
  return metric * current / original;
}

fn membraneForce(strain: f32, modulus: f32, hardening: f32) -> f32 {
  let extension = max(0.0, strain);
  return modulus * extension * (1.0 + hardening * extension * extension);
}

@compute @workgroup_size(64)
fn measure(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index >= config.mesh.x) { return; }
  let stride = config.mesh.y;
  let row = index / stride;
  let col = index % stride;
  let ringStart = row * stride;
  let ringCount = stride - 1u;
  let prev = ringStart + (col + ringCount - 1u) % ringCount;
  let next = ringStart + (col + 1u) % ringCount;
  let lower = select(index, index - stride, row > 0u);
  let upper = select(index, index + stride, row < config.mesh.z);
  let p = source[index];
  let hoop = lengthRatio(prev, next, p.contactMetric.x);
  let axial = lengthRatio(lower, upper, p.contactMetric.y);
  let hoopT = membraneForce(hoop - 1.0 + config.elasticity.x * (axial - 1.0),
    config.elasticity.y * p.restProperties.x, config.hardening.x);
  let axialT = membraneForce(axial - 1.0 + config.elasticity.x * (hoop - 1.0),
    config.elasticity.z * p.restProperties.x, config.hardening.y);
  let gapM = displaced[index].w;
  let contact = 1.0 - smoothstep(config.shell.x + 0.00004, config.shell.x + 0.00038, gapM);
  let pressure = contact * hoopT / max(0.004, p.restProperties.y);
  result[index].position = displaced[index];
  result[index].fields = vec4<f32>(hoop, axial, hoopT, axialT);
  result[index].details = vec4<f32>(gapM, pressure, p.contactMetric.w, p.restProperties.z);
}
`;
