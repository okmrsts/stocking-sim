const assert = require('node:assert/strict');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { withBrowser } = require('../browser.cjs');

async function ready(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#status').dataset.state !== 'loading');
  const state = await page.locator('#status').getAttribute('data-state');
  assert.equal(state, 'ready', await page.locator('#details').textContent());
}

async function capture() {
  await withBrowser(process.argv[2], process.argv[3], async ({ browser, base, newPage }) => {
    const viewport = { width: 1440, height: 1080 };
    const desktop = await newPage({ viewport });
    const errors = [];
    desktop.on('pageerror', error => errors.push(error.message));
    await ready(desktop, base + '?capture=1');
    await desktop.getByText('未着用（無荷重）', { exact: true }).waitFor();
    const measured = await desktop.evaluate(async () => {
      const { meshLevels } = await import('/src/config/stage1a.js');
      const app = window.stockingStage1a;
      const geo = app.unloadedGeometry;
      const position = geo.getAttribute('position');
      const fields = geo.getAttribute('clothFields');
      const stride = meshLevels.find(level => level.id === 'standard').columns + 1;
      let meridianLengthM = 0, invalidFields = 0;
      for (let point = 0; point < fields.count; point++) {
        if (fields.getX(point) !== 1 || fields.getY(point) !== 1
          || fields.getZ(point) !== 0 || fields.getW(point) !== 0) invalidFields++;
      }
      for (let point = stride; point < position.count - 1; point += stride) {
        meridianLengthM += Math.hypot(
          position.getY(point) - position.getY(point - stride),
          position.getZ(point) - position.getZ(point - stride)
        );
      }
      geo.computeBoundingBox();
      const full = await app.profileView('front', 60);
      const macro = await app.profileView('thigh-macro', 60);
      const comparison = await app.profileView('comparison', 60);
      return {
        runtime: app.result, full, macro, comparison, invalidFields,
        preset: app.relaxedSize,
        rest: {
          meridianLengthMm: meridianLengthM * 1000,
          diameterMm: (geo.boundingBox.max.x - geo.boundingBox.min.x) * 1000
        },
        wornThigh: { hoop: app.samples.thigh.stretchHoop, axial: app.samples.thigh.stretchAxial }
      };
    });
    assert.equal(measured.invalidFields, 0);
    assert.ok(Math.abs(measured.rest.meridianLengthMm - measured.preset.axialLengthMm) < 0.01);
    assert.ok(Math.abs(measured.rest.diameterMm - measured.preset.tubeDiameterMm) < 0.01);
    assert.equal(measured.runtime.validationErrors, 0);
    assert.deepEqual(measured.runtime.errors, []);
    assert.deepEqual(errors, []);
    await desktop.screenshot({ path: join(__dirname, 'comparison.png') });

    const mobile = await newPage({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true
    });
    await ready(mobile, base);
    const compare = mobile.getByRole('button', { name: '着用比較', exact: true });
    const labels = mobile.locator('#comparison-labels');
    assert.equal(await compare.getAttribute('aria-pressed'), 'true');
    await labels.waitFor();
    await mobile.getByRole('button', { name: '素足', exact: true }).click();
    await labels.waitFor({ state: 'hidden' });
    assert.equal(await mobile.getByRole('button', { name: '素足' }).getAttribute('aria-pressed'), 'true');
    await compare.click();
    assert.equal(await mobile.getByRole('button', { name: '素足' }).getAttribute('aria-pressed'), 'false');
    await labels.waitFor();
    await mobile.getByRole('button', { name: '足部' }).click();
    await labels.waitFor({ state: 'hidden' });
    await compare.click();
    const overflows = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflows, false);
    await mobile.screenshot({ path: join(__dirname, 'mobile.png') });
    await writeFile(join(__dirname, 'result.json'), JSON.stringify({
      browser: browser.version(), viewport, mobile: { overflows, viewSwitchesPassed: true }, ...measured
    }, null, 2) + '\n');
  });
}

capture().catch(error => { console.error(error); process.exitCode = 1; });
