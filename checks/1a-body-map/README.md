# 段階1a 部位別の軟組織と体型調整

修正前は `849c5b5`。基準体型で旧版と同じカメラ・照明を使って撮影した。

| 固定視点 | 修正前 | 修正後 |
| --- | --- | --- |
| 1. 全体 | [正面](../1a-cuff/01-front.png) | [正面](01-front.png) |
| 2. 斜め | [斜め](../1a-cuff/02-oblique.png) | [斜め](02-oblique.png) |
| 3. 横シワ | [足首](../1a-cuff/03a-ankle.png)・[膝裏](../1a-cuff/03b-knee.png) | [足首](03a-ankle.png)・[膝裏](03b-knee.png) |
| 4. 太ももの拡大 | [太もも](../1a-cuff/04-thigh.png) | [太もも](04-thigh.png) |
| 5. 極限マクロ | [太もも](../1a-cuff/05a-thigh-macro.png)・[足首](../1a-cuff/05b-ankle-macro.png) | [太もも](05a-thigh-macro.png)・[足首](05b-ankle-macro.png) |

| 追加の観察 | 小さめ | 基準 | 大きめ |
| --- | --- | --- | --- |
| 全体 | [正面](small-front.png) | [正面](01-front.png) | [正面](large-front.png) |
| 着用時の臀部と履き口 | [後ろ斜め](small-hip.png) | [後ろ斜め](hip-rear-worn.png) | [後ろ斜め](large-hip.png) |

[軟組織マップの正面](map-front.png) · [軟組織マップの背面](map-back.png) · [スマホ幅の体型シート](mobile-settings.png)

## 体型と組織の検証

全項目を下限・基準・上限に設定して6部位を計測。腰・骨盤・ふくらはぎを下限、臀部・太もも・足首を上限にした組み合わせも試した。

| 寸法 | 小さめ | 基準 | 大きめ |
| --- | ---: | ---: | ---: |
| 腰の断面の幅 | 218.2 mm | 248.0 mm | 277.8 mm |
| 殿幅 | 313.7 mm | 332.2 mm | 369.7 mm |
| 臀部背面のモデル原点からの距離 | 119.7 mm | 131.7 mm | 144.8 mm |
| 太もも周長 | 477.2 mm | 541.6 mm | 585.0 mm |
| ふくらはぎ周長 | 305.8 mm | 351.1 mm | 396.5 mm |
| 足首の幅 | 60.5 mm | 66.9 mm | 73.1 mm |

4体型の無荷重皮膚メッシュはいずれも閉じた1成分。描画メッシュを測った履き口付近の7,232点と足部の16,320面の重心で、4体型とも皮膚への貫通は0件。基準体型での履き口付近の予測変位は1.38 mm。軟組織の同一圧力に対する前後差、周方向の周期性、荷重の増加と除荷後の復帰、時間刻みを分割した場合の一致を試験した。スマホ幅390 pxで変更の適用、マップ表示、着用への復帰、100%へのリセットを確認した。 [体型別生データ](body-tests.json) · [解剖と応答モデルの設計記録](../../docs/decisions/0018-regional-tissue-and-body-controls.md)

## 描画と布の検証

Chrome Headless Shell 151.0.7922.34、Linux、SwiftShader、1440 × 1080・DPR 1。WebGPU検証エラー0件。全体4.93 FPS、マクロ2.48 FPS。iPhone Safari実機は未測定。基準体型の同倍率の太ももと足首の糸幅の中央値はどちらも18 px。 [糸幅](macro-width.json)

| メッシュ | 片脚の点 | 片脚の三角形 | 布計算の中央値 | 95%点 |
| --- | ---: | ---: | ---: | ---: |
| 低 | 9,061 | 17,640 | 3.80 ms | 4.70 ms |
| 標準 | 22,945 | 45,120 | 8.00 ms | 9.40 ms |
| 高 | 43,165 | 85,272 | 14.40 ms | 29.90 ms |

[描画と布計算の生データ](result.json)

再実行は `node checks/1a-body-map/test-tissue.mjs`。撮影は `node checks/1a-body-map/capture.cjs /path/to/chrome-headless-shell /path/to/cdn-cache`、体型別とモバイル幅の試験は同じ引数で `test-bodies.cjs` を使う。
