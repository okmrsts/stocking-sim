# ストッキング・シミュレーター仕様書

段階0の設計。以下のモジュール名・データ項目・アルゴリズムは段階1以降の実装契約。段階0の `index.html` は独立した描画診断ページ。

## 1. 構成と部品の境界

| 配置先 | 部品 | 主な入力 → 出力 | 初出 |
| --- | --- | --- | --- |
| `index.html`、`src/main.js` | 静的エントリー、初期化・画面の接続 | 起動設定、入力イベント → 実行中のシーン | 0・1 |
| `src/core/gpu/context.js`、`diagnostics.js` | WebGPU専用デバイス・描画器、診断 | canvas、必要な GPU limits → `GpuContext`、`GpuDiagnostic` | 1 |
| `src/core/cloth/solver.js`、`fields.wgsl.js`、`constraints.wgsl.js` | 布の静的平衡・動力学、物理量 | `ClothRestMesh`、`ClothMaterial`、`CollisionField`、拘束 → `ClothFrame` | 1 |
| `src/core/cloth/contact.wgsl.js`、`topology.js`、`wetness.wgsl.js` | 接触、切断・糸の破断、含水場 | 接触距離、`YarnGraph`、道具入力、含水設定 → 接触・破断・含水量を反映した `ClothFrame` | 1・4・5 |
| `src/core/textile/material.js`、`optics.wgsl.js`、`stitch.wgsl.js` | 汎用の編織物描画 | `ClothFrame`、`TextilePattern`、`TextileOptics`、照明 → 被覆率、透過率、反射・光沢 | 1 |
| `src/core/body/leg-model.js`、`collision-field.js`、`model-source.js` | パラメトリックな脚、接触形状、外部モデル用の入口 | `BodyParameters` または外部モデル → `BodyModel` | 1 |
| `src/core/ui/shell.js`、`pointer-router.js` | レイアウトと操作の調停 | `ActionDefinition[]`、`UiState`、入力装置 → `ActionEvent` | 1 |
| `src/stocking/design.js`、`patterns.js`、`rest-shape.js` | 丈、部位、編み組織、デニール、レスト形状の変換 | `GarmentDesign`、採寸 → 汎用メッシュ・物性・編み目・糸接続 | 1 |
| `src/stocking/session.js`、`dressing.js`、`tools.js` | モード、表示、引き上げる動作、道具の割り当て | `BodyModel`、`GarmentDesign`、`ActionEvent` → 布・視点・UI の更新命令 | 1〜5 |
| `src/config/` | 服・素材・編み組織、脚形状、描画、UI | バージョン付き設定 → 検証済みの各入力 | 1〜6 |
| `checks/views.json`、`checks/<段階>/` | 比較設定と検証記録 | 同じシーン設定 → PNG、計測環境、診断件数、比較結果 | 0 |

`core/` の各部品は `stocking/` を参照しない。組み立て層がデニールや足首などの意味を物理・描画に渡せる量に変換する。例えば、かかと補強は組み立て層で指定し、布側には材料インデックスと張力限界、描画側には糸半径や光学係数を入力する。布ソルバーは照明・カメラ・UIを参照せず、脚モデルは衣料を参照しない。

## 2. データ契約

座標系は右手、+Y が上、+Z が解剖学的な正面。距離は m、時間は秒、質量は kg、膜張力は N/m、糸張力は N。色はリニア RGB。CPU 配列は位置・材料座標・物性を `Float32Array`、索引・フラグを `Uint32Array` で持つ。GPU の位置・法線は 16 B 境界を基本に、WGSL と JS でオフセット・ストライドを照合する。

| データ型 | 受け渡しと単位 |
| --- | --- |
| `GpuContext` | `adapter, device, renderer, diagnostics, dispose()`。描画・計算は同一デバイス。 |
| `GpuDiagnostic` | `kind, phase, label, message, shaderLocation?, timeS`。WGSL コンパイル、検証、メモリ不足、デバイス消失、初期化失敗を区別。 |
| `BodyParameters` | `legLengthM, hipWidthM, stanceWidthM, crossSections[], footLengthM, toeSpreadM, kneeFlexRad, ankleFlexRad`。各断面に前後・左右半径と中心の偏り。 |
| `BodyModel` | `renderRoot, landmarks, pelvisFrame, collisionField, updatePose(pose), dispose()`。基準点は股関節、膝、足首、踵、足先。 |
| `CollisionField` | `poseVersion, boundsM, gridOrPrimitives, bodyVelocity`。`sample(position)` は符号付き距離（外側が正）、勾配、表面速度を返す。 |
| `GarmentDesign` | `schemaVersion, lengthType, relaxWidthM, lengthM, zones[], defaultPatternId, yarnMaterialId, denier, colorSrgb, backSeam`。sRGB は取り込み時に変換する。 |
| `ClothRestMesh` | `positionsM, triangles, materialCoordsM, faceMaterialIds, initialPoseM, seamPairs, yarnGraph?`。三角形の材料基底は周・縦方向。チャート継ぎ目は頂点共有または明示縫合で位置と連結を保つ。 |
| `ClothMaterial` | `surfaceDensityKgM2, toeStiffnessNpm[2], hardeningNpm[2], hardeningStart[2], shearNpm, poissonCoupling, bendingNm, dampingRatio, friction, tearLaw?, moistureLaw?`。方向は材料座標に従う。 |
| `ClothFrame` | `positionsM, normals, triangles, topologyVersion, deformationGradient, stretch[2], tensionNpm[2], shear, contactGapM, contactPressurePa, moisture, yarnState?, clothToWorld`。粒子・三角形・糸別の GPU バッファ参照には格納型と要素数を添える。 |
| `YarnGraph` | `segments[], dependencies[]`。セグメントに安定 ID、布面の三角形 ID と重心座標での支点、材料、レスト長、荷重を担う方向と断面積。依存辺にほどける方向と条件。状態は伸び、張力、破断と解放。 |
| `TextilePattern` | `cellPitchM[2], centerlineSegments[], layerOrder[], yarnStyleIds[], yarnGraphMapping`。周期セル内の糸芯曲線、ループの交差・表裏、破断後に無効化する曲線の対応。 |
| `TextileOptics` | `fiberRadiusM, extinctionPerM, tintLinear, roughness, anisotropy, ior, wetOptics`。材料設定から供給する。 |
| `ActionEvent` | `actionId, phase, pointerId?, rayOriginM?, rayDirection?, value?, timeS`。ドラッグは `start/update/end/cancel`。布へのヒットは組み立て層で面 ID と重心座標へ変換する。 |

CPU は初期配置・設定・入力を管理し、物理量の更新は GPU で行う。切断後には異なる層が同じ形状を参照できるよう、布の可視・接触メッシュ、材料座標、糸写像を同じ `topologyVersion` へ更新する。GPU は破断候補 ID を読み戻し、形状変更をステップ境界で反映する。影響外の頂点の速度と含水量を引き継ぐ。

## 3. 布、張力とシワ

- **レスト形状と初期配置。** 小さい無荷重の筒・足袋形状に材料座標を設定する。着用初期配置は断面対応で脚の外側に置き、元の材料長を保って衝突拘束下で静的平衡へ収束させる。太もも・ふくらはぎの周長差が周方向伸長を作る。軸方向の余長はパターンの長さと接触・摩擦で決まる。最大頂点移動・残差・貫通量を収束判定に用いる。
- **ひずみと膜張力。** 無荷重材料座標から変形勾配 `F` を計算して、周・縦の伸長率 `λu, λv`、せん断と面積比 `J = sqrt(det(FᵀF))` を求める。伸び % は `100 × (λ − 1)`。方向別の初期剛性、閾値以降の J カーブ硬化、せん断、ポアソン連成を膜エネルギーに入れ、変形で微分して張力を得る。ポアソン連成はエネルギーの安定性を保つ範囲で適用する。N/m は糸の分担幅と配向を介して N に変換する。
- **座屈と接触。** 圧縮は低い圧縮抵抗と曲げ拘束の組み合わせで面外へ逃がす。足首・膝裏の横シワは余長・低い縦張力・摩擦・曲げ抵抗で発生する。数値的対称性を崩す必要がある場合は全域に微小な決定的摂動を加える。符号付き距離で衝突を解き、表面に対する相対速度から摩擦を計算する。厚さ、貫通の許容差、自己接触距離を設定する。
- **両脚の静止フィット（1a）。** `src/stocking/rest-shape.js` が周・縦方向のレスト長に対する接触面距離の比と、体表の位置・法線を渡す。WGSL が圧縮部に折り返しを発生させ、非隣接の同列の布点と辺で重なりを調べて外側に投影する。変形後のひずみ、張力、肌との隙間、接触圧の推定量、布どうしの接触補正量を読み戻し、描画と診断に共用する。局所の接触圧を `src/core/body/soft-tissue.js` に渡し、変形した肌の座標と法線に合わせて布を解き直す。対称立位のもう一方は鏡映して表示する。[設計記録](decisions/0014-bilateral-body-and-tissue-compliance.md)
- **無荷重時の基準形状との比較（1a）。** 同じレスト半径、軸方向の材料座標と補強情報から比較用のメッシュを作る。両方を一つの平行投影カメラで表示し、ピクセル当たりの距離をそろえる。[表示と実装の記録](decisions/0013-unloaded-fit-comparison.md)
- **動力学（2〜）。** XPBD 型の固定刻みで予測、拘束投影、速度補正を行う。WGSL を複数パスに分け、拘束の彩色または読み書き分離で競合を避ける。着脱は足先から進む移動拘束、摘みは近傍を距離で重み付けした拘束。解除は減衰比 1 を基準に、貫通・揺り返し・戻り時間を測る。脱衣後は重力・自己接触で折り畳みを解く。
- **切断と伝線（4）。** 刃は前面上の連続ヒットと面隣接だけを辿る。切れ目を跨ぐ拘束を解除し、境界を複製し、別連結成分を重力で落下させる。残留張力で切り口が開く。過負荷では限界比最大の糸を安定 ID による同点処理で1本ずつ切り、そのたび近傍の荷重を再計算する。糸端は張力が抜けて縮む。依存辺が縦ループの解放を伝え、横糸が残る。低張力・補強で止まり、近傍を引くと再開する。ノンランと網は解放の連鎖を持たず、網は各糸に個別強度を持つ。
- **水（5）。** 単位面積あたりの水量 kg/m² を保持し、飽和量に対する 0〜1 を含水率として渡す。面隣接での拡散、重力方向への移流、余剰分の滴下、乾燥を扱う。含水率を摩擦・付着、伝線の開始と停止、吸収と粗さに反映する。
- **診断。** 張力、伸長、接触の圧／隙間、含水率を単位付きの固定色範囲で表示する。段階3から糸伸び・張力を追加する。透けとの対応では同じ材料と視線角で伸長・被覆率・透過率を同一点で記録し、角度や補強の影響も別に検証する。

`src/config/` に係数を集約する。段階4の既定破断値は素材・線密度・編み組織・水分ごとに資料と測定条件を `docs/decisions/` に示し、推定値は区別する。破れやすさ倍率 `s` は 0.25〜4 と「破れない」、既定は 1。倍率は破断限界だけを `1/s` 倍する。現実どおり／破れにくい／破れやすいを設定プリセットとして提供する。「破れない」は張力起因の破断を無効にする。刃による切断は独立した操作。

## 4. 編み目と光

材料座標でループの芯を評価し、変形勾配で現在の接平面の距離に直してから、一定の実寸半径で糸の被覆を判定する。伸長で芯の間隔が広がり、同じ糸の半径は維持される。糸の並び、ループの前後、端部は材料レシピに従う。

連続な材料座標の微分から画素フットプリントを得る。近景は糸芯距離場のピクセル積分、遠景は変形後のセル面積と糸被覆から求める平均の光学厚を使い、画素の投影範囲に合わせて連続混合する。微分はフラグメントの一様な制御フローで先に評価し、非一様分岐内では微分や暗黙 LOD を呼ばない。WGSL の基本経路は f32 とコア機能を使用する。マクロの比較は同じ換算スケールで行う。

リニア空間で吸収、光路長、被覆率を組み合わせる。斜視では法線と視線の内積で光路が長くなる。重なった層の透過率は積で扱う。肌の不透明パスの深度で隠面を処理し、布は透明パスで層を合成する。光沢は糸の向き・重なり・粗さから求め、濡れは屈折率差による吸収の変化と粗さの変化を通じて暗さ・ツヤへ反映する。肌はマットなリニア色から最終出力で一度だけ sRGB へ変換する。

デニールは 9000 m あたりの g（線密度）。単一円形換算の糸半径は `sqrt(linearDensityKgPerM / (π × fiberDensityKgM3))` を基準にする。混紡・かさ・フィラメント構成は素材設定で補正する。生地ピッチ、厚み、素材、補強の糸本数は個別設定。補強の濃さも同じ光学式に材料と変形を入れて求める。

## 5. 脚と外部モデル

大腿、膝蓋部と膝裏、腓腹、アキレス腱、踝、踵、土踏まず、足指の外周を採寸値と連続断面から左右それぞれ生成する。パンストには骨盤側の接続面を用意する。表示、着用基準点、衝突表現は同じパラメーターから作り、変更時に外側距離との整合を確認する。

段階1aでは、`src/config/leg-anatomy.js` の断面、踵から足先までの寸法、5本の足指の位置と半径を変更できる。脚モデルが脚の皮膚曲面、足の皮膚用三角形、着用用包絡面の点・法線、足部の符号付きスカラー場を返す。両腿の皮膚曲面は骨盤で一つにつながり、へその高さまで続く。着用用包絡面の前足部は皮膚断面の凸包で足指の谷をまたぎ、足の甲と踵は基準となる曲線から皮膚との交点を求める。両者を滑らかにつないで布に渡す。[採寸値とモデル化の記録](decisions/0009-leg-anatomy.md) · [足部を密着させる調整](decisions/0012-close-fit-foot-envelope.md)

外部用入口は `loadBodyModel({ source, jointMap, license, fitProfile }) → Promise<BodyModel>`。glTF 2.0 の `.glb` 単独ファイル、メートル、右手座標、+Y 上、正面 +Z を対象にする。骨盤、左右の股関節・膝・足首・足部・つま先のジョイントを `jointMap` で明示する。スキンウェイトと逆バインド行列、正しい法線、閉じた衝突プロキシを要求する。外部ファイル参照や追加デコーダー必須の圧縮・拡張は初期対象外。作者、出典、表示・改変の権利を確認し、公開配布に同梱する場合は再配布権も確認する。既定モデルは手続き生成する。

## 6. モード、UI、段階

| 段階 | 操作と表示 |
| --- | --- |
| 0 | 固定版、WebGPU 描画・撮影診断、GitHub Pages 公開 |
| 1a | 両脚の20D平編みニーハイ。静止着用、肌の圧縮、透け、横シワと局所自己接触、足指と踵、極限マクロ、張力・伸長・隙間・接触圧・不透明度・布どうしの接触の診断 |
| 1b | 20D平編みパンスト、60Dタイツ、ラッセル網を追加 |
| 2 | 履く、ずり下ろす、引き抜く。並列比較、ストッキングのみ、素脚のみ。脱衣後は縮み、垂れ、折り畳まれる |
| 3 | 摘む、引っ張る、離す。丸いテント状、シワの消失、貫通と揺り返しの抑制、糸伸びと糸張力 |
| 4 | 切る、過負荷、破れやすさ。個々の糸の破断、伸び測定、伝線の進行・停止 |
| 5 | 濡らす、乾かす。濡れの暗さ・ツヤ・診断、拡散と滴下、付着・摩擦・伝線の変化 |
| 6 | 未着用形状を見ながらパンスト／ニーハイ／ひざ下、丈と筒幅、ウエスト・トップバンド、太もも、ふくらはぎ、踵とつま先の補強、バックシーム、平編み・1×1リブ・ノンラン・ラッセル網、10〜110D、ナイロン・ポリウレタン混・シルク・ウール、色を自由に設定 |

設計、着脱・比較、着用テストの3モード。視点、摘み、カッター、水、全体、極限マクロ、乾燥、リセットの道具を段階とモードに合わせて出す。タッチ／マウス／ペンの実際の入力を `PointerEvent.pointerType` で判別し、レイアウトは `(pointer: coarse)` とビューポートで判定する。スマホでは `100dvh` を基準にセーフエリア対応の下部バーを用い、設定シートに常時届く閉じるボタンとフォーカス復帰を用意する。キャンバスは選択道具にだけポインター入力を渡す。キャンセル・回転・画面離脱で解除し、シート内のスクロールを保つ。

## 7. 配布と診断

静的 HTTPS／localhost で ES モジュールを配信する。ブラウザーへ入る外部依存は CDN 上の three.js 一版と同版公式アドオン。ビルド不要。段階0は単独 HTML。後段で分割した同梱 ES モジュールをダブルクリックするとブラウザーの `file://` 制限があるため、HTTPS または localhost で開く。

初期化は API とアダプターを検査し、取得した GPU デバイスを three.js に渡す。固定版では `src/core/gpu/context.js` 一箇所で WebGL フォールバックを無効にし、初期化後にバックエンドとデバイスを照合する。版更新時の確認点は [0007](decisions/0007-three-webgpu-boundary.md) に記録する。検証スコープ、`uncapturederror`、デバイス消失、コンパイル診断（直接管理する WGSL の `getCompilationInfo()`）を画面に反映する。API・CDN・初期化・検証・デバイス消失を区別する。

## 8. 撮影と性能

段階1aの両脚は `checks/views-1a-bilateral.json`、過去の片脚版は `checks/views-1a-revision.json` を参照する。カメラ座標、向き、FOV、近遠クリップ、解像度、DPR、照明、プリセット、シードを固定する。写真3と5は膝裏・足首と太もも・足首を同じスケールの2地点で1組にする。近接の撮影地点は基準モデルに合わせて段階1で初回校正し、その後固定する。各段階を同じ条件で比べる。段階2〜5は入力時刻を固定した前・中・後の状態を足し、段階4では荷重点・速度・初期状態を同じにして素材、デニール、編み組織、倍率ごとの最初の糸の破断伸び % を表にする。

全体とマクロでウォームアップ後の rAF 間隔から FPS とフレーム時間分布を取り、ブラウザー・OS・端末/GPU・解像度・DPR・素材・測定時間・サンプル数を残す。レンダリング中も検証件数を監視する。全体30 FPSは近年の iPhone Safari 実機で測る。低負荷化は遠景の編み目平均化、DPR 上限、衝突・拘束の帯域削減を先に検討し、物理の精度を変える場合は比較結果を記録する。
