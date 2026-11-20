# 段階1aの両脚着用と肌の圧縮

へそから下の左右対称モデルに20D平編みニーハイを両脚とも着用させた。全身の見え方に合わせて全体・斜めの撮影位置を調整し、足首・膝裏・マクロは前回の位置を右脚へ平行移動した。[撮影設定](../views-1a-bilateral.json)

| 視点 | 片脚版 | 両脚版 |
| --- | --- | --- |
| 1. 全体 | [正面](../1a-close-fit/01-front.png) | [正面](01-front.png) |
| 2. 斜め | [斜め](../1a-close-fit/02-oblique.png) | [斜め](02-oblique.png) |
| 3. 横シワ | [足首](../1a-close-fit/03a-ankle.png)・[膝裏](../1a-close-fit/03b-knee.png) | [足首](03a-ankle.png)・[膝裏](03b-knee.png) |
| 4. 太ももの拡大 | [太もも](../1a-close-fit/04-thigh.png) | [太もも](04-thigh.png) |
| 5. 極限マクロ | [太もも](../1a-close-fit/05a-thigh-macro.png)・[足首](../1a-close-fit/05b-ankle-macro.png) | [太もも](05a-thigh-macro.png)・[足首](05b-ankle-macro.png) |
| 着用比較 | [着用比較](../1a-comparison/comparison.png) | [着用比較](06-comparison.png)・[スマホ幅](09-mobile.png) |
| 履き口 | 追加視点 | [着用](07a-cuff.png)・[素足](07b-bare-cuff.png)・[接触圧](08c-pressure.png) |

## 肌の圧縮

| 部位 | 半径方向の圧縮 |
| --- | ---: |
| 履き口 | 5.38 mm |
| 太もも | 2.36 mm |
| ふくらはぎ | 0.60 mm |
| 足首 | 0.073 mm |
| 履き口のすぐ上 | 外側へ0.33 mm |

値は同じ計測位置の荷重場でのモデル計算。布に沿った推定接触圧は履き口5.33 kPa、太もも2.40 kPa、足首0.41 kPaだった。骨盤と左右の腿が一つの連結成分であること、両側の足部と着用が鏡映されていることを確認した。標準メッシュの片足16,320三角形の重心は皮膚の場で外側にあり、対側も鏡映先の足部に対して同じ関係になる。

太ももと足首の糸幅の中央値はともに18 px、同じ倍率で約60.6 µmだった。周方向張力と不透明度の相関係数は −0.32。[張力](08a-tension.png)・[不透明度](08b-opacity.png)・[糸幅](macro-width.json)

## 性能

Linux x64、Chrome Headless Shell 151.0.7922.34・SwiftShader、1440 × 1080、DPR 1。全体6.77 FPS、極限マクロ3.89 FPS、着用比較5.87 FPS、WebGPU検証エラー0件。スマホ幅のエミュレーションで着用比較・履き口・素足の切替を確認。iPhone Safari実機の性能は未計測。

| メッシュ | 片脚の計算点 | 片脚の三角形 | 布計算中央値 | 95%点 |
| --- | ---: | ---: | ---: | ---: |
| 低 | 9,061 | 17,640 | 3.60 ms | 4.90 ms |
| 標準 | 22,945 | 45,120 | 7.00 ms | 7.90 ms |
| 高 | 43,165 | 85,272 | 11.90 ms | 13.90 ms |

左右対称なので片脚を計算し、両脚に同じメッシュを描画する。標準では布だけで90,240三角形を表示する。表は静止着用の6パスを1回実行する時間で、肌を変形させる3回の反復、CPUの入力生成、読み戻し、描画は別。

[測定データ](result.json) · [設計記録](../../docs/decisions/0014-bilateral-body-and-tissue-compliance.md)

撮影と計測はリポジトリのルートから `node checks/1a-bilateral/capture.cjs /path/to/chrome-headless-shell /path/to/cdn-cache` で再実行できる。
