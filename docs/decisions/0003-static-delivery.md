# 0003 静的ファイルを GitHub Pages から配信する

決定日 2026-11-20

この決定は [0005](0005-netlify-delivery.md) で更新した。

指定された GitHub Pages の公開ブランチのルートから、`.nojekyll` 付きで静的配信する構成を選んだ。three.js は固定 CDN バージョンで、アプリのインストールやビルドは不要。検証写真は設定とともにコミットする。実際に発行された HTTPS URL を開くところまでを公開確認とする。

段階0の診断用 HTML はインラインのモジュールと import map を持つ。後段の分割モジュールは HTTPS または localhost で読む。ブラウザーは `file://` での分割 ES モジュールの読み込みを制限する。

- [GitHub Pages の公開元の公式手順](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [JavaScript モジュールのローカル試験に関する MDN の説明](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#troubleshooting)
