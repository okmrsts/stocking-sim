# 0004 診断の撮影に Chrome Headless Shell と SwiftShader を使う

決定日 2026-11-20

作業環境にハードウェア描画用のデバイスがなく、標準 Chromium の起動は Unix ソケット制約で止まった。公式配布の Chrome Headless Shell と SwiftShader で WebGPU を有効にし、Vulkan・Skia Graphite を使ってキャンバスを自動撮影する。色付きの三角形を WGSL で描くことで、API の有無の判定に加えて作業環境でのシェーダー描画と PNG 取得まで確かめた。

Headless Shell が CDN へ接続できない場合は、取得済みの同じ版の CDN 応答を撮影処理に渡す。これらのブラウザー設定とテスト用キャッシュは作業環境内の撮影に使う。端末の性能は iPhone Safari 実機の計測で判定する。

- [Chrome for Developers のヘッドレス WebGPU 起動ガイド](https://developer.chrome.com/blog/supercharge-web-ai-testing)
- [実測の環境と手順](../../checks/0/README.md)
