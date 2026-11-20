import { drapeChain } from './drape-chain.wgsl.js';

export const guidedShell = /* wgsl */ `
struct Node {
  fitted: vec4<f32>,
  normal: vec4<f32>,
  rest: vec4<f32>,
  optics: vec4<f32>,
  completed: vec4<f32>,
}
struct Knobs {
  grid: vec4<u32>,
  motion: vec4<f32>,
  fit: vec4<f32>,
  drape: vec4<f32>,
  cloth: vec4<f32>,
  clock: vec4<u32>,
  physics: vec4<f32>,
  packing: vec4<f32>,
}
struct Result {
  position: vec4<f32>,
  fields: vec4<f32>,
  details: vec4<f32>,
  contact: vec4<f32>,
}
@group(0) @binding(0) var<storage, read> nodes: array<Node>;
@group(0) @binding(1) var<storage, read_write> predicted: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> results: array<Result>;
@group(0) @binding(3) var<uniform> config: Knobs;
@group(0) @binding(4) var<storage, read_write> draped: array<vec4<f32>>;

const tau = 6.283185307;
${drapeChain}

fn around(index: u32, col: u32) -> u32 {
  return index - index % config.grid.y + col;
}

fn fitted(arc: f32, col: u32, clearance: f32) -> vec3<f32> {
  let sampleRow = clamp(arc / config.motion.z * f32(config.grid.z), 0.0, f32(config.grid.z));
  let low = u32(sampleRow);
  let a = nodes[low * config.grid.y + col];
  let b = nodes[min(low + 1u, config.grid.z) * config.grid.y + col];
  let t = fract(sampleRow);
  let base = mix(a.fitted.xyz, b.fitted.xyz, t);
  let direction = normalize(mix(a.normal.xyz, b.normal.xyz, t));
  let floorFade = select(1.0, smoothstep(0.0003, 0.008, base.y), direction.y < 0.0);
  return base + direction * clearance * floorFade;
}

fn parked(node: Node) -> vec3<f32> {
  let lengthM = nodes[config.grid.z * config.grid.y].rest.w - node.rest.w;
  let fraction = lengthM / nodes[config.grid.z * config.grid.y].rest.w;
  let sampleIndex = fraction * f32(config.clock.z - 1u);
  let low = min(u32(sampleIndex), config.clock.z - 2u);
  let chain = mix(draped[low].xy, draped[low + 1u].xy, sampleIndex - f32(low));
  let hasChain = config.motion.x == 0.0 || config.motion.w > 0.0;
  let centre = select(hangingStart(lengthM), chain, hasChain);
  let sway = lateral(lengthM);
  return vec3<f32>(nodes[0].fitted.x + node.rest.x * 1.28 + sway,
    centre.x + node.rest.z * config.drape.y, centre.y);
}

@compute @workgroup_size(64)
fn advance(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index >= config.grid.x) { return; }
  let col = index % config.grid.y;
  let node = nodes[index];
  let progress = config.motion.x;
  let placement = smoothstep(0.0, config.motion.y, progress);
  let pulled = clamp((progress - config.motion.y) / (1.0 - config.motion.y), 0.0, 1.0);
  let frontArc = mix(config.fit.x, config.motion.z, pulled);
  let seated = smoothstep(0.0, config.packing.x, frontArc);
  let gatherStart = max(0.0, frontArc - config.packing.y);
  let gatherU = clamp((node.fitted.w - gatherStart) / (config.motion.z - gatherStart), 0.0, 1.0);
  let seatedArc = select(node.fitted.w, mix(gatherStart, max(0.0, frontArc), gatherU),
    node.fitted.w >= gatherStart);
  let arc = mix(frontArc + node.fitted.w - config.motion.z, seatedArc, seated);
  let slack = config.fit.w * (1.0 - smoothstep(0.79, 1.0, pulled));
  let gathered = config.packing.z * seated * (1.0 - smoothstep(0.72, 1.0, pulled))
    * smoothstep(0.0, 0.24, gatherU) * (0.5 - 0.5 * cos(tau * gatherU * 4.0 + 0.40 * sin(node.normal.w)));
  var next: vec3<f32>;
  if (arc >= 0.0) {
    next = fitted(arc, col, (slack + gathered) * smoothstep(0.0, 0.018, arc));
  } else {
    let centre = nodes[config.grid.w].fitted.xyz;
    let tip = nodes[col].fitted.xyz;
    let relief = smoothstep(0.0, config.fit.z, -arc);
    let gathering = vec2<f32>(node.rest.x, node.rest.z)
      * (0.9 + 0.16 * sin(tau * arc / config.drape.z * 1.45));
    let rim = mix(tip.xy, centre.xy + gathering + vec2<f32>(0.0, 0.026), relief);
    next = vec3<f32>(rim, centre.z - arc * config.fit.y);
  }
  let point = mix(parked(node), next, placement);
  let safeHeight = vec3<f32>(point.x, max(0.0003, point.y), point.z);
  let position = mix(safeHeight, node.completed.xyz, smoothstep(0.974, 1.0, pulled));
  predicted[index] = vec4<f32>(position, select(0.0, slack, arc >= 0.0 && placement == 1.0));
}

fn ratio(a: u32, b: u32) -> f32 {
  let distance = length(predicted[b].xyz - predicted[a].xyz);
  let rest = max(1e-5, length(nodes[b].rest.xyz - nodes[a].rest.xyz));
  return max(0.10, distance / rest);
}

@compute @workgroup_size(64)
fn measure(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index >= config.grid.x) { return; }
  let stride = config.grid.y;
  let row = index / stride;
  let col = index % stride;
  let count = stride - 1u;
  let previous = around(index, (col + count - 1u) % count);
  let next = around(index, (col + 1u) % count);
  let below = select(index, index - stride, row > 0u);
  let above = select(index, index + stride, row < config.grid.z);
  let hoop = ratio(previous, next);
  let axial = ratio(below, above);
  let hoopStrain = max(0.0, hoop - 1.0 + config.cloth.z * (axial - 1.0));
  let axialStrain = max(0.0, axial - 1.0 + config.cloth.z * (hoop - 1.0));
  let data = nodes[index].optics;
  results[index].position = predicted[index];
  results[index].fields = vec4<f32>(hoop, axial, config.cloth.x * data.z * hoopStrain,
    config.cloth.y * data.z * axialStrain);
  results[index].details = vec4<f32>(predicted[index].w, 0.0, data.x, data.y);
  results[index].contact = vec4<f32>(0.0);
}
`;
