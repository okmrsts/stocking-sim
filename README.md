# ストッキング・シミュレーター

「プリセット」から、20Dニーハイ、20Dパンスト、60Dタイツ、網タイツを比較できます。ニーハイの「着脱」では、着用、ずり下ろし、引き抜き、素脚と布の別表示を試せます。

WebGPU 専用の布シミュレーターを段階ごとに作ります。段階1aでは固定版 three.js と自作 WGSL で、へそから下の両脚に20D平編みニーハイを着用させます。布の接触圧に応じた肌の変形と、無荷重時の布の基準形状を同じ縮尺で比較できます。腰・骨盤・臀部・脚の寸法を調整して再フィットし、軟組織の変形しやすさを色表示できます。

## 開き方

リポジトリのルートで `python3 -m http.server 8765` を実行し、WebGPU に対応したブラウザーで [localhost](http://localhost:8765/) を開きます。ビルドやパッケージのインストールは不要です。CDN に接続できる必要があります。

[GitHub Pages のシミュレーター](https://okmrsts.github.io/stocking-sim/) を開けます。配信元は `main` の `/(root)` です。[段階0の診断](checks/0/probe.html) · [段階1aの下半身形状と寸法の検証](checks/1a-anatomy/README.md) · [臀部の修正前後の比較](checks/1a-gluteal/README.md)

## ファイル

| ファイル | 内容 |
| --- | --- |
| [index.html](index.html) | シミュレーターの入口と固定 import map |
| [docs/SPEC.md](docs/SPEC.md) | 部品の境界、データ、物理、表示、検証仕様 |
| [docs/MANUAL.md](docs/MANUAL.md) | 着脱と診断の操作 |
| [docs/EXTENDING.md](docs/EXTENDING.md) | 編み組織・素材・外部モデルの拡張点 |
| [docs/decisions/](docs/decisions/) | 設計上の決定 |
| [src/](src/) | WebGPU初期化、脚の曲面、布計算、編み目、画面・設定 |
| [checks/views-1a-anatomy.json](checks/views-1a-anatomy.json) | 下半身の固定五視点と側面・背面・臀部・足部・履き口 |
| [checks/1b/](checks/1b/README.md) | 腰丈の3種類と固定視点の比較 |
| [checks/2/](checks/2/README.md) | 着脱の写真と検証記録 |
| [checks/0/](checks/0/) | 段階0の検証記録 |
| [CHANGELOG.md](CHANGELOG.md) | 段階別の変更履歴 |
