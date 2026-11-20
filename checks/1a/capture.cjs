const { writeFile, readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { withBrowser } = require('../browser.cjs');

const photos = [
  ['front', '01-front'], ['oblique', '02-oblique'],
  ['ankle-wrinkles', '03a-ankle'], ['knee-wrinkles', '03b-knee'],
  ['thigh', '04-thigh'], ['thigh-macro', '05a-thigh-macro'], ['ankle-macro', '05b-ankle-macro'],
  ['foot', '06a-foot'], ['heel', '06b-heel']
];
const output = join(__dirname, '../1a-snug-fit');

async function capture() {
  const config = JSON.parse(await readFile(join(__dirname, '../views-1a-revision.json'), 'utf8'));
  const baseline = JSON.parse(await readFile(join(__dirname, '../1a-revision/result.json'), 'utf8'));
  const { width, height, deviceScaleFactor } = config.viewport;
  const viewport = { width, height };
  await withBrowser(process.argv[2], process.argv[3], async ({ browser, base, newPage, args }) => {
    const page = await newPage({ viewport, deviceScaleFactor });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const url = new URL(process.argv[4] || base);
    url.searchParams.set('capture', '1');
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#status')?.dataset.state !== 'loading', null,
      { timeout: 40000 });
    const status = await page.locator('#status').getAttribute('data-state');
    if (status !== 'ready') {
      throw new Error(await page.locator('#details').textContent());
    }

    for (const [viewId, filename] of photos) {
      await page.evaluate(view => window.stockingStage1a.profileView(view, 2), viewId);
      await page.screenshot({ path: join(output, filename + '.png') });
    }

    const diagnosticPhotos = [[1, 'diagnostic-tension'], [4, 'diagnostic-opacity']];
    for (const [mode, file] of diagnosticPhotos) {
      await page.evaluate(async display => {
        window.stockingStage1a.setDisplay(display);
        await window.stockingStage1a.profileView('front', 2);
      }, mode);
      await page.screenshot({ path: join(output, file + '.png') });
    }
    const measurements = await page.evaluate(async () => {
      const app = window.stockingStage1a;
      app.setDisplay(0);
      const front = await app.profileView('front');
      const macro = await app.profileView('thigh-macro');
      const meshes = await app.meshBenchmarks(15);
      return {
        runtime: app.result, yarnDiameterMicrometers: app.yarnDiameterMicrometers,
        samples: app.samples, relaxedSize: app.relaxedSize, gaps: app.gaps,
        selfContact: app.selfContact, footContact: app.footContact,
        tensionOpacity: app.tensionOpacity, initial: app.initial, front, macro, meshes
      };
    });

    const mobile = await newPage({
      viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true
    });
    await mobile.goto(process.argv[4] || base, { waitUntil: 'domcontentloaded' });
    await mobile.waitForFunction(() => document.querySelector('#status')?.dataset.state !== 'loading');
    const mobileStatus = await mobile.locator('#status').getAttribute('data-state');
    if (mobileStatus !== 'ready') throw new Error(await mobile.locator('#details').textContent());
    await mobile.getByRole('button', { name: '足部' }).click();
    await mobile.getByRole('button', { name: 'かかと' }).click();
    await mobile.getByRole('button', { name: '素足' }).click();
    const footControls = await mobile.evaluate(() => ({
      bare: document.querySelector('#bare-foot').getAttribute('aria-pressed') === 'true',
      label: document.querySelector('#view-label').textContent,
      disabled: document.querySelector('#display-mode').disabled
    }));
    await mobile.getByRole('button', { name: '素足' }).click();
    await mobile.getByRole('button', { name: '極限マクロ' }).click();
    await mobile.getByRole('button', { name: '足首', exact: true }).click();
    await mobile.locator('#scale').waitFor({ state: 'visible' });
    await mobile.getByRole('button', { name: '確かめる' }).click();
    await mobile.getByLabel('表示する項目').selectOption('7');
    await mobile.getByRole('button', { name: '閉じる' }).click();
    const mobileLayout = await mobile.evaluate(() => ({
      overflows: document.documentElement.scrollWidth > innerWidth,
      closed: !document.getElementById('settings').open,
      selectedView: document.getElementById('view-label').textContent,
      displayedMode: document.getElementById('display-mode').value
    }));

    const result = {
      browser: browser.version(), platform: process.platform + ' ' + process.arch, viewport, deviceScaleFactor,
      chromeArgs: args, cdn: process.argv[3] ? 'cached-jsdelivr-response' : 'direct',
      mobileLayout, footControls, pageErrors, ...measurements
    };
    console.log(JSON.stringify(result, null, 2));
    const { thigh, ankle, cuff, toe } = result.samples;
    const gapSpread = gap => gap.maxMm - gap.minMm;
    const reducedWrinkles = Object.keys(result.gaps).every(site =>
      gapSpread(result.gaps[site]) < 0.6 * gapSpread(baseline.gaps[site])
    ) && result.selfContact.reversedPoints < baseline.selfContact.reversedPoints;
    const plausible = thigh.stretchHoop > ankle.stretchHoop && thigh.normalOpacity < ankle.normalOpacity
      && cuff.normalOpacity > thigh.normalOpacity && toe.normalOpacity > thigh.normalOpacity
      && reducedWrinkles && result.tensionOpacity.pearson < 0
      && result.footContact.footInsideSkin === 0
      && result.footContact.footPoints > 0;
    if (!plausible || pageErrors.length || result.runtime.errors.length || result.runtime.validationErrors !== 0
      || mobileLayout.overflows || !mobileLayout.closed || mobileLayout.displayedMode !== '7'
      || !footControls.bare || !footControls.disabled || footControls.label !== 'かかと'
      || !mobileLayout.selectedView.includes('足首')) {
      throw new Error('Stage 1a verification failed.');
    }
    await writeFile(join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  });
}

capture().catch(error => { console.error(error); process.exitCode = 1; });
