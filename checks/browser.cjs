const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname, sep } = require('node:path');

const root = resolve(__dirname, '..');
const cdn = 'https://cdn.jsdelivr.net/npm/three@0.185.0/build/';
const args = [
  '--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-features=Vulkan,SkiaGraphite,DawnUseSwiftShader', '--use-vulkan=swiftshader',
  '--disable-vulkan-surface'
];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

async function withBrowser(executablePath, cache, run) {
  const server = createServer(async (request, response) => {
    const path = request.url.split('?')[0];
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    try {
      if (!file.startsWith(root + sep) || !mime[extname(file)]) throw new Error('Unavailable');
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] + '; charset=utf-8' }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true, args });
    const modules = new Map();
    if (cache) {
      for (const name of ['three.webgpu.js', 'three.tsl.js', 'three.core.js']) {
        modules.set(cdn + name, await readFile(resolve(cache, name)));
      }
    }

    async function newPage(options) {
      const page = await browser.newPage(options);
      if (modules.size) await page.route(cdn + '**', route => {
        const bytes = modules.get(route.request().url());
        return bytes ? route.fulfill({
          contentType: 'text/javascript',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: bytes
        }) : route.continue();
      });
      return page;
    }
    await run({ browser, newPage, base: 'http://127.0.0.1:' + server.address().port, args });
  } finally {
    await browser?.close();
    server.close();
  }
}

module.exports = { withBrowser };
