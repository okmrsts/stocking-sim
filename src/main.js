import { NeutralToneMapping, SRGBColorSpace } from 'three/webgpu';
import { createLeg } from './core/body/leg-model.js';
import { createLowerBodyGeometry } from './core/body/lower-body.js';
import { updateTissueField, wrapCompliantSurface } from './core/body/soft-tissue.js';
import { createClothGeometry, sampleCloth } from './core/cloth/geometry.js';
import { createStaticShellSolver } from './core/cloth/solver.js';
import { createGpuContext, withGpuValidation } from './core/gpu/context.js';
import { createTextileMaterial } from './core/textile/material.js';
import { measureFrames, summarize } from './core/ui/metrics.js';
import { connectOrbit } from './core/ui/pointer-router.js';
import {
  bodyProfile, comparisonConfig, footAnatomy, diagnostics, lowerBodyConfig, material, meshLevels, preset, renderConfig, tissue
} from './config/stage1a.js';
import { createKneeHighInput } from './stocking/rest-shape.js';
import { createUnloadedGeometry } from './stocking/unloaded-preview.js';
import { createStudio } from './stocking/scene.js';
import { createStageCamera } from './stocking/stage-camera.js';
import { createComparisonView } from './stocking/comparison-view.js';
import { collectFitMetrics } from './stocking/stage1a-metrics.js';
import { measureFootFit } from './stocking/foot-fit-metrics.js';

const query = new URLSearchParams(location.search);
const format = new Intl.NumberFormat('ja-JP');
const modeLabels = ['', '張力', '周方向の伸び', '肌との隙間', '不透明度', '濡れ', '接触圧', '布どうしの接触'];
const legends = [
  '', '0 — ' + diagnostics.tensionNpmMax + ' N/m（縦横の大きい値）',
  '0 — ' + Math.round(diagnostics.strainMax * 100) + '%', '0 — ' + diagnostics.gapMmMax + ' mm',
  '0 — 100%（表示角度を含む）', '0 — 100%（段階1aは常に乾燥）', '0 — 5 kPa（推定）',
  '接触による外向き補正 0 — ' + diagnostics.selfContactMmMax + ' mm'
];


export async function start() {
  const canvas = document.querySelector('canvas');
  const status = document.getElementById('status');
  const details = document.getElementById('details');
  const benchmarkButton = document.getElementById('benchmark');
  const output = document.getElementById('benchmark-result');
  const settings = document.getElementById('settings');
  const frameStats = document.getElementById('frame-stats');
  const scale = document.getElementById('scale');
  const subviews = document.getElementById('subviews');
  const viewLabel = document.getElementById('view-label');
  const comparisonLabels = document.getElementById('comparison-labels');
  const controls = Array.from(document.querySelectorAll('.toolbar [data-view]'));
  const viewMode = document.getElementById('display-mode');
  if (query.has('capture')) document.documentElement.classList.add('capture');

  const result = { errors: [], validationErrors: 0, revision: null };
  function reportError(label, error) {
    if (error?.constructor?.name === 'GPUValidationError') result.validationErrors++;
    result.errors.push(label + ' — ' + (error?.message ?? error));
    status.dataset.state = 'error';
    status.textContent = 'WebGPU の処理でエラーが発生しました';
    details.textContent = result.errors.join('\n');
    details.hidden = false;
  }

  const { device, adapter, renderer, revision } = await createGpuContext(canvas, reportError);
  result.revision = revision;
  result.adapter = { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture };
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 0.84;

  const response = await fetch(new URL('../checks/views-1a-bilateral.json', import.meta.url));
  if (!response.ok) throw new Error('視点の設定を読み込めません。');
  const { views, defaultView } = await response.json();
  const bareLeg = createLeg(bodyProfile, footAnatomy);
  let surface = bareLeg, tissueField;
  const solve = await withGpuValidation(device, reportError, () => createStaticShellSolver(device));
  const standard = meshLevels.find(level => level.id === 'standard');
  const measureSolve = async (level, repeats) => {
    const start = performance.now();
    const input = createKneeHighInput(surface, preset, level);
    const prepareMs = performance.now() - start;
    const fitted = await withGpuValidation(device, reportError, () => solve(input, material, repeats));
    return { fitted, prepareMs };
  };
  for (let pass = 0; pass < tissue.passes; pass++) {
    const { fitted } = await measureSolve(standard, 0);
    tissueField = updateTissueField(fitted, tissue, tissueField);
    surface = wrapCompliantSurface(bareLeg, tissueField);
  }
  const initial = await measureSolve(standard, 7);
  const frame = initial.fitted;
  const optics = {
    ...preset,
    cellPitchM: [
      2 * Math.PI * preset.relaxedRadiusM / Math.round(2 * Math.PI * preset.relaxedRadiusM / preset.cellPitchM[0]),
      preset.cellPitchM[1]
    ]
  };
  const cloth = createTextileMaterial(optics, diagnostics);
  const geometry = createClothGeometry(frame);
  const unloadedGeometry = createUnloadedGeometry(frame);
  const foot = bareLeg.createFootGeometry();
  const skinStart = footAnatomy.skinJoinM - 0.0012;
  const body = {
    foot, halfStanceM: lowerBodyConfig.halfStanceM,
    bare: createLowerBodyGeometry(bareLeg.skinSurface, skinStart, lowerBodyConfig),
    loaded: createLowerBodyGeometry(wrapCompliantSurface(bareLeg.skinSurface, tissueField), skinStart, lowerBodyConfig)
  };
  const { scene, textile, unloaded, setSkinLoaded, setClothGeometry } = createStudio(
    renderConfig, body, geometry, unloadedGeometry, cloth.material
  );
  const { camera, target, setView: positionCamera, rotate, zoom, zoomRatio } = createStageCamera(views, anchor => {
    const sample = sampleCloth(frame, surface, anchor.arcM, anchor.angleRad);
    return {
      positionM: sample.position.map((coordinate, axis) =>
        coordinate + (axis === 0 ? body.halfStanceM : 0) + sample.normal[axis] * anchor.distanceM),
      targetM: [sample.position[0] + body.halfStanceM, ...sample.position.slice(1)]
    };
  });
  const comparison = createComparisonView(unloaded, comparisonConfig);
  const draw = () => renderer.render(scene, unloaded.visible ? comparison.synchronize(camera, target, zoomRatio()) : camera);
  let currentView = defaultView;
  let resizeQueued = false;
  let drawQueued = false;
  let measuring = false;
  let userMovedCamera = false;

  function requestDraw() {
    if (drawQueued || measuring) return;
    drawQueued = true;
    requestAnimationFrame(() => {
      drawQueued = false;
      try {
        draw();
      } catch (error) {
        reportError('描画', error);
      }
    });
  }

  function updateScale() {
    const view = views[currentView];
    scale.hidden = view.group !== 'macro' || userMovedCamera;
    if (!scale.hidden) {
      const visibleHeightM = 2 * view.anchor.distanceM * Math.tan(camera.fov * Math.PI / 360);
      scale.firstElementChild.style.width = canvas.clientHeight * 0.001 / visibleHeightM + 'px';
    }
  }

  function setView(viewId) {
    if (!views[viewId]) return false;
    currentView = viewId;
    userMovedCamera = false;
    positionCamera(viewId);
    const comparing = viewId === 'comparison';
    unloaded.visible = comparing;
    comparisonLabels.hidden = !comparing;
    viewLabel.hidden = comparing;
    if (comparing && !textile.visible) setBarefoot(false);
    const current = views[viewId];
    const label = current.group === 'macro' ? '極限マクロ · ' : current.group === 'wrinkles' ? 'シワ · ' : '';
    viewLabel.textContent = label + current.label;
    for (const button of controls) {
      const buttonView = views[button.dataset.view];
      button.setAttribute('aria-pressed', String(button.dataset.view === viewId
        || Boolean(current.group && buttonView.group === current.group)));
    }
    subviews.replaceChildren();
    subviews.hidden = !current.group;
    if (current.group) {
      for (const [id, view] of Object.entries(views)) {
        if (view.group !== current.group) continue;
        const button = document.createElement('button');
        button.textContent = view.label;
        button.setAttribute('aria-pressed', String(id === viewId));
        button.addEventListener('click', () => {
          if (!measuring) setView(id);
        });
        subviews.append(button);
      }
    }
    updateScale();
    requestDraw();
    return true;
  }

  function setDisplay(mode) {
    cloth.mode.value = mode;
    viewMode.value = String(mode);
    const legend = document.getElementById('legend');
    legend.hidden = mode === 0 || !textile.visible;
    document.getElementById('legend-text').textContent = modeLabels[mode] + '  ' + legends[mode];
    requestDraw();
  }

  const barefootButton = document.getElementById('bare-foot');
  function setBarefoot(barefoot) {
    if (barefoot && unloaded.visible) setView('front');
    textile.visible = !barefoot;
    setSkinLoaded(!barefoot);
    barefootButton.setAttribute('aria-pressed', String(barefoot));
    viewMode.disabled = barefoot || measuring;
    document.getElementById('legend').hidden = barefoot || cloth.mode.value === 0;
    requestDraw();
  }
  barefootButton.addEventListener('click', () => {
    if (!measuring) setBarefoot(textile.visible);
  });

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    renderer.setPixelRatio(query.has('capture') ? 1 : Math.min(devicePixelRatio, renderConfig.maxPixelRatio));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    updateScale();
    requestDraw();
  }

  async function profileView(viewId, samples = 90) {
    setView(viewId);
    return withGpuValidation(device, reportError, async () => {
      const metrics = await measureFrames(draw, { samples });
      await device.queue.onSubmittedWorkDone();
      return { ...metrics, width: canvas.width, height: canvas.height };
    });
  }

  async function meshBenchmarks(repeats, includeRendering = false, includeFootFit = false) {
    const results = [];
    for (const level of meshLevels) {
      const { fitted, prepareMs } = await measureSolve(level, repeats);
      const measured = {
        id: level.id, points: fitted.points, renderPoints: fitted.points + 1,
        triangles: fitted.triangles, prepareMs, ...summarize(fitted.elapsedMs)
      };
      if (includeRendering || includeFootFit) {
        const measuredGeometry = createClothGeometry(fitted);
        try {
          if (includeFootFit) {
            measured.footFit = measureFootFit(measuredGeometry, foot, surface.footDistance, surface.footLimitM);
          }
          if (includeRendering) {
            setClothGeometry(measuredGeometry);
            measured.fullView = await profileView('front', 45);
          }
        } finally {
          setClothGeometry(geometry);
          measuredGeometry.dispose();
        }
      }
      results.push(measured);
    }
    return results;
  }

  document.getElementById('mesh-stats').textContent =
    format.format(frame.points) + ' 計算点 · ' + format.format(frame.triangles) + ' 三角形';
  document.getElementById('solve-stats').textContent =
    '布計算 ' + summarize(frame.elapsedMs).medianMs.toFixed(2) + ' ms';
  for (const button of controls) button.addEventListener('click', () => {
    if (!measuring) setView(button.dataset.view);
  });
  document.getElementById('settings-open').addEventListener('click', () => settings.showModal());
  viewMode.addEventListener('change', () => setDisplay(Number(viewMode.value)));
  connectOrbit(canvas, (dx, dy) => {
    if (measuring) return;
    rotate(dx, dy);
    userMovedCamera = true;
    updateScale();
    requestDraw();
  }, factor => {
    if (measuring) return;
    zoom(factor);
    userMovedCamera = true;
    updateScale();
    requestDraw();
  });

  benchmarkButton.addEventListener('click', async () => {
    if (measuring) return;
    measuring = true;
    benchmarkButton.disabled = true;
    viewMode.disabled = true;
    output.textContent = '計測中…';
    const restoreView = currentView;
    const restoreDisplay = cloth.mode.value;
    const restoreBarefoot = !textile.visible;
    try {
      setBarefoot(false);
      setDisplay(0);
      const front = await profileView('front', 72);
      const closeup = await profileView('thigh-macro', 72);
      const levels = await meshBenchmarks(9, true);
      output.textContent = [
        '全体 ' + front.fps.toFixed(1) + ' FPS · マクロ ' + closeup.fps.toFixed(1) + ' FPS',
        ...levels.map(level => format.format(level.points) + ' 点 · '
          + format.format(level.triangles) + ' 三角形 · ' + level.medianMs.toFixed(2)
          + ' ms（95% ' + level.p95Ms.toFixed(2) + ' ms） · 全体 ' + level.fullView.fps.toFixed(1) + ' FPS')
      ].join('\n');
      frameStats.textContent = '全体 ' + front.fps.toFixed(1) + ' FPS';
    } catch (error) {
      reportError('計測', error);
      output.textContent = '計測に失敗しました。';
    } finally {
      measuring = false;
      benchmarkButton.disabled = false;
      viewMode.disabled = false;
      setView(restoreView);
      setDisplay(restoreDisplay);
      setBarefoot(restoreBarefoot);
    }
  });

  new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; resize(); });
  }).observe(document.getElementById('stage'));

  setView(views[query.get('view')] ? query.get('view') : defaultView);
  const initialMode = Number(query.get('display') || 0);
  setBarefoot(query.get('barefoot') === '1');
  setDisplay(Number.isInteger(initialMode) && initialMode >= 0 && initialMode <= 7 ? initialMode : 0);
  resize();
  await withGpuValidation(device, reportError, async () => {
    draw();
    await device.queue.onSubmittedWorkDone();
  });

  if (!result.errors.length) {
    status.dataset.state = 'ready';
    status.textContent = 'WebGPU · 検証エラー 0件';
  }

  if (query.has('capture')) {
    window.stockingStage1a = {
      result, setView, setDisplay, setBarefoot, profileView, meshBenchmarks, unloadedGeometry,
      ...collectFitMetrics(frame, surface, optics, cloth.radiusM),
      footFit: measureFootFit(geometry, foot, surface.footDistance, surface.footLimitM),
      lowerBody: { ...body, textile, tissueField },
      initial: { points: frame.points, triangles: frame.triangles, prepareMs: initial.prepareMs, ...summarize(frame.elapsedMs) }
    };
  }
}
