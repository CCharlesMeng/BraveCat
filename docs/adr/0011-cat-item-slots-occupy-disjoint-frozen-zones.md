# Cat Item 的 rest 与 play 占用互不重叠的冻结分区

首版四个固定活动位置中，`rest` 与 `play` 不得共用同一中央活动区。
`rest` 落在近处左前地面或上层平台带；`play` 落在中央主地毯带。两区在
画布上必须互不相交，且各自完整落在主题 `1200×1600` 画布内。

三套 furnished base plate 的 dressed QA 已证明分区在 A / B / F 中都物理
存在且可同时占用：

- A 清润鼠尾草：左前地板承托 `rest-cloud-bed`，中央圆毯承托
  `play-soft-tunnel`（见 `production/a-clear-sage/qa--furnished-base-plate-dressed--candidate-v01.png`）。
- B 暖胡桃画廊：左前地板与中央圆毯分属不同区域（见
  `production/b-warm-walnut-gallery/qa--furnished-base-plate-dressed--candidate-v01.png`）。
- F 月白蓝灰：上层平台承托 rest，下层圆毯承托 play（见
  `production/f-moonwhite-bluegray/qa--furnished-base-plate-dressed--candidate-v01.png`）。

dressed QA 中的临时 `dress.itemBox` 只是测量起点，不是冻结几何；正式坐标
写入各主题 `geometry--furnished-base-plate--measured-freeze-v02.json` 的
`catItemSlots`。

## Consequences

- `rest` 与 `play` 的 `placement` 必须 AABB 不相交；机器检查拒绝重叠或越界。
- 同一主题可同时上架一件 rest 用品与一件 play 用品，无需运行时互斥或共享
  槽位仲裁。
- 中央地毯带专属 `play`；不得把猫窝注册到地毯中心，也不得把隧道注册到
  左前 rest 带。
- F 的 rest 可落在上层平台，play 仍落在下层地毯，仍视为互不重叠的分区。
- `scratch` 与 `feed` 继续使用既有预留区，本决策不改变它们的位置语义。
- 本决策冻结设计事实；`runtimeEligible` 仍须在 occlusion、Pose QA 与
  resolver 接入通过后单独晋升。
