const assert = require('node:assert/strict');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { withBrowser } = require('../browser.cjs');
const { capture, ready } = require('../1a-anatomy/capture.cjs');

const bareViews = [['hip-rear', 'hip-rear'], ['hip-side', 'hip-side']];
const wornViews = [
  ['front', '01-front'], ['oblique', '02-oblique'],
  ['ankle-wrinkles', '03a-ankle'], ['knee-wrinkles', '03b-knee'], ['thigh', '04-thigh'],
  ['thigh-macro', '05a-thigh-macro'], ['ankle-macro', '05b-ankle-macro'],
  ['hip-rear', 'hip-rear-worn']
];

function measurePosterior() {
  const geometry = window.stockingStage1a.lowerBody.bare;
  const positions = geometry.getAttribute('position').array;
  const indices = geometry.getIndex().array;
  const startY = 0.665, stepY = 0.005, rows = 48;
  const degrees = 180 / Math.PI;

  return [0.045, 0.090, 0.120, 0.135].map(x => {
    const back = new Float64Array(rows).fill(Infinity);
    for (let face = 0; face < indices.length; face += 3) {
      const segment = [];
      for (let edge = 0; edge < 3; edge++) {
        const a = indices[face + edge] * 3, b = indices[face + (edge + 1) % 3] * 3;
        const ax = positions[a] - x, bx = positions[b] - x;
        if ((ax < 0) === (bx < 0)) continue;
        const t = ax / (ax - bx);
        segment.push([
          positions[a + 1] + t * (positions[b + 1] - positions[a + 1]),
          positions[a + 2] + t * (positions[b + 2] - positions[a + 2])
        ]);
      }
      if (segment.length !== 2) continue;
      segment.sort((a, b) => a[0] - b[0]);
      const [[ay, az], [by, bz]] = segment;
      if (ay === by) continue;
      const first = Math.max(0, Math.ceil((ay - startY) / stepY));
      const last = Math.min(rows - 1, Math.floor((by - startY) / stepY));
      for (let row = first; row <= last; row++) {
        const t = (startY + row * stepY - ay) / (by - ay);
        back[row] = Math.min(back[row], az + t * (bz - az));
      }
    }
    const turns = [];
    for (let row = 2; row < rows - 2; row++) {
      const y = startY + row * stepY;
      // Exclude the intended medial fold and the waist cutoff.
      if (y < 0.715 || y > 0.840) continue;
      const before = Math.atan2(back[row] - back[row - 2], 2 * stepY);
      const after = Math.atan2(back[row + 2] - back[row], 2 * stepY);
      turns.push(Math.abs(after - before) * degrees);
    }
    return {
      lateralMm: x * 1000,
      maxTurnDegrees: Math.max(...turns),
      contourMm: [...back].map(z => Number.isFinite(z) ? Math.round(z * 10000) / 10 : null)
    };
  });
}

async function run() {
  const baselineOutput = process.argv[4];
  if (baselineOutput) {
    await withBrowser(process.argv[2], process.argv[3], async ({ base, newPage }) => {
      const page = await newPage({ viewport: { width: 1440, height: 1080 } });
      await ready(page, base + '?capture=1');
      const posterior = await page.evaluate(measurePosterior);
      await writeFile(join(baselineOutput, 'previous-posterior.json'), JSON.stringify(posterior, null, 2) + '\n');
      await page.evaluate(() => window.stockingStage1a.setBarefoot(true));
      for (const [view, name] of bareViews) {
        await page.evaluate(view => window.stockingStage1a.profileView(view, 2), view);
        await page.screenshot({ path: join(baselineOutput, 'previous-' + name + '.png') });
      }
    });
    return;
  }

  await capture({
    output: __dirname,
    bareViews,
    wornViews,
    mobileAngles: [['臀部側面'], ['臀部', 'mobile-hip-rear']],
    inspect: async page => {
      const posterior = await page.evaluate(measurePosterior);
      assert.ok(posterior.every(slice => Number.isFinite(slice.maxTurnDegrees)));
      return { posterior };
    }
  });
}

run().catch(error => { console.error(error); process.exitCode = 1; });
