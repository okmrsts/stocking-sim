# 0007 three.js の内部参照を WebGPU 初期化に集約する

決定日 2026-11-20

段階0と段階1aは `src/core/gpu/context.js` の `createGpuContext()` を共用する。r185 の `renderer._getFallback` を無効化し、`init()` 後に `renderer.backend.isWebGPUBackend` と `renderer.backend.device` を照合する。これらは upstream の内部に依存するコードとして、このファイルに集約した。固定版と想定した形が違う場合は画面にエラーを出す。

版を上げるときは、次を確認してから固定値を更新する。

1. 新しい版の公式例、実装、型定義で `WebGPURenderer` に呼び出し側の `GPUDevice` を渡す方法を照合する。
2. WebGPU 初期化に失敗しても WebGL へ切り替わらないことを確認する。公開された制御方法が提供されていれば、内部参照をそれに置き換える。
3. 段階0の診断と段階1aの五視点を再実行する。対応環境で WebGPU 検証 0 件、WebGPU 非対応で診断が表示されること、使用デバイスが同一であることを確かめる。
4. `wgslFn` のノード受け渡し、フラグメントの微分、透明素材のアルファ合成、sRGB 出力を確認する。

- [r185 固定の経緯](0001-three-version.md)
