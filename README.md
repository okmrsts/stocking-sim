# ストッキング・シミュレーター

WebGPU 専用の布シミュレーターを段階ごとに作ります。段階0では固定版 three.js と自作 WGSL を使う描画診断ページを用意しています。

## 開き方

リポジトリのルートで `python3 -m http.server 8765` を実行し、WebGPU に対応したブラウザーで [localhost](http://localhost:8765/) を開きます。ビルドやパッケージのインストールは不要です。CDN に接続できる必要があります。

GitHub Pages ではブランチルートを公開元に指定し、発行された HTTPS ページを開きます。公開結果と撮影検証は [段階0の記録](checks/0/README.md) に記載します。

## ファイル

| ファイル | 内容 |
| --- | --- |
| [index.html](index.html) | WebGPU 診断と固定 import map |
| [docs/SPEC.md](docs/SPEC.md) | 部品の境界、データ、物理、表示、検証仕様 |
| [docs/MANUAL.md](docs/MANUAL.md) | 診断の使い方と後段の操作予定 |
| [docs/EXTENDING.md](docs/EXTENDING.md) | 編み組織・素材・外部モデルの拡張点 |
| [docs/decisions/](docs/decisions/) | 設計上の決定 |
| [checks/views.json](checks/views.json) | 五視点の比較条件 |
| [checks/0/](checks/0/) | 段階0の検証記録 |
| [CHANGELOG.md](CHANGELOG.md) | 段階別の変更履歴 |
