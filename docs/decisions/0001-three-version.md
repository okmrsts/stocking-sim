# 0001 three.js を 0.185.0（r185）に固定する

決定日 2026-11-20

r185 を採用する。公式リリース、タグに固定された例、ブラウザー用 CDN 配布と同じ版の DefinitelyTyped 宣言を取得した。公式計算例の `three/webgpu`、`three/tsl`、`renderer.init()`、`renderer.compute()`、`renderer.render()` と、型定義の `colorNode`、`wgslFn`、`WebGPURendererParameters.device` を確認した。型定義は開発時の参照資料。

r185 は TSL 計算のバインディング更新を修正している。変更されたプリマルチプライドアルファの処理に合わせて背景を不透明にし、シアー素材のアルファ合成は段階1で検証する。

import map の `three` と `three/webgpu` は jsDelivr 上の同じ npm ファイルを参照する。r185 は内部で WebGL フォールバックを設定する。初期化部では r185 のソースで確認した `renderer._getFallback = null` を一箇所で設定し、`init()` 後にバックエンドとデバイスを照合する。

- [r185 公式リリース](https://github.com/mrdoob/three.js/releases/tag/r185)
- [公式計算例のタグ固定ソース](https://cdn.jsdelivr.net/gh/mrdoob/three.js@r185/examples/webgpu_compute_particles.html)
- [公式ノードマテリアル例のタグ固定ソース](https://cdn.jsdelivr.net/gh/mrdoob/three.js@r185/examples/webgpu_tsl_vfx_flames.html)
- [three.js 0.185.0 配布ソース](https://registry.npmjs.org/three/-/three-0.185.0.tgz)
- [DefinitelyTyped の型定義 0.185.0](https://registry.npmjs.org/@types/three/-/three-0.185.0.tgz)
- [移行ガイド 184 → 185](https://github.com/mrdoob/three.js/wiki/Migration-Guide#184--185)
