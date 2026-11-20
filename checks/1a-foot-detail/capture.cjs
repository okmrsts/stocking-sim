const assert = require('node:assert/strict');
const { capture } = require('../1a-anatomy/capture.cjs');
const { measureFootAnatomy } = require('./measure.cjs');

capture({
  output: __dirname,
  bareViews: [
    ['foot-top', 'bare-top'], ['foot-medial', 'bare-medial'], ['foot-lateral', 'bare-lateral'],
    ['foot-ankle', 'bare-ankle'], ['foot', 'bare-toes']
  ],
  wornViews: [
    ['front', '01-front'], ['oblique', '02-oblique'],
    ['ankle-wrinkles', '03a-ankle'], ['knee-wrinkles', '03b-knee'], ['thigh', '04-thigh'],
    ['thigh-macro', '05a-thigh-macro'], ['ankle-macro', '05b-ankle-macro'],
    ['foot', 'worn-toes'], ['foot-medial', 'worn-medial'], ['foot-ankle', 'worn-ankle']
  ],
  inspect: async page => {
    const footAnatomy = await page.evaluate(measureFootAnatomy);
    const targets = {
      lengthMm: [233.8, 1.5], heelBreadthMm: [60.4, 2.5],
      ballCutBreadthMm: [93.2, 2], ballProjectedBreadthMm: [91.1, 2.5],
      instepHeightMm: [57.2, 2], lateralMalleolusMm: [62.8, 2.5], medialMalleolusMm: [75.6, 2.5]
    };
    for (const [key, [target, tolerance]] of Object.entries(targets)) {
      assert.ok(Math.abs(footAnatomy[key] - target) <= tolerance, key + ': ' + footAnatomy[key] + ' mm');
    }
    assert.ok(footAnatomy.medialArchLiftMm > 10 && footAnatomy.achillesInsetMm > 4);
    assert.equal(footAnatomy.toes.length, 5);
    for (let i = 1; i < footAnatomy.toes.length; i++) {
      assert.ok(footAnatomy.toes[i].heelToTipMm < footAnatomy.toes[i - 1].heelToTipMm);
      assert.ok(footAnatomy.toes[i].padHeightMm < footAnatomy.toes[i - 1].padHeightMm);
    }
    assert.ok(footAnatomy.gapsMm.every(width => width > 1));
    assert.ok(footAnatomy.nailTriangles > 0);
    return { footAnatomy };
  }
}).catch(error => { console.error(error); process.exitCode = 1; });
