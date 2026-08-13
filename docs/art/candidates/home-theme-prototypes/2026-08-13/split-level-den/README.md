# split-level-den（原型编号 F）· 第二个 HomeForm 候选

状态：approved-for-development-preview 候选；`shippingEligible: false`，
仅进 `public/dev-art/home-theme/split-level-den/`，不进 `public/assets/`。

## 来源

- 几何控制图：`../home-theme--f-split-level-den--control-v01.png`
  （用户确认方向"F 可以"）。灭点 (2750, 900)，转角 x=980，
  错层平台承担看窗/进食，低层地面承担睡眠/玩耍。
- `source--shell--imagegen-v01.png`：image generation 原始产出
  （1024×1536），参考 = 控制图（几何）+ classic-v4 interior（风格）。
- `shell--candidate-v01.png`：按 Home v4 既有规则归一化
  （裁 {0,62,1024,1365} → 等比放大 1200×1600，sRGB + alpha）。

## 实测与数据冻结

画面书架与理想控制图存在小偏差，运行时坐标按候选实测重排
（与 classic-v4 "坐标实测自已验收美术"惯例一致）：

- 三条书架顶边反推 yAtLeft ≈ 262 / 419 / 578（灭点漂移 ≤ 15px）。
- 卡位行改为"坐在架上"：bottomAtLeft = 260 / 417 / 576，行高 105。
- 柜顶沿实测 y ≈ 730 → 748（x 560 → 900），斜率 ≈ 3.0°；
  纪念品锚点 y 688/693/699。
- 数据落在 `src/lib/homeTheme/forms/split-level-den.ts`，
  由 wallY 公式投影，测试锁定灭点收敛。

## QA 证据

- `f-geometry-qa.png`：卡位/锚点/treat 叠加在候选图上的几何对齐检查。
- `lab--split-level-den--{gaze,sleep,eat}.png`：Theme Lab
  （`?themeLab=split-level-den`）下真实明信片、纪念品、Treat 与猫的
  重投影截图；classic-v4 六状态像素回归同步保持一致。

## 已知欠账（后续切片处理）

- 窗景与展示架烘焙在 shell 里：无 exterior 时间层与 lighting，
  换 finish/时间氛围需等分层资产（切片 4）。
- 猫爬架、碗、地毯烘焙在 shell 里：吃饭时 minho 贴片自带的碗与
  shell 画的碗并存，待 feeding-set 部件拆分（切片 3）。
- minho 动画贴片复用 classic-v4 的四套；是否为本 form 单独出图
  待美术评审。
