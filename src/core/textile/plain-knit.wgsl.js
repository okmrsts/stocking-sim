export const fabricShader = /* wgsl */ `
fn shadePlainKnit(materialUV: vec2<f32>, fields: vec4<f32>, cloth: vec4<f32>,
  worldNormal: vec3<f32>, eye: vec3<f32>, pitch: vec2<f32>, data: vec4<f32>,
  tint: vec3<f32>, mode: f32, maxima: vec3<f32>) -> vec4<f32> {
  let normalDir = normalize(worldNormal);
  let viewDir = normalize(eye);
  let facing = max(0.11, abs(dot(normalDir, viewDir)));
  let cycles = materialUV / pitch;
  let px = dpdx(cycles);
  let py = dpdy(cycles);
  let footprint = max(length(px), length(py));
  let metric = vec2<f32>(fields.x * cloth.w / data.y, fields.y);
  let cell = max(vec2<f32>(0.00008), pitch * metric);
  let radius = data.x;
  let course = floor(cycles.y);
  let repeatCoord = fract(cycles) - vec2<f32>(0.5);
  let pixelM = min(0.00018, max(length(px * cell), length(py * cell)));
  let shoulderLength = length(cell * vec2<f32>(0.26, 0.22));
  let sideLength = length(cell * vec2<f32>(0.09, 0.40));
  let yarnLength = 2.0 * (shoulderLength + sideLength) + length(cell * vec2<f32>(1.0, 0.25));
  let meanThickness = 2.0 * radius * yarnLength * cloth.z / (cell.x * cell.y);
  let coarseOpacity = 1.0 - exp(-0.93 * meanThickness / pow(facing, 0.59) - 0.018);

  var filtered = coarseOpacity;
  var fiber = 0.0;
  if (footprint < 0.44) {
    let shift = 0.5 * (course - 2.0 * floor(0.5 * course));
    let x = fract(cycles.x + shift) - 0.5;
    let neighborX = fract(cycles.x + 0.5 - shift) - 0.5;
    var centerDistance = knitDistance(vec2<f32>(x, repeatCoord.y) * cell, cell);
    var overUnder = 1.0;
    if (repeatCoord.y < -0.24) {
      let other = knitDistance(vec2<f32>(neighborX, repeatCoord.y + 1.0) * cell, cell);
      overUnder = 1.0 - 0.28 * (1.0 - smoothstep(radius, 2.3 * radius, max(other, centerDistance)));
      centerDistance = min(centerDistance, other);
    }
    if (repeatCoord.y > 0.28) {
      let other = knitDistance(vec2<f32>(neighborX, repeatCoord.y - 1.0) * cell, cell);
      centerDistance = min(centerDistance, other);
    }
    let aa = max(0.0000008, 0.58 * pixelM);
    let edge = 1.0 - smoothstep(radius - aa, radius + aa, centerDistance);
    let fineOpacity = 0.018 + edge * (1.0 - exp(-2.65 / facing));
    let blend = smoothstep(0.12, 0.44, footprint);
    filtered = mix(fineOpacity, coarseOpacity, blend);
    let normalizedRadius = min(1.0, centerDistance / radius);
    fiber = edge * sqrt(max(0.0, 1.0 - normalizedRadius * normalizedRadius)) * (1.0 - blend) * overUnder;
  }

  let lamp = normalize(vec3<f32>(-0.64, 0.65, 0.53));
  let diffuse = max(0.0, dot(normalDir, lamp));
  let specular = pow(max(0.0, dot(normalDir, normalize(lamp + viewDir))), 15.0);
  var value = tint * (0.35 + 0.84 * diffuse)
    + vec3<f32>(0.11, 0.106, 0.12) * (0.25 * specular + fiber * (0.16 + 0.58 * specular));
  if (mode > 0.5) {
    var scalar = max(fields.z, fields.w) / maxima.x;
    if (mode > 1.5) { scalar = max(0.0, fields.x - 1.0) / maxima.y; }
    if (mode > 2.5) { scalar = cloth.x * 1000.0 / maxima.z; }
    if (mode > 3.5) { scalar = coarseOpacity; }
    if (mode > 4.5) { scalar = 0.0; }
    if (mode > 5.5) { scalar = cloth.y / 5000.0; }
    value = heatRamp(scalar) * (0.81 + 0.19 * diffuse);
    filtered = 1.0;
  }
  return vec4<f32>(value, clamp(filtered, 0.0, 1.0));
}

fn segmentDistance(point: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
  let axis = b - a;
  let parameter = clamp(dot(point - a, axis) / dot(axis, axis), 0.0, 1.0);
  return length(point - a - parameter * axis);
}

fn quadraticDistance(point: vec2<f32>, a: vec2<f32>, b: vec2<f32>, c: vec2<f32>) -> f32 {
  let chord = c - a;
  var t = clamp(dot(point - a, chord) / dot(chord, chord), 0.0, 1.0);
  let acceleration = 2.0 * (a - 2.0 * b + c);
  for (var iteration = 0u; iteration < 3u; iteration++) {
    let u = 1.0 - t;
    let delta = u * u * a + 2.0 * u * t * b + t * t * c - point;
    let velocity = 2.0 * (u * (b - a) + t * (c - b));
    let divisor = dot(velocity, velocity) + dot(delta, acceleration);
    if (divisor > 1e-11) {
      t = clamp(t - dot(delta, velocity) / divisor, 0.0, 1.0);
    }
  }
  let u = 1.0 - t;
  let distanceM = length(u * u * a + 2.0 * u * t * b + t * t * c - point);
  return min(distanceM, min(length(point - a), length(point - c)));
}

fn knitDistance(point: vec2<f32>, cell: vec2<f32>) -> f32 {
  let mirrored = vec2<f32>(abs(point.x), point.y);
  let shoulder = vec2<f32>(0.245, 0.18) * cell;
  let base = vec2<f32>(0.31, -0.32) * cell;
  let boundary = vec2<f32>(0.50, -0.51) * cell;
  let startOffset = vec2<f32>(0.0, 0.18) * cell;
  let ellipse = vec2<f32>(0.245, 0.45) * cell;
  let topPoint = mirrored - startOffset;
  let k0 = length(topPoint / ellipse);
  let k1 = length(topPoint / (ellipse * ellipse));
  let crown = select(length(mirrored - shoulder),
    select(min(ellipse.x, ellipse.y), abs(k0 * (k0 - 1.0) / max(1.0, k1)), k0 > 1e-4), topPoint.y >= 0.0);
  let stem = segmentDistance(mirrored, shoulder, base);
  let underlap = quadraticDistance(mirrored, base, vec2<f32>(0.35, -0.51) * cell, boundary);
  return min(crown, min(stem, underlap));
}

fn heatRamp(value: f32) -> vec3<f32> {
  let t = clamp(value, 0.0, 1.0);
  let blue = vec3<f32>(0.034, 0.105, 0.42);
  let green = vec3<f32>(0.018, 0.57, 0.40);
  let red = vec3<f32>(0.92, 0.20, 0.044);
  return mix(mix(blue, green, smoothstep(0.0, 0.52, t)), red, smoothstep(0.46, 1.0, t));
}
`;
