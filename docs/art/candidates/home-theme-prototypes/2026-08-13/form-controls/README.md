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

**本目录按 3:4（1200×1600）合同执行。**

2026-08-13 用户裁决：房间画布与窗外景规格是两回事——HomeForm 几何
维持 3:4 合同；窗外景是可按视角重新定位的独立图层（后期可能加陀螺仪
视差），其母版要求是"任意视差偏移下盖满窗洞 + 构图安全出血"，与画布
比例无关。视差预留细则见
`../../home-exteriors/README.md` 的「视差与视角预留」。

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

2026-08-13 产品方向已改为“主题固定家具，小猫用品可换”。现有几何与实测
坐标继续有效，但 socket 角色重新分类：

1. 窗框、postcard-display、柜子、主地毯和植物成为 Home Theme 内部固定
   图层；仍需 base/occlusion 和锚点 QA，但不进入玩家选择或存档。
2. scratcher 与 feeding-set 迁移为 `scratch`、`feed` Cat Item adapter。
3. 新增 `rest` 与 `play` 活动位置，分别生产猫窝与玩具；位置必须通过真实
   `sleep/stretch/play/reach/sniff` Pose 验收。
4. 同一 Cat Item 必须覆盖 A/B/F 三个主题 adapter 后才可上架。
