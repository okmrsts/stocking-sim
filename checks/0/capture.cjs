const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const executablePath = process.argv[2];
const cdnCacheDir = process.argv[3];
const cdnBuild = 'https://cdn.jsdelivr.net/npm/three@0.185.0/build/';
const viewport = { width: 1000, height: 700 };
const swiftShaderArgs = [
  '--enable-unsafe-webgpu',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-features=Vulkan,SkiaGraphite,DawnUseSwiftShader',
  '--use-vulkan=swiftshader',
  '--disable-vulkan-surface'
];

async function capture() {
  const html = await readFile(join(__dirname, '../../index.html'));
  const modules = new Map();
  if (cdnCacheDir) {
    for (const name of ['three.webgpu.js', 'three.tsl.js', 'three.core.js']) {
      modules.set(cdnBuild + name, await readFile(join(cdnCacheDir, name)));
    }
  }
  const server = createServer((request, response) => {
    if (request.url !== '/') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: swiftShaderArgs
    });
    try {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      if (modules.size > 0) {
        await page.route(cdnBuild + '**', route => {
          const bytes = modules.get(route.request().url());
          if (!bytes) return route.continue();
          return route.fulfill({
            contentType: 'text/javascript',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: bytes
          });
        });
      }
      await page.goto('http://127.0.0.1:' + server.address().port + '/', {
        waitUntil: 'domcontentloaded'
      });
      await page.waitForFunction(() => {
        const state = document.querySelector('#status').dataset.state;
        return state !== 'loading';
      }, null, { timeout: 40_000 });

      const probe = await page.evaluate(async () => {
        const adapter = await navigator.gpu?.requestAdapter();
        const info = adapter?.info;
        return {
          state: document.querySelector('#status').dataset.state,
          ...window.stockingProbe,
          adapter: info ? {
            vendor: info.vendor,
            architecture: info.architecture,
            isFallbackAdapter: info.isFallbackAdapter
          } : null
        };
      });
      const result = {
        browser: browser.version(),
        platform: process.platform + ' ' + process.arch,
        viewport,
        deviceScaleFactor: 1,
        chromeArgs: swiftShaderArgs,
        cdn: cdnCacheDir ? 'cached-jsdelivr-response' : 'direct',
        ...probe
      };
      console.log(result);
      if (probe.state !== 'ready' || probe.backend !== 'WebGPU' || probe.revision !== '185'
        || probe.validationErrors !== 0 || !Number.isFinite(probe.fps)) {
        throw new Error('WebGPU drawing probe failed.');
      }
      await page.screenshot({ path: join(__dirname, 'webgpu-probe.png') });
      await writeFile(join(__dirname, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    } finally {
      await browser.close();
    }
  } finally {
    server.close();
  }
}

capture().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
