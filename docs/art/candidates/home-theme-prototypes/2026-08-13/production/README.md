# A / B / F clean shell 生产候选（生产顺序第 3–4 步）

日期：2026-08-13。管线：`scripts/build-form-shell-candidates.mjs`、
`scripts/freeze-form-geometry.mjs`、`scripts/build-postcard-rail-pieces.mjs`。
状态：**候选待用户核验**；`runtimeEligible=false`，不进 `public/`。
A/F shell 已由用户口头验收（“基本还行”）；B 控制图随用户
“按顺序推进”指令视为签收并已进入同一流程。

每个 form 目录内：

- `source--clean-shell--imagegen-v01.png`：原始生成件（1024×1536），
  参考 = form 控制图（几何）+ 获批概念图（色板/风格），窗洞按约定
  生成为纯黑。
- `shell--aperture-alpha--candidate-v01.png`：归一化 1200×1600、
  纯黑窗洞键控为透明的 clean shell（RGBA）。房间完全无部件：
  无窗框、无轨、无家具、无地毯。
- `aperture-mask--candidate-v01.png`：独立窗洞 mask（白=洞），
  供 Exterior 跨窗型合成 QA 与视差行程验证使用。
- `qa--control-overlay--candidate-v01.png`：控制几何叠加在候选上
  （青蓝底透出窗洞）。
- `measurements--candidate-v01.json`：窗洞 bbox 与墙角实测及相对
  控制图的偏差。

## 实测结论（v01）

| Form | 窗洞偏差 (L/T/R/B) | 转角偏差 | 结论 |
| --- | --- | --- | --- |
| A 清润鼠尾草 | +19 / +9 / +8 / +63 | −24（906 vs 930） | 可用；右列卡位距实测转角仅 ~6px，冻结时须复核或下轮把转角右移 |
| B 暖胡桃画廊 | +24 / −45 / +4 / +26 | +93（783 vs 690） | 可用；但控制图卡位区起点 x 705 落进实测后墙，画廊须整体右移进实测右墙（见 v02 冻结） |
| F 月白蓝灰错层 | +10 / −89 / +36 / +53 | +92（652 vs 560） | 可用；卡位区（x≥685）与柜子仍完整落在实测后墙内；窗洞偏大偏高 |

按 ADR 0007，运行时坐标在候选获用户签收后**按实测重排冻结**进
form 数据（与 classic-v4 / split-level-den 同一惯例）；本表偏差即
届时的重排输入。

## 实测冻结 v02（生产顺序第 3 步收尾）

`scripts/freeze-form-geometry.mjs` 以实测为准输出每个 form 目录下的
`geometry--measured-freeze-v02.json`（`freezeLevel: measured-freeze-v02`）
与 `qa--measured-freeze-overlay--v02.png`。**部件生产与运行时集成一律
消费 v02**，v01 控制 manifest 保留为方向证据。重排要点：

- **A**：卡位双列左移 12px（x 618–888），轨条收到 x 603–898，避开实测
  转角 906；柜体 quad、纪念品锚点、plant socket 全部按转角 906 的右墙
  射线重投；treat 锚点贴实测窗底 y 913。
- **B**：画廊六卡 + 三轨 + 矮柜整体右移进实测右墙（x 790–1160），
  以 (150,880) 灭点、转角 783 重投全部 quad；treat 锚点贴实测窗底 y 931。
- **F**：窗洞按 mask 实测为四点 quad；平台前沿与台阶底沿由像素梯度
  实测（左 x140 / 右 x1060 两列）；柜体右移到 x 665–1070 避免跨越
  实测转角 652；treat 锚点按 mask 列实测窗底落位。

## 首件透明 HomePiece：postcard-display 轨条（生产顺序第 4 步）

`scripts/build-postcard-rail-pieces.mjs` 把绿幕生成的单条轨条
（A 浅木+黄铜、F 白橡）按绿度主导键控成透明素材，缩放落位到
v02 冻结的 rails 坐标：

- `piece--postcard-display-rails--candidate-v01.png`：1200×1600 透明
  部件层（base，三条轨）。A/F 为正面直轨；**B 为右墙透视轨**，由同
  脚本按 v02 透视 quad 做逐列双线性变形落位（近端加厚、向近端上扬）。
- `piece--postcard-display-frames-foreground--candidate-v01.png`（仅 F）：
  六个白橡空框 foreground occlusion 层，框外沿比 slot 各向大 8px，
  动态卡片边缘滑入框后。
- `qa--piece-postcard-rails--v01.png`：base（F 含 foreground）叠在
  clean shell 上并画出六个 slot quad 的对位证据；每排卡位正下方一条
  轨，无绿边。
- **A 的 foreground 判定**：v02 冻结里卡位底边 y 425 在轨顶 y 432 之上
  （7px 间隙，卡片悬于轨上方不重叠），按“foreground 按需”合同判定
  A 的 postcard-display 无需 occlusion 层；后续真实卡片叠层验收若
  推翻此判定，再补轨前沿层。
- **B 的 foreground 判定同 A**：透视轨顶即 rail 线，slot quad 底边在
  其上方，无重叠。

## 第二件：scratcher base（件序第 2 件，A/F）

`scripts/build-scratcher-pieces.mjs`：绿幕抓柱（A 浅木+鼠尾草双平台、
F 白橡+烟蓝双平台）键控 → 等比缩放进 v02 scratcher socket region、
底边中点对齐：

- `piece--scratcher--candidate-v01.png`：A 实际落位 185×567 @ (55,673)，
  靠窗立柱、顶台即窗边 gaze-perch；F 实际落位 148×500 @ (76,820)，
  立于低层地面、贴平台前沿（部件在前正确遮挡平台立面）。
- `qa--piece-scratcher--v01.png`：部件 + socket region 虚线对位证据。
- 欠账：高低 perch 与 `play-target` 锚点未量测（待猫叠层验收轮）。
- **B 已补齐**（2026-08-13 傍晚）：胡桃立柱 + 象牙藤编双平台 + 悬挂
  玩具球，实际落位 156×500 @ (82,860)。

## 第三件：feeding-set base（A/B/F）

`scripts/build-feeding-set-pieces.mjs`：绿幕碗垫组（A 斑点青瓷双碗 +
鼠尾草垫、B 陶土双碗 + 陶土边藤编垫、F 蓝白纹样双碗 + 烟蓝毡垫）
键控 → 等比缩放进 v02 feeding-set socket region、底边中点对齐：

- `piece--feeding-set--candidate-v01.png`：A 250×93 @ (295,1172)、
  B 220×90 @ (300,1195)、F 230×95 @ (285,1205)。
- `qa--piece-feeding-set--v01.png`：部件 + socket region 对位证据。
- 欠账：两碗中心与猫进食落脚点未量测（待猫叠层验收轮）；碗口
  foreground 待动态填充物需求确认。

## 第五件提前：window-frame base（A/B/F，treat 锚点依赖窗台）

`scripts/build-window-frame-pieces.mjs`：绿幕窗框（洞内同为纯绿）
键控后按**洞对位**落位——检测素材内透明洞边界，把洞映射到 v02 实测
窗洞（A/B 矩形、F 透视 quad，框/帘/窗台按窗洞平面列线性映射整体
变形），框内沿相对窗洞向内包边 12px 以盖住毛洞边缘并吸收画稿窗洞
顶边不水平造成的楔形露边（B 首轮曾出现右上露蓝，包边后消除）：

- `piece--window-frame--candidate-v01.png`：A 浅木框 + 鼠尾草罗马帘
  （收拢在洞顶上方）+ 窗台；B 深胡桃框 + 藤编卷帘 + 深窗台；
  F 白橡框 + 两侧蓝灰纱帘 + 窄窗台（随左墙透视变形）。
- `qa--piece-window-frame--v01.png`：部件 + 实测窗洞虚线 + treat
  锚点对位证据。
- 欠账：窗台前沿 foreground（猫趴窗台时的压边）未拆层；F 帘布
  与 postcard 框的 z 序为“框画在帘上”，物理上帘更近，帘布应拆进
  foreground occlusion——留待遮挡拆层轮。

## 第四~六件：cabinet / rug / plant（还原修复轮）

用户对 dressed v01 的判定是「跟效果图差太多」：房间空、无阴影、光照平。
修复轮由 `scripts/build-room-furnishing-pieces.mjs` 一次装配三件
（绿幕原稿归档为 `source--{cabinet,rug,plant}--imagegen-v01.png`）：

- `piece--cabinet--candidate-v01.png`：A 藤编双门柜 245×303、B 胡桃
  长矮柜 380×154、F 白橡移门柜 435×176。A/B 素材自带 3/4 视角，
  不做 quad 二次透视 warp，按 region 底边对齐；右墙件要求侧板朝右、
  顶面向左上（VP 方向）收——A 原稿即满足，**B 原稿水平翻转后落位**。
- `piece--rug--candidate-v01.png`：三套主地毯（鼠尾草圆毯 / 陶土边
  藤编椭圆毯 / 灰蓝月白滚边椭圆毯），region 内居中，平贴地面不加影。
- `piece--plant--candidate-v01.png`：三套独立盆栽。**植物底部锚到
  装配后的实际柜顶 +14px**，不用冻结 region 底边（冻结几何假设的
  柜顶偏高，直接用会悬空）；放置结果写进
  `placement--furnishings--v01.json` 供动态内容 QA 复用。
- 落地件（cabinet、plant，及补装的 scratcher、feeding-set）在部件层内
  垫径向渐变软椭圆接触阴影（`scripts/lib/piece-utils.mjs` 的
  `contactShadowSvg`），解决 v01 的漂浮感。
- `qa--piece-furnishings--v01.png`：三件 + socket region 对位证据。

## 光照层（还原修复轮）

`scripts/build-form-lighting.mjs` 按 v02 窗洞生成
`piece--lighting--candidate-v01.png`（z 带 lighting，最后叠加）：
窗心暖色径向光晕 + 地板暖光池 + 四周冷色 vignette，专治 v01 的
「产品渲染感」平光。

## 全件穿戴 QA

`scripts/build-dressed-room-qa.mjs` 把每套 form 当前全部候选部件按
z 序（exterior → shell → window-frame → 轨/框 → scratcher →
feeding-set）合成为 `qa--dressed-room--v01.png`，江湾 v03 以 1.10
倍率居中作窗外景。仅证据用途，不是 runtime 合成器。

**v02（还原修复轮）**：同脚本重写后输出 `qa--dressed-room--v02.png`
与横向总览条 `qa--dressed-room--overview--v02.png`。z 序扩展为：
exterior → shell → window-frame → 轨 → rug → cabinet → scratcher →
feeding-set → plant → **六张明信片**（6 张外景母版裁片按 slot quad
列线性 warp 贴入，B 为右墙透视）→ F 前景相框 → **柜顶纪念品**
（postmark-pin / travel-charm，y 锚到实际柜顶）→ **窗台零食**
（fish-biscuit 贴 treat 锚点）→ **rug 上睡猫**（sleep spritesheet
第 0 帧，宽约 rug 46%）→ 光照层。动态内容直接取运行时资产
（`apps/web/public/assets/`、`dev-art/home-v4/cat-animations/`），
仅作合层证据，不固化进任何部件。

## Exterior 视差行程 QA（联动 home-exteriors 试点）

江湾与静海湾母版 v03（按新规格重制，地平线实测均 y 580 ∈ 520–640 带，
裁切偏置由管线自动求解）以 1.10 倍率、±60px 行程合成进 A/B/F 窗洞的
三联证据：
`docs/art/candidates/home-exteriors/approved-direction-2026-08-13/validation/*-parallax/`。
三种窗型在行程两端均保持“上天空、中地标、下水面”的可读构图，无露底。

## 已知欠账

- A 的 treat 锚点当前落在放大后的窗洞内：窗框 piece 的窗台必须
  覆盖 y 850–913 带，锚点在窗框 piece 产出后随实测调整。
- A 生成件带天花板、左墙偏宽，与控制图的取景差异记录在案；
  不影响 socket 拓扑。
- 逐平面 HomeFinish（墙/地/踢脚线分离输出）未开始；当前 shell 为
  单层烘焙 finish，与 den 迁移态一致。
