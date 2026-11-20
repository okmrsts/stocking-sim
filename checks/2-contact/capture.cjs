const assert = require('node:assert/strict');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { withBrowser } = require('../browser.cjs');
const { ready } = require('../1a-anatomy/capture.cjs');
const { inspectMesh } = require('../2/mesh-intersections.cjs');

const fixedViews = [
  ['front', '01-front'], ['oblique', '02-oblique'], ['ankle-wrinkles', '03a-ankle'],
  ['knee-wrinkles', '03b-knee'], ['thigh', '04-thigh'], ['thigh-macro', '05a-thigh-macro'],
  ['ankle-macro', '05b-ankle-macro']
];
const photo = (page, name) => page.screenshot({ path: join(__dirname, name + '.jpg'), quality: 88 });
const status = page => page.evaluate(() => {
  const { contactMs, frameIntervals, ...state } = window.stockingStage1a.dressing.status();
  const times = contactMs.sort((a, b) => a - b);
  const total = frameIntervals.reduce((sum, x) => sum + x, 0);
  return {
    ...state, frameSamples: frameIntervals.length,
    fps: total > 0 ? 1000 * frameIntervals.length / total : null,
    recentContactSamples: times.length,
    contactMedianMs: times[Math.floor(times.length / 2)] ?? null,
    contactP95Ms: times[Math.ceil(times.length * 0.95) - 1] ?? null,
    display: document.getElementById('dressing-position').value,
    gpu: window.stockingStage1a.result
  };
});

async function arrived(page, progress, settled = false) {
  await page.waitForFunction(({ progress, settled }) => {
    const state = window.stockingStage1a.dressing.status();
    return (state.progress === progress && (!settled || state.settling >= 1.5))
      || document.getElementById('dressing-position').value === '接触で停止'
      || document.getElementById('status').dataset.state === 'error';
  }, { progress, settled }, { timeout: 150000 });
  const result = await status(page);
  assert.equal(result.progress, progress, JSON.stringify(result));
  if (settled) assert.equal(result.settling, 1.5);
  assert.deepEqual(result.gpu.errors, []);
  return result;
}

async function main({ browser, base, newPage }) {
  const desktop = await newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  const monitor = page => page.on('pageerror', error => errors.push(error.message));
  monitor(desktop);
  await ready(desktop, base + '?capture=1&view=front');
  for (const [view, name] of fixedViews) {
    await desktop.evaluate(view => window.stockingStage1a.profileView(view, 2), view);
    await photo(desktop, name);
  }
  const fixed = await desktop.evaluate(async () => {
    const app = window.stockingStage1a;
    return { front: await app.profileView('front', 25), macro: await app.profileView('thigh-macro', 25) };
  });
  const configurations = [
    [1, 0], [0.31, 1], [0.43, 1], [0.72, 1], [0.31, -1], [0.43, -1], [0.72, -1], [0, 0]
  ];
  const poses = [];
  for (const [progress, direction] of configurations) {
    await desktop.evaluate(async ([p, tilt]) => {
      await window.stockingStage1a.dressing.inspect(p, 1.5, tilt);
      await window.stockingStage1a.profileView('dressing', 2);
    }, [progress, direction]);
    poses.push({ progress, direction, ...await desktop.evaluate(inspectMesh) });
    if (progress === 1) await photo(desktop, 'before');
    if (progress === 0.43) await photo(desktop, direction === 1 ? 'outward' : 'inward');
    if (progress === 0) await photo(desktop, 'after');
  }
  const desktopGpu = await desktop.evaluate(() => window.stockingStage1a.result);
  await desktop.close();

  const mobile = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  monitor(mobile);
  await ready(mobile, base + '?capture=1&view=front');
  await mobile.evaluate(() => document.documentElement.classList.remove('capture'));
  await mobile.getByRole('button', { name: '着脱', exact: true }).click();
  await mobile.getByLabel('引く方向', { exact: true }).selectOption('1');
  await mobile.getByLabel('速く引く').check();
  await mobile.getByRole('button', { name: 'ずり下ろす', exact: true }).click();
  const outward = await arrived(mobile, 0.43);
  assert.equal(outward.slant, 1);
  await photo(mobile, 'mobile');

  await mobile.getByLabel('引く方向', { exact: true }).selectOption('-1');
  await mobile.getByRole('button', { name: '履く', exact: true }).click();
  await mobile.waitForFunction(() => window.stockingStage1a.dressing.status().progress > 0.50);
  await mobile.getByRole('button', { name: '一時停止', exact: true }).click();
  await mobile.waitForFunction(() => {
    const d = window.stockingStage1a.dressing.status();
    return d.progress === d.target && d.progress > 0.50 && d.progress < 1;
  });
  const reversal = await status(mobile);

  await mobile.getByRole('button', { name: '引き抜く', exact: true }).click();
  const inward = await arrived(mobile, 0, true);
  assert.equal(inward.slant, -1);
  await mobile.getByLabel('引く方向', { exact: true }).selectOption('0');
  await mobile.getByRole('button', { name: '履く', exact: true }).click();
  const straight = await arrived(mobile, 1);
  assert.equal(straight.slant, 0);
  const report = { chromium: browser.version(), fixed, poses, desktopGpu, errors,
    playback: { outward, reversal, inward, straight }, mobileViewport: [390, 844] };
  await writeFile(join(__dirname, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  assert.deepEqual(errors, []);
  assert.deepEqual(desktopGpu.errors, []);
  assert.ok(poses.every(pose => pose.insideFoot === 0 && pose.selfCrossings === 0),
    JSON.stringify(poses.filter(pose => pose.insideFoot || pose.selfCrossings)));
  assert.ok(straight.checkedSteps > outward.checkedSteps);
}

withBrowser(process.argv[2], process.argv[3], main).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
