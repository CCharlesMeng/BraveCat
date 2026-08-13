# Home Theme 架构变更规划

状态：规划。承接同目录 `modular-composition-contract.md` 的分层契约，
回答"代码库需要改什么、按什么顺序改"。

## 迁移起点（现状盘点）

| 现状 | 位置 | 问题 |
| --- | --- | --- |
| 全部家外观常量集中在一个平面模块 | `src/lib/homeArt.ts` | 单一 canvas、单一 interior-foreground(+eat 整图变体)、硬编码 6 个明信片 quad、3 个纪念品锚点、猫落位、Treat 位置 |
| 图层堆叠顺序手写在标记里 | `src/App.svelte`（room section） | exterior → interior → 猫 → 明信片墙 → 纪念品 → lighting 的顺序、遮挡关系都是隐式的 |
| 一张全屋通用纪念品遮挡图 | `public/assets/home/display--souvenir-occlusion--v01.png` | 与"occlusion 属于具体物件"的契约冲突 |
| 存档没有家外观字段 | `src/lib/game/index.ts` `GameState`、`src/lib/save/`（Dexie，SAVE_SCHEMA_VERSION 3） | 无处保存玩家的主题/部件选择 |
| 预览门禁是全局布尔 | `homeArt.ts` `HOME_ART_PREVIEW_SHIPPING_ELIGIBLE = false` | 生产仍走 CSS 房间；门禁无法按 form/piece 粒度放行 |
| 投影是近似 | `displayCanvasStyle` 用 clip-path + skewY | 多 form 多灭点后，近似误差会随墙面角度放大 |
| exterior 时间层与窗洞位置耦合 | `public/dev-art/home-v4/exterior-*.png` | 新 form 窗洞位置不同，exterior 不能直接复用 |

## 变更 1 · 新建 `src/lib/homeTheme/` 深模块

对外只暴露四个入口，调用方不拼层、不判断兼容性：

```
src/lib/homeTheme/
├── index.ts            # listHomeForms / listCompatiblePieces /
│                       # defaultCustomizationFor / resolveHomeScene
├── types.ts            # HomeForm/HomeFinish/HomePiece/HomeSocket/
│                       # HomeThemePreset/HomeCustomization/ResolvedHomeScene
├── projection.ts       # canvasStyle、quad 投影等几何工具（自 homeArt.ts 迁入）
├── resolveHomeScene.ts # 校验 + 投影 + z 序 + occlusion + 动态内容锚点
├── presets.ts          # 主题预设，含迁移用 classic-v4
├── forms/
│   ├── classic-v4.ts   # 现 homeArt.ts 常量整理成第一个 HomeForm 数据
│   ├── form-a.ts       # 首批新 form（矩形标准间）
│   └── form-f.ts       # 首批新 form（错层窗龛）
└── pieces/             # 按 kind 分组的 HomePiece adapter 注册表
```

`homeArt.ts` 的拆解去向：

- `postcardDisplaySlots`、`souvenirDisplayAnchors`、`catPlacements`、
  `treatPlacement`、`HOME_RIGHT_WALL_CORNER_X` 等 → `forms/classic-v4.ts`
  的 socket 与锚点定义。
- `interiorForegroundEat` 整图变体 → feeding-set piece 的
  `activityVariants.eat`，退役整图切换。
- `canvasStyle` / `displayCanvasStyle` / `paintedCanvasRect` →
  `projection.ts`。
- `drawerArt`（nav、pack、album 等 UI chrome）与家外观无关，留在原地
  或移入独立 `uiArt.ts`。

## 变更 2 · 渲染层改为数据驱动

- 新建 `src/lib/homeTheme/HomeScene.svelte`。`App.svelte` 只计算一次
  `$derived scene = resolveHomeScene(customization)`，把 time、activity、
  明信片、纪念品、Treat 数量和交互回调传进去。
- 层堆叠由 `scene.layers`（按契约固定的 9 段 z 序）驱动 `{#each}` 渲染，
  不再手写标记顺序。
- 动态内容渲染到 scene 输出的锚点/quad 上；`App.svelte` 不再 import 任何
  具体 form 的坐标常量。
- 全局 `souvenirOcclusion` 退役，由柜子 piece 的 `foregroundOcclusion`
  层接管。
- 投影方式作为独立决策：多 form 后每面墙灭点不同，建议 resolver 统一
  输出 quad，渲染层用 CSS `matrix3d` 做真 homography，替换现有
  clip-path + skewY 近似；classic-v4 迁移期可先保留近似以保证像素回归。

## 变更 3 · 状态与存档

- `GameState` 新增 `homeCustomization: HomeCustomization`。全家共享一份，
  与 CONTEXT.md 中 Home Theme"由全家共享"的定义一致；不随猫切换。
- 只存选择 ID（formId/finishId/presetId/每 socket 的 pieceId），不存派生
  坐标或图片路径。
- `GAME_STATE_VERSION` 与 `SAVE_SCHEMA_VERSION` 各 +1，迁移函数为旧存档
  注入 `classic-v4` 默认 preset。
- 未知或已下架的 piece ID 不让导入失败：`isGameState` 只校验形状，
  `resolveHomeScene` 负责把不兼容/不存在的选择回退到该 form 的 preset
  默认值（与"更换 HomeForm 时不兼容者回退"同一条路径）。

## 变更 4 · 资产管线

- 运行时目录契约：
  - `public/assets/home-themes/<formId>/`：shell、finish、exterior 时间层。
  - `public/assets/home-pieces/<kind>/<pieceId>/`：透明 PNG/WebP 分层。
  - 候选照旧走 `docs/art/candidates/`，dev 验证走 `public/dev-art/`。
- exterior 与窗洞解耦：每个 form 声明窗口视口，exterior 素材按 form 出，
  或 form 定义对共享天空素材的裁剪投影；classic-v4 沿用现有四张。
- 新校验脚本 `scripts/check-home-theme-assets.mjs`：注册表里的每个
  form/finish/piece 都必须有对应文件、尺寸正确、piece 带 alpha、命名符合
  版本约定；挂进 `npm run build`（与 `check-home-display-assets.mjs` 并列，
  classic-v4 迁移完成后取代它）。
- 每个新 form 冻结前，沿用 `measure-*` 脚本惯例产出几何测量证据
  （水平线、灭点、socket 投影），存入该 form 的候选目录。

## 变更 5 · Theme Lab（dev-only）

- `?themeLab` 挂载 `ThemeLab.svelte`：切换 form/finish、逐 socket 换 piece、
  展示 `resolveHomeScene` 的校验错误（缺落脚面、遮挡冲突、猫活动区侵入）。
- 配套 `scripts/capture-theme-lab.mjs` 批量截图做 QA，对齐现有 capture
  脚本惯例。
- Theme Lab 落地后删除 `wallLayoutPrototype.ts`、`WallLayoutPrototype.svelte`
  和 `?wallProto` 分支（文件内已有 PROTOTYPE 标记）。

## 变更 6 · 上线门禁

- 全局 `HOME_ART_PREVIEW_SHIPPING_ELIGIBLE` 改为 form/piece 级
  `shippingEligible`，production 侧按此过滤注册表（对齐
  `PRODUCTION_STARTER_CATALOG` 的先例）。
- CSS 房间保留为生产兜底，直到第一个 form 通过视觉验收；之后作为
  独立清理项移除。

## 实施顺序（纵向切片）

1. **切片 0 — 无视觉变化的重构**：建 `homeTheme` 模块，把现有 v4 包成
   `classic-v4` form + 默认 pieces，`App.svelte` 改为消费
   `ResolvedHomeScene`。验收标准：composite QA 截图与重构前逐像素一致。
   这是唯一的高风险改动，先行落地。
   **✅ 已完成（2026-08-13）**。`src/lib/homeTheme/` 落地
   types/projection/forms/classic-v4/resolveHomeScene/presets；
   `homeArt.ts` 收窄为日常节奏与抽屉 chrome；全局
   `HOME_ART_PREVIEW_SHIPPING_ELIGIBLE` 门禁提前并入 form 的
   `shippingEligible`（变更 6 的一部分）。渲染层暂保留具名字段
   （exterior/shell/lighting）而非通用 layers 数组，等第二个 form
   进场再数据驱动。验收证据：`scripts/capture-home-scene-regression.mjs`
   对 6 个种子状态（4 活动 × 满陈列、空陈列、外出）前后逐像素对比，
   差异全部落在同代码两轮自比的噪声包络内（HUD 计数文字与缩放图像
   边缘光栅化抖动）；`npm run check`、111 个测试、`npm run build`
   资产校验全部通过。
2. **切片 1 — 存档**：`homeCustomization` 字段、双版本迁移、回退语义
   与测试。
   **✅ 已完成（2026-08-13）**。`GameState` 新增全家共享的
   `homeCustomization`（只存 ID）；`GAME_STATE_VERSION`、
   `SAVE_SCHEMA_VERSION` 同步升到 4，导入走新增迁移 3，IndexedDB
   直载走 `restoreGameState` 宽松恢复注入默认预设。ID 类型放开为
   字符串：`isHomeCustomization` 只校验形状，引用已下架内容不算
   损坏；新增 `normalizeHomeCustomization` 在解析时统一回退
   （未知 form → 默认预设；未知 finish → 该 form 预设默认值；
   未知 socket 的 piece 丢弃），`resolveHomeScene` 对形状合法输入
   总是成功。115 个测试、`npm run build`、6 状态像素回归全部通过。
3. **切片 2 — Theme Lab + 第二个 form**：A 或 F 的 shell 进 dev-art，
   跑通 form 切换与动态内容重投影。
   **✅ 已完成（2026-08-13）**。场景升级为数据驱动的 `backdrop` 图层
   数组（fixture/occlusion/exterior 均可空）；第二个 form
   `split-level-den`（原型 F）落地：shell 由控制图 + classic 风格
   参考生成，归一化进 `public/dev-art/home-theme/split-level-den/`，
   卡位行与柜沿锚点按画面实测重排并有灭点收敛测试锁定；
   `?themeLab[=presetId]` 挂载 dev-only Theme Lab，支持主题切换、
   下架回退演示与投影参考线。QA 证据见
   `split-level-den/README.md`；classic 六状态像素回归保持一致。
   欠账：F 的窗景/家具仍烘焙在 shell（切片 3/4 拆分），minho 动画
   贴片暂复用 classic 的四套。
4. **切片 3 — 部件拆分**：优先 `postcard-display`、`scratcher`、
   `feeding-set`、`cabinet` 四类，各出两款验证换装；per-piece occlusion
   接管后删除全局遮挡图。
   **✅ 已完成（2026-08-13）**。socket/piece 机制落地：form 声明类型化
   `HomeSocket`，`HomePiece` 注册表按 kind + compatibilityProfile 匹配，
   `listCompatiblePieces` seam 就位；归一化把已下架/不兼容部件回退
   预设默认值。form 定义中的全局 fixture/遮挡字段删除：classic 的
   画框墙与柜前遮挡改由 `classic-wall-frames`、`classic-oak-cabinet`
   两个 piece 提供（输出不变，像素回归一致）。split-level-den 真实
   换装跑通：shell 替换为零漂移干净底（家具区外与 v01 逐像素一致），
   `scratcher`、`feeding-set` 各两款（默认件差分抠自 v01，替换件
   绿幕键控），Theme Lab 支持逐 socket 换件与
   `?themePieces=` 复现。欠账：classic 的 scratcher/feeding/rug 与
   den 的柜体/窗框仍烘焙在 shell（"四类各两款"完成 2/4 类的双款）；
   差分件不可移植；替换件缺接触阴影。
5. **切片 4 — finish 层与玩家 UI**：表面风格切换、主题选择界面、
   门禁放行。

## 需要补 ADR 的决策

- Home 场景在运行时由选择 ID 解析，存档只存 ID、不存派生结果。
- 家的美术按 form/finish/piece 分层出资产，不再新增整图背景变体
  （取代 `interior-foreground-*` 模式）。
- （待定，切片 0 期间验证）墙面投影采用 matrix3d homography 还是保留
  clip-path 近似。

## 风险与开放问题

- **性能**：图层数从 3–4 张涨到 9 段若干张，需要预加载策略与 WebP 化；
  Theme Lab 阶段实测低端移动端解码耗时。
- **猫动画贴片**：现有动画只有 minho 一套且落位绑定 classic-v4 视角，
  新 form 需要各自的 `catPlacements`；动画是否复用取决于新 form 的
  相机角度是否接近。
- **测试迁移**：`homeArt.test.ts` 拆成 projection 工具测试 +
  resolver 不变量测试（socket 兼容、z 序、exclusion、回退）。
