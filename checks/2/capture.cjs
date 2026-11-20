const assert = require('node:assert/strict');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { withBrowser } = require('../browser.cjs');
const { ready } = require('../1a-anatomy/capture.cjs');
const { inspectMesh } = require('./mesh-intersections.cjs');

const fixedViews = [
  ['front', '01-front'], ['oblique', '02-oblique'], ['ankle-wrinkles', '03a-ankle'],
  ['knee-wrinkles', '03b-knee'], ['thigh', '04-thigh'], ['thigh-macro', '05a-thigh-macro'],
  ['ankle-macro', '05b-ankle-macro']
];

function capturePage(page, file, quality = 89) {
  const options = file.endsWith('.png') ? {} : { quality };
  return page.screenshot({ ...options, path: join(__dirname, file) });
}

function motionReport() {
  const app = window.stockingStage1a;
  const { frameIntervals, ...status } = app.dressing.status();
  const ms = frameIntervals.reduce((a, b) => a + b, 0);
  return { ...status, fps: ms ? frameIntervals.length * 1000 / ms : null, intervals: frameIntervals.length };
}

async function waitProgress(page, expected, settled = false) {
  await page.waitForFunction(({ expected, settled }) => {
    const { progress, settling, target } = window.stockingStage1a.dressing.status();
    const error = document.getElementById('status').dataset.state === 'error';
    return error || (progress === expected && (!settled || settling >= 1.5))
      || (expected !== target && document.getElementById('dressing-position').value === '接触で停止');
  }, { expected, settled }, { timeout: 45000 });
  const report = await page.evaluate(motionReport);
  assert.equal(report.progress, expected, JSON.stringify(report));
  return report;
}

async function capture({ browser, base, newPage }) {
  const page = await newPage({ viewport: { width: 1440, height: 1080 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await ready(page, base + '?capture=1&view=front');
  for (const [view, name] of fixedViews) {
    await page.evaluate(view => window.stockingStage1a.profileView(view, 2), view);
    await capturePage(page, name + (name.includes('macro') ? '.png' : '.jpg'));
  }
  const front = await page.evaluate(() => window.stockingStage1a.profileView('front', 30));
  const macro = await page.evaluate(() => window.stockingStage1a.profileView('thigh-macro', 30));
  const intersections = [];
  for (const progress of [1, 0.995, 0.96, 0.9, 0.83, 0.72, 0.61, 0.52, 0.47, 0.43, 0.35, 0.32, 0.3, 0.285, 0.275, 0.24, 0.19, 0.1, 0]) {
    await page.evaluate(progress => window.stockingStage1a.dressing.inspect(progress), progress);
    intersections.push({ progress, ...await page.evaluate(inspectMesh) });
  }
  const poses = [
    ['before', 0, 1.5], ['toes', 0.31, 0], ['heel', 0.43, 0], ['calf', 0.72, 0], ['worn', 1, 0],
    ['pull-free', 0.15, 0], ['released', 0, 0], ['folded', 0, 1.5]
  ];
  for (const [name, progress, elapsed] of poses) {
    await page.evaluate(async ([progress, elapsed]) => {
      const app = window.stockingStage1a;
      await app.dressing.inspect(progress, elapsed);
      await app.profileView('dressing', 2);
    }, [progress, elapsed]);
    await capturePage(page, name + '.jpg');
  }
  const runtime = await page.evaluate(() => window.stockingStage1a.result);

  const mobile = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  mobile.on('pageerror', error => pageErrors.push(error.message));
  await ready(mobile, base + '?capture=1');
  await mobile.evaluate(() => document.documentElement.classList.remove('capture'));
  await mobile.getByRole('button', { name: '着脱', exact: true }).click();
  await mobile.getByRole('button', { name: 'ずり下ろす', exact: true }).click();
  const lower = await waitProgress(mobile, 0.43);
  await mobile.getByRole('button', { name: '履く', exact: true }).click();
  await mobile.waitForFunction(() => window.stockingStage1a.dressing.status().progress > 0.48);
  await mobile.getByRole('button', { name: '一時停止', exact: true }).click();
  await mobile.waitForFunction(() => {
    const { progress, target } = window.stockingStage1a.dressing.status();
    return progress === target && progress > 0.43 && progress < 1;
  });
  const paused = await mobile.evaluate(motionReport);
  await mobile.getByRole('button', { name: '引き抜く', exact: true }).click();
  const remove = await waitProgress(mobile, 0, true);
  const arrangement = mobile.locator('#dressing-arrangement');
  await arrangement.selectOption('split');
  await mobile.getByText('脱衣後の布', { exact: true }).filter({ visible: true }).first().waitFor();
  assert.equal(await mobile.evaluate(() => window.stockingStage1a.lowerBody.textile.visible), false);
  await capturePage(mobile, 'mobile-comparison.jpg');
  await arrangement.selectOption('cloth');
  assert.equal(await mobile.evaluate(() => window.stockingStage1a.lowerBody.textile.visible), true);
  await capturePage(mobile, 'mobile-cloth.jpg');
  await arrangement.selectOption('body');
  assert.equal(await mobile.evaluate(() => window.stockingStage1a.lowerBody.textile.visible), false);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  await mobile.getByRole('button', { name: '履く', exact: true }).click();
  const dress = await waitProgress(mobile, 1);
  const mobileRuntime = await mobile.evaluate(() => window.stockingStage1a.result);
  const report = { chromium: browser.version(), runtime, mobileRuntime, pageErrors, front, macro,
    intersections, playback: { lower, paused, remove, dress }, mobileViewport: [390, 844] };
  await writeFile(join(__dirname, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(runtime.errors, []);
  assert.deepEqual(mobileRuntime.errors, []);
  assert.ok(intersections.every(sample => sample.insideFoot === 0 && sample.selfCrossings === 0),
    JSON.stringify(intersections.filter(sample => sample.insideFoot || sample.selfCrossings)));
}

withBrowser(process.argv[2], process.argv[3], capture).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
