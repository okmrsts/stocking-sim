export function summarize(samples) {
  const ordered = [...samples].sort((a, b) => a - b);
  const quantile = fraction => ordered[Math.ceil(ordered.length * fraction) - 1];
  return { medianMs: quantile(0.5), p95Ms: quantile(0.95), samples: samples.length };
}

export async function measureFrames(draw, { warmup = 12, samples = 90 } = {}) {
  let previous = null;
  let intervals = [];
  for (let frame = 0; frame < warmup + samples + 1; frame++) {
    const time = await new Promise(resolve => requestAnimationFrame(resolve));
    draw();
    if (frame > warmup) intervals.push(time - previous);
    previous = time;
  }
  const durationMs = intervals.reduce((sum, interval) => sum + interval, 0);
  return { fps: samples * 1000 / durationMs, durationMs, ...summarize(intervals) };
}
