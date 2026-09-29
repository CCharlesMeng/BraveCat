# 小猫用品扩展候选状态

> 2026-09-29 当前决策：用户已批准全部现有素材，见 `docs/art/reviews/all-existing-assets-approval-2026-09-29.json`。下文旧日期的待用户审批描述保留为历史；剩余生产/接入/技术验证事项见 `docs/plans/next-step-plan-2026-09-29.md`。


日期：2026-08-13。状态：**候选待用户审核，未归档**。本轮只生产三种新
`CatItem` identity 的无猫造型源稿与 A / B / F 识别并排板；
`runtimeEligible=false`，不进入 `public/`。

用户已明确同意以 `scratch-hideaway-tower` 替换现有 `scratch-basic`，并增加
`play-ball-track` 与 `play-teaser-stand` 两件玩具。候选沿用 A 清润鼠尾草、
B 暖胡桃画廊、F 月白蓝灰的已批准房间合成、shape review 色板与 BraveCat
低饱和水彩尺度语言。

## 九张 1:1 shape-review source

### `scratch-hideaway-tower` · 躲藏瞭望猫塔

支持 `scratch`、`gaze`、`rest`。共同身份是紧凑防倾倒圆底座、单一同轴麻绳
磨爪柱、带真实入口与内垫的下层圆角躲藏舱，以及完整受支撑的顶部瞭望台；
中段由舱体遮挡，没有第二根独立柱、第三层或附加玩具。

- A 清润鼠尾草：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-scratch-hideaway-tower--theme-a-clear-sage--shape-review--candidate-v01-not-alpha.png`
- B 暖胡桃画廊：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-scratch-hideaway-tower--theme-b-warm-walnut--shape-review--candidate-v01-not-alpha.png`
- F 月白蓝灰：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-scratch-hideaway-tower--theme-f-moonwhite-bluegray--shape-review--candidate-v01-not-alpha.png`

### `play-ball-track` · 环形球轨

支持 `play`、`reach`。三套都保留同一低矮圆环、连续轨道与伸爪开口、一个
受限球，以及一块可踩的中央磨砂织物圆盘；没有第二球或零散部件。

- A 清润鼠尾草：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-ball-track--theme-a-clear-sage--shape-review--candidate-v01-not-alpha.png`
- B 暖胡桃画廊：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-ball-track--theme-b-warm-walnut--shape-review--candidate-v01-not-alpha.png`
- F 月白蓝灰：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-ball-track--theme-f-moonwhite-bluegray--shape-review--candidate-v01-not-alpha.png`

### `play-teaser-stand` · 自立逗猫杆

支持 `play`、`reach`、`greet`。三套都保留同一防滑加重小底座、单根柔韧
弧形杆与一个低位可达软目标。A / F 分别使用鼠尾草、深靛布叶，B 使用一个
陶土布球；没有真人手、多串羽毛、额外目标或落地灯部件。

- A 清润鼠尾草：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-teaser-stand--theme-a-clear-sage--shape-review--candidate-v01-not-alpha.png`
- B 暖胡桃画廊：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-teaser-stand--theme-b-warm-walnut--shape-review--candidate-v01-not-alpha.png`
- F 月白蓝灰：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-teaser-stand--theme-f-moonwhite-bluegray--shape-review--candidate-v01-not-alpha.png`

## 三张 A / B / F identity contact sheet

三张并排板只含 A、B、F 三件静物，不含猫、房间、文字、标签或 UI。顺序均为
左 A、中 B、右 F。

- 躲藏瞭望猫塔：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-scratch-hideaway-tower--abf-identity-contact-sheet--candidate-v01-not-alpha.png`
- 环形球轨：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-ball-track--abf-identity-contact-sheet--candidate-v01-not-alpha.png`
- 自立逗猫杆：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-cat-item-play-teaser-stand--abf-identity-contact-sheet--candidate-v01-not-alpha.png`

## QA

机器实测：

- 九张 shape-review source 均为 `1024 × 1024` PNG，`hasAlpha=no`。
- 三张 identity contact sheet 均为 `1536 × 864` PNG，精确 `16:9`，
  `hasAlpha=no`。
- 所有图均使用米白纸面；文件名中的 `not-alpha` 与实测一致。

逐图人工检查：

- 猫塔 A / B / F：真实入口与内垫可读；舱体、顶部瞭望台与圆形防倾倒底座的
  承托关系成立；完整外轮廓未裁切；没有额外玩具或第三层。三套造型、视角和
  尺度一致，浅白蜡木鼠尾草、暖胡桃奶油藤编陶土滚边、白橡烟蓝月白可一眼
  区分。
- 球轨 A / B / F：每张恰有一个球，球被限制在轨道内；开口可伸爪触达，
  中央圆盘可踩；完整外轮廓未裁切；没有第二球或装饰托盘内容。三套仅更换
  指定木色、圆盘和球色。
- 逗猫杆 A / B / F：底座稳定且有防滑底边；杆与目标均完整未裁切，目标位于
  猫可伸爪范围；每张只有一个目标，没有真人手、多串羽毛或落地灯语义。
  A / F 布叶与 B 布球符合指定主题差异。
- 三张并排板：同一用品的 A / B / F 身份一致，静物均完整，无猫、房间、
  家具、文字、标签、UI、水印或额外物件。
- 九张主稿未触发结构失败，因此没有使用主稿重做额度。并排板生成器初稿画布
  为 `1536 × 1024`，已居中裁为 `1536 × 864`；裁后复检无物件裁切。

## 下一步建议

等待用户审核本轮 identity，不归档、不提取 alpha、不进入 runtime。若三款
获准继续，下一轮建议各做一张 A / B / F Minho 使用效果板：

1. 猫塔：同一 Minho 基线分别验证磨爪、从真实入口进入/休息、顶部眺望；
   冻结入口安全区、舱内承托、顶部 support surface 与前沿遮挡。
2. 球轨：验证 Minho 前爪能穿过开口触及唯一球，身体可稳定踩在中央圆盘或
   轨道外侧；冻结球的 interaction region 与前爪 reach socket。
3. 逗猫杆：验证 Minho 站立或侧卧伸爪能触及单一目标，弧杆不穿过头身且底座
   不被误读为落脚平台；冻结目标 reach socket、摆动包络与遮挡顺序。

效果板必须继续使用项目当前实际猫 Minho，不得用通用生成猫替代。
