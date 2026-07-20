# 《咪游记》美术校准与批产约定 v1

`candidates/calibration/` 下的内容均为 `calibration-non-final`，不得进入运行时素材目录。画风浓淡和明信片规格已经锁定；具体猫形象在用户提供真实小猫照片前是硬阻塞项。

## 已锁定决策与硬门

- `style-intensity = B`（`locked`）：采用三张现有参考图的浓度，不自动增强或减淡。
- `postcard-format = landscape-4:3-1200x900`（`locked`）：明信片与正式场景底板统一为横版 1200×900。
- `portrait-generation = blocked-by-user-photo`：未收到用户真实小猫照片前，不得生成身份板、具体小猫 Portrait 或六姿势，也不得以臆造猫、预设猫或参考图中的猫代替。
- 解锁 Portrait 时必须先向用户说明照片要求，然后停止并等待用户在后续消息中提供照片；不能在说明要求的同一轮直接生成。

届时应先要求 4–8 张未滤镜、清晰原图：正面、左右 3/4、侧面、全身站/坐、背部与尾巴花纹；自然光、无遮挡、单猫入镜，并补充眼睛颜色和关键辨识特征。收到后先检查覆盖度，不足则继续等待补图。

## 文件与 ID

- ID 一律用小写 ASCII kebab-case；地标 ID 用 `{country}-{city}-{landmark}`。
- 已批准文件不覆盖；像素、透明边或合成位变化都递增两位版本号。
- 正式形象：`portrait--{portrait-id}--{sit|sleep|walk|eat|play|gaze}--vNN.png`
- 正式场景：`scene--{destination-id}--{variant-id}--vNN.png`
- 正式物品：`item--{snack|wish|toy}--{item-id}--vNN.png`
- 正式纪念品：`souvenir--{destination-id}--{souvenir-id}--vNN.png`
- 校准板：`calibration-non-final--{family}-board--{subject-id}--candidate-{a|b|c}--vNN.png`

## 画布与透明层

| 资产 | 母版尺寸 | 输出 |
| --- | --- | --- |
| 场景/空白明信片底板 | 1200×900（横版 4:3） | sRGB、8-bit、opaque PNG；保留空白文案/邮戳区，不画猫、日期或合成位标记 |
| 单个形象姿势 | 1024×1024 | 仅解除照片硬门后输出；straight-alpha RGBA PNG；六姿势同画布、同体量，主体留 64 px 安全边 |
| 物品/纪念品图标 | 512×512 | straight-alpha RGBA PNG；主体留 48 px 安全边 |
| 场景校准候选板 | 1200×900（横版 4:3） | opaque PNG；图内标 `CALIBRATION • NON-FINAL`，文件名含 `calibration-non-final` |

透明资产不得带纸色矩形底、彩边或场景碎片；完全透明像素的 RGB 置零。允许极淡的中性接触阴影，但不得把具体地面画进形象层。v1 场景不做前景遮挡层，合成位必须完整、无遮挡。

## 场景合成位

- 坐标以整张 1200×900 场景底板为基准，原点在左上，`x/y` 均归一化到 `[0,1]`。
- `x/y` 指形象画布的底部中心锚点；`scale = 形象渲染高度 / 场景高度`。
- `flip` 在缩放后、定位前水平翻转，锚点不变。
- 运行时顺序固定为：`scene → portrait → postcard copy → postmark`。
- `pose` 只能取 `sit/sleep/walk/eat/play/gaze`；旅伴直接画进场景变体。
- 每个场景另记 `safeBounds` 供人工验收，但运行时只需 ADR-0001 所定的 `x/y/scale/pose/flip`。

照片硬门解除前，只能用几何框和锚点检查空合成位，不得生成或放入替代猫。收到照片并批准真实猫形象后，才把所需姿势实际叠进场景做最终合成 QA；形象不得遮住地标识别点，也不得压入文案/邮戳安全区。

## 提示词与人工挑选

1. `prompt-pack.calibration.v1.json` 中只有场景与图标任务可处于候选阶段；所有具体猫任务必须在 `blockedJobs` 中保持 `blocked-by-user-photo`。
2. 画风直接使用已锁定的 B 浓度，不再自动生成 A/C 浓淡变体。
3. 场景候选与正式输出都按 1200×900；照片硬门解除前，场景只能保留空合成位。
4. 候选只进 `candidates/calibration/`，并在该目录的 manifest 中保持 `shippingEligible: false`。
5. 负责人按 0–2 分评价适用项：画风贴合、身份一致、轮廓可读、合成适配、透明边质量。任一适用项为 0 即淘汰。
6. Portrait 解锁顺序固定为：说明照片要求 → 等待用户提供 → 检查照片覆盖度 → 用户确认身份校准 → 才允许六姿势任务。
7. 批产后机器检查尺寸、RGBA/opaque 约束、ID 唯一和场景 pose 引用；六姿势齐全与逐场景实叠检查在照片硬门解除后执行。

`asset-manifest.v1.template.json` 是生产清单模板；其 `compositionSlot` 与当前 `src/lib/assets` 类型对齐，`production` 字段只用于生产和 QA。

## 锁定后可并行的批次

- `[blocked-by-user-photo]` 每个 `portrait-id` 一个六姿势与透明导出批次；用户照片到达并完成身份确认前不得排队或执行。
- 每个 `destination-id` 一个批次：同一地标的 2–3 个 1200×900 空场景变体；10 个地标可各自独立。
- 物品按 `snack`、`wish`、`toy` 三批；统一锁定图标体量后并行。
- 每个 `destination-id` 一个纪念品批次。
- 元数据/空槽 QA 可按地标分批；含猫实叠 QA 标记为 `blocked-by-user-photo`，最终由单一整合批次汇总目录。

开始非猫批次前仍需锁定地标清单、图标语言和每个地标的变体/旅伴配额。猫花纹、配饰与身份规则只能从用户照片提取，不能预设。
