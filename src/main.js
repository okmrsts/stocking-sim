import { NeutralToneMapping, SRGBColorSpace } from 'three/webgpu';
import { createClothGeometry, sampleCloth } from './core/cloth/geometry.js';
import { createStaticShellSolver } from './core/cloth/solver.js';
import { createGpuContext, withGpuValidation } from './core/gpu/context.js';
import { createTextileMaterial } from './core/textile/material.js';
import { measureFrames, summarize } from './core/ui/metrics.js';
import { connectOrbit } from './core/ui/pointer-router.js';
import {
  comparisonConfig, diagnostics, meshLevels, renderConfig, tissueDisplay
} from './config/stage1a.js';
import { buildFitting, disposeFitting } from './stocking/build-fitting.js';
import { connectBodyControls } from './stocking/body-controls.js';
import { createUnloadedGeometry } from './stocking/unloaded-preview.js';
import { createStudio } from './stocking/scene.js';
import { createStageCamera } from './stocking/stage-camera.js';
import { createComparisonView } from './stocking/comparison-view.js';
import { collectFitMetrics } from './stocking/stage1a-metrics.js';
import { measureFootFit } from './stocking/foot-fit-metrics.js';
import { garments, textileOptics } from './config/garments.js';
import { dressingConfig } from './config/dressing.js';
import { createDressingPlayer } from './stocking/dressing-player.js';

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
  const garmentSelect = document.getElementById('garment-preset');
  const garmentNote = document.getElementById('preset-note');
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

  const response = await fetch(new URL('../checks/views-1a-anatomy.json', import.meta.url));
  if (!response.ok) throw new Error('視点の設定を読み込めません。');
  const { views, defaultView } = await response.json();
  views.dressing = dressingConfig.view;
  views['dressing-detached'] = dressingConfig.detachedView;
  views['dressing-split'] = dressingConfig.splitView;
  const solver = await withGpuValidation(device, reportError, () => createStaticShellSolver(device));
  const solve = (...args) => withGpuValidation(device, reportError, () => solver(...args));
  const requestedGarment = query.get('garment');
  const initialGarment = Object.hasOwn(garments, requestedGarment) ? garments[requestedGarment] : garments['knee-high'];
  let fitting = await buildFitting({}, solve, 7, initialGarment);
  let optics = textileOptics(initialGarment);
  const cloth = createTextileMaterial(optics, diagnostics);
  let yarn = { radiusM: cloth.radiusM, netRadiusM: cloth.netRadiusM };
  let unloadedGeometry = createUnloadedGeometry(fitting.frame);
  const { scene, textile, unloaded, setSkinLoaded, setBody, setTissueMap, setClothGeometry,
    setBodyVisible, setNailsVisible } = createStudio(
    renderConfig, fitting.body, fitting.geometry, unloadedGeometry, cloth.material, tissueDisplay, fitting.joined
  );
  const { camera, target, setView: positionCamera, setAspect, rotate, zoom, zoomRatio } = createStageCamera(views, anchor => {
    const { frame, surface, body } = fitting;
    const sample = sampleCloth(frame, surface, anchor.arcM, anchor.angleRad);
    return {
      positionM: sample.position.map((coordinate, axis) =>
        coordinate + (axis === 0 ? body.halfStanceM : 0) + sample.normal[axis] * anchor.distanceM),
      targetM: [sample.position[0] + body.halfStanceM, ...sample.position.slice(1)]
    };
  });
  const comparison = createComparisonView(unloaded, comparisonConfig);
  const draw = () => renderer.render(scene, unloaded.visible
    ? comparison.synchronize(camera, target, zoomRatio(), comparisonDepth)
    : camera);
  let currentView = defaultView;
  let resizeQueued = false;
  let drawQueued = false;
  let measuring = false;
  let userMovedCamera = false;
  let tissueVisible = false;
  let bareBeforeMap = false;
  let arrangement = 'together';
  let comparisonDepth = 0;
  let viewingBarefoot = false;
  const dressingOpen = document.getElementById('dressing-open');
  const dressingControls = document.getElementById('dressing-controls');
  const dressingProgress = document.getElementById('dressing-progress');
  const dressingPosition = document.getElementById('dressing-position');
  const dressingArrangement = document.getElementById('dressing-arrangement');
  let draggingProgress = false;
  const dressing = createDressingPlayer({
    device, getFitting: () => fitting, onError: reportError,
    onBlocked: () => { dressingPosition.value = '接触で停止'; },
    show: (geometry, progress, elapsed, framesPerSecond) => {
      setClothGeometry(geometry, progress === 1 ? fitting.joined : null);
      if (!draggingProgress) dressingProgress.value = Math.round(1000 * progress);
      const label = progress === 1 ? '着用中' : progress === 0 ? '脱衣後' : Math.round(progress * 100) + '%';
      dressingPosition.value = label;
      dressingProgress.setAttribute('aria-valuetext', label);
      if (framesPerSecond > 0) frameStats.textContent = '着脱 ' + framesPerSecond.toFixed(1) + ' FPS';
      updateArrangement(progress);
      requestDraw();
    }
  });

  function updateArrangement(progress = dressing.status().progress) {
    const split = arrangement === 'split';
    const clothOnly = arrangement === 'cloth';
    const bodyOnly = arrangement === 'body';
    setBodyVisible(!clothOnly);
    setNailsVisible(!clothOnly && !tissueVisible);
    textile.visible = clothOnly || (!split && !bodyOnly && !viewingBarefoot);
    setSkinLoaded(arrangement === 'together' && progress > 0 && !viewingBarefoot);
    const oldComparison = currentView === 'comparison';
    unloaded.visible = split || oldComparison;
    const draped = split && progress === 0;
    unloaded.geometry = draped ? textile.children[0].geometry : unloadedGeometry;
    comparisonDepth = draped ? unloaded.geometry.boundingSphere.center.z : 0;
    comparisonLabels.hidden = !unloaded.visible;
    comparisonLabels.children[0].textContent = split ? '素脚' : '両脚に着用';
    comparisonLabels.children[1].textContent = draped ? '脱衣後の布' : '未着用（無荷重）';
    viewMode.disabled = !textile.visible || measuring;
    for (const mode of [3, 6, 7]) {
      viewMode.options[mode].disabled = progress < 1 || Boolean(fitting.joined && mode >= 6);
    }
    if (viewMode.selectedOptions[0]?.disabled) setDisplay(0);
    dressingArrangement.value = arrangement;
    updateLegend();
  }

  function enterDressing() {
    if (measuring || fitting.garment.upper) return;
    if (tissueVisible) setTissueVisible(false);
    if (viewingBarefoot) setBarefoot(false);
    dressingControls.hidden = false;
    dressingOpen.setAttribute('aria-expanded', 'true');
    if (!currentView.startsWith('dressing')) setView('dressing');
    updateArrangement();
    requestDraw();
  }

  dressingOpen.addEventListener('click', () => {
    if (measuring) return;
    if (dressingControls.hidden) enterDressing();
    else {
      dressingControls.hidden = true;
      dressingOpen.setAttribute('aria-expanded', 'false');
      arrangement = 'together';
      setView('dressing');
      updateArrangement();
      requestDraw();
    }
  });
  for (const [id, target] of [['dress', 1], ['lower', 0.43], ['remove', 0]]) {
    document.getElementById(id).addEventListener('click', () => {
      if (measuring) return;
      enterDressing();
      arrangement = 'together';
      setView('dressing');
      updateArrangement();
      dressing.move(target, id);
    });
  }
  document.getElementById('pause-dressing').addEventListener('click', () => dressing.pause());
  dressingProgress.addEventListener('input', () => {
    if (measuring) return;
    dressing.move(Number(dressingProgress.value) / 1000, 'scrub');
  });
  dressingProgress.addEventListener('pointerdown', () => { draggingProgress = true; });
  for (const event of ['pointerup', 'pointercancel', 'blur']) {
    addEventListener(event, () => { draggingProgress = false; }, true);
  }
  dressingArrangement.addEventListener('change', () => {
    if (measuring) return;
    arrangement = dressingArrangement.value;
    setView(arrangement === 'split' ? 'dressing-split'
      : arrangement === 'cloth' && dressing.status().progress === 0 ? 'dressing-detached' : 'dressing');
    updateArrangement();
    requestDraw();
  });

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
    if (fitting.garment.upper && (viewId === 'comparison' || viewId.startsWith('dressing'))) viewId = 'front';
    currentView = viewId;
    userMovedCamera = false;
    positionCamera(viewId);
    const comparing = viewId === 'comparison';
    if (comparing || !viewId.startsWith('dressing') && arrangement !== 'together') {
      arrangement = 'together';
      updateArrangement();
    }
    if (comparing && tissueVisible) setTissueVisible(false);
    unloaded.visible = comparing || arrangement === 'split';
    comparisonLabels.hidden = !unloaded.visible;
    viewLabel.hidden = unloaded.visible;
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

  const legend = document.getElementById('legend');
  const legendText = document.getElementById('legend-text');

  function updateLegend() {
    legend.hidden = !tissueVisible && (cloth.mode.value === 0 || !textile.visible);
    legendText.textContent = tissueVisible
      ? '変形しやすさ 0 — ' + tissueDisplay.maxMmPerKpa + ' mm/kPa（青ほど硬い）'
      : modeLabels[cloth.mode.value] + '  ' + legends[cloth.mode.value];
  }

  function setDisplay(mode) {
    cloth.mode.value = mode;
    viewMode.value = String(mode);
    updateLegend();
    requestDraw();
  }

  const barefootButton = document.getElementById('bare-foot');
  function setBarefoot(barefoot) {
    if (barefoot && unloaded.visible) setView('front');
    viewingBarefoot = barefoot;
    textile.visible = !barefoot;
    setSkinLoaded(!barefoot && dressing.status().progress > 0);
    barefootButton.setAttribute('aria-pressed', String(barefoot));
    viewMode.disabled = barefoot || measuring;
    updateLegend();
    requestDraw();
  }

  function setTissueVisible(enabled) {
    if (enabled === tissueVisible) return true;
    if (enabled) {
      bareBeforeMap = !textile.visible;
      setBarefoot(true);
    }
    tissueVisible = enabled;
    setTissueMap(enabled);
    updateMapButton(enabled);
    if (!enabled) setBarefoot(bareBeforeMap);
    updateLegend();
    requestDraw();
    return true;
  }

  barefootButton.addEventListener('click', () => {
    if (measuring) return;
    if (tissueVisible) setTissueVisible(false);
    else if (arrangement !== 'together') {
      arrangement = 'together';
      setView('front');
      setBarefoot(true);
    } else setBarefoot(textile.visible);
  });

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    renderer.setPixelRatio(query.has('capture') ? 1 : Math.min(devicePixelRatio, renderConfig.maxPixelRatio));
    renderer.setSize(width, height, false);
    setAspect(width / height);
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
    const { measureSolve, surface, geometry, joined, assemble, body: { foot } } = fitting;
    const results = [];
    for (const level of meshLevels) {
      const { fitted, prepareMs } = await measureSolve(level, repeats);
      const measured = {
        id: level.id, points: fitted.points, renderPoints: fitted.points + 1,
        triangles: fitted.triangles, prepareMs, ...summarize(fitted.elapsedMs)
      };
      if (includeRendering || includeFootFit) {
        const measuredGeometry = createClothGeometry(fitted);
        let whole;
        try {
          if (includeFootFit) {
            measured.footFit = measureFootFit(measuredGeometry, foot, surface.footDistance, surface.footLimitM);
          }
          if (includeRendering) {
            whole = assemble(fitted, measuredGeometry);
            if (whole) measured.wornTriangles = whole.index.count / 3;
            setClothGeometry(measuredGeometry, whole);
            measured.fullView = await profileView('front', 45);
          }
        } finally {
          setClothGeometry(geometry, joined);
          whole?.dispose();
          measuredGeometry.dispose();
        }
      }
      results.push(measured);
    }
    return results;
  }

  function updateFitStats() {
    const { frame } = fitting;
    document.getElementById('mesh-stats').textContent =
      format.format(frame.points) + ' 計算点（片脚） · '
      + format.format(fitting.joined ? fitting.joined.index.count / 3 : frame.triangles * 2) + ' 三角形（着用面）';
    document.getElementById('solve-stats').textContent =
      '布計算 ' + summarize(frame.elapsedMs).medianMs.toFixed(2) + ' ms';
  }

  function syncGarmentControls() {
    const { garment } = fitting;
    garmentSelect.value = garment.id;
    for (const button of [dressingOpen, controls.find(item => item.dataset.view === 'comparison')]) {
      button.disabled = Boolean(garment.upper);
    }
    garmentNote.textContent = garment.upper ? '静止着用 · 着脱と無荷重比較はニーハイで利用できます' : '';
    garmentNote.hidden = !garment.upper;
    canvas.setAttribute('aria-label', garment.label + 'の3D表示');
  }

  async function updateFitting(values, garment) {
    if (measuring) return false;
    if (garment === fitting.garment && Object.entries(fitting.dimensions).every(([id, value]) => values[id] === value)) return true;
    measuring = true;
    garmentSelect.disabled = true;
    try {
      await dressing.pause();
      const next = await buildFitting(values, solve, 5, garment);
      const previous = fitting;
      const previousUnloaded = unloadedGeometry;
      unloadedGeometry = createUnloadedGeometry(next.frame);
      fitting = next;
      optics = textileOptics(garment);
      yarn = cloth.setOptics(optics);
      setBody(next.body);
      setClothGeometry(next.geometry, next.joined);
      dressing.reset();
      if (garment.upper) {
        dressingControls.hidden = true;
        dressingOpen.setAttribute('aria-expanded', 'false');
        arrangement = 'together';
      }
      syncGarmentControls();
      updateArrangement(1);
      dressingProgress.value = '1000';
      dressingPosition.value = '着用中';
      setSkinLoaded(textile.visible);
      setTissueMap(tissueVisible);
      setView(currentView);
      updateFitStats();
      frameStats.textContent = '';
      exposeCapture();
      disposeFitting(previous);
      previousUnloaded.dispose();
      return true;
    } catch (error) {
      garmentSelect.value = fitting.garment.id;
      reportError('着用フィットの更新', error);
      throw error;
    } finally {
      measuring = false;
      garmentSelect.disabled = false;
      viewMode.disabled = !textile.visible;
      requestDraw();
    }
  }

  const applyBody = values => updateFitting(values, fitting.garment);
  const applyGarment = id => Object.hasOwn(garments, id) && updateFitting(fitting.dimensions, garments[id]);
  garmentSelect.addEventListener('change', () => {
    applyGarment(garmentSelect.value)?.catch(error => { console.error(error); });
  });
  const updateMapButton = connectBodyControls({
    initial: fitting.dimensions,
    onApply: applyBody,
    onMap: enabled => !measuring && setTissueVisible(enabled)
  });
  updateFitStats();
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
    garmentSelect.disabled = true;
    viewMode.disabled = true;
    output.textContent = '計測中…';
    const restoreView = currentView;
    const restoreArrangement = arrangement;
    const restoreDisplay = cloth.mode.value;
    const restoreMap = tissueVisible;
    if (restoreMap) setTissueVisible(false);
    const restoreBarefoot = !textile.visible;
    let restoreMotion;
    try {
      await dressing.pause();
      restoreMotion = dressing.status();
      arrangement = 'together';
      await dressing.inspect(1);
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
      garmentSelect.disabled = false;
      viewMode.disabled = false;
      setView(restoreView);
      setDisplay(restoreDisplay);
      if (restoreMotion) await dressing.inspect(restoreMotion.progress, restoreMotion.settling);
      setBarefoot(restoreBarefoot);
      if (restoreArrangement !== 'together') {
        arrangement = restoreArrangement;
        setView(restoreView);
        updateArrangement();
      }
      if (restoreMap) setTissueVisible(true);
    }
  });

  new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; resize(); });
  }).observe(document.getElementById('stage'));

  syncGarmentControls();
  setView(views[query.get('view')] ? query.get('view') : defaultView);
  const initialMode = Number(query.get('display') || 0);
  setBarefoot(query.get('barefoot') === '1');
  setDisplay(Number.isInteger(initialMode) && initialMode >= 0 && initialMode <= 7 ? initialMode : 0);
  updateArrangement();
  resize();
  await withGpuValidation(device, reportError, async () => {
    draw();
    await device.queue.onSubmittedWorkDone();
  });

  if (!result.errors.length) {
    status.dataset.state = 'ready';
    status.textContent = 'WebGPU · 検証エラー 0件';
  }

  function exposeCapture() {
    if (!query.has('capture')) return;
    const { frame, surface, body, geometry, tissueField, initial, dimensions } = fitting;
    window.stockingStage1a = {
      result, setView, setDisplay, setBarefoot, setTissueVisible, profileView, meshBenchmarks, unloadedGeometry,
      dressing: { inspect: dressing.inspect, move: dressing.move, pause: dressing.pause, status: dressing.status },
      surface,
      applyBody, applyGarment, dimensions, garment: fitting.garment.id, yarn, joined: fitting.joined,
      ...collectFitMetrics(frame, surface, optics, yarn.radiusM),
      footFit: measureFootFit(geometry, body.foot, surface.footDistance, surface.footLimitM),
      lowerBody: { ...body, textile, tissueField },
      initial: { points: frame.points, triangles: frame.triangles, prepareMs: initial.prepareMs, ...summarize(frame.elapsedMs) }
    };
  }
  exposeCapture();
  garmentSelect.disabled = false;
  if (query.get('view') === 'dressing' && !query.has('capture')) enterDressing();
}
