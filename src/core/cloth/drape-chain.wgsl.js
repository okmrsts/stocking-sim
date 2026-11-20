export const drapeChain = /* wgsl */ `
fn hangingStart(lengthM: f32) -> vec2<f32> {
  let hang = smoothstep(0.0, 0.22, lengthM);
  return vec2<f32>(0.177 - 0.056 * hang + 0.027 * sin(tau * lengthM / config.drape.z) * hang,
    config.drape.x + 0.38 * lengthM);
}

fn lateral(lengthM: f32) -> f32 {
  let phase = tau * lengthM / config.drape.z;
  return config.packing.w * asin(0.91 * sin(phase)) / asin(0.91);
}

fn moveChain(index: u32, delta: vec2<f32>) {
  draped[index] = vec4<f32>(draped[index].xy + delta, draped[index].zw);
}

fn constrainPair(index: u32, spacing: f32) {
  let diff = draped[index + 1u].xy - draped[index].xy;
  let x = lateral(f32(index + 1u) * spacing) - lateral(f32(index) * spacing);
  let projectedLength = sqrt(max(spacing * spacing * 0.04, spacing * spacing - x * x));
  let distance = length(diff);
  let share = select(0.5, 1.0, index == 0u);
  let adjustment = diff * ((distance - projectedLength) / max(0.000001, distance)) * 0.74;
  let separation = vec2<f32>(0.0, max(0.0, config.physics.z - (diff.y - adjustment.y)));
  moveChain(index, (1.0 - share) * (adjustment - separation));
  moveChain(index + 1u, share * (separation - adjustment));
}

@compute @workgroup_size(1)
fn settle() {
  let count = config.clock.z;
  let lengthM = nodes[config.grid.z * config.grid.y].rest.w;
  let spacing = lengthM / f32(count - 1u);
  if (config.clock.x != 0u) {
    for (var i = 0u; i < count; i++) {
      let position = hangingStart(f32(i) * spacing);
      draped[i] = vec4<f32>(position, position);
    }
  }
  for (var step = 0u; step < config.clock.y; step++) {
    let dt = config.physics.x;
    for (var i = 1u; i < count; i++) {
      let current = draped[i];
      var speed = (current.xy - current.zw) * config.physics.w;
      if (current.x <= config.physics.y + 0.00001) { speed.y *= 0.65; }
      let next = current.xy + speed - vec2<f32>(config.drape.w * dt * dt, 0.0);
      draped[i] = vec4<f32>(next, current.xy);
    }
    for (var sweep = 0u; sweep < config.clock.w; sweep++) {
      for (var i = 0u; i + 1u < count; i++) { constrainPair(i, spacing); }
      for (var i = count - 1u; i > 0u; i--) { constrainPair(i - 1u, spacing); }
      // Keep the section planes separated and the whole rendered sleeve off the floor.
      for (var i = 1u; i < count; i++) {
        let position = max(draped[i].xy, vec2<f32>(config.physics.y, draped[i - 1u].y + config.physics.z));
        draped[i] = vec4<f32>(position, draped[i].zw);
      }
    }
  }
}
`;
