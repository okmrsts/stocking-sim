const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { capture } = require('../1a-anatomy/capture.cjs');

async function inspect(page) {
  const fit = await page.evaluate(async () => {
    const app = window.stockingStage1a;
    const ankleWrinkles = app.gaps.ankleFront;
    const ankleVariants = [];
    for (const ankles of [90, 110]) {
      await app.applyBody({ ankles });
      const fitted = window.stockingStage1a;
      ankleVariants.push({ ankles: fitted.dimensions.ankles, fit: fitted.footFit });
    }
    await app.applyBody({ ankles: 100 });
    return { ankleWrinkles, ankleVariants };
  });
  return fit;
}

async function main() {
  await capture({
    output: __dirname,
    bareViews: [['foot-medial', 'bare-medial']],
    wornViews: [
      ['front', '01-front'], ['oblique', '02-oblique'], ['ankle-wrinkles', '03a-ankle'],
      ['knee-wrinkles', '03b-knee'], ['thigh', '04-thigh'], ['thigh-macro', '05a-thigh-macro'],
      ['ankle-macro', '05b-ankle-macro'], ['foot-medial', 'worn-medial'], ['foot-top', 'worn-toes']
    ],
    inspect
  });
  const result = JSON.parse(await readFile(join(__dirname, 'result.json'), 'utf8'));
  const fitted = [result.foot, ...result.meshes.map(x => x.footFit), ...result.ankleVariants.map(x => x.fit)];
  for (const fit of fitted) {
    assert.ok(fit.clothWidthMm - fit.skinWidthMm < 2.4, 'Forefoot width');
    assert.ok(fit.tipOverhangMm < 1.1, 'Toe tip clearance');
    assert.equal(fit.triangleCenters.insideSkin, 0);
    assert.ok(fit.triangleCenters.minFieldMm > 0);
    assert.ok(fit.ankleBend.samples > 0);
    assert.equal(fit.ankleBend.reversedTriangles, 0);
    assert.ok(fit.instep.every(point => point.verticalGapMm > 0 && point.verticalGapMm < 2), 'Instep clearance');
  }
  assert.deepEqual(result.ankleVariants.map(x => x.ankles), [90, 110]);
  assert.ok(result.ankleWrinkles.crestArcsMm.length >= 3);
  assert.ok(result.ankleWrinkles.maxMm - result.ankleWrinkles.minMm < 0.25);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
