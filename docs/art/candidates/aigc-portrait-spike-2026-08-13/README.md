# AIGC Portrait Spike — 2026-08-13

R&D spike：验证「用户上传一张猫照片 → 风格化生成游戏形象（Portrait）→ 输出姿势一致的角色套图」的可行性。
这是四端商业化改造中的核心付费功能，也是最大技术不确定点。

结论见同目录 [`feasibility.md`](./feasibility.md)：**有条件可行**。

所有文件均为候选（candidate），未经审批，不得进入 `public/` 或 `src/`。

## 产物清单

| 文件 | 说明 |
| --- | --- |
| `upload-standin--juju--photo--v01.png` | 「用户上传照片」替身：写实橘白猫、普通室内背景（AI 生成，1024×1024 RGB） |
| `portrait-candidate--juju--sit--v01.png` | sit 姿势候选（白底 RGB） |
| `portrait-candidate--juju--sleep--v01.png` | sleep 姿势候选（白底 RGB） |
| `portrait-candidate--juju--walk--v01.png` | walk 姿势候选（白底 RGB） |
| `portrait-candidate--juju--eat--v01.png` | eat 姿势候选（白底 RGB，含 portrait-contained 食盆） |
| `portrait-candidate--juju--*--v01--alpha.png` | 上述四张的抠图实测产物（泛洪填充白底转透明，1px 羽化，RGBA） |

试验角色代号 `juju`（橘橘）。文件名沿用现役 `portrait--<cat>--<pose>--vNN.png` 约定，加 `portrait-candidate--` 前缀与生产资产隔离。

## 生成参数

- 生成器：Cursor 内置图像生成工具（作为工作流替身；生产目标模型为百炼万相 2.7，见 feasibility.md）。
- 尺寸：1:1，输出 1024×1024（与现役 `public/portraits/minho/` 规格一致）。
- 照片替身提示词要点：写实手机快照质感、橘白花色（橘色头顶盖斑、白色鼻梁血统线、白胸白前腿、橘背、环纹尾巴、琥珀眼、粉鼻）、普通客厅背景。
- 姿势图提示词结构（每姿势一次调用，两张参考图）：
  1. 参考图 1 = 照片替身（角色身份来源）；
  2. 参考图 2 = minho 对应姿势 png（画风与构图锚点，`public/portraits/minho/portrait--minho--<pose>--v01.png`）；
  3. 文字 = 身份特征逐条锁定（花色分块、眼色、体型）+ 姿势物理约定（按 `src/lib/assets/portraitPoseVocabulary.js` 的落脚面/承重点转写为自然语言）+ 纯白空背景、无地面阴影、主体贴 bottom-center。
- eat 姿势按词汇要求把食盆（`food-vessel`，portrait-contained）画进形象内、位于口鼻下前方；未烘入任何 scene-provided 目标。

## 评估

### 1. 跨姿势角色一致性 — 良好，有可控缺陷

四张图可明确辨识为同一只猫：橘色头顶盖斑 + 白色鼻梁血统线、白胸白前腿、橘背、深色环纹尾巴、琥珀眼、粉鼻全部稳定复现。

缺陷（前景平均色实测，RGB）：sit (227,200,172) 明显浅于 sleep/eat (220,182,140)，即橘色饱和度存在跨姿势漂移；白/橘分界线位置也逐姿势漂移（照片中后腿以橘为主，walk 候选四肢全白）；sleep 的头顶斑覆盖略大。用户「认得出是自己的猫」这一底线达标，但需要自动 QA 卡色块拓扑。

### 2. 画风与现役资产匹配度 — 高

彩铅写实质感、细腻毛发笔触、柔和暖光、无描边，与 minho 组并排看属于同一套资产。把现役 png 作为逐姿势风格参考图的做法效果显著，应保留进生产管线。

### 3. 透明背景 / 可抠性 — 有条件通过

模型无法直接输出 alpha，只能出白底图。对四张图做泛洪填充抠图实测（`--alpha.png`）：全部干净分离，白毛区域无误删（毛发边缘的细微暖灰阴影提供了分离度）。但轮廓边缘接近纯白（min channel ≥ 235）的像素占比实测为 walk 37.8% / eat 45.1% / sit 50.6% / sleep 66.1%，阈值法本质脆弱——浅色猫贴白底时随时可能失败。生产必须用分割模型抠图，且可把生成底色改为中性浅灰绿以拉开同色边界（详见 feasibility.md）。

### 4. 姿势物理正确性 — 全部符合词汇约定

- sit：臀部 + 双前爪着地的紧凑坐姿（hindquarters-and-front-paws / compact-horizontal-perch）✓
- sleep：蜷成球，躯干、头、蜷爪贴地（torso-head-and-curled-paws / broad-horizontal-perch）✓
- walk：全侧面行进，承重爪落在同一水平地线（load-bearing-paws / continuous-horizontal-path）✓
- eat：四爪站立，食盆位于口鼻下前方且包含在形象内（standing-paws / food-vessel portrait-contained / below-and-ahead-of-muzzle）✓

锚点实测：四张图前景水平中心 0.50–0.53（居中达标），但底部留白 70–248px 不等——`support-contact-bottom-center` 锚点约定需要在后处理中做基线归一化，不能指望模型直接出齐。

### 5. 与现役 png 规格兼容性 — 达标

1024×1024 与 minho 组一致；唯一缺口是无 alpha 通道，由抠图后处理补齐。生产建议 2K 生成后降采样到 1024，可改善边缘。

## 复现抠图实测

一次性脚本（不在仓库内）：Pillow + numpy，从图像边界对 min(R,G,B) ≥ 245 的像素做四连通泛洪得到背景掩膜，前景保持不透明，1px 均值羽化。指标口径：`edge_near_white` = 前景轮廓像素中 min channel ≥ 235 的占比。
