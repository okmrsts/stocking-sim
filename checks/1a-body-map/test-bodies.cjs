const assert = require('node:assert/strict');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { withBrowser } = require('../browser.cjs');
const { ready, measureSurface } = require('../1a-anatomy/capture.cjs');
const { measureCuff } = require('../1a-cuff/measure.cjs');

const standard = { waist: 100, hips: 100, glutes: 100, thighs: 100, calves: 100, ankles: 100 };
const large = { waist: 112, hips: 112, glutes: 118, thighs: 108, calves: 113, ankles: 110 };
const small = { waist: 88, hips: 93, glutes: 83, thighs: 88, calves: 87, ankles: 90 };
const mixed = { waist: 88, hips: 93, glutes: 118, thighs: 108, calves: 87, ankles: 110 };

function measureSize() {
  const app = window.stockingStage1a;
  const skin = app.lowerBody.bare.getAttribute('position');
  const waistTop = 0.933, buttY = 0.79, ankleY = 0.15;
  let waistHalf = 0, buttRear = 0;
  let ankleMin = Infinity, ankleMax = -Infinity;
  for (let i = 0; i < skin.count; i++) {
    const x = skin.getX(i), y = skin.getY(i), z = skin.getZ(i);
    if (Math.abs(y - waistTop) < 0.0001) waistHalf = Math.max(waistHalf, Math.abs(x));
    if (Math.abs(y - buttY) < 0.004) buttRear = Math.min(buttRear, z);
    if (x > 0 && Math.abs(y - ankleY) < 0.002) {
      ankleMin = Math.min(ankleMin, x);
      ankleMax = Math.max(ankleMax, x);
    }
  }
  return { waistWidthMm: 2000 * waistHalf, buttBackMm: -1000 * buttRear, ankleWidthMm: 1000 * (ankleMax - ankleMin) };
}

async function test({ newPage, base }) {
  const page = await newPage({ viewport: { width: 1440, height: 1080 } });
  await ready(page, base + '?capture=1');
  const results = {};
  for (const [name, dimensions] of Object.entries({ standard, large, small, mixed })) {
    await page.evaluate(values => window.stockingStage1a.applyBody(values), dimensions);
    const surface = await page.evaluate(measureSurface);
    const cuff = await page.evaluate(measureCuff);
    const dimensionsMm = { ...surface.measurements, ...await page.evaluate(measureSize) };
    const applied = await page.evaluate(() => window.stockingStage1a.dimensions);
    assert.deepEqual(applied, dimensions);
    assert.ok(Object.values(dimensionsMm).every(Number.isFinite));
    assert.deepEqual(surface.topology, { components: 1, openEdges: 0, nonManifoldEdges: 0, inconsistentEdges: 0 });
    assert.ok(surface.positionsFinite && surface.foot.triangleCenters.insideSkin === 0);
    assert.ok(cuff.band.minimumMm > 0 && cuff.band.throughSkin === 0);
    assert.ok(dimensionsMm.crotchHeightMm > cuff.upperY * 1000 + 12);
    assert.equal(surface.runtime.validationErrors, 0);
    results[name] = { dimensions, dimensionsMm, cuff: cuff.band, topology: surface.topology, foot: surface.foot.triangleCenters };
    if (name === 'mixed' || name === 'standard') continue;
    await page.evaluate(async () => {
      const app = window.stockingStage1a;
      await app.profileView('hip-rear', 2);
    });
    await page.screenshot({ path: join(__dirname, name + '-hip.png') });
    await page.evaluate(() => window.stockingStage1a.profileView('front', 2));
    await page.screenshot({ path: join(__dirname, name + '-front.png') });
  }
  for (const key of ['waistWidthMm', 'hipBreadthMm', 'buttBackMm', 'thighCircumferenceMm', 'calfCircumferenceMm', 'ankleWidthMm']) {
    const { large, standard, small } = results;
    assert.ok(large.dimensionsMm[key] > standard.dimensionsMm[key], key);
    assert.ok(standard.dimensionsMm[key] > small.dimensionsMm[key], key);
  }

  await page.evaluate(async values => {
    const app = window.stockingStage1a;
    await app.applyBody(values);
    window.stockingStage1a.setTissueVisible(true);
    await window.stockingStage1a.profileView('front', 2);
  }, standard);
  await page.screenshot({ path: join(__dirname, 'map-front.png') });
  await page.evaluate(() => window.stockingStage1a.profileView('back', 2));
  await page.screenshot({ path: join(__dirname, 'map-back.png') });
  assert.match(await page.locator('#legend-text').textContent(), /mm\/kPa/);

  const mobile = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ready(mobile, base + '?view=hip-rear');
  await mobile.getByRole('button', { name: '体型', exact: true }).click();
  await mobile.getByRole('slider', { name: '臀部の張り出し' }).press('End');
  await mobile.getByRole('slider', { name: '太ももの太さ' }).press('End');
  await mobile.screenshot({ path: join(__dirname, 'mobile-settings.png') });
  await mobile.getByRole('button', { name: '着用に反映' }).click();
  await mobile.getByRole('dialog').waitFor({ state: 'hidden', timeout: 60000 });
  assert.equal(await mobile.getByRole('button', { name: '臀部', exact: true }).getAttribute('aria-pressed'), 'true');
  await mobile.getByRole('button', { name: '体型', exact: true }).click();
  await mobile.getByRole('button', { name: '軟組織マップ', exact: true }).click();
  assert.match(await mobile.locator('#legend-text').textContent(), /青ほど硬い/);
  await mobile.getByRole('button', { name: '素足', exact: true }).click();
  assert.equal(await mobile.getByRole('button', { name: '素足', exact: true }).getAttribute('aria-pressed'), 'false');
  await mobile.getByRole('button', { name: '体型', exact: true }).click();
  await mobile.getByRole('button', { name: '基準に戻す' }).click();
  assert.equal(await mobile.getByRole('slider', { name: '臀部の張り出し' }).inputValue(), '100');
  await mobile.getByRole('button', { name: '着用に反映' }).click();
  await mobile.getByRole('dialog').waitFor({ state: 'hidden', timeout: 60000 });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.match(await mobile.locator('#status').textContent(), /検証エラー 0件/);
  await writeFile(join(__dirname, 'body-tests.json'), JSON.stringify({ ...results, mobile: 'passed' }, null, 2) + '\n');
}

withBrowser(process.argv[2], process.argv[3], test).catch(error => { console.error(error); process.exitCode = 1; });
