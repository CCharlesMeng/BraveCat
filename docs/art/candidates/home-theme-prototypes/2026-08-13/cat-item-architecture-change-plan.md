# 从家具换件迁移到小猫用品

状态：编码会话交接规划。产品决策见
`docs/adr/0010-home-themes-fix-furniture-cat-items-vary.md`；本文不授权本
美术会话修改运行时代码。

## 迁移原则

保留已经证明有价值的深模块和分层合成，删除玩家需要理解的家具兼容性。

- 保留：`resolveHomeScene`、HomeForm 几何、主题 finish、数据驱动图层、
  明信片/纪念品投影、per-layer occlusion、Theme Lab 几何 QA。
- 收回内部：窗框、陈列、柜子、主地毯、植物的 `HomePiece`。它们继续作为
  主题内部图层，但不进入玩家选择、存档或兼容列表。
- 改名并深化：抓柱、食盆迁移为 Cat Item adapter；新增猫窝和玩具。
- 删除：玩家逐 socket 家具选择、`listCompatiblePieces` 外部 interface、
  家具 fallback 文案和家具适配反馈 UI。

## 目标模块

```text
src/lib/homeTheme/
├── index.ts              # listHomeThemes / listCatItems / resolveHomeScene
├── types.ts              # HomeTheme / CatItem / CatItemThemeAdapter / scene
├── resolveHomeScene.ts
├── themes/
│   ├── classic-v4.ts
│   ├── clear-sage.ts
│   ├── warm-walnut-gallery.ts
│   └── moonwhite-split-level.ts
└── cat-items/
    ├── scratch-basic.ts
    ├── feed-ceramic-pair.ts
    ├── rest-cloud-bed.ts
    └── play-soft-tunnel.ts
```

家具图层可继续使用现有内部 registry，但不应暴露为第二套玩家选择 seam。

## 状态迁移

目标存档只保留：

```ts
type HomeSelection = {
  homeThemeId: string
  catItems: {
    scratch: string
    feed: string
    rest: string
    play: string
  }
}
```

从现有 `homeCustomization` 迁移：

- `presetId` / `formId` / `finishId` 解析成最接近的 `homeThemeId`。
- 现有 scratcher 选择映射到 `scratch`；feeding-set 映射到 `feed`。
- 窗框、陈列、柜子、地毯和植物选择丢弃，不迁移成用品。
- `rest`、`play` 注入默认用品。
- 旧字段在一个存档版本内只读迁移，写回只使用新形状。

未知或下架 Cat Item ID 沿用现有“保存原 ID、解析时回退”的语义。

## Resolver 深化

`resolveHomeScene(themeId, catItems, dynamic)` 负责：

1. 解析完整主题和固定家具内部图层。
2. 为四个 `CatItemId` 选择当前主题 adapter。
3. 合成用品 base、猫 Pose、动态内容与用品 foreground occlusion。
4. 在开发环境拒绝缺失主题 adapter、落脚面或互动目标的数据。

调用者不判断 Cat Item 是否适配主题。生产 catalog 只放行已覆盖全部上架主题
的用品。

## UI 改造

- 保留主题抽屉和整屋预览确认。
- 删除主题抽屉中的 `部件` tab、家具热点、柜子选项和家具适配反馈。
- 新增独立 `小猫用品` 入口，分类固定为磨爪、吃饭、睡觉、玩耍。
- 用品详情优先展示真实猫活动预览；静物缩略图只用于选择。
- 切主题不弹兼容对话框，用品语义无缝保留。

旧 UI 截图继续留在候选归档，标记为 rejected evidence，不进入实现。

## 资产迁移

- 现有 A/B/F 抓柱 → `scratch-basic` 的三个主题 adapter 来源。
- 现有 A/B/F 双碗 → `feed-ceramic-pair` 的三个主题 adapter 来源。
- 窗框、陈列、柜子、地毯、植物 → 各主题固定图层来源。
- 新产 `rest-cloud-bed` 与 `play-soft-tunnel` 的 A/B/F 三套 adapter。
- 每个用品 adapter 交付 base、必要 foreground、support surface、互动目标、
  猫 Pose QA 和同母版注册证据。

## 纵向切片

1. **收窄界面但不改画面**：固定现有家具选择为主题默认值，隐藏家具 UI；
   回归截图保持像素一致。
2. **状态迁移**：引入 `homeThemeId + catItems`，迁移 scratch/feed，注入
   rest/play 默认值。
3. **两件既有用品**：抓柱、双碗改走 Cat Item adapter；用 `gaze/play/eat`
   Pose 验证。
4. **两件新用品**：猫窝和软隧道，补齐 `sleep/stretch/reach/sniff`。
5. **玩家 UI**：上线 `小猫用品` 分类和活动预览；删除家具兼容代码。
6. **清理**：移除旧 piece selection 存档形状、家具 fallback 和被否决文案。

## 验收

- 切换 A/B/F 时四个 Cat Item ID 不变，画面自动使用主题适配外观。
- 家具始终随主题完整切换，不出现保留、兼容或 fallback UI。
- 每个用品至少触发一个真实 Home activity，且猫落脚、遮挡和比例正确。
- 主题与用品变更不影响旅行、明信片、纪念品、Treat 或当前猫身份。
- 生产环境不暴露缺少任一主题 adapter 的 Cat Item。
