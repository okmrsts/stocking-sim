# 段階1aのサイズ調整

片脚の20D平編みニーハイを、未着用状態で小さくしてから同じ脚に着用する。足首と膝裏で布の余りが減るかを、前回と同じ[視点と撮影設定](../views-1a-revision.json)で比較した。

| 視点 | 調整前 | 調整後 |
| --- | --- | --- |
| 1. 全体 | [正面](../1a-revision/01-front.png) | [正面](01-front.png) |
| 2. 斜め | [斜め](../1a-revision/02-oblique.png) | [斜め](02-oblique.png) |
| 3. 横シワ | [足首](../1a-revision/03a-ankle.png)・[膝裏](../1a-revision/03b-knee.png) | [足首](03a-ankle.png)・[膝裏](03b-knee.png) |
| 4. 太ももの拡大 | [太もも](../1a-revision/04-thigh.png) | [太もも](04-thigh.png) |
| 5. 極限マクロ | [太もも](../1a-revision/05a-thigh-macro.png)・[足首](../1a-revision/05b-ankle-macro.png) | [太もも](05a-thigh-macro.png)・[足首](05b-ankle-macro.png) |
| 足部 | [足指](../1a-revision/06a-foot.png)・[かかと](../1a-revision/06b-heel.png) | [足指](06a-foot.png)・[かかと](06b-heel.png) |

## 寸法とシワ

| 計測項目 | 調整前 | 調整後 |
| --- | ---: | ---: |
| 未着用の筒径（円筒換算） | 53.6 mm | 51.0 mm |
| 未着用の足部基準径 | 42.0 mm | 39.8 mm |
| 未着用の縦方向の材料長 | 879.4 mm | 830.3 mm |
| 足首の肌と布の隙間の最大・最小差 | 1.52 mm | 0.40 mm |
| 膝裏の肌と布の隙間の最大・最小差 | 1.53 mm | 0.71 mm |
| 布の縦方向が逆転した頂点 | 417点 | 0点 |
| 自己接触で外側へ補正された頂点 | 128点 | 0点 |

シワによる隙間の変動幅は、標準メッシュの固定計測線で足首74%、膝裏53%減った。写真でも深い折れが解消し、足首と膝裏に浅い横シワが残った。調整後の静止着用では重なって補正される点がなかった。足部で皮膚の場を測った8,000頂点はすべて外側だった。

寸法調整の根拠は[設計記録](../../docs/decisions/0011-snug-knee-high-fit.md)を参照。

## 透けと性能

正対時の不透明度は太もも21.3%、足首24.9%、つま先37.5%。太ももと足首の糸幅は、同倍率のマクロ画像でどちらも中央値18 px（約60.6 µm）だった。[張力](diagnostic-tension.png)・[不透明度](diagnostic-opacity.png)・[糸幅の計測](macro-width.json)

Linux x64、Chrome Headless Shell 151.0.7922.34・SwiftShader、1440 × 1080・DPR 1。全体10.31 FPS、極限マクロ4.05 FPS、WebGPU 検証エラー0件。モバイル表示の Chromium エミュレーションでは足部、素足表示、マクロ、設定シートの操作を確認。新しい寸法での iPhone Safari 実機性能は未測定。

| メッシュ | 計算点 | 三角形 | 布計算の中央値 | 95%点 |
| --- | ---: | ---: | ---: | ---: |
| 低 | 9,061 | 17,640 | 3.70 ms | 4.30 ms |
| 標準 | 22,945 | 45,120 | 7.30 ms | 21.30 ms |
| 高 | 43,165 | 85,272 | 12.20 ms | 12.80 ms |

[計測の生データ](result.json)

## 再撮影

リポジトリルートで `node checks/1a/capture.cjs /path/to/chrome-headless-shell /path/to/cdn-cache` を実行する。糸幅の再計測は NumPy、Pillow、SciPy のある環境で `python3 checks/1a/measure-yarn.py` を実行する。
