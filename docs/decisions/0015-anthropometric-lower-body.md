# 0015 採寸値に合わせた下半身の曲面

決定日 2026-11-20

旧モデルはへその高さが約1,016 mmで、骨盤に向けて左右の腿の内周を一つの線へ集めていた。これが縦の比率と骨盤・内腿の折れ込みに影響していた。産総研「人体寸法データベース1991–92」の日本人青年女性群（18〜29歳。全体204名、項目ごとに有効標本数が異なる）を主な基準にして、床面からの高さと水平断面を設定し直した。

| 項目 | 青年女性平均 | 計測項目 |
| --- | ---: | --- |
| 臍高 | 925.1 mm | [B12](https://www.airc.aist.go.jp/dhrt/91-92/data/gif/B12.gif) |
| 股下高 | 714.5 mm | [B18](https://www.airc.aist.go.jp/dhrt/91-92/data/gif/B18.gif) |
| 殿溝高 | 692.3 mm | [B17](https://www.airc.aist.go.jp/dhrt/91-92/data/gif/B17.gif) |
| 殿幅 | 330.7 mm | [D6](https://www.airc.aist.go.jp/dhrt/91-92/data/gif/D6.gif) |
| 殿部厚径 | 207.2 mm | [E6](https://www.airc.aist.go.jp/dhrt/91-92/data/gif/E6.gif) |
| 臍位腹部厚径 | 169.8 mm | [E4](https://www.airc.aist.go.jp/dhrt/91-92/data/gif/E4.gif) |
| 大腿幅・大腿厚 | 163.4 mm・180.7 mm | [D15](https://www.airc.aist.go.jp/dhrt/91-92/data/gif/D15.gif)・[E8](https://www.airc.aist.go.jp/dhrt/91-92/data/gif/E8.gif) |
| 膝厚・下腿最大厚 | 115.3 mm・105.4 mm | [E9](https://www.airc.aist.go.jp/dhrt/91-92/data/gif/E9.gif)・[E10](https://www.airc.aist.go.jp/dhrt/91-92/data/gif/E10.gif) |

膝の高さと内外のくるぶしの位置、大腿と下腿の周長、足長と足幅は、産総研の1997–98年青年女性群の値も参照した。参照値は集団の項目別平均である。膝蓋骨、膝裏、腓腹筋、足先の細部は、基準断面の間を手続きで作った近似曲面として扱う。

骨盤と左右の腿の上部を符号付きスカラー場で滑らかに接続し、股の底の前後方向の曲線を別に定義した。内腿に人工的な頂点の集中がなくなる。足部と腿の水平な断面境界は実際の頂点を縫い合わせ、へその位置より少し上を閉じて、下半身全体を一つの連続メッシュにする。服には同じ脚の基準曲面から位置と法線を渡し、履き口の圧で変形した後に布を解き直す。

姿勢は左右対称の立位とし、片方の接触計算を鏡映する。骨格や筋を個別に作り込んだモデルとの比較に向けて、参照断面と手続きで補った部分を区別して記録する。

[産総研 人体寸法データベース1991–92](https://www.airc.aist.go.jp/dhrt/91-92/) · [1997–98 青年女性群統計](https://www.airc.aist.go.jp/dhrt/97-98/stat-yf.pdf) · [メッシュの測定値と比較画像](../../checks/1a-anatomy/README.md)
