# ストッキング・シミュレーター

WebGPU 専用の布シミュレーターを段階ごとに作ります。段階1aでは固定版 three.js と自作 WGSL で、片脚の20D平編みニーハイの静止着用、折り返した布どうしの接触、足部の5本の指と踵を表示します。

## 開き方

リポジトリのルートで `python3 -m http.server 8765` を実行し、WebGPU に対応したブラウザーで [localhost](http://localhost:8765/) を開きます。ビルドやパッケージのインストールは不要です。CDN に接続できる必要があります。

[GitHub Pages のシミュレーター](https://okmrsts.github.io/stocking-sim/) を開けます。配信元は `main` の `/(root)` です。[段階0の診断](checks/0/probe.html) · [段階1aの足部とサイズの調整前後](checks/1a-close-fit/README.md)

## ファイル

| ファイル | 内容 |
| --- | --- |
| [index.html](index.html) | 段階1aの入口と固定 import map |
| [docs/SPEC.md](docs/SPEC.md) | 部品の境界、データ、物理、表示、検証仕様 |
| [docs/MANUAL.md](docs/MANUAL.md) | 診断の使い方と後段の操作予定 |
| [docs/EXTENDING.md](docs/EXTENDING.md) | 編み組織・素材・外部モデルの拡張点 |
| [docs/decisions/](docs/decisions/) | 設計上の決定 |
| [src/](src/) | WebGPU初期化、脚の曲面、布計算、編み目、画面・設定 |
| [checks/views-1a-revision.json](checks/views-1a-revision.json) | 片脚のニーハイ用に固定した五視点と足部の追加視点 |
| [checks/0/](checks/0/) | 段階0の検証記録 |
| [CHANGELOG.md](CHANGELOG.md) | 段階別の変更履歴 |
