# 段階1a 足首から足先までの形状確認

旧版 `f0144a6` と同じカメラ位置・照明・画面寸法で比較した。基準体型の日本人青年女性の立位を想定する。写真は右足側を中心に撮影し、左足には鏡映した形状を用いる。[撮影設定](../views-1a-anatomy.json)

| 足部の観察 | 変更前の素足 | 変更後の素足 | 変更後の着用 |
| --- | --- | --- | --- |
| 甲と五本の指 | [真上](before-top.png) | [真上](bare-top.png) | |
| 足指の前方斜め | [足指](before-toes.png) | [足指](bare-toes.png) | [足指](worn-toes.png) |
| 内側と土踏まず | [内側](before-medial.png) | [内側](bare-medial.png) | [内側](worn-medial.png) |
| 外くるぶし | [外側](before-lateral.png) | [外側](bare-lateral.png) | |
| 踵とアキレス腱 | [後ろ](before-ankle.png) | [後ろ](bare-ankle.png) | [後ろ](worn-ankle.png) |

[スマホ幅での足指の表示](mobile-toes.png)

| 着用の固定視点 | 変更前 | 変更後 |
| --- | --- | --- |
| 1. 全体 | [正面](../1a-body-map/01-front.png) | [正面](01-front.png) |
| 2. 斜め | [斜め](../1a-body-map/02-oblique.png) | [斜め](02-oblique.png) |
| 3. 横シワ | [足首](../1a-body-map/03a-ankle.png)・[膝裏](../1a-body-map/03b-knee.png) | [足首](03a-ankle.png)・[膝裏](03b-knee.png) |
| 4. 太ももの拡大 | [太もも](../1a-body-map/04-thigh.png) | [太もも](04-thigh.png) |
| 5. 極限マクロ | [太もも](../1a-body-map/05a-thigh-macro.png)・[足首](../1a-body-map/05b-ankle-macro.png) | [太もも](05a-thigh-macro.png)・[足首](05b-ankle-macro.png) |

## 採寸と曲面

| 測定項目 | 参考値 | メッシュの測定値 |
| --- | ---: | ---: |
| 足長 | 233.8 mm | 233.7 mm |
| 踵幅 | 60.4 mm | 61.9 mm |
| 前足部の斜め断面の幅 | 93.2 mm | 92.5 mm |
| 前足部の幅の横方向への投影 | 91.1 mm | 90.5 mm |
| 甲高 | 57.2 mm | 57.1 mm |
| 外くるぶしの高さ | 62.8 mm | 63.1 mm |
| 内くるぶしの高さ | 75.6 mm | 75.6 mm |

同じ断面で測った土踏まずの内外の高さの差は 15.9 mm、踵後端と足首後面の前後差は 7.4 mm。

| 足指 | 踵から先端まで | 指腹の厚み |
| --- | ---: | ---: |
| 母趾 | 233.5 mm | 17.8 mm |
| 第2趾 | 229.5 mm | 15.0 mm |
| 第3趾 | 221.5 mm | 13.5 mm |
| 第4趾 | 211.8 mm | 12.1 mm |
| 小趾 | 200.0 mm | 11.7 mm |

皮膚メッシュは閉じた1成分で、開いた辺・非多様体辺・面の向きに矛盾のある辺は0件。足指は五つの先端、四つの指間、五つの爪面を確認した。個別の趾の表面は骨節構造・集団資料・足のプロポーションを用いた推定形状。[採寸の出典・測定定義・構成](../../docs/decisions/0019-anatomical-foot-landmarks.md)

## 描画と着用

Chromium 151.0.7922.34、Linux、SwiftShader、1440 × 1080。WebGPU検証エラー 0件。全体 5.63 FPS、極限マクロ 3.44 FPS。iPhone Safari実機は未検証。

| メッシュ | 片脚の計算点 | 片脚の三角形 | 布計算の中央値 | 足部で皮膚に入った三角形の重心 |
| --- | ---: | ---: | ---: | ---: |
| 低 | 9,061 | 17,640 | 3.80 ms | 0 / 6,400 |
| 標準 | 22,945 | 45,120 | 7.20 ms | 0 / 16,320 |
| 高 | 43,165 | 85,272 | 11.70 ms | 0 / 30,888 |

ブラウザー幅390 pxで足部の4視点と素足切替を確認。足首を90%・110%にしたときも標準メッシュの足部で貫通は0件だった。[足首の調整時の計測](ankle-variants.json) · [糸幅の測定](macro-width.json) · [採寸・描画・全メッシュの測定値](result.json)

撮影は `node checks/1a-foot-detail/capture.cjs /path/to/chrome-headless-shell /path/to/cdn-cache`。足首の調整とスマホ幅の検証は同じ引数で `test-controls.cjs` を使う。
