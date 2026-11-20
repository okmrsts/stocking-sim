# 段階0の検証記録

## 自動撮影

Linux x64 の作業環境で Chrome for Testing Headless Shell 151.0.7922.34 と SwiftShader を使用。WebGPU のバックエンドとデバイスが一致し、three.js のリビジョンが 185 であること、キャンバスの背景と WGSL のグラデーションが PNG に描かれることを確認した。

| 項目 | 実測 |
| --- | --- |
| ブラウザーの画面 | 1000 × 700、DPR 1 |
| WebGPU キャンバス | 640 × 320 |
| 三角形の描画 | 58.1 FPS（rAF 120 間隔） |
| 正常描画の WebGPU 検証エラー | 0件 |
| 故障注入の診断 | 未定義 WGSL 関数に対し行・列を含むエラーを画面に表示、1件 |
| WebGPU アダプターを取得できない場合 | 既定のヘッドレス起動で非対応の表示を確認 |
| 縦長表示 | 390 × 844 の Chromium モバイルエミュレーション。横方向のはみ出しなし |
| 全体・極限マクロ、iPhone Safari | 段階0の診断には脚と布がないため FPS は未測定。Safari の動作も未確認 |

[診断ページの写真](webgpu-probe.png)と[生の計測値](result.json)。段階0には脚と布のシーンがないため、全体・斜め・足首と膝裏・太もも・極限マクロの写真、前段階との比較はない。五視点の設定は [views.json](../views.json) に保存した。

## 再現方法

Playwright が使える Node.js 環境で実行する。撮影用のツールであり、サイトの実行には不要。

```sh
node checks/0/capture.cjs /path/to/chrome-headless-shell /path/to/cdn-cache
```

キャッシュを使う場合は、固定 CDN の `build/` から取得した `three.webgpu.js`、`three.core.js`、`three.tsl.js` をそのディレクトリへ置く。省略すると Headless Shell から CDN に直接アクセスする。使用した起動フラグは [result.json](result.json) に記録した。

この作業環境では標準 Chromium が Unix ソケットの権限制約で起動できなかった。Headless Shell の通常起動でも GPU アダプターは取得できず、SwiftShader の指定だけではキャンバス用共有画像を確保できなかった。Vulkan と Skia Graphite を有効にした構成で撮影に成功した。

Headless Shell から CDN への直接接続は応答を得られなかったため、実測時は CDN から取得し npm 配布とバイト一致を確認した JavaScript を、同じ要求 URL にテスト側から返した。外部 CDN の実機接続は公開後に確認する。

## GitHub Pages

未公開。作業フォルダーにリモートがなく、接続済みリポジトリに該当プロジェクトがなかった。GitHub の新規作成画面は認証を要求し、パスキーはブラウザーの部分対応が表示された後で認証に失敗した。ローカルの `main` ブランチに公開用の静的ページを用意した。

公開できたら iPhone Safari で HTTPS URL を開き、青緑の三角形と「WebGPU 描画成功 · 検証エラー 0件」を確認する。エラーの場合は画面上の詳細、iPhone の機種、iOS の版を記録する。
