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

## 部件拆分（切片 3，2026-08-13）

`shell.png` 已替换为干净底 `shell--candidate-v02-clean.png`：
以 v01 为参考重生成"无家具"版（`source--clean-shell--imagegen-v02.png`），
仅在家具区内羽化混入，家具区外与 v01 逐像素一致，书架/卡位实测数据
继续有效。管线见 `scripts/build-den-piece-split.mjs`。

- `piece--scratcher--green-post`、`piece--feeding--ceramic-bowls`：
  从 v01 与干净底的差分抠出，自带阴影；叠回干净底可还原 v01
  （脚本内置还原校验）。差分件含少量结构线残影，仅限本 form
  本位置使用，不可移植到其他背景。
- `piece--scratcher--rope-tower`、`piece--feeding--raised-feeder`：
  绿幕生成 + 绿色优势度键控（`scripts/build-den-alt-pieces.mjs`），
  底边中点锚定到与默认件相同的落脚点。
- `lab--split-level-den--swapped-pieces.png`：Theme Lab 换装组合
  QA 截图（`?themePieces=scratcher:den-rope-tower,feeding-set:den-raised-feeder`）。

## 已知欠账（后续切片处理）

- 窗景、壁柜、书架、地毯仍烘焙在 shell 里：无 exterior 时间层与
  lighting，柜体换装与 finish 层待后续切片。
- 吃饭时 minho 贴片自带的碗与 feeding-set 部件的碗并存，待贴片
  与部件的碗位对齐评审。
- 替换部件（麻绳斜塔、高脚食台）无接触阴影，视觉贴地感待美术
  评审补一层软阴影。
- minho 动画贴片复用 classic-v4 的四套；是否为本 form 单独出图
  待美术评审。
