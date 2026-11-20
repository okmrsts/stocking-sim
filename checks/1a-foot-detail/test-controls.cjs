const assert = require('node:assert/strict');
const { join } = require('node:path');
const { writeFile } = require('node:fs/promises');
const { withBrowser } = require('../browser.cjs');
const { ready } = require('../1a-anatomy/capture.cjs');

async function test({ newPage, base }) {
  const page = await newPage({ viewport: { width: 800, height: 600 } });
  await ready(page, base + '?capture=1');
  const variants = [];
  for (const ankles of [90, 110]) {
    const checked = await page.evaluate(async ankles => {
      await window.stockingStage1a.applyBody({ ankles });
      const app = window.stockingStage1a;
      return { ankles: app.dimensions.ankles, footFit: app.footFit, validationErrors: app.result.validationErrors };
    }, ankles);
    assert.equal(checked.ankles, ankles);
    assert.equal(checked.footFit.triangleCenters.insideSkin, 0);
    assert.ok(checked.footFit.triangleCenters.minFieldMm > 0);
    assert.equal(checked.validationErrors, 0);
    variants.push(checked);
  }

  const mobile = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ready(mobile, base);
  await mobile.getByRole('button', { name: '足部', exact: true }).click();
  await mobile.getByRole('button', { name: '素足', exact: true }).click();
  for (const name of ['内側と土踏まず', '外くるぶし', '足首の後ろ', '甲と五本の指']) {
    const view = mobile.getByRole('button', { name, exact: true });
    await view.click();
    assert.equal(await view.getAttribute('aria-pressed'), 'true');
  }
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.match(await mobile.locator('#status').textContent(), /検証エラー 0件/);
  await mobile.screenshot({ path: join(__dirname, 'mobile-toes.png') });
  await writeFile(join(__dirname, 'ankle-variants.json'), JSON.stringify(variants, null, 2) + '\n');
}

withBrowser(process.argv[2], process.argv[3], test).catch(error => { console.error(error); process.exitCode = 1; });
