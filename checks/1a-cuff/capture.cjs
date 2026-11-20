const assert = require('node:assert/strict');
const { capture } = require('../1a-anatomy/capture.cjs');
const { measureCuff } = require('./measure.cjs');

capture({
  output: __dirname,
  bareViews: [['hip-rear', 'hip-rear-bare']],
  wornViews: [
    ['front', '01-front'], ['oblique', '02-oblique'],
    ['ankle-wrinkles', '03a-ankle'], ['knee-wrinkles', '03b-knee'], ['thigh', '04-thigh'],
    ['thigh-macro', '05a-thigh-macro'], ['ankle-macro', '05b-ankle-macro'],
    ['hip-rear', 'hip-rear-worn'], ['hip-side', 'hip-side-worn'], ['cuff', 'cuff-worn']
  ],
  inspect: async page => {
    const cuffContact = await page.evaluate(measureCuff);
    for (const region of [cuffContact.band, cuffContact.rim, cuffContact.ring]) {
      assert.ok(region.samples > 0);
      assert.equal(region.throughSkin, 0);
      assert.ok(region.minimumMm > 0 && region.maximumMm < 1);
    }
    assert.ok(cuffContact.compressionMm > 0.5 && cuffContact.compressionMm < 2);
    assert.ok(cuffContact.rear.maximumOutwardMm < 0.05);
    return { cuffContact };
  }
}).catch(error => { console.error(error); process.exitCode = 1; });
