import { guidedShell } from './guided-shell.wgsl.js';

export async function createGuidedShell(device, input, settings, material) {
  const { frame, nodes } = input;
  const module = device.createShaderModule({ label: 'Guided sleeve motion', code: guidedShell });
  const { messages } = await module.getCompilationInfo();
  const errors = messages.filter(message => message.type === 'error');
  if (errors.length) throw new Error(errors.map(error => error.message).join('\n'));
  const entries = ['read-only-storage', 'storage', 'storage', 'uniform', 'storage'].map((type, binding) => ({
    binding, visibility: GPUShaderStage.COMPUTE, buffer: { type }
  }));
  const layout = device.createBindGroupLayout({ entries });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  const pipelines = await Promise.all(['settle', 'advance', 'measure'].map(entryPoint =>
    device.createComputePipelineAsync({ layout: pipelineLayout, compute: { module, entryPoint } })
  ));
  const bytes = frame.points * 64;
  const flags = GPUBufferUsage;
  const controls = new ArrayBuffer(144);
  new Uint32Array(controls).set([frame.points, frame.columns + 1, frame.rows, frame.points]);
  const counters = new Uint32Array(controls);
  counters[22] = settings.drapePoints;
  counters[23] = settings.drapeIterations;
  const uniforms = new Float32Array(controls);
  uniforms.set([
    0, settings.clearSweep, frame.arcs.at(-1), 0,
    settings.insertionArcM, settings.packedLengthRatio, settings.packingSpanM, settings.bodyClearanceM,
    settings.detachedDepthM, settings.drapeWidthRatio, settings.foldPitchM, settings.gravity,
    material.hoopModulusNpm, material.axialModulusNpm, material.poisson, 0
  ], 4);
  uniforms.set([settings.drapeStepS, settings.floorClearanceM, settings.foldSpacingM, settings.drapeDamping], 24);
  uniforms.set([settings.seatToeArcM, settings.gatherSpanM, settings.gatherHeightM, settings.lateralFoldM], 28);
  uniforms[33] = settings.slantArcM;
  const create = (size, usage) => device.createBuffer({ size, usage });
  const source = create(nodes.byteLength, flags.STORAGE | flags.COPY_DST);
  const predicted = create(frame.points * 16, flags.STORAGE);
  const result = create(bytes, flags.STORAGE | flags.COPY_SRC);
  const uniform = create(controls.byteLength, flags.UNIFORM | flags.COPY_DST);
  const draped = create(settings.drapePoints * 16, flags.STORAGE);
  const readback = create(bytes, flags.MAP_READ | flags.COPY_DST);
  const group = device.createBindGroup({
    layout,
    entries: [source, predicted, result, uniform, draped].map((buffer, binding) => ({ binding, resource: { buffer } }))
  });
  device.queue.writeBuffer(source, 0, nodes);
  const state = new Float32Array(frame.points * 16);

  let previousStep = -1;

  async function sample(progress, elapsed, slant = 0) {
    uniforms[4] = progress;
    uniforms[7] = elapsed;
    uniforms[32] = slant;
    const useChain = progress === 0 || elapsed > 0;
    const step = Math.round(elapsed / settings.drapeStepS);
    const reset = previousStep === -1 || step < previousStep;
    counters[20] = Number(reset);
    counters[21] = useChain ? step - (reset ? 0 : previousStep) : 0;
    previousStep = useChain ? step : -1;
    device.queue.writeBuffer(uniform, 0, controls);
    const encoder = device.createCommandEncoder();
    for (const [index, pipeline] of pipelines.entries()) {
      if (index === 0 && (!useChain || !reset && counters[21] === 0)) continue;
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(index === 0 ? 1 : Math.ceil(frame.points / 64));
      pass.end();
    }
    encoder.copyBufferToBuffer(result, 0, readback, 0, bytes);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    try {
      state.set(new Float32Array(readback.getMappedRange()));
    } finally {
      readback.unmap();
    }
    return state;
  }

  return {
    sample,
    dispose() { for (const buffer of [source, predicted, result, uniform, readback, draped]) buffer.destroy(); }
  };
}
