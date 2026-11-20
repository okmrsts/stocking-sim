import { dressingConfig } from '../config/dressing.js';
import { material } from '../config/stage1a.js';
import { createClothGeometry, updateClothGeometry } from '../core/cloth/geometry.js';
import { createSweptSelfClient } from '../core/geometry/swept-self-client.js';
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
  let slant = 0, targetSlant = 0, speed = 1;
  let selfStops = 0, checkedSteps = 0;
  let lastSelfFaces = null;
  const contactMs = [];

  async function prepare() {
    if (resources) return resources;
    if (!preparation) {
      preparation = (async () => {
        const fitting = getFitting();
        const frame = fitting.frame;
        const relaxed = createUnloadedGeometry(frame);
        try {
          const input = createDressingInput(frame, fitting.surface, relaxed);
          const stride = frame.columns + 1;
          const geometry = createClothGeometry(frame);
          const test = createSweptVertexTest(fitting.body.loaded, fitting.body.halfStanceM);
          const selfTest = await createSweptSelfClient(geometry,
            id => id < frame.points && id % stride === frame.columns ? id - frame.columns : id);
          try {
            const solver = await createGuidedShell(device, input, dressingConfig, material);
            const candidatePositions = new Float32Array((frame.points + 1) * 3);
            resources = { frame, solver, geometry, test, selfTest, candidatePositions };
          } catch (error) {
            selfTest.dispose();
            geometry.dispose();
            throw error;
          }
          return resources;
        } finally {
          relaxed.dispose();
          preparation = null;
        }
      })();
    }
    return preparation;
  }

  async function render(value, elapsed, direction, guard = false, fps = 0) {
    const fitting = getFitting();
    if (!guard && value === 1) {
      show(fitting.geometry, value, elapsed);
      return true;
    }
    const { frame, solver, geometry, test, selfTest, candidatePositions } = await prepare();
    const full = value === 1;
    const state = full ? frame.state : await solver.sample(value, elapsed, direction);
    if (guard) {
      const begin = performance.now();
      const prior = progress === 1 ? fitting.geometry : geometry;
      const positions = prior.getAttribute('position').array;
      const toe = frame.points * 3;
      candidatePositions.fill(0, toe);
      let acrossCentre = false;
      for (let i = 0; i < frame.points; i++) {
        for (let axis = 0; axis < 3; axis++) {
          const coordinate = state[i * 16 + axis];
          candidatePositions[i * 3 + axis] = coordinate;
          if (i < frame.columns) candidatePositions[toe + axis] += coordinate / frame.columns;
        }
        acrossCentre ||= candidatePositions[i * 3] + fitting.body.halfStanceM <= 0;
      }
      const crossing = test(positions, candidatePositions, 3);
      const ordered = progress === 0 && value === 0
        && orderedDrape(positions, frame) && orderedDrape(candidatePositions, frame);
      const touching = crossing < 0 && (acrossCentre || (!ordered && await selfTest.firstContact(positions, candidatePositions)));
      contactMs.push(performance.now() - begin);
      if (contactMs.length > 120) contactMs.shift();
      if (crossing >= 0 || touching) {
        lastCrossing = crossing;
        if (crossing >= 0) collisionStops++;
        else {
          lastSelfFaces = touching === true ? 'mirror-plane' : touching;
          selfStops++;
        }
        return false;
      }
      checkedSteps++;
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
    const step = Math.min(dressingConfig.travelStep, dt * speed / dressingConfig.seconds);
    const directionStep = Math.min(Math.abs(slant - targetSlant), dt * dressingConfig.slantChangePerS);
    const nextSlant = directionStep === Math.abs(slant - targetSlant) ? targetSlant
      : slant + Math.sign(targetSlant - slant) * directionStep;
    const delta = target - progress;
    const next = Math.abs(delta) <= step ? target : progress + Math.sign(delta) * step;
    const elapsed = next > 0 ? 0 : Math.min(dressingConfig.settleSeconds, settling + dt);
    inFlight = (async () => {
      try {
        let candidate = next, direction = nextSlant;
        for (let attempt = 0; attempt < 4; attempt++) {
          const time = candidate === 0 ? elapsed : candidate < dressingConfig.clearSweep ? pickupTime : 0;
          if (await render(candidate, time, direction, true, fps)) {
            progress = candidate;
            slant = direction;
            settling = candidate === 0 ? time : 0;
            if (candidate >= dressingConfig.clearSweep) pickupTime = 0;
            return;
          }
          candidate = (candidate + progress) / 2;
          direction = (direction + slant) / 2;
        }
        target = progress;
        targetSlant = slant;
        onBlocked();
      } catch (error) {
        target = progress;
        targetSlant = slant;
        settling = dressingConfig.settleSeconds;
        onError('着脱', error);
      }
    })().finally(() => {
      inFlight = undefined;
      if (target !== progress || targetSlant !== slant || (progress === 0 && settling < dressingConfig.settleSeconds)) queue();
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

  function pull(direction, quick) {
    targetSlant = Math.max(-1, Math.min(1, direction));
    speed = quick ? dressingConfig.quickFactor : 1;
    if (progress === 0 || progress === 1) slant = targetSlant;
    if (!frozen && (target !== progress || targetSlant !== slant)) queue();
  }

  async function pause() {
    frozen = true;
    cancelAnimationFrame(animation);
    animation = 0;
    await inFlight;
    target = progress;
    targetSlant = slant;
    lastTime = 0;
  }

  async function inspect(value, elapsed = dressingConfig.settleSeconds, direction = slant) {
    await pause();
    await render(value, elapsed, direction);
    targetSlant = slant = direction;
    target = progress = value;
    settling = elapsed;
  }

  function reset() {
    resources?.solver.dispose();
    resources?.selfTest.dispose();
    resources?.geometry.dispose();
    resources = null;
    target = progress = 1;
    settling = dressingConfig.settleSeconds;
    pickupTime = 0;
    collisionStops = 0;
    lastCrossing = -1;
    targetSlant = slant = 0;
    speed = 1;
    selfStops = checkedSteps = 0;
    lastSelfFaces = null;
    contactMs.length = 0;
  }

  return { move, pull, pause, inspect, reset, active: () => Boolean(inFlight || animation),
    status: () => ({ progress, target, action, settling, collisionStops, lastCrossing, selfStops,
      lastSelfFaces, checkedSteps, slant, contactMs: [...contactMs], frameIntervals: [...frameIntervals] }) };
}

// The unshifted drape keeps each elliptical section in a fixed-Z plane.
// A strict order at both endpoints separates the strips throughout the step.
function orderedDrape(positions, { rows, columns }) {
  const stride = columns + 1;
  let previous = Infinity;
  for (let row = 0; row <= rows; row++) {
    const i = row * stride * 3;
    const depth = positions[i + 2];
    if (!(depth < previous)) return false;
    for (let column = 1; column <= columns; column++) {
      if (positions[i + 3 * column + 2] !== depth) return false;
    }
    previous = depth;
  }
  return true;
}
