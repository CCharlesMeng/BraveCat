# 家主题与小猫用品合成契约

状态：当前设计。取代 `modular-composition-contract.md` 中“玩家逐件替换家具”
的方案；决策见 `docs/adr/0010-home-themes-fix-furniture-cat-items-vary.md`。

## 结论

Home Theme 是一套完整固定空间。房间形态、墙地表面、窗框、旅行陈列装置、
纪念品柜、主地毯和植物共同组成主题，不在不同主题之间逐件迁移。

玩家只选择 Cat Item（小猫用品）：它必须支持小猫吃饭、睡觉、磨爪或玩耍，
并改变小猫在家的可见活动。玩家不是在装修房间，而是在照顾小猫。

## 选择层

### Home Theme · 完整空间

每个主题固定：

- 相机、画布、水平线、灭点和 HomeForm。
- 墙、地面、窗洞、平台、台阶和连续表面。
- 窗框、窗帘、旅行陈列、纪念品柜、主地毯和植物。
- 明信片、纪念品、Treat 和 Cat Item 的投影位置。
- 猫行走安全区、落脚面、遮挡和 lighting。

固定不等于烘焙成单图。窗框、柜沿、陈列前框等仍可按遮挡职责拆成内部图层，
但这些图层只属于主题 adapter，不成为玩家可选部件。

### Cat Item · 小猫用品

首版只提供四个固定活动位置：

- `scratch`：抓柱、低矮猫树、磨爪垫。
- `feed`：食盆、水碗、慢食盘。
- `rest`：猫窝、睡垫、纸箱窝。
- `play`：隧道、球轨、逗猫玩具、益智喂食玩具。

`rest` 与 `play` **不共用**中央活动区。决策见
`docs/adr/0011-cat-item-slots-occupy-disjoint-frozen-zones.md`：`rest` 落近处
左前地面或上层平台带，`play` 落中央主地毯带；两区 AABB 必须互不相交。A / B / F
的 furnished dressed QA 已证明分区物理存在。正式坐标冻结在各主题
`geometry--furnished-base-plate--measured-freeze-v02.json` 的 `catItemSlots`。

Cat Item 必须至少支持一个 Home activity 和对应 Pose。纯装饰、窗框、相框、
柜子、植物和普通地毯不是 Cat Item。

## 跨主题身份

玩家选择的是稳定的 `CatItemId`，不是某张家具图片。同一用品在 A、B、F
主题中可以改变材质、底座比例和透视，以适配房间，但应保留可识别的形状、
玩法和名称。

例如“云朵猫窝”可以在 A 使用鼠尾草亚麻，在 B 使用奶油织物，在 F 使用
烟蓝毡；三者仍是同一件用品，支持同一组睡眠活动。

```ts
type CatItem = {
  id: CatItemId
  activity: 'scratch' | 'feed' | 'rest' | 'play'
  supportedActivities: readonly HomeActivity[]
}

type CatItemThemeAdapter = {
  catItemId: CatItemId
  homeThemeId: HomeThemeId
  art: {
    base: string
    foregroundOcclusion?: string
    activityVariants?: Partial<Record<HomeActivity, string>>
  }
  anchors: Record<string, Point>
  supportSurface: Polygon
  interactionRegion: Polygon
}
```

可上架不变量：

- 每个上架 Cat Item 必须覆盖所有上架 Home Theme；不在运行时显示兼容错误。
- adapter 使用主题冻结的活动位置，不能移动或自由摆放。
- `supportSurface`、猫落脚点和互动目标必须与 Pose 物理兼容。
- base 与 foreground occlusion 必须来自同一注册母版。
- 用品更换不得改变明信片、纪念品、Treat 或房间家具。

## 深模块接口

调用者只选择主题与小猫用品，不判断尺寸或主题兼容性：

```ts
listHomeThemes(): readonly HomeThemeSummary[]
listCatItems(activity: CatItemActivity): readonly CatItemSummary[]
resolveHomeScene(
  themeId: HomeThemeId,
  catItems: CatItemSelection,
  dynamic: HomeDynamicContext,
): ResolvedHomeScene
```

`resolveHomeScene` 内部负责：

- 读取完整主题 adapter 和 Cat Item 的主题专属 adapter。
- 解析固定家具、动态陈列、用品、猫、遮挡和 lighting 的层顺序。
- 将同一 `CatItemId` 映射成当前主题的正确外观与尺度。
- 对缺失 adapter 的开发数据直接失败；生产目录在上架前过滤完整性。

调用者不认识 HomeForm 坐标、家具 ID、用品图片路径或兼容 profile。

## 存档

```ts
type HomeSelection = {
  homeThemeId: HomeThemeId
  catItems: {
    scratch: CatItemId
    feed: CatItemId
    rest: CatItemId
    play: CatItemId
  }
}
```

- 切换主题保留四个 Cat Item ID，只替换其主题 adapter。
- Cat Item 暂时下架时保留原 ID，解析到默认用品；重新上架后自动恢复。
- 不保存图片路径、坐标、z-index、家具 ID 或主题适配 ID。

## 层顺序

建议固定为：

1. exterior/time
2. theme shell 与固定后层家具
3. Cat Item base
4. cat
5. postcard/souvenir/Treat dynamic content
6. theme 固定前景遮挡
7. Cat Item foreground occlusion
8. lighting
9. interaction/UI

## 已有资产如何处理

- A/B/F 完整合成图继续作为 Home Theme 的固定家具视觉方向。
- 窗框、陈列、柜子、主地毯和植物审阅图成为主题内部资产来源，不进入玩家
  物品列表。
- 抓柱与食盆审阅图可迁移为首批 `scratch`、`feed` 默认用品 adapter。
- 旧“点柜子换件”“适配窗框/陈列/柜子”UI 标记为否决方案，不进入实现。
- 新增 `rest` 和 `play` 两类真正以猫为中心的用品美术。

## 首批切片

1. A/B/F 各冻结一套完整固定主题。
2. 生产两个跨主题用品：
   - `scratch-basic`：现有抓柱设计的 A/B/F adapter。
   - `feed-ceramic-pair`：现有双碗设计的 A/B/F adapter。
3. 新设计两个用品：
   - `rest-cloud-bed`：猫窝，支持 `sleep`、`stretch`。
   - `play-soft-tunnel`：软隧道，支持 `play`、`reach`、`sniff`。
4. 用真实猫 Pose 验证四个活动位置、落脚面、遮挡与面板避让。
5. 只在上述切片通过后扩展用品数量，不增加家具换件或自由摆放。
