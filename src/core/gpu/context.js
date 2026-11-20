import { REVISION, WebGPURenderer } from 'three/webgpu';

const supportedRevision = '185';

export async function createGpuContext(canvas, onError) {
  if (!globalThis.isSecureContext || !navigator.gpu) {
    throw new Error('この環境では WebGPU を利用できません。');
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('WebGPU アダプターを取得できません。');

  const device = await adapter.requestDevice();
  device.addEventListener('uncapturederror', ({ error }) => onError('WebGPU', error));
  device.lost.then(({ reason, message }) => {
    if (reason !== 'destroyed') onError('WebGPU デバイス消失', new Error(message || reason));
  });

  try {
    if (REVISION !== supportedRevision) throw new Error('未検証の three.js リビジョン ' + REVISION);
    const renderer = new WebGPURenderer({ canvas, device, alpha: false });
    // r185 compatibility boundary. Audit fallback and backend ownership when updating three.js.
    if (!Object.hasOwn(renderer, '_getFallback') || typeof renderer._getFallback !== 'function') {
      throw new Error('three.js の WebGPU フォールバック設定を確認できません。');
    }
    renderer._getFallback = null;
    await renderer.init();
    if (renderer.backend?.isWebGPUBackend !== true || renderer.backend.device !== device) {
      throw new Error('指定した WebGPU デバイスで描画を初期化できません。');
    }
    return { device, adapter, renderer, revision: REVISION };
  } catch (error) {
    device.destroy();
    throw error;
  }
}

export async function withGpuValidation(device, onError, operation) {
  device.pushErrorScope('validation');
  try {
    return await operation();
  } finally {
    const error = await device.popErrorScope();
    if (error) onError('WebGPU 検証', error);
  }
}
