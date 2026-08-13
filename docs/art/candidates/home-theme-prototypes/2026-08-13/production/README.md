# A / F clean shell 生产候选（生产顺序第 3 步）

日期：2026-08-13。管线：`scripts/build-form-shell-candidates.mjs`。
状态：**候选待用户核验**；`runtimeEligible=false`，不进 `public/`。
B 按既定顺序待其控制图签收后进入同一流程。

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
| F 月白蓝灰错层 | +10 / −89 / +36 / +53 | +92（652 vs 560） | 可用；卡位区（x≥685）与柜子仍完整落在实测后墙内；窗洞偏大偏高 |

按 ADR 0007，运行时坐标在候选获用户签收后**按实测重排冻结**进
form 数据（与 classic-v4 / split-level-den 同一惯例）；本表偏差即
届时的重排输入。

## 已知欠账

- A 的 treat 锚点当前落在放大后的窗洞内：窗框 piece 的窗台必须
  覆盖 y 850–913 带，锚点在窗框 piece 产出后随实测调整。
- A 生成件带天花板、左墙偏宽，与控制图的取景差异记录在案；
  不影响 socket 拓扑。
- 逐平面 HomeFinish（墙/地/踢脚线分离输出）未开始；当前 shell 为
  单层烘焙 finish，与 den 迁移态一致。
