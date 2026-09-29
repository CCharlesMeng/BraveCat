# Cat Item intrinsic alpha candidates

日期：2026-08-13。状态：**透明候选已产出，待注册与遮挡轮**。本目录只包含
美术候选与 QA 证据；没有进入 `public/`，也不能声称 runtime-ready。

## 范围

本轮只处理六张已批准的无猫造型审阅稿：

- `rest-cloud-bed`
  - A：`/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-rest-cloud-bed--theme-a-clear-sage--shape-review--candidate-v01-not-alpha.png`
  - B：`/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-rest-cloud-bed--theme-b-warm-walnut--shape-review--candidate-v01-not-alpha.png`
  - F：`/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-rest-cloud-bed--theme-f-moonwhite-bluegray--shape-review--candidate-v01-not-alpha.png`
- `play-soft-tunnel`
  - A：`/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-soft-tunnel--theme-a-clear-sage--shape-review--candidate-v01-not-alpha.png`
  - B：`/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-soft-tunnel--theme-b-warm-walnut--shape-review--candidate-v01-not-alpha.png`
  - F：`/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-soft-tunnel--theme-f-moonwhite-bluegray--shape-review--candidate-v01-not-alpha.png`

错误猫使用板没有归档、处理或引用。

## 方法

六张候选均直接从批准造型稿提取，不需要重生成 matte source：

1. 用 Apple Vision foreground instance mask 取得物件外轮廓；只保留最大连通物件，
   排除米白纸面和接触影。
2. 对高置信外轮廓包围的内部区域回填原源图像素。这样不会把 F 的月白床垫、
   A/B 的浅色织物、月白/浅木加固圈或隧道内壁误删为透明。
3. 半透明外沿使用最近高置信内部像素做局部 RGB 去污染，保留语义 mask 的软
   alpha；没有使用全局白色或米白键控。
4. alpha bbox 外保留 24 px 全透明安全边；alpha 为 0 的隐藏 RGB 也清零，
   避免缩放采样带出纸面颜色。

隧道入口和侧孔中源图可见的是内壁/后侧内衬，因此这些实体像素保持不透明，
没有让棋盘背景穿过内壁。猫进入后的可见区域和遮挡顺序必须在同母版
foreground occlusion 与猫 Pose 注册轮决定。

## 输出

- `rest-cloud-bed/a-clear-sage/cat-item--rest-cloud-bed--a-clear-sage--base--candidate-v01.png`
- `rest-cloud-bed/b-warm-walnut/cat-item--rest-cloud-bed--b-warm-walnut--base--candidate-v01.png`
- `rest-cloud-bed/f-moonwhite-bluegray/cat-item--rest-cloud-bed--f-moonwhite-bluegray--base--candidate-v01.png`
- `play-soft-tunnel/a-clear-sage/cat-item--play-soft-tunnel--a-clear-sage--base--candidate-v01.png`
- `play-soft-tunnel/b-warm-walnut/cat-item--play-soft-tunnel--b-warm-walnut--base--candidate-v01.png`
- `play-soft-tunnel/f-moonwhite-bluegray/cat-item--play-soft-tunnel--f-moonwhite-bluegray--base--candidate-v01.png`

## QA

- 机器实测：[`alpha-qa--candidate-v01.json`](alpha-qa--candidate-v01.json)
- 人工判定：[`alpha-qa--candidate-v01.md`](alpha-qa--candidate-v01.md)
- 猫窝深灰/棋盘双背景：
  [`rest-cloud-bed/qa--rest-cloud-bed--abf-alpha-contact-sheet--candidate-v01.png`](rest-cloud-bed/qa--rest-cloud-bed--abf-alpha-contact-sheet--candidate-v01.png)
- 隧道深灰/棋盘双背景：
  [`play-soft-tunnel/qa--play-soft-tunnel--abf-alpha-contact-sheet--candidate-v01.png`](play-soft-tunnel/qa--play-soft-tunnel--abf-alpha-contact-sheet--candidate-v01.png)

checkerboard 只存在于 contact sheet，没有烘焙进六张主稿。

## 已知阻断

- 六张图是 intrinsic alpha candidates，尚未注册到各主题 full-canvas 坐标。
- `rest` 与 `play` 是否共用中央活动区尚未冻结。
- 猫窝前沿 foreground occlusion 与隧道猫体遮挡本轮未拆；后续必须从同一
  注册母版产出 mask。
- 尚无 foreground occlusion、support/interaction socket、活动区多边形或
  猫 Pose registry。
- 尚未用项目猫 Pose 完成像素注册、穿插、进出路径和遮挡合成 QA。

因此本轮结果只能用于下一轮注册与遮挡制作，不能直接进入 runtime。
