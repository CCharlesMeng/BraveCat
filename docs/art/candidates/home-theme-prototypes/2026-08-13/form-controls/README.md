# A / B / F HomeForm 控制图与几何冻结（生产顺序第 2 步）

日期：2026-08-13。产出自 `scripts/build-approved-homeform-controls.mjs`，
依据 `approved-direction/` 的三张概念图推导。每套一张 1200×1600 控制图
加一份几何 manifest JSON，覆盖：相机（水平线/灭点/转角）、墙面、窗洞、
平台与台阶（F）、全部七类 socket、六个 slot quad、三条展示轨、纪念品
锚点、Treat 锚点、四类猫活动区与排除区，并标注统一 z 序
（shell → rear pieces → cat → dynamic → piece occlusion → lighting）。

## 画布决议（需用户知悉）

`art-production-status.md` 曾要求"16:9 HomeForm 控制图 / 最终 16:9
相机"，与同日 `home-exteriors/README.md` 明确的
「正式资产继承 Home 的 1200×1600（3:4）画布合同」直接矛盾，也与运行时
代码（全部 form canvas 1200×1600、App 3:4 布局）不符。16:9 的说法可
追溯到审阅板被规范成 1920×1080 的画布格式，审阅板不是相机规格。

**本目录按 3:4（1200×1600）合同执行。** 若确需把 Home 相机改为 16:9，
属于画布合同级变更，须先落新的 ADR 并重做全部既有几何，请显式改判。

## 冻结语义

- 本轮冻结的是**方向几何**：结构、分区、socket 拓扑与相对比例，供
  第 3 步 clean shell / 窗洞 mask / finish 生产作为几何参考。
- 运行时坐标按 ADR 0007 在美术产出后**实测复核再冻结**进 form 数据；
  不得把本目录 JSON 直接拷进 scene resolver。
- B 的六卡与轨道收敛右墙 VP(150,880)，manifest 中 quad 已按射线计算；
  A/F 卡位为 frontal 矩形。

## 三套结构摘要

| Form | 相机 | 窗 | 六卡 | 柜 | 生活区 |
| --- | --- | --- | --- | --- | --- |
| A 清润鼠尾草 | 单点 VP(600,880)，转角 x=930 | 后墙左 | 后墙右 frontal | 右墙（藤面），柜顶 3 纪念品 + plant | 地面：爬架窗左、碗、地毯 |
| B 暖胡桃旅行画廊 | 右墙 VP(150,880)，转角 x=690 | 独占后墙 | 宽右墙 2×3 随深度收缩 | 右墙矮柜，柜顶 3 纪念品 + plant | 地面：爬架左下、碗、地毯 |
| F 月白蓝灰错层 | 左墙 VP(2600,870)，转角 x=560 | 左墙（退深） | 后墙 frontal | 后墙下独立低柜（落平台） | 平台：窗座/Treat；一级台阶下低层：碗、爬架、地毯 |

F 的本控制图（v01，语义上取代旧竖版
`home-theme--f-split-level-den--control-v01.png`）把概念确认的
"卡与柜在后墙、平台 + 一级台阶"统一进最终几何；柜子为独立 piece，
支撑面是平台顶面。

## 下一步（生产顺序第 3 步）

1. A 与 F 先行：按控制图生产 clean shell、窗洞 aperture alpha/遮罩与
   逐平面 HomeFinish；逐张核验透视与边缘后实测冻结运行时坐标。
2. B 在本控制图获用户签收后进入同一流程。
3. 部件顺序照旧：postcard-display → scratcher → feeding-set →
   cabinet → window-frame → rug → plant；每件 base + 必要 occlusion +
   锚点/支撑/排除 QA 图齐备才可上架。
