export function stitchRings(lower, upper, face) {
  if (!lower.length || !upper.length) throw Error('A skin surface did not produce a complete seam.');
  let lowerStep = 0, upperStep = 0;
  let a = lower.at(-1).id, b = upper.at(-1).id;
  while (lowerStep < lower.length || upperStep < upper.length) {
    const nextLowerAngle = lower[lowerStep]?.angle ?? Infinity;
    const nextUpperAngle = upper[upperStep]?.angle ?? Infinity;
    if (nextLowerAngle <= nextUpperAngle) {
      const next = lower[lowerStep].id;
      face(a, next, b);
      a = next;
      lowerStep++;
    } else {
      const next = upper[upperStep].id;
      face(a, next, b);
      b = next;
      upperStep++;
    }
  }
}
