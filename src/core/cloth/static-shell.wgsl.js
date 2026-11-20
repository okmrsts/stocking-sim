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
  contact: vec4<f32>,
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
@group(0) @binding(4) var<storage, read_write> projected: array<vec4<f32>>;

const tau: f32 = 6.283185307;

const foldPath = array<vec2<f32>, 9>(
  vec2<f32>(0.0, 0.0), vec2<f32>(0.15, 0.025), vec2<f32>(0.39, 0.09),
  vec2<f32>(0.65, 0.34), vec2<f32>(0.62, 0.46), vec2<f32>(0.47, 0.49),
  vec2<f32>(0.55, 0.56), vec2<f32>(0.79, 0.29), vec2<f32>(1.0, 0.0)
);

fn foldStrength(point: PointInput) -> f32 {
  let ease = max(0.0, 1.0 - point.contactMetric.y);
  let threshold = config.shell.z + 0.017 * max(0.0, point.contactMetric.x - 1.0);
  return smoothstep(0.025, 0.12, ease - threshold) * point.contactMetric.z;
}

fn fitPoint(index: u32) -> vec4<f32> {
  let p = source[index];
  let extent = config.shell.y;
  let cycle = fract(p.surfacePoint.w / extent + 0.12 * sin(p.surfaceNormal.w * 2.0));
  let amount = foldStrength(p);
  let selectIndex = min(7u, u32(floor(cycle * 8.0)));
  let fraction = cycle * 8.0 - f32(selectIndex);
  let section = mix(foldPath[selectIndex], foldPath[selectIndex + 1u], smoothstep(0.0, 1.0, fraction));
  let slack = max(0.0, 1.0 - p.contactMetric.y - config.shell.z);
  let smallBuckle = 0.43 * extent / tau * sqrt(slack) * (0.5 - 0.5 * cos(cycle * tau));
  let height = mix(smallBuckle * p.contactMetric.z, config.shell.w * section.y, amount);
  let gap = config.shell.x + min(config.shell.w, height);
  let stride = config.mesh.y;
  let row = index / stride;
  let col = index % stride;
  let shiftRows = amount * (section.x - cycle) * extent / config.hardening.w;
  let sampleRow = clamp(f32(row) + shiftRows, 0.0, f32(config.mesh.z));
  let low = u32(floor(sampleRow));
  let high = min(low + 1u, config.mesh.z);
  let lo = source[low * stride + col];
  let hi = source[high * stride + col];
  let alpha = sampleRow - f32(low);
  let base = mix(lo.surfacePoint.xyz, hi.surfacePoint.xyz, alpha);
  let normal = normalize(mix(lo.surfaceNormal.xyz, hi.surfaceNormal.xyz, alpha));
  return vec4<f32>(base + normal * gap, gap);
}

@compute @workgroup_size(64)
fn fit(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= config.mesh.x) { return; }
  displaced[id.x] = fitPoint(id.x);
}

@compute @workgroup_size(64)
fn separateContact(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index >= config.mesh.x) { return; }
  let stride = config.mesh.y;
  let row = index / stride;
  let col = index % stride;
  let p = displaced[index];
  projected[index] = p;
  if (row < 3u || row + 3u > config.mesh.z || foldStrength(source[index]) < 0.36) { return; }

  // Compare non-neighbor segments in the same meridian plane. Only an outer
  // layer moves, so projection cannot push a fabric layer into the body.
  let normal = normalize(source[index].surfaceNormal.xyz);
  let along = source[index + stride].surfacePoint.xyz - source[index - stride].surfacePoint.xyz;
  let tangent = normalize(along - normal * dot(along, normal));
  let crosswise = normalize(cross(normal, tangent));
  var pushOut = 0.0;
  for (var offset = -12; offset <= 12; offset++) {
    let otherRow = i32(row) + offset;
    if (abs(offset) < 3 || otherRow < 0 || otherRow >= i32(config.mesh.z)) { continue; }
    let other = u32(otherRow) * stride + col;
    let lo = displaced[other].xyz - p.xyz;
    let hi = displaced[other + stride].xyz - p.xyz;
    let u = dot(lo, tangent);
    let v = dot(hi, tangent);
    if (u * v > 0.0 || abs(u - v) < 1e-7) { continue; }
    let closest = mix(lo, hi, clamp(u / (u - v), 0.0, 1.0));
    if (abs(dot(closest, crosswise)) > 0.0010) { continue; }
    let radial = -dot(closest, normal);
    if (radial > 0.0 && radial < config.hardening.z) {
      pushOut = max(pushOut, config.hardening.z - radial);
    }
  }
  projected[index] = vec4<f32>(p.xyz + normal * pushOut, p.w + pushOut);
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
  let bodyAxis = source[upper].surfacePoint.xyz - source[lower].surfacePoint.xyz;
  let clothAxis = displaced[upper].xyz - displaced[lower].xyz;
  let reversed = select(0.0, 1.0, foldStrength(p) >= 0.36 && dot(bodyAxis, clothAxis) < 0.0);
  result[index].contact = vec4<f32>(max(0.0, gapM - fitPoint(index).w), foldStrength(p), reversed, 0.0);
}
`;
