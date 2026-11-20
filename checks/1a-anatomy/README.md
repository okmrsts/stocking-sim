# 段階1aの下半身形状と寸法の検証

旧版 `3f977c7` と形状を修正した版を、同じカメラ・照明で撮影した。下半身は左右対称の立位。両脚には同じ20D平編みニーハイを着用させている。[撮影設定](../views-1a-anatomy.json)

| 視点 | 修正前 | 修正後 |
| --- | --- | --- |
| 素足・正面 | [正面](previous-bare-front.png) | [正面](bare-front.png) |
| 素足・側面 | [側面](previous-bare-side.png) | [側面](bare-side.png) |
| 素足・背面 | [背面](previous-bare-back.png) | [背面](bare-back.png) |
| 1. 全体 | [正面](../1a-bilateral/01-front.png) | [正面](01-front.png) |
| 2. 斜め | [斜め](../1a-bilateral/02-oblique.png) | [斜め](02-oblique.png) |
| 3. 横シワ | [足首](../1a-bilateral/03a-ankle.png)・[膝裏](../1a-bilateral/03b-knee.png) | [足首](03a-ankle.png)・[膝裏](03b-knee.png) |
| 4. 太ももの拡大 | [太もも](../1a-bilateral/04-thigh.png) | [太もも](04-thigh.png) |
| 5. 極限マクロ | [太もも](../1a-bilateral/05a-thigh-macro.png)・[足首](../1a-bilateral/05b-ankle-macro.png) | [太もも](05a-thigh-macro.png)・[足首](05b-ankle-macro.png) |

追加の観察写真は[履き口](07-cuff.png)、[足指](08-foot.png)、[かかと](09-heel.png)、[着用と無荷重の基準形状](06-comparison.png)、[スマホ幅](mobile.png)。

## 寸法

値は未着用の三角形メッシュを切って求めた断面の幅・厚さ、周長、床面からの高さ。へその高さには設定したへその中心を使った。殿部の基準断面は床から約803 mm。前後の断面寸法や周長には計測定義の違いがある。参照値と割り当てた断面の関係は[設計記録](../../docs/decisions/0015-anthropometric-lower-body.md)に記した。

| 項目 | 採寸資料の平均 | モデル |
| --- | ---: | ---: |
| へその高さ | 925.1 mm | 924.9 mm |
| 股下高 | 714.5 mm | 714.6 mm |
| 殿幅 | 330.7 mm | 330.9 mm |
| 殿部厚径 | 207.2 mm | 206.3 mm |
| へその高さでの胴の前後径 | 169.8 mm | 169.1 mm |
| 大腿幅 | 163.4 mm | 163.4 mm |
| 大腿厚 | 180.7 mm | 180.7 mm |
| 大腿囲 | 542.7 mm | 540.8 mm |
| 膝厚 | 115.3 mm | 115.8 mm |
| 下腿の最大厚に対応させた断面 | 105.4 mm | 105.4 mm |
| 下腿最大囲に対応させた断面 | 351.2 mm | 351.1 mm |
| 足長 | 233.8 mm | 233.8 mm |
| 足幅 | 93.2 mm | 93.7 mm |

閉じたメッシュの連結成分は1。境界辺・3面以上が共有する辺・面の向きが不整合な辺はいずれも0。輪郭を正面・側面・背面で確認した。採寸点の間にある皮膚の形状は、既知の部位を参考に補間して作った。

## 着用・性能

履き口で肌のへこみは5.23 mm、接触圧は5.04 kPaと推定した。片足の標準メッシュの足部16,320面の重心は肌の外側。太ももと足首では、マクロの画像上の糸幅の中央値は同倍率で18 px、約60.6 µmだった。[糸幅の測定](macro-width.json)

Linux、Chrome Headless Shell 151.0.7922.34・SwiftShader、1440 × 1080・DPR 1。全体4.65 FPS、極限マクロ3.41 FPS、WebGPU検証エラー0件。スマホ幅エミュレーションで側面・背面・素足・着用比較の切り替えを確認した。iPhone Safari実機は未計測。

| メッシュ | 片脚の計算点 | 片脚の三角形 | 布計算の中央値 | 95%点 |
| --- | ---: | ---: | ---: | ---: |
| 低 | 9,061 | 17,640 | 3.50 ms | 3.70 ms |
| 標準 | 22,945 | 45,120 | 7.00 ms | 7.60 ms |
| 高 | 43,165 | 85,272 | 12.00 ms | 13.30 ms |

[計測データ](result.json)

撮影は `node checks/1a-anatomy/capture.cjs /path/to/chrome-headless-shell /path/to/cdn-cache`、糸幅の検証は `python3 checks/1a/measure-yarn.py checks/1a-anatomy` で再実行できる。
