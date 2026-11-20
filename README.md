# ストッキング・シミュレーター

WebGPU 専用の布シミュレーターを段階ごとに作ります。段階1aでは固定版 three.js と自作 WGSL で、へそから下の両脚に20D平編みニーハイを着用させます。布の接触圧に応じた肌の変形と、無荷重時の布の基準形状を同じ縮尺で比較できます。

## 開き方

リポジトリのルートで `python3 -m http.server 8765` を実行し、WebGPU に対応したブラウザーで [localhost](http://localhost:8765/) を開きます。ビルドやパッケージのインストールは不要です。CDN に接続できる必要があります。

[GitHub Pages のシミュレーター](https://okmrsts.github.io/stocking-sim/) を開けます。配信元は `main` の `/(root)` です。[段階0の診断](checks/0/probe.html) · [段階1aの両脚と肌の圧縮の検証](checks/1a-bilateral/README.md)

## ファイル

| ファイル | 内容 |
| --- | --- |
| [index.html](index.html) | 段階1aの入口と固定 import map |
| [docs/SPEC.md](docs/SPEC.md) | 部品の境界、データ、物理、表示、検証仕様 |
| [docs/MANUAL.md](docs/MANUAL.md) | 診断の使い方と後段の操作予定 |
| [docs/EXTENDING.md](docs/EXTENDING.md) | 編み組織・素材・外部モデルの拡張点 |
| [docs/decisions/](docs/decisions/) | 設計上の決定 |
| [src/](src/) | WebGPU初期化、脚の曲面、布計算、編み目、画面・設定 |
| [checks/views-1a-bilateral.json](checks/views-1a-bilateral.json) | 下半身の固定した五視点と足部・履き口の追加視点 |
| [checks/0/](checks/0/) | 段階0の検証記録 |
| [CHANGELOG.md](CHANGELOG.md) | 段階別の変更履歴 |
