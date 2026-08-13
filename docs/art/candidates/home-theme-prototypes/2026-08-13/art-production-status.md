# A / B / F 美术生产状态与编码交接

日期：2026-08-13。状态：**视觉方向已批准**，批准级别为
`visual-direction-approved`；归档见 `approved-direction/`。该批准不代表
production-ready，`runtimeEligible=false`，未进入 `public/`，不可当作
运行时或 shipping 资产。

现有技术阻断继续有效：完整概念仍是烘焙整图，套装板不是 production
alpha；A/B 缺独立 16:9 HomeForm 控制图，F 缺最终 16:9 几何标注；窗洞、
socket、quad、锚点、遮挡与透明分层均未冻结或未生产。

本文只清点已经存在的概念图和套装审阅板。逻辑条目不是资产 manifest；
凡标为“未产出”的透明层均没有文件路径。

## 冻结边界

- `HomeTheme` 是协调 preset，不是单张整图。
- `HomeForm` 冻结相机、房间结构、平台/台阶、socket 与落脚面。
- `HomeFinish` 只提供连续墙面、地面、木作、光照和 exterior/time 氛围。
- 窗框、陈列、猫爬架、碗、柜子、地毯与安全插槽中的花瓶均为独立
  `HomePiece`。
- 猫、六张明信片、纪念品与 Treat 是动态层，不得烘焙进上述资产。
- 套装板只用于审阅轮廓、材质、配色与可拆性；它们有纸面底色和组合排版，
  **不是可直接切割的 production alpha**。

## 已核验源文件

### A · 清润鼠尾草

- 完整概念：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a--clear-sage--concept-v01.png`
- 当前套装审阅板：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-part-set-a-clear-sage-review-board-v03.png`
- 当前完整合成审阅图：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--assembled-room-review--candidate-v01.png`
  — 2026-08-13 用户以“ok”签收整体搭配方向；不签精确坐标或 runtime 分层。
- `v03` 为 1920×1080；从 `v02` 只做非破坏性的画布比例规范化，未重画
  物件。两侧纸面留白属于审阅板，不属于任何资产。

### B · 暖胡桃旅行画廊

- 完整概念：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-b-warm-walnut-travel-gallery-v02.png`
- 当前套装审阅板：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-part-set-b-warm-walnut-travel-gallery-review-board-v02.png`
- 原始生成板 `...review-board-v01.png` 实际为 1536×1024，不是请求中的
  16:9；`v02` 保留原画面并规范为 1920×1080，未覆盖旧文件。

### F · 月白蓝灰错层

- 完整概念：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/home-theme--f-moonwhite-bluegray--candidate-v01.png`
- 几何控制：
  `/Users/moon/Documents/Code/BraveCat/docs/art/candidates/home-theme-prototypes/2026-08-13/home-theme--f-split-level-den--control-v01.png`
- 当前套装审阅板：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/home-part-suite--f-moonwhite-bluegray--review-board--v04.png`
- 当前完整合成审阅图：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--assembled-room-review--candidate-v01.png`
  — 2026-08-13 用户以“ok”签收整体搭配方向；不签精确坐标或 runtime 分层。
- `v04` 为 1920×1080；从纯黑窗洞修正版 `v03` 只做画布比例规范化，
  未重画物件。

## 统一视觉 QA 结论

### A

状态：**概念方向通过；套装审阅通过；production 未就绪**。

- 结构与透视：完整概念能读出“窗与六卡共享后墙、柜子落在右墙”的 A
  形态；家具均落地，未见明显漂浮。
- 配色：象牙白、浅木与鼠尾草低饱和且统一，属于三套中最清润的默认候选。
- 完整性：概念中的窗、猫爬架、双碗、柜子与单一地毯均完整；柜子接近
  右边界但未裁切。
- 可拆性：`v03` 左侧 clean shell 已移除可替换物件，窗洞为纯黑审阅遮罩；
  右侧窗框、空六卡陈列、猫爬架、双碗垫、空柜、单一地毯与独立花瓶互不
  接触、无裁切。
- 失败项：完整概念仍把 exterior、HomeFinish、全部家具、旅行画面和柜顶
  小物烘焙在一张图中；不能分层。A 只有总览结构图，没有独立高分辨率
  HomeForm 控制图，因此不能从概念或套装板冻结相机与 socket 坐标。

### B

状态：**概念方向通过；套装审阅通过；production 未就绪**。

- 结构与透视：`v02` 完整概念保持“大窗独占后墙、宽右墙承载六卡和矮柜”；
  右墙陈列随近端略放大，柜体支撑关系成立。
- 配色：暖胡桃、象牙白、陶土与藤编一致，温暖但没有高饱和或厚重暗部。
- 完整性：额外条纹脚垫已经移除，只保留一个主地毯；猫爬架、双碗和矮柜
  未裁切。
- 可拆性：新 `v02` 套装板有 clean shell、空窗框、六个空卡槽、完整猫爬
  架、双碗单垫、空四藤编面柜、单一地毯和独立花瓶；各组有明确间距，
  无粘连或裁切。
- 失败项：完整概念仍烘焙旅行画面、柜顶篮筐/托盘/花瓶及全部家具；不能
  直接拆。B 只有总览结构图，没有独立高分辨率 HomeForm 控制图；宽右墙的
  精确灭点、六个卡槽 quad 与柜体 socket 仍未冻结。

### F

状态：**概念方向通过；套装审阅通过；几何待复核；production 未就绪**。

- 结构与透视：完整概念保留连续抬高平台和一级下降台阶，高处休息与低处
  玩耍分区清楚；控制图也明确柜子应是独立 piece，而不是平台结构。
- 配色：月白、白橡与烟蓝统一，冷暖平衡且与 A/B 有足够区分。
- 完整性：完整概念中的窗帘、六卡、抓柱、双碗、低柜和单一地毯完整；
  `v04` 套装板中的七组部件互不接触、无裁切，窗洞纯黑、卡槽为空、低柜
  为空。
- 失败项：完整概念里的低柜与平台视觉关系较紧，仍可能被误读为一体木作；
  套装板 clean shell 的取景和右侧墙体比例也不等同于竖版控制图。编码不得
  从套装板反推平台 polygon、台阶落脚面或柜体 socket；须先以控制图统一
  一份最终 16:9 几何标注。

## Candidate asset inventory

以下每项的“base / foreground”是待生产层职责，不代表文件已经存在。

### A · 清润鼠尾草

- `shell`：矩形 A HomeForm、共享后墙与右墙、裸窗洞；现有 clean shell
  只有审阅证据，透明/遮罩 production 文件未产出。
- `finish`：象牙灰泥、浅木地板与踢脚线、柔和日光；逐平面受控输出未产出。
- `window-frame`：base 为浅木框、鼠尾草罗马帘和窗台；foreground 为窗台
  前沿及必要的帘前遮挡。需要 `gaze-perch`、`treat` 锚点；未产出。
- `postcard-display`：base 为三条浅木/黄铜轨；foreground 为压住动态卡片
  的框前沿或轨前沿。概念和审阅板证明有 2×3 六槽；六个 slot quad 未量测，
  透明层未产出。
- `scratcher`：base 为浅木立柱与鼠尾草双平台；foreground 为猫站入平台时
  的前缘。需要上下 `gaze-perch` 与 `play-target`；未产出。
- `feeding-set`：base 为单一椭圆垫和两只青瓷碗；仅在动态填充物需要压边时
  提供碗口 foreground。两碗中心与猫进食落脚点未量测；未产出。
- `cabinet`：base 为浅木藤编门柜；foreground 为柜顶前沿。概念证明柜顶可
  承载动态内容，但三个 `souvenir` 锚点和排除区未量测；未产出。
- `rug`：base 为单一鼠尾草编织地毯；通常无 foreground。`sleep` / `play`
  区域未量测；未产出。
- `plant`：base 为独立陶瓶与枝叶，仅能进入安全 plant socket；未产出。

### B · 暖胡桃旅行画廊

- `shell`：窄后墙大窗洞、宽右墙、木地板；套装板证明可清空，但 production
  shell 和独立窗洞遮罩未产出。
- `finish`：象牙灰泥、暖胡桃地板/踢脚线与柔和日光；逐平面输出未产出。
- `window-frame`：base 为深胡桃框、窗台与藤编罗马帘；foreground 为深窗台
  前沿。需要 `gaze-perch`、`treat` 锚点；未产出。
- `postcard-display`：base 为右墙三条胡桃轨；foreground 为六框和轨道前沿，
  动态明信片位于两者之间。远近 2×3 slot quad 尚未冻结；未产出。
- `scratcher`：base 为胡桃立柱、两块象牙织物/藤编平台及悬挂玩具；
  foreground 为平台前缘。需要两个 perch 与 `play-target`；未产出。
- `feeding-set`：base 为两只陶碗和一个陶土色椭圆垫；碗口 foreground 按
  动态填充需要决定。进食落脚点未量测；未产出。
- `cabinet`：base 为四藤编面暖胡桃矮柜；foreground 为柜顶前沿。需要三个
  `souvenir` 锚点并排除花瓶；未产出。
- `rug`：base 为单一陶土边自然藤编地毯；通常无 foreground。睡眠与玩耍
  polygon 未量测；未产出。
- `plant`：base 为独立象牙陶瓶和枝叶；未产出。

### F · 月白蓝灰错层

- `shell`：抬高平台、恰好一级台阶、前景低地面与裸窗洞；production shell
  未产出，最终 16:9 几何还需和控制图复核。
- `finish`：月白墙面、白橡平台/台阶/地面与烟蓝氛围；逐平面输出未产出。
- `window-frame`：base 为白橡框和两侧轻薄蓝灰帘；foreground 为窗台前沿及
  猫穿过帘前时的帘布层。需要 `gaze-perch`、`treat` 锚点；未产出。
- `postcard-display`：base 为白橡三轨；foreground 为六个空框和轨前沿。
  2×3 动态卡 slot quad 未量测；未产出。
- `scratcher`：base 为白橡立柱和烟蓝双平台；foreground 为平台前缘。
  高低 perch、平台支撑面与 `play-target` 未量测；未产出。
- `feeding-set`：base 为蓝白双碗；它落在平台还是低地面的 socket 必须随
  最终 HomeForm 冻结。碗口 foreground 与进食落脚点未产出。
- `cabinet`：base 为适配平台 socket 的完整空白橡低柜；foreground 为柜顶
  前沿。需要三个 `souvenir` 锚点、平台支撑面与台阶排除区；未产出。
- `rug`：base 为单一冷灰蓝椭圆编织地毯；通常无 foreground。低层
  `sleep` / `play` polygon 未量测；未产出。
- `plant`：base 为独立蓝白小花瓶和枝叶；未产出。

## 后续编码会话可依赖

- A/B/F 的主题角色、优雅低饱和色板和物件设计语言。
- 每套都只使用一个主地毯和六个空的动态明信片槽。
- clean shell 不包含 HomePiece；exterior/time、猫、明信片、纪念品和 Treat
  始终另层。
- 部件需要 `base` / 按需 `foregroundOcclusion`，遮挡归属于具体 piece 或
  socket。
- UI 方向为“底部主题抽屉 + 点物换件”；本文不授权 UI 实现。

## 后续编码会话不可依赖

- 不得把任何套装板复制进 `public/`、按纸面背景直接切图，或把黑窗洞当成
  运行时 exterior。
- 不得从概念图或套装板读取最终坐标、quad、z-band、锚点、热区、排除区、
  compatibility profile、资源 ID 或文件名。
- 不得把 `visual-direction-approved` 当成 production 批准，或假定候选图
  已经透明、已经做边缘去色、已经适配分辨率或已通过猫动画遮挡测试。
- A/B 缺少独立严格 HomeForm 控制图；F 仍缺最终 16:9 几何标注。三者都
  不能直接进入 scene resolver 数据。

## 审批与透明资产生产顺序

1. **已完成：**2026-08-13 已审批 A/B/F 完整概念的色板与物件造型；
   套装板只签“拆分方向”，不签 production 文件。
2. **已完成（2026-08-13）：**A/B/F 三套 HomeForm 控制图与几何 manifest
   已产出，见 `form-controls/`；窗洞、平台/台阶、support surface、
   exclusion zone、全部 socket、slot quad 与锚点均已按方向冻结。
   **画布决议**：原文的“16:9 相机”与 `home-exteriors` 归档的
   1200×1600（3:4）画布合同及运行时代码矛盾（16:9 可追溯到审阅板
   画布格式），控制图按 3:4 合同执行；如需改判 16:9 属画布合同级
   变更，须先落 ADR。
3. A 与 F 作为首批真实 HomeForm，先产 clean shell、exterior aperture
   alpha/遮罩与逐平面 HomeFinish；逐张核验透视和边缘。B 在宽右墙控制图
   获批后进入同一流程。
   **进行中（2026-08-13）：**A/F 的 clean shell + aperture alpha +
   独立窗洞 mask 候选已产出并完成控制线对齐实测，见 `production/`；
   偏差与欠账记录于该目录 README，待用户核验后按实测冻结运行时
   坐标。逐平面 HomeFinish 未开始。
   **更新（2026-08-13 下午）：**用户以“按顺序推进”签收 B 控制图，
   B 的 clean shell / aperture alpha / mask / 实测已按同一管线产出
   （转角实测 783 vs 控制 690，画廊须整体右移）。A/B/F 三套均已按实测
   冻结为 `geometry--measured-freeze-v02.json` + v02 QA 叠图；后续部件
   与运行时集成一律消费 v02。
4. 每个 form 的透明 HomePiece 顺序：
   `postcard-display` → `scratcher` → `feeding-set` → `cabinet` →
   `window-frame` → `rug` → `plant`。
   **进行中（2026-08-13 下午）：**A/F 的 postcard-display base 首件
   （三条轨，绿幕键控 → v02 坐标落位）已产出候选与对位 QA，见
   `production/*/piece--postcard-display-rails--candidate-v01.png`；
   六卡空框/轨前沿 foreground 与 B 的透视轨条未产出。
   **更新（2026-08-13 傍晚）：**postcard-display 三套齐——B 透视轨条
   （逐列双线性变形）与 F 六空框 foreground 已产出；A/B 按 v02 几何
   判定无需 occlusion 层（卡位底边在轨顶上方，无重叠）。scratcher
   base A/F 已产出（A 靠窗 gaze-perch、F 低层地面），B 未产出；
   perch/play 锚点待猫叠层验收轮量测。下一件：`feeding-set`。
5. 每件先交 base，再交必要的 foreground occlusion，并同时提交锚点与
   support/exclusion 视觉 QA 图；缺任一项不得上架。
6. 最后才做真实猫、六张明信片、三类纪念品和 Treat 的叠层验收；通过前
   所有文件继续留在候选区。

## 2026-08-13 · A / F 第一批独立 source 候选

本轮只生产候选图并做视觉 QA；没有写入 `public/`，没有修改运行时代码。
生成器虽然请求了 3:4，但全部实际输出均为 **1024×1536（2:3）**，不是
1200×1600，也没有用拉伸伪造比例。构图均把主体留在中心约
1024×1365 的 3:4 trim-safe 区域内；后续只能裁切重构，不能直接当最终画布。

对全部文件实测 `hasAlpha: no`。shell 是不透明 source，黑窗洞仍烘焙在图中；
其余文件名明确标有 `not-alpha`。隔离物件两轮都出现了背景渐变/晕影，不满足
“纯色无纹理隔离背景”，因此下面虽保留形态证据，但全部物件候选均标记淘汰，
不得抠图后直接进入 runtime。

### A · 清润鼠尾草

- clean shell v01：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--clean-shell-source--candidate-v01.png`
  — 1024×1536，alpha：无。**复核后改判结构失败并淘汰**：主内角视觉估算
  x≈635（约 62%），而控制图目标为 x≈790±35；右返回墙约 38%，导致后墙
  过窄，裸窗右侧不足以稳定容纳 2×3 明信片陈列区。连续表面、纯黑裸窗洞和
  动态内容去除虽通过，但不能弥补 HomeForm 比例错误。
- clean shell v02：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--clean-shell-source--candidate-v02.png`
  — 1024×1536（实际仍为 2:3），alpha：无。**本轮结构审阅通过**：主内角
  视觉估算 x≈795（约 77.6%），位于目标 x=790±35 内；右返回墙约 22.4%。
  裸窗右沿约 x≈370，至主内角约有 425 px 连续空白后墙，可明显容纳未来
  2×3 卡区。标准矩形房间、连续墙/天花/地面/踢脚线、纯黑裸窗洞和零
  HomePiece/动态内容均通过；中心 3:4 trim-safe 未见关键结构裁切。
- postcard-display base v01：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--postcard-display-base-source--candidate-v01-not-alpha.png`
  — 1024×1536，alpha：无。三条浅木/黄铜轨、六个空槽、无墙面和旅行图，
  结构/完整性通过；青色隔离底有渐变和晕影，失败，已由 v02 重做。
- postcard-display base v02：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--postcard-display-base-source--candidate-v02-not-alpha.png`
  — 1024×1536，alpha：无。三轨六空槽、后部安装片和主体留白完整；与
  foreground 的职责有形态区别。重做后青色底仍非均匀纯色，**淘汰**。
- postcard-display foreground-occlusion v01：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--postcard-display-foreground-occlusion-source--candidate-v01-not-alpha.png`
  — 1024×1536，alpha：无。六个空前框和三条前沿完整，无动态图；青色底
  有渐变和阴影，失败，已由 v02 重做。
- postcard-display foreground-occlusion v02：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--postcard-display-foreground-occlusion-source--candidate-v02-not-alpha.png`
  — 1024×1536，alpha：无。前框/轨前沿职责清楚、无后部安装片，但青色底
  仍有渐变，且与 base 不是同一像素注册母版，**淘汰**。
- scratcher v01：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--scratcher-source--candidate-v01-not-alpha.png`
  — 1024×1536，alpha：无。浅木底座、完整麻绳柱和两块鼠尾草织物平台均
  完整，无裁切/粘连/猫/房间污染；紫色底有渐变，失败，已由 v02 重做。
- scratcher v02：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--scratcher-source--candidate-v02-not-alpha.png`
  — 1024×1536，alpha：无。物件结构、材质和 trim-safe 完整性继续通过；
  紫色底仍有晕影，不是纯色隔离底，**淘汰**。

### F · 月白蓝灰错层

- clean shell v01：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--clean-shell-source--candidate-v01.png`
  — 1024×1536，alpha：无。连续表面、纯黑裸窗洞、无柜子/动态内容通过；
  平台到前景之间出现中间落脚条和第二层级，不能读成恰好一级下降台阶，
  **结构失败并淘汰**，已由 v02 重做。
- clean shell v02：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--clean-shell-source--candidate-v02.png`
  — 1024×1536，alpha：无。**复核后改判结构失败并淘汰**：主内角视觉估算
  x≈510（约 50%），远离控制图目标 x≈835±35；右侧被错误扩成宽返回墙并
  出现深柱/墙体投影。一级下降立面和动态内容去除通过，但整体 HomeForm
  不能承载控制图要求的宽后墙三段 socket。
- clean shell v03：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--clean-shell-source--candidate-v03.png`
  — 1024×1536（实际仍为 2:3），alpha：无。平台、单一立面、纯黑裸窗洞、
  无柱/柜子/第二台阶和后墙 socket 容量通过；但主内角视觉估算 x≈915
  （约 89.4%），右返回墙只有约 10.6%，越过目标 x=800–870，**结构失败，
  已由 v04 重做**。
- clean shell v04：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--clean-shell-source--candidate-v04.png`
  — 1024×1536（实际仍为 2:3），alpha：无。主内角视觉估算 x≈890
  （约 86.9%），右返回墙约 13.1%；比 v03 左移，但仍在允许上限 x=870
  之外，且未达到 15–20% 右墙目标，**重做后仍结构失败并淘汰**。窗右至
  内角的连续空白后墙约 550 px，视觉上足够划分六卡区与独立柜体 socket
  空区；连续平台、恰好一级立面、无柜体/柱子/中间平台/第二台阶也通过，
  但这些局部通过不能替代主内角比例合格。
- clean shell v05：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--clean-shell-source--candidate-v05.png`
  — 1024×1536（实际仍为 2:3），alpha：无。基于 v04 只修正房间内角和与其
  相连的天花、踢脚线、平台边及右墙接缝；主内角视觉估算 x≈850（约 83.0%），
  位于目标 x=835±35 内，右返回墙约 17.0%。宽后墙保留裸窗、六卡区和独立
  柜体 socket 空区；连续抬高平台通过单一立面下降到前景，无柱子、柜体、
  中间平台或第二台阶。**本轮结构审阅通过**。
- postcard-display base v01：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--postcard-display-base-source--candidate-v01-not-alpha.png`
  — 1024×1536，alpha：无。三条白橡/月白轨、六个空槽和烟蓝安装片完整，
  无墙面/旅行图；珊瑚色底有渐变，失败，已由 v02 重做。
- postcard-display base v02：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--postcard-display-base-source--candidate-v02-not-alpha.png`
  — 1024×1536，alpha：无。结构、完整性、冷色 F 区分和动态污染检查通过；
  珊瑚色底仍不均匀，**淘汰**。
- postcard-display foreground-occlusion v01：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--postcard-display-foreground-occlusion-source--candidate-v01-not-alpha.png`
  — 1024×1536，alpha：无。六个空前框、三条前沿完整，月白/烟蓝区别明确；
  珊瑚色底有渐变和阴影，失败，已由 v02 重做。
- postcard-display foreground-occlusion v02：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--postcard-display-foreground-occlusion-source--candidate-v02-not-alpha.png`
  — 1024×1536，alpha：无。前沿职责和六槽结构通过；背景仍有渐变，且未与
  base 建立同母版像素注册，**淘汰**。
- scratcher v01：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--scratcher-source--candidate-v01-not-alpha.png`
  — 1024×1536，alpha：无。白橡底座、完整麻绳柱、两块烟蓝毡平台和月白
  滚边均完整，无裁切/粘连/猫/房间污染；黄色底有渐变，失败，已由 v02 重做。
- scratcher v02：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--scratcher-source--candidate-v02-not-alpha.png`
  — 1024×1536，alpha：无。结构、材质、trim-safe 与 A/F 风格区分通过；
  黄色底仍有晕影，不是纯色隔离底，**淘汰**。

### 统一 QA 与 runtime 阻断

- 通过：A shell v02 与 F shell v05 通过控制图主内角比例、后墙 socket
  容量、连续表面、黑窗洞和动态内容去除。所有内角数值均为 1024 宽图上的
  视觉估算，不是已注册的机器几何。
- shell 失败证据：A v01 主内角约 62%；F v01 有额外层级；F v02 主内角约
  50% 且有深柱/宽右墙；F v03 主内角约 89.4%；F v04 约 86.9%，重做后仍
  超出允许区间。上述失败文件全部保留且不覆盖；F v05 为后续局部修正版。
- HomePiece 状态不变：全部 postcard-display 和 scratcher 两轮仍因隔离
  背景非纯色、无 alpha 而淘汰；本轮没有继续生成这些物件。
- shell 仍不能进 runtime：它们是 2:3 不透明概念 source，黑窗洞没有独立
  aperture alpha/mask；A 尚无最终 HomeForm 相机几何，F 也未完成最终 16:9
  几何复核；二者都没有逐平面像素注册、socket、support surface、exclusion
  zone、z-band 或 exterior mask。
- HomePiece 仍不能进 runtime：没有 alpha，隔离底不合格，未做边缘去色；
  base / foreground-occlusion 并非同一母版导出，不能保证像素注册；六个
  slot quad、抓柱 perch/play anchor、遮挡 mask 和目标 socket 投影均未量测。

### 后续生产暂停点

1. 暂停 `feeding-set` 与 `cabinet`，也不重启 postcard/scratcher；先解决
   F 主内角和右返回墙比例。生成式重做已用完一次额度，下一步应先冻结可量测
   的最终 16:9 HomeForm 几何或采用能锁定透视线的生产方法。
2. A v02 也只通过候选结构审阅；在 aperture mask、逐平面像素注册、socket、
   support/exclusion 和中心 3:4 实际裁切验证完成前，不进入 runtime。
3. 独立物件恢复生产前，仍须换用能输出真实 alpha 或可验证恒定 RGB 隔离底、
   并能从同一母版导出 base / foreground 的管线。

## 2026-08-13 · A / F 第二批造型审阅源

本批只签收 `feeding-set`、`cabinet`、`window-frame`、`rug` 与 `plant`
的独立造型、材质和配色，不是 production alpha。十张主审阅图均使用米白
纸面背景，生成请求为 1:1，实测全部为 **1024×1024**；没有误标为 3:4 或
1200×1600。全部实测 `hasAlpha: no`，纸纹和轻微水彩接触影均已烘焙，
不得抠图或复制到 runtime。

### A · 清润鼠尾草

- feeding-set：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--feeding-set-shape-review-source--candidate-v01-not-alpha.png`
  — 1024×1024，alpha：无。**造型审阅通过**：两只空置斑点青瓷系碗落在
  单一浅鼠尾草椭圆垫上；无食物、水、第二张垫、脚垫或其他道具，边界完整。
- cabinet：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--cabinet-shape-review-source--candidate-v01-not-alpha.png`
  — 1024×1024，alpha：无。**造型审阅通过**：浅白蜡木、双藤编门、独立
  柜脚和完整柜顶成立；柜顶为空，无纪念品、书、篮筐、花瓶或附着房间结构。
- window-frame：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--window-frame-shape-review-source--candidate-v01-not-alpha--retry-v02-blackmask-normalized-v01.png`
  — 1024×1024，alpha：无。**造型审阅通过**：浅木完整框、窗台和鼠尾草
  亚麻罗马帘均未裁切，窗洞不含 exterior。黑窗洞归一化后实测
  222,734 个 near-black 像素全部为精确 RGB `#000000`，不存在非精确
  near-black 像素；这仍是不透明审阅遮罩，不是 aperture alpha。
- rug：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--rug-shape-review-source--candidate-v01-not-alpha.png`
  — 1024×1024，alpha：无。**造型审阅通过**：单一低饱和鼠尾草椭圆编织
  地毯完整居中；无地板、家具、玩具或第二张垫子。
- plant：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--plant-shape-review-source--candidate-v01-not-alpha.png`
  — 1024×1024，alpha：无。**造型审阅通过**：单一象牙斑点陶瓶与纤细
  鼠尾草枝叶形成克制安全轮廓；无第二容器或承托家具，尺寸未巨大遮墙。

### F · 月白蓝灰错层

- feeding-set：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--feeding-set-shape-review-source--candidate-v01-not-alpha.png`
  — 1024×1024，alpha：无。**造型审阅通过**：两只空置蓝白陶瓷碗落在
  单一冷灰蓝椭圆承托垫上；无食物、水、第二张垫、脚垫、平台或其他道具。
- cabinet v01：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--cabinet-shape-review-source--candidate-v01-not-alpha.png`
  — 1024×1024，alpha：无。**复核后淘汰**：低矮独立柜体、空柜顶和冷灰蓝
  拉手成立，但木作明显偏蜂蜜色暖橡，和 F 的月白/白橡/烟蓝色板冲突。
- cabinet v02：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--cabinet-shape-review-source--candidate-v02-not-alpha.png`
  — 1024×1024，alpha：无。**造型审阅通过**：改为低饱和月白洗色白橡木，
  月白门板与烟蓝灰拉手清楚；完整顶板、侧板、底框和短柜脚使其明确读成
  独立柜体而非平台，柜顶为空。
- window-frame：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--window-frame-shape-review-source--candidate-v01-not-alpha--retry-v02-blackmask-normalized-v01.png`
  — 1024×1024，alpha：无。**造型审阅通过**：白橡完整框、窗台、帘杆与
  两侧轻薄蓝灰帘均未裁切，窗洞不含 exterior。黑窗洞归一化后实测
  268,169 个 near-black 像素全部为精确 RGB `#000000`，不存在非精确
  near-black 像素；这仍是不透明审阅遮罩，不是 aperture alpha。
- rug：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--rug-shape-review-source--candidate-v01-not-alpha.png`
  — 1024×1024，alpha：无。**造型审阅通过**：单一冷灰蓝椭圆编织地毯
  完整居中；无地板、平台、家具、玩具或第二张垫子。
- plant：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--plant-shape-review-source--candidate-v01-not-alpha.png`
  — 1024×1024，alpha：无。**造型审阅通过**：单一蓝白小陶瓶与克制枝叶
  形成安全、疏朗的小尺度轮廓；无第二容器、平台或承托家具。

### 窗洞失败与淘汰证据

两套初稿和一次生成式重做的窗洞肉眼接近黑色，但机器实测仍混有 near-black
渐变，因此全部淘汰并保留，未覆盖旧文件。主审阅路径改用从重做稿非破坏
派生的黑遮罩归一化版本；归一化只把与窗洞中心连通且 RGB 最大通道值不超过
96 的 aperture 区域压为 `#000000`，没有声称产生 alpha。

- A 初稿：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--window-frame-shape-review-source--candidate-v01-not-alpha.png`
  — 1024×1024，alpha：无；exact black 141,048，near-black 222,820，
  其中 81,772 像素并非精确黑，**淘汰**。
- A 重做原稿：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-a-clear-sage--window-frame-shape-review-source--candidate-v01-not-alpha--retry-v02.png`
  — 1024×1024，alpha：无；exact black 175,848，near-black 221,905，
  其中 46,057 像素并非精确黑，**淘汰**。
- F 初稿：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--window-frame-shape-review-source--candidate-v01-not-alpha.png`
  — 1024×1024，alpha：无；exact black 157,893，near-black 260,851，
  其中 102,958 像素并非精确黑，**淘汰**。
- F 重做原稿：
  `/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-theme-f-moonwhite-bluegray--window-frame-shape-review-source--candidate-v01-not-alpha--retry-v02.png`
  — 1024×1024，alpha：无；exact black 179,483，near-black 266,620，
  其中 87,137 像素并非精确黑，**淘汰**。

### 本批统一 QA 与阻断

- 十张主审阅图在本批范围内通过：每张只含一种完整物件组，主体居中且留白
  充足，无裁切、房间、猫、UI、文字、水印或动态内容；未见额外部件。
- A 的浅木、象牙与鼠尾草，以及 F 的月白、白橡与冷灰蓝保持一眼可区分；
  两套物件的画面占比、柔和低饱和水彩和米白纸面语言一致。
- 这些文件只解决造型、材质与配色审阅，**不能解决 socket、房间透视、
  遮挡拆层、alpha 或像素注册阻断**；也没有提供锚点、support surface、
  exclusion zone、base / foreground 同母版导出或猫动画叠层证据。
- 本轮十张主造型随 A / F 合成审阅图获得视觉方向签收；仍需用可控管线按
  冻结 HomeForm 生产真实透明 base / foreground，并逐件完成注册与遮挡 QA。

## 2026-08-13 · A / F 完整合成视觉签收

用户以“ok”签收 A / F 两张完整合成审阅图，批准级别为
`visual-direction-approved`。两图只确认 shell 与五个主造型的整体搭配、
主题色板、相对视觉重量和空间读感；**不签精确坐标**、socket、support /
exclusion geometry、z-band、遮挡拆层或像素注册。

两图实测均为 `1024 × 1536`（2:3）、无 alpha，并继续保留黑窗洞和已合成
审阅内容。它们不是 `1200 × 1600`（3:4）production 画布，不是可拆运行时
层，也不能用来反推 runtime placement。A / F shell 的 alpha/aperture mask、
主造型透明 base / foreground、socket 对位、比例裁切、逐层注册与猫动画
遮挡 QA 仍为有效阻断；`runtimeEligible=false`。
