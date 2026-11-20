const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve, join } = require('node:path');
const { withBrowser } = require('../browser.cjs');
const { ready } = require('../1a-anatomy/capture.cjs');
const { inspectFit } = require('./inspect.cjs');

const fixed = [
  ['front', '01-front'], ['oblique', '02-oblique'],
  ['ankle-wrinkles', '03a-ankle'], ['knee-wrinkles', '03b-knee'],
  ['thigh', '04-thigh'], ['thigh-macro', '05a-thigh-macro'], ['ankle-macro', '05b-ankle-macro']
];
const ids = ['pantyhose', 'tights', 'fishnet'];
const output = resolve(process.argv[4] ?? '/tmp/stocking-1b-captures');

async function capture({ base, browser, newPage }) {
  await mkdir(output, { recursive: true });
  const page = await newPage({ viewport: { width: 1440, height: 1080 } });
  const browserErrors = [];
  function monitor(page) {
    page.on('pageerror', error => browserErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
  }
  monitor(page);
  await ready(page, base + '?capture=1&view=front');
  const baseline = await page.evaluate(inspectFit);
  const presets = [];
  for (const id of ids) {
    const path = join(output, id);
    await mkdir(path, { recursive: true });
    await page.evaluate(id => window.stockingStage1a.applyGarment(id), id);
    for (const [view, file] of fixed) {
      await page.evaluate(view => window.stockingStage1a.profileView(view, 2), view);
      await page.screenshot({ path: join(path, file + '.png') });
    }
    const fit = await page.evaluate(inspectFit);
    const metrics = await page.evaluate(async () => ({
      front: await window.stockingStage1a.profileView('front', 25),
      macro: await window.stockingStage1a.profileView('thigh-macro', 25),
      levels: await window.stockingStage1a.meshBenchmarks(7, false, true)
    }));
    presets.push({ ...fit, ...metrics });
  }
  await page.evaluate(() => window.stockingStage1a.applyBody({ hips: 110, thighs: 110 }));
  const adjusted = await page.evaluate(inspectFit);
  const laptopRuntime = await page.evaluate(() => window.stockingStage1a.result);

  const mobile = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  monitor(mobile);
  await ready(mobile, base + '?garment=pantyhose');
  const select = mobile.getByLabel('プリセット', { exact: true });
  assert.equal(await select.inputValue(), 'pantyhose');
  assert.ok(await mobile.getByRole('button', { name: '着脱', exact: true }).isDisabled());
  await select.selectOption('fishnet');
  await mobile.waitForFunction(() => !document.getElementById('garment-preset').disabled);
  await mobile.getByRole('button', { name: '斜め', exact: true }).click();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  await mobile.screenshot({ path: join(output, 'mobile.jpg'), quality: 90 });
  await select.selectOption('knee-high');
  await mobile.waitForFunction(() => !document.getElementById('garment-preset').disabled);
  assert.ok(await mobile.getByRole('button', { name: '着脱', exact: true }).isEnabled());
  assert.ok(await mobile.getByRole('button', { name: '着用比較', exact: true }).isEnabled());

  const report = { chromium: browser.version(), baseline, presets, adjusted, laptopRuntime, browserErrors };
  await writeFile(join(__dirname, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(laptopRuntime.errors, []);
  assert.equal(laptopRuntime.validationErrors, 0);
  for (const fit of [...presets, adjusted]) {
    assert.equal(fit.topology.components, 1);
    assert.ok(fit.topology.openEdges > 0);
    assert.equal(fit.topology.waistEdgesOnly, true);
    assert.equal(fit.topology.nonManifold + fit.topology.inconsistent + fit.topology.degenerate, 0);
    assert.equal(fit.pelvis.inside, 0, fit.garment + ': ' + JSON.stringify(fit.pelvis));
    assert.equal(fit.foot.triangleCenters.insideSkin, 0);
    assert.ok(fit.opacity.thigh < fit.opacity.ankle && fit.opacity.ankle < fit.opacity.toe);
    assert.ok(fit.opacity.tensionCorrelation < 0);
  }
  assert.ok(presets[2].opacity.thigh < presets[0].opacity.thigh);
  assert.ok(presets[0].opacity.thigh < presets[1].opacity.thigh);
}

withBrowser(process.argv[2], process.argv[3], capture).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
