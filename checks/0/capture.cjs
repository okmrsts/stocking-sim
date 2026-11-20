const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { withBrowser } = require('../browser.cjs');

async function capture() {
  const viewport = { width: 1000, height: 700 };
  await withBrowser(process.argv[2], process.argv[3], async ({ browser, base, newPage, args }) => {
    const page = await newPage({ viewport, deviceScaleFactor: 1 });
    await page.goto(base + '/checks/0/probe.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#status').dataset.state !== 'loading',
      null, { timeout: 40000 });
    const probe = await page.evaluate(async () => {
      const info = (await navigator.gpu?.requestAdapter())?.info;
      return {
        state: document.querySelector('#status').dataset.state,
        ...window.stockingProbe,
        adapter: info ? { vendor: info.vendor, architecture: info.architecture,
          isFallbackAdapter: info.isFallbackAdapter } : null
      };
    });
    const result = {
      browser: browser.version(), platform: process.platform + ' ' + process.arch,
      viewport, deviceScaleFactor: 1, chromeArgs: args,
      cdn: process.argv[3] ? 'cached-jsdelivr-response' : 'direct', ...probe
    };
    console.log(result);
    if (probe.state !== 'ready' || probe.backend !== 'WebGPU' || probe.revision !== '185'
      || probe.validationErrors !== 0 || !Number.isFinite(probe.fps)) {
      throw new Error('WebGPU drawing probe failed.');
    }
    await page.screenshot({ path: join(__dirname, 'webgpu-probe.png') });
    await writeFile(join(__dirname, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  });
}

capture().catch(error => { console.error(error); process.exitCode = 1; });
