import { dressingConfig } from '../config/dressing.js';
import { material } from '../config/stage1a.js';
import { createClothGeometry, updateClothGeometry } from '../core/cloth/geometry.js';
import { createSweptVertexTest } from '../core/geometry/swept-vertices.js';
import { createGuidedShell } from '../core/cloth/guided-shell.js';
import { createDressingInput } from './dressing-input.js';
import { createUnloadedGeometry } from './unloaded-preview.js';

export function createDressingPlayer({ device, getFitting, show, onBlocked, onError }) {
  let resources;
  let preparation;
  let progress = 1;
  let target = 1;
  let action = 'dressing';
  let settling = dressingConfig.settleSeconds;
  let lastTime = 0;
  let animation = 0;
  let inFlight;
  let frozen = false;
  let collisionStops = 0;
  let lastCrossing = -1;
  let frameIntervals = [];
  let pickupTime = 0;

  async function prepare() {
    if (resources) return resources;
    if (!preparation) {
      preparation = (async () => {
        const fitting = getFitting();
        const frame = fitting.frame;
        const relaxed = createUnloadedGeometry(frame);
        try {
          const input = createDressingInput(frame, fitting.surface, relaxed);
          const solver = await createGuidedShell(device, input, dressingConfig, material);
          const test = createSweptVertexTest(fitting.body.loaded, fitting.body.halfStanceM);
          resources = { frame, solver, geometry: createClothGeometry(frame), test };
          return resources;
        } finally {
          relaxed.dispose();
          preparation = null;
        }
      })();
    }
    return preparation;
  }

  async function render(value, elapsed, guard = false, fps = 0) {
    const fitting = getFitting();
    if (!guard && value === 1) {
      show(fitting.geometry, value, elapsed);
      return true;
    }
    const { frame, solver, geometry, test } = await prepare();
    const full = value === 1;
    const state = full ? frame.state : await solver.sample(value, elapsed);
    if (guard && value !== progress) {
      const prior = progress === 1 ? fitting.geometry : geometry;
      const positions = prior.getAttribute('position').array.subarray(0, frame.points * 3);
      const crossing = test(positions, state, 16);
      if (crossing >= 0) {
        lastCrossing = crossing;
        collisionStops++;
        return false;
      }
    }
    if (!full) updateClothGeometry(geometry, frame, state);
    show(full ? fitting.geometry : geometry, value, elapsed, fps);
    return true;
  }

  function queue() {
    if (!frozen && !animation && !inFlight) animation = requestAnimationFrame(tick);
  }

  function tick(now) {
    animation = 0;
    if (lastTime && now > lastTime) frameIntervals.push(now - lastTime);
    if (frameIntervals.length > 120) frameIntervals.shift();
    const fps = frameIntervals.length > 2 ? 1000 * frameIntervals.length / frameIntervals.reduce((a, b) => a + b, 0) : 0;
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60;
    lastTime = now;
    const step = Math.min(dressingConfig.travelStep, dt / dressingConfig.seconds);
    const delta = target - progress;
    const next = Math.abs(delta) <= step ? target : progress + Math.sign(delta) * step;
    const elapsed = next > 0 ? 0 : Math.min(dressingConfig.settleSeconds, settling + dt);
    inFlight = (async () => {
      try {
        let candidate = next;
        for (let attempt = 0; attempt < 4; attempt++) {
          const time = candidate === 0 ? elapsed : candidate < dressingConfig.clearSweep ? pickupTime : 0;
          if (await render(candidate, time, true, fps)) {
            progress = candidate;
            settling = candidate === 0 ? time : 0;
            if (candidate >= dressingConfig.clearSweep) pickupTime = 0;
            return;
          }
          candidate = (candidate + progress) / 2;
        }
        target = progress;
        onBlocked();
      } catch (error) {
        target = progress;
        settling = dressingConfig.settleSeconds;
        onError('着脱', error);
      }
    })().finally(() => {
      inFlight = undefined;
      if (target !== progress || (progress === 0 && settling < dressingConfig.settleSeconds)) queue();
      else lastTime = 0;
    });
  }

  function move(value, kind) {
    if (!animation && !inFlight) frameIntervals = [];
    if (progress === 0 && value > 0) pickupTime = settling;
    frozen = false;
    action = kind;
    target = Math.max(0, Math.min(1, value));
    queue();
  }

  async function pause() {
    frozen = true;
    cancelAnimationFrame(animation);
    animation = 0;
    await inFlight;
    target = progress;
    lastTime = 0;
  }

  async function inspect(value, elapsed = dressingConfig.settleSeconds) {
    await pause();
    await render(value, elapsed);
    target = progress = value;
    settling = elapsed;
  }

  function reset() {
    resources?.solver.dispose();
    resources?.geometry.dispose();
    resources = null;
    target = progress = 1;
    settling = dressingConfig.settleSeconds;
    pickupTime = 0;
    collisionStops = 0;
    lastCrossing = -1;
  }

  return { move, pause, inspect, reset, active: () => Boolean(inFlight || animation),
    status: () => ({ progress, target, action, settling, collisionStops, lastCrossing, frameIntervals: [...frameIntervals] }) };
}
