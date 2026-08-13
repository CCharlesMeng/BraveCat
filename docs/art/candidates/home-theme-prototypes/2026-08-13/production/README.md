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
  部件层（base，仅三条轨；六卡空框与轨前沿 foreground 未产出）。
- `qa--piece-postcard-rails--v01.png`：部件叠在 clean shell 上并画出
  六个 slot quad 的对位证据；每排卡位正下方一条轨，无绿边。
- B 的轨条在右墙透视上，须按 v02 的透视 quad 单独生产，本轮未做。

## Exterior 视差行程 QA（联动 home-exteriors 试点）

江湾母版 v03（按新规格重制，地平线实测 y 580 ∈ 520–640 带）以
1.10 倍率、±60px 行程合成进 A/F 窗洞的三联证据：
`docs/art/candidates/home-exteriors/approved-direction-2026-08-13/validation/riverbend-parallax/`。
两种窗型在行程两端均保持“上天空、中远岸、下水面”的可读构图，无露底。

## 已知欠账

- A 的 treat 锚点当前落在放大后的窗洞内：窗框 piece 的窗台必须
  覆盖 y 850–913 带，锚点在窗框 piece 产出后随实测调整。
- A 生成件带天花板、左墙偏宽，与控制图的取景差异记录在案；
  不影响 socket 拓扑。
- 逐平面 HomeFinish（墙/地/踢脚线分离输出）未开始；当前 shell 为
  单层烘焙 finish，与 den 迁移态一致。
