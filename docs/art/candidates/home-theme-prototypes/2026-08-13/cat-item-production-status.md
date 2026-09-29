# 小猫用品候选生产状态

日期：2026-08-13。状态：**视觉方向已获用户“ok，归档”批准**；批准级别为
`visual-direction-approved`，归档见 `approved-direction/cat-items/`。
`runtimeEligible=false`，不进入 `public/`。

批准范围是云朵猫窝与软布隧道的 A / B / F 造型，以及正确 Minho 的 Pose、
尺度和遮挡使用方向。Minho 是当前默认验证猫；使用错误猫的两个
`abc-usage-review-board--candidate-v01.png` 继续淘汰，不得归档。

## `rest-cloud-bed` · 云朵猫窝

三套主题适配造型：

- A 清润鼠尾草：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-rest-cloud-bed--theme-a-clear-sage--shape-review--candidate-v01-not-alpha.png`
- B 暖胡桃画廊：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-rest-cloud-bed--theme-b-warm-walnut--shape-review--candidate-v01-not-alpha.png`
- F 月白蓝灰：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-rest-cloud-bed--theme-f-moonwhite-bluegray--shape-review--candidate-v01-not-alpha.png`

三者保留三瓣云边、椭圆开口和低前沿的共同身份；只改变织物、滚边与色板。

错误效果板（淘汰）：

`/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-rest-cloud-bed--abc-usage-review-board--candidate-v01.png`

该图错误使用了非项目猫形象，**不得审核、归档或进入后续生产**。

当前 Minho 效果板：

`/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-rest-cloud-bed--abf-minho-usage-review-board--candidate-v02.png`

初检：项目当前实际猫 Minho 在三套猫窝中使用同一官方蜷睡身份与比例；
银白短毛、灰色纹理和环纹尾保持一致。睡眠面承托成立，低前沿只遮挡少量
身体、不遮脸。效果板用于审核 Pose、尺度和遮挡，不是运行时合成证据。

## `play-soft-tunnel` · 软布隧道

三套主题适配造型：

- A 清润鼠尾草：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-soft-tunnel--theme-a-clear-sage--shape-review--candidate-v01-not-alpha.png`
- B 暖胡桃画廊：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-soft-tunnel--theme-b-warm-walnut--shape-review--candidate-v01-not-alpha.png`
- F 月白蓝灰：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-soft-tunnel--theme-f-moonwhite-bluegray--shape-review--candidate-v01-not-alpha.png`

三者保留短圆筒、一个侧孔、一个悬挂球和防滚底面的共同身份。

错误效果板（淘汰）：

`/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-soft-tunnel--abc-usage-review-board--candidate-v01.png`

该图错误使用了非项目猫形象，**不得审核、归档或进入后续生产**。

当前 Minho 效果板：

`/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-soft-tunnel--abf-minho-usage-review-board--candidate-v02.png`

初检：A 展示 Minho 进入，B 展示 Minho 从侧孔伸头/伸爪，F 展示 Minho
离开；官方银白身份、绿眼和环纹尾在可见角度保持。入口尺寸、侧孔高度和
地面接触成立。效果板没有证明动画路径或逐帧遮挡。

## Intrinsic alpha candidates · 2026-08-13

六张米白纸面 `not-alpha` 源稿已提取为独立透明物件候选。主稿、逐图 alpha
实测、处理方法、纠错记录和深灰/棋盘双背景 contact sheet 见：

[`cat-items/README.md`](cat-items/README.md)

用户已以“可以”批准这六张透明独立候选的视觉方向。原字节归档到
`approved-direction/cat-items/production-sources/`；六张 base 作为
`visual-direction-approved` 图片资产，两个 contact sheet 和
`alpha-qa--candidate-v01.json` 作为 evidence 单独记录。所有条目均为
`runtimeEligible=false`。

本轮没有处理错误猫使用板，没有进入 `public/`，也没有修改运行时代码。

## 分区决策（已冻结）

`rest` 与 `play` **不共用**中央活动区。见
`docs/adr/0011-cat-item-slots-occupy-disjoint-frozen-zones.md`：`rest` =
近处左前地面/平台带，`play` = 中央主地毯带。正式槽位几何写入各主题
`geometry--furnished-base-plate--measured-freeze-v02.json`。

## 仍需生产 / 接入

- 六张 intrinsic base 的 full-canvas 槽位已写入 geometry v02，但
  `runtimeEligible` 仍为 false，尚未接入 `packages/core` resolver。
- 六张 foreground occlusion 已从同一母版 alpha 派生为
  `--foreground-occlusion--candidate-v01.png`（指标追加在
  `production-sources/evidence/alpha-qa--candidate-v01.json`）；仍须经
  core/机器检查与浏览器 QA 后方可晋升。
- Minho Pose 接触图已写入 `production-sources/evidence/`（rest/play × A/B/F）；
  仍须人工签收与 runtime 合成复核。
- 造型与 intrinsic-alpha 视觉方向均已追加到 `approved-direction/` manifest；
  core 解析、机器检查与浏览器 Pose/遮挡 QA 全绿前仍不得晋升 runtime。
  素材已复制到 `apps/web/public/dev-art/home-theme/{a,b,f}/`，未进
  `public/assets/`。
