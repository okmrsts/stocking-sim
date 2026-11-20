import { shellShader } from './static-shell.wgsl.js';

export async function createStaticShellSolver(device) {
  const module = device.createShaderModule({ label: 'Static cloth shell', code: shellShader });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter(message => message.type === 'error');
  if (errors.length) {
    throw new Error(errors.map(message => message.lineNum + ':' + message.linePos + ' ' + message.message).join('\n'));
  }
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
  const [fit, separateContact, measure] = await Promise.all(['fit', 'separateContact', 'measure'].map(entryPoint =>
    device.createComputePipelineAsync({ layout, compute: { module, entryPoint } })
  ));

  return async function solve(input, settings, repeats = 1) {
    const { columns, rows } = input;
    const points = (columns + 1) * (rows + 1);
    const resultBytes = points * 64;
    const controls = new ArrayBuffer(80);
    new Uint32Array(controls).set([points, columns + 1, rows, 0]);
    new Float32Array(controls).set([
      settings.radialClearanceM, settings.wrinklingWavelengthM,
      settings.compressionThreshold, settings.maxWrinkleAmplitudeM,
      settings.poisson, settings.hoopModulusNpm, settings.axialModulusNpm, 0,
      settings.hoopHardening, settings.axialHardening, settings.selfClearanceM, input.arcs.at(-1) / rows,
      settings.fineWrinkleWavelengthM ?? 0, settings.fineWrinkleAmplitudeM ?? 0, 0, 0
    ], 4);

    const buffers = [];
    const make = (size, usage) => {
      const buffer = device.createBuffer({ size, usage });
      buffers.push(buffer);
      return buffer;
    };

    try {
      const geometry = make(input.input.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      const displaced = make(points * 16, GPUBufferUsage.STORAGE);
      const alternative = make(points * 16, GPUBufferUsage.STORAGE);
      const output = make(resultBytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
      const uniform = make(controls.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
      const readback = make(resultBytes, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
      device.queue.writeBuffer(geometry, 0, input.input);
      device.queue.writeBuffer(uniform, 0, controls);
      const groups = [[displaced, alternative], [alternative, displaced]].map(([read, write]) =>
        device.createBindGroup({
          layout: bindGroupLayout,
          entries: [geometry, read, output, uniform, write].map((buffer, binding) => ({ binding, resource: { buffer } }))
        })
      );

      async function run(copy) {
        const start = performance.now();
        const encoder = device.createCommandEncoder();
        function dispatch(pipeline, group) {
          const pass = encoder.beginComputePass();
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, group);
          pass.dispatchWorkgroups(Math.ceil(points / 64));
          pass.end();
        }
        dispatch(fit, groups[0]);
        for (let iteration = 0; iteration < settings.selfContactIterations; iteration++) {
          dispatch(separateContact, groups[iteration % 2]);
        }
        dispatch(measure, groups[settings.selfContactIterations % 2]);
        if (copy) encoder.copyBufferToBuffer(output, 0, readback, 0, resultBytes);
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        return performance.now() - start;
      }

      await run(false);
      const elapsedMs = [];
      for (let iteration = 0; iteration < repeats; iteration++) elapsedMs.push(await run(false));
      await run(true);
      await readback.mapAsync(GPUMapMode.READ);
      const state = new Float32Array(readback.getMappedRange().slice(0));
      readback.unmap();
      return { ...input, state, elapsedMs, points, triangles: 2 * rows * columns + columns };
    } finally {
      for (const buffer of buffers) buffer.destroy();
    }
  };
}
