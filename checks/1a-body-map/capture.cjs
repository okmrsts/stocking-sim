const assert = require('node:assert/strict');
const { capture } = require('../1a-anatomy/capture.cjs');
const { measureCuff } = require('../1a-cuff/measure.cjs');

capture({
  output: __dirname,
  bareViews: [],
  wornViews: [
    ['front', '01-front'], ['oblique', '02-oblique'],
    ['ankle-wrinkles', '03a-ankle'], ['knee-wrinkles', '03b-knee'], ['thigh', '04-thigh'],
    ['thigh-macro', '05a-thigh-macro'], ['ankle-macro', '05b-ankle-macro'],
    ['hip-rear', 'hip-rear-worn']
  ],
  inspect: async page => {
    const cuffContact = await page.evaluate(measureCuff);
    assert.ok(cuffContact.band.minimumMm > 0 && cuffContact.band.throughSkin === 0);
    return { cuffContact };
  }
}).catch(error => { console.error(error); process.exitCode = 1; });
