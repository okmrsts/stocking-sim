export const diamondNetShader = /* wgsl */ `
fn integrateNetBand(phase: f32, halfWidth: f32) -> f32 {
  let shifted = phase + 0.5;
  return floor(shifted) * (2.0 * halfWidth)
    + clamp(fract(shifted) - (0.5 - halfWidth), 0.0, 2.0 * halfWidth);
}

fn netBand(phase: f32, footprint: f32, halfWidth: f32) -> f32 {
  let span = max(0.00001, footprint);
  return clamp((integrateNetBand(phase + 0.5 * span, halfWidth)
    - integrateNetBand(phase - 0.5 * span, halfWidth)) / span, 0.0, 1.0);
}

fn diamondCoverage(uv: vec2<f32>, px: vec2<f32>, py: vec2<f32>, cell: vec2<f32>, radius: f32) -> vec2<f32> {
  let halfWidth = clamp(radius * length(1.0 / cell), 0.0, 0.48);
  let across = vec2<f32>(1.0, 1.0);
  let along = vec2<f32>(1.0, -1.0);
  let a = netBand(dot(uv, across), abs(dot(px, across)) + abs(dot(py, across)), halfWidth);
  let b = netBand(dot(uv, along), abs(dot(px, along)) + abs(dot(py, along)), halfWidth);
  return vec2<f32>(1.0 - (1.0 - a) * (1.0 - b), a * b);
}
`;
