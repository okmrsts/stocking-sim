const assert = require('node:assert/strict');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { withBrowser } = require('../browser.cjs');

async function ready(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#status').dataset.state !== 'loading', null, { timeout: 50000 });
  assert.equal(await page.locator('#status').getAttribute('data-state'), 'ready', await page.locator('#details').textContent());
}

async function capture() {
  await withBrowser(process.argv[2], process.argv[3], async ({ browser, base, newPage }) => {
    const viewport = { width: 1440, height: 1080 };
    const page = await newPage({ viewport });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await ready(page, base + '?capture=1');
    const photos = [
      ['front', '01-front'], ['oblique', '02-oblique'], ['ankle-wrinkles', '03a-ankle'],
      ['knee-wrinkles', '03b-knee'], ['thigh', '04-thigh'], ['thigh-macro', '05a-thigh-macro'],
      ['ankle-macro', '05b-ankle-macro'], ['comparison', '06-comparison'], ['cuff', '07a-cuff']
    ];
    for (const [view, filename] of photos) {
      await page.evaluate(viewId => window.stockingStage1a.profileView(viewId, 2), view);
      await page.screenshot({ path: join(__dirname, filename + '.png') });
    }
    for (const [mode, filename] of [[1,'08a-tension'], [4,'08b-opacity'], [6,'08c-pressure']]) {
      await page.evaluate(async mode => {
        const app = window.stockingStage1a;
        app.setDisplay(mode);
        await app.profileView(mode === 6 ? 'cuff' : 'oblique', 2);
      }, mode);
      await page.screenshot({ path: join(__dirname, filename + '.png') });
    }
    await page.evaluate(async () => {
      const app = window.stockingStage1a;
      app.setDisplay(0);
      app.setBarefoot(true);
      await app.profileView('cuff', 2);
    });
    await page.screenshot({ path: join(__dirname, '07b-bare-cuff.png') });

    const measurements = await page.evaluate(async () => {
      const app = window.stockingStage1a;
      const { loaded, bare, textile, tissueField } = app.lowerBody;
      const index = loaded.getIndex().array;
      const positions = loaded.getAttribute('position');
      const parent = Uint32Array.from({ length: positions.count }, (_, i) => i);
      function root(node) {
        while (node !== parent[node]) {
          parent[node] = parent[parent[node]];
          node = parent[node];
        }
        return node;
      }
      for (let i = 0; i < index.length; i += 3) {
        const a = root(index[i]);
        parent[root(index[i + 1])] = a;
        parent[root(index[i + 2])] = a;
      }
      const islands = new Set(parent.map((_, id) => root(id))).size;
      const barePositions = bare.getAttribute('position');
      let verticesMoved = 0, maxDisplacementMm = 0;
      for (let i = 0; i < positions.count; i++) {
        const displacement = 1000 * Math.hypot(
          positions.getX(i) - barePositions.getX(i),
          positions.getY(i) - barePositions.getY(i),
          positions.getZ(i) - barePositions.getZ(i)
        );
        if (displacement > 0.05) verticesMoved++;
        maxDisplacementMm = Math.max(maxDisplacementMm, displacement);
      }
      loaded.computeBoundingBox();
      const sites = [
        ['ankle', .358, .31], ['calf', .494, .31], ['thigh', .772, .31], ['cuff', .844, .20],
        ['aboveCuff', .866, .20], ['hip', .915, .20]
      ];
      const compressionMm = Object.fromEntries(sites.map(([name, arc, angle]) =>
        [name, 1000 * tissueField.sample(arc, angle)]));
      const barefootHidesPair = !textile.visible;
      app.setBarefoot(false);
      const full = await app.profileView('front', 60);
      const comparison = await app.profileView('comparison', 60);
      const macro = await app.profileView('thigh-macro', 60);
      const meshes = await app.meshBenchmarks(9, false, true);
      return {
        runtime: app.result, initial: app.initial, full, comparison, macro, meshes,
        stockings: textile.children.map(mesh => ({ offsetM: mesh.position.x, handedness: mesh.scale.x })),
        pelvisHeightM: loaded.boundingBox.max.y, islands, barefootHidesPair, verticesMoved, maxDisplacementMm,
        compressionMm, clothSamples: app.samples, tensionOpacity: app.tensionOpacity, foot: app.footFit
      };
    });

    assert.deepEqual(measurements.runtime.errors, []);
    assert.equal(measurements.runtime.validationErrors, 0);
    assert.deepEqual(pageErrors, []);
    assert.equal(measurements.islands, 1);
    assert.ok(measurements.pelvisHeightM > 1 && measurements.verticesMoved > 100);
    assert.equal(measurements.stockings.length, 2);
    assert.equal(measurements.stockings[0].offsetM, -measurements.stockings[1].offsetM);
    assert.deepEqual(measurements.stockings.map(mesh => mesh.handedness), [1, -1]);
    assert.ok(measurements.barefootHidesPair);
    assert.ok(measurements.compressionMm.cuff > measurements.compressionMm.thigh
      && measurements.compressionMm.thigh > measurements.compressionMm.ankle && measurements.compressionMm.hip === 0);
    assert.ok(measurements.clothSamples.thigh.normalOpacity < measurements.clothSamples.ankle.normalOpacity);
    assert.ok(measurements.tensionOpacity.pearson < 0);
    assert.ok(measurements.foot.triangleCenters.minFieldMm > 0);
    assert.ok(measurements.meshes.every(level => level.footFit.triangleCenters.insideSkin === 0));

    const mobile = await newPage({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true
    });
    await ready(mobile, base);
    await mobile.getByText('両脚に着用', { exact: true }).waitFor();
    await mobile.getByRole('button', { name: 'シワ', exact: true }).click();
    await mobile.getByRole('button', { name: '履き口', exact: true }).click();
    await mobile.getByRole('button', { name: '素足', exact: true }).click();
    const barePressed = await mobile.getByRole('button', { name: '素足', exact: true }).getAttribute('aria-pressed');
    await mobile.getByRole('button', { name: '着用比較', exact: true }).click();
    const comparePressed = await mobile.getByRole('button', { name: '着用比較', exact: true }).getAttribute('aria-pressed');
    const overflows = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(barePressed, 'true');
    assert.equal(comparePressed, 'true');
    assert.equal(overflows, false);
    await mobile.screenshot({ path: join(__dirname, '09-mobile.png') });
    await writeFile(join(__dirname, 'result.json'), JSON.stringify({
      browser: browser.version(), viewport, mobile: { overflows, viewSwitchesPassed: true }, ...measurements
    }, null, 2) + '\n');
  });
}

capture().catch(error => { console.error(error); process.exitCode = 1; });
