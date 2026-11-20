const assert = require('node:assert/strict');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { withBrowser } = require('../browser.cjs');

async function ready(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#status')?.dataset.state !== 'loading', null, { timeout: 60000 });
  assert.equal(await page.locator('#status').getAttribute('data-state'), 'ready', await page.locator('#details').textContent());
}

function measureSurface() {
  const app = window.stockingStage1a;
  const { bare, foot, tissueField, loaded } = app.lowerBody;
  const coords = bare.getAttribute('position').array;
  const triangles = bare.getIndex().array;
  const edges = new Map();
  const vertices = coords.length / 3;
  const parent = Uint32Array.from({ length: vertices }, (_, i) => i);
  function root(id) {
    while (id !== parent[id]) {
      parent[id] = parent[parent[id]];
      id = parent[id];
    }
    return id;
  }
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i], b = triangles[i + 1], c = triangles[i + 2];
    parent[root(b)] = root(a);
    parent[root(c)] = root(a);
    for (const [p, q] of [[a,b], [b,c], [c,a]]) {
      const key = Math.min(p, q) * vertices + Math.max(p, q);
      const data = edges.get(key) ?? [0, 0];
      data[0]++;
      data[1] += p < q ? 1 : -1;
      edges.set(key, data);
    }
  }
  const topology = {
    components: new Set(parent.map((_, id) => root(id))).size,
    openEdges: [...edges.values()].filter(([count]) => count === 1).length,
    nonManifoldEdges: [...edges.values()].filter(([count]) => count > 2).length,
    inconsistentEdges: [...edges.values()].filter(([count, balance]) => count === 2 && balance !== 0).length
  };

  function slice(axis, value, include) {
    const points = [];
    let length = 0;
    for (let triangle = 0; triangle < triangles.length; triangle += 3) {
      const intersections = [];
      for (let edge = 0; edge < 3; edge++) {
        const a = 3 * triangles[triangle + edge], b = 3 * triangles[triangle + (edge + 1) % 3];
        const before = coords[a + axis] - value, after = coords[b + axis] - value;
        if ((before < 0) === (after < 0)) continue;
        const t = before / (before - after);
        intersections.push([0, 1, 2].map(k => coords[a + k] + t * (coords[b + k] - coords[a + k])));
      }
      if (intersections.length !== 2 || !intersections.every(include)) continue;
      points.push(...intersections);
      length += Math.hypot(...intersections[0].map((x, k) => x - intersections[1][k]));
    }
    const ranges = [0, 1, 2].map(axis => {
      const values = points.map(p => p[axis]);
      return [Math.min(...values), Math.max(...values)];
    });
    return { ranges, perimeterMm: 1000 * length };
  }
  foot.computeBoundingBox();
  bare.computeBoundingBox();
  const floor = foot.boundingBox.min.y;
  const whole = () => true, oneLeg = p => p[0] > 0;
  const width = (section, axis) => 1000 * (section.ranges[axis][1] - section.ranges[axis][0]);
  const hip = slice(1, 0.805 + 1e-7, whole);
  const navel = slice(1, 0.9269 + 1e-7, whole);
  const crotch = slice(0, 1e-7, whole);
  const thigh = slice(1, floor + 0.6923, oneLeg);
  const knee = slice(1, floor + 0.4289, oneLeg);
  const calf = slice(1, 0.314 + 1e-7, oneLeg);
  const measurements = {
    navelHeightMm: 1000 * (0.9269 - floor),
    navelSectionDepthMm: width(navel, 2),
    hipBreadthMm: width(hip, 0),
    hipDepthMm: width(hip, 2),
    crotchHeightMm: 1000 * (crotch.ranges[1][0] - floor),
    thighBreadthMm: width(thigh, 0),
    thighDepthMm: width(thigh, 2),
    thighCircumferenceMm: thigh.perimeterMm,
    kneeDepthMm: width(knee, 2),
    calfDepthMm: width(calf, 2),
    calfCircumferenceMm: calf.perimeterMm,
    footLengthMm: 1000 * (foot.boundingBox.max.z - foot.boundingBox.min.z),
    footBreadthMm: 1000 * (foot.boundingBox.max.x - foot.boundingBox.min.x)
  };
  const cuffs = { compressionMm: tissueField.sample(0.844, 0.2) * 1000, pressurePa: app.samples.cuff.pressurePa };
  return {
    topology, measurements, cuffs, foot: app.footFit,
    positionsFinite: coords.every(Number.isFinite) && loaded.getAttribute('position').array.every(Number.isFinite),
    opacity: { thigh: app.samples.thigh.normalOpacity, ankle: app.samples.ankle.normalOpacity, tensionCorrelation: app.tensionOpacity.pearson },
    runtime: app.result
  };
}

async function capture() {
  await withBrowser(process.argv[2], process.argv[3], async ({ browser, base, newPage }) => {
    const page = await newPage({ viewport: { width: 1440, height: 1080 } });
    await ready(page, base + '?capture=1');
    const measured = await page.evaluate(measureSurface);
    const bareViews = [['front','bare-front'], ['side','bare-side'], ['back','bare-back'], ['oblique','bare-oblique']];
    const wornViews = [
      ['front','01-front'], ['oblique','02-oblique'], ['ankle-wrinkles','03a-ankle'], ['knee-wrinkles','03b-knee'],
      ['thigh','04-thigh'], ['thigh-macro','05a-thigh-macro'], ['ankle-macro','05b-ankle-macro'],
      ['comparison','06-comparison'], ['cuff','07-cuff'], ['foot','08-foot'], ['heel','09-heel']
    ];
    for (const [bare, views] of [[true, bareViews], [false, wornViews]]) {
      await page.evaluate(bare => window.stockingStage1a.setBarefoot(bare), bare);
      for (const [view, name] of views) {
        await page.evaluate(view => window.stockingStage1a.profileView(view, 2), view);
        await page.screenshot({ path: join(__dirname, name + '.png') });
      }
    }
    const speed = await page.evaluate(async () => {
      const app = window.stockingStage1a;
      return {
        front: await app.profileView('front', 45),
        macro: await app.profileView('thigh-macro', 45),
        meshes: await app.meshBenchmarks(9, false, true),
        runtimeAfterBenchmarks: app.result
      };
    });
    const mobile = await newPage({ viewport: {width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
    await ready(mobile, base);
    await mobile.getByRole('button', { name:'斜め', exact:true }).click();
    await mobile.getByRole('button', { name:'側面', exact:true }).click();
    await mobile.getByRole('button', { name:'背面', exact:true }).click();
    await mobile.getByRole('button', { name:'素足', exact:true }).click();
    assert.equal(await mobile.getByRole('button', { name:'素足', exact:true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await mobile.getByRole('button', { name:'着用比較', exact:true }).click();
    await mobile.screenshot({ path: join(__dirname, 'mobile.png') });
    const result = { browser: browser.version(), ...measured, ...speed };
    await writeFile(join(__dirname,'result.json'), JSON.stringify(result, null, 2) + '\n');

    assert.deepEqual(measured.topology, { components: 1, openEdges: 0, nonManifoldEdges: 0, inconsistentEdges: 0 });
    assert.ok(measured.positionsFinite);
    assert.deepEqual(speed.runtimeAfterBenchmarks.errors, []);
    assert.equal(speed.runtimeAfterBenchmarks.validationErrors, 0);
    assert.ok(measured.cuffs.compressionMm > 0);
    assert.ok(measured.opacity.thigh < measured.opacity.ankle && measured.opacity.tensionCorrelation < 0);
    assert.ok(measured.foot.triangleCenters.minFieldMm > 0);
    assert.ok(speed.meshes.every(level => level.footFit.triangleCenters.insideSkin === 0));
    const targets = {
      navelHeightMm: [925.1, 1], navelSectionDepthMm: [169.8, 6],
      hipBreadthMm: [330.7, 3], hipDepthMm: [207.2, 4], crotchHeightMm: [714.5, 8],
      thighBreadthMm: [163.4, 4], thighDepthMm: [180.7, 6], kneeDepthMm: [115.3, 5],
      calfDepthMm: [105.4, 6], footLengthMm: [233.8, 2], footBreadthMm: [93.2, 3]
    };
    for (const [name, [target, tolerance]] of Object.entries(targets)) {
      const measuredValue = measured.measurements[name];
      assert.ok(Math.abs(measuredValue - target) <= tolerance, name + ': ' + measuredValue + ' mm');
    }
  });
}

module.exports = { measureSurface };
if (require.main === module) capture().catch(error => { console.error(error); process.exitCode = 1; });
