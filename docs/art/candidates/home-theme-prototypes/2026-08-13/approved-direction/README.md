# Home Theme A / B / F 视觉方向批准归档

日期：2026-08-13  
审批：`visual-direction-approved`  
运行时资格：`false`

本目录保存用户已批准的 A / B / F Home Theme 视觉方向。批准范围是色板、
物件造型、整体空间意图和拆分审阅方向；不等于批准 production alpha、
运行时坐标或 shipping 资产。

2026-08-13，用户以“ok”签收本轮 A / F 完整合成审阅图。该签收只确认
整体搭配、视觉平衡和主题方向，**不签精确坐标**、socket、层边界或像素注册。

同日，用户以“ok”签收 B 暖胡桃旅行画廊的 `v03 unified grade` 合成图。
v03 以统一调色修正饱和度与窗景图层割裂，**supersedes v02**；v02 仅保留在
Cursor assets 作为过饱和失败对照，不进入本批准归档。

同日，用户以“ok，推进”批准 UI 的“主题抽屉 + 实景预览确认”层级，以及
真实 A / B / F 美术适配方向。之后产品停止家具换件，改为小猫用品；旧的
点柜子换件、部件分类和家具适配反馈只保留为否决方案证据。生成图中的文字
字形、小标签和 microcopy 不是正式文案；当前方向以
`home-theme-ui-spec.md` 为准。

主题视觉批准继续有效，但资产角色已调整：窗框、陈列、柜子、主地毯和植物
属于固定 Home Theme；抓柱和双碗可作为首批小猫用品的主题适配来源。

同日，用户以“ok，归档”批准云朵猫窝与软布隧道的 A / B / F 造型方向，
以及两张 Minho 使用方向板。Minho 是当前默认验证猫；两个
`abc-usage-review-board--candidate-v01.png` 使用错误猫，继续标记淘汰，
不在批准归档中。

随后用户以“可以”批准六张小猫用品透明独立候选的视觉方向，并将原字节及
alpha QA 证据归档到 `cat-items/production-sources/`。该批准只确认透明提取
与独立物件方向，不代表 full-canvas 注册、occlusion、socket 或 Pose QA 完成。

## 归档范围

- `concepts/`：A / B / F 三张完整概念图。
- `review-boards/`：A / B / F 三张当前 `1920 × 1080` Home Part 审阅板。
- `ui/`：Home Theme UI directions 图，以及本轮通过真实 A / B / F 美术
  适配方向审阅的 v02 review board。
- `shells/`：通过结构审阅的 A shell v02、F shell v05，以及
  `shells/b/` 中 B 的 blackmask-normalized 主稿。
- `shape-reviews/a/`、`shape-reviews/f/`：A / F 各五张当前主造型审阅图；
  F cabinet 使用通过的 v02。固定家具图仅供主题内部生产，食盆可迁移为
  Cat Item adapter 来源。
- `shape-reviews/b/`：B 的八类当前主造型审阅图，包含 finish swatch。
- `composites/`：获用户批准的 A / F 完整合成审阅图；`composites/b/`
  只归档 B 的 v03 unified grade 批准主稿。
- `cat-items/`：云朵猫窝与软布隧道的 A / B / F 造型主稿，以及正确 Minho
  的 v02 使用方向板。
- `cat-items/production-sources/`：六张 intrinsic-alpha base 候选；
  `evidence/` 内两张 alpha contact sheet 和一份机器 QA JSON 仅作证据，
  不计为运行时图片资产。

`manifest.json` 当前记录 46 个图片资产条目与 3 个 evidence 条目。归档目录
共含 48 张 PNG（其中 2 张是 evidence contact sheet）及 1 份 evidence JSON。
所有文件保留候选原始文件名和原始字节；manifest 记录稳定 ID、尺寸、alpha、
SHA-256、审批级别与阻断项。

## 仍然有效的技术阻断项

1. 完整概念图烘焙了 exterior、HomeFinish、家具和动态陈列，不能直接分层。
2. 审阅板带纸面背景与组合排版，不是可切割的 production alpha。
3. A / B 缺独立高分辨率 16:9 HomeForm 控制图；F 仍需统一最终 16:9
   几何标注。
4. 窗洞、平台/台阶、support surface、socket、slot quad、热区、排除区、
   锚点、z-band 与 foreground occlusion 均未冻结或未生产。
5. UI directions 只批准层级与真实美术适配方向，不授权 UI 实现；生成文字
   不是正式文案，预览、确认、回滚、点物和响应式交互也尚未通过 runtime QA。
6. 本轮 shell 与合成图实际为 `1024 × 1536`（2:3），不是 production
   `1200 × 1600`（3:4）；shell 不透明且黑窗洞不是 aperture alpha。
7. A / F 十张及 B 八张造型审阅图带米白纸面、无 alpha；它们只签造型、
   材质和配色，不能直接抠图或作为 runtime HomePiece。
8. 六张小猫用品造型图同样是 `not-alpha` 纸面审阅源；两张 Minho 使用板
   只签 Pose、尺度与遮挡方向，不是运行时合成、动画路径或逐帧遮挡证据。
9. 六张 intrinsic-alpha 候选尚未定位到主题 full-canvas；foreground
   occlusion、support/interaction socket、活动区与入口/出口目标、Minho
   Pose 注册和逐帧遮挡 QA 均未完成。

因此，本目录不得被描述为 production-ready、runtime eligible 或
shipping eligible，也不得复制到 `public/`。
