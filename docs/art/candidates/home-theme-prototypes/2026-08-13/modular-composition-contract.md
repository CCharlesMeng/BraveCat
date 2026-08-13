# Home Theme 分层合成契约

状态：设计提案。目标是同时支持整体主题切换和兼容物件的独立替换，避免
“一个主题一张整图”。代码库层面的落地路径见同目录
`architecture-change-plan.md`。

## 结论

最终 Home 不是单张背景，而是由一个 `HomeForm`、一个 `HomeFinish`、若干
类型化 `HomeSocket` 的物件选择以及动态游戏内容解析出的 `ResolvedHomeScene`。

`HomeThemePreset` 只是上述选择的一套协调默认值。玩家可以一键采用主题，
也可以继续替换该房间形态允许的窗框、相框、猫爬架、碗、柜子和地毯。

## 四层选择

### 1. HomeForm · 房间形态

冻结不可随单个物件变化的物理事实：

- 画布、相机、水平线和灭点。
- 墙、地面、屋顶、窗洞、平台和台阶。
- 猫活动落脚面、陈列墙面、柜体落点和行走安全区。
- 每个可替换位置的 `HomeSocket`。

A、B、D、E、F 是不同的 HomeForm，不是背景图片版本。

### 2. HomeFinish · 表面风格

只改变连续表面的材质与氛围：

- 墙纸或墙面 wash。
- 地板、屋顶、梁柱和踢脚线材质。
- 窗外时间层与室内 lighting。
- 不创建独立可识别的家具或陈列物件。

同一 HomeFinish 可以适配多种 HomeForm，但必须为每个平面输出受控投影，
不能把一张墙纸位图直接拉伸到所有房间。

### 3. HomePiece · 可替换物件

每件物件只服务一种类型化插槽：

- `window-frame`：窗框、窗台、窗帘或百叶。
- `postcard-display`：相框、展示轨、软木板或夹绳。
- `scratcher`：猫爬架、抓柱或低矮猫树。
- `feeding-set`：水碗、食盆和承托垫。
- `cabinet`：纪念品柜、矮柜或旅行箱柜。
- `rug`：睡眠/玩耍地毯。
- `plant`：花瓶与植物；只能使用主题提供的安全插槽。

物件资产必须是带透明度的独立 PNG/WebP 或由多个透明层组成；不得重新
烘焙进 shell。

### 4. Dynamic Content · 动态内容

不属于换肤资产：

- 当前猫及其 Home activity。
- 最近六个到访地点对应的明信片。
- 最近三类纪念品。
- 窗台小鱼干、字条和交互状态。

换主题或换物件时，这些内容只重新投影到新场景，不被重建或清空。

## HomeSocket

HomeForm 用 socket 描述“这里允许放什么”，而不是写死某张素材：

```ts
type HomeSocket = {
  id: string
  kind: HomePieceKind
  plane: RoomPlaneId
  projection: Quad | Rect
  zBand: readonly [min: number, max: number]
  supportSurface?: Polygon
  exclusionZones: readonly Polygon[]
  interactionRegion?: Polygon
  compatibilityProfile: string
}
```

关键不变量：

- `projection` 由 HomeForm 的透视产生，HomePiece 不自带第二套房间透视。
- HomePiece 可以声明自身内部锚点，但不能移动 socket。
- `supportSurface` 保证柜子、碗、猫爬架真实落地。
- `exclusionZones` 防止植物、柜子和明信片侵入猫活动或彼此穿插。
- occlusion 必须属于具体物件或 socket，不再使用一张全屋通用遮挡图。

## HomePiece adapter

```ts
type HomePiece = {
  id: HomePieceId
  kind: HomePieceKind
  compatibleProfiles: readonly string[]
  art: {
    base: string
    foregroundOcclusion?: string
    activityVariants?: Partial<Record<HomeActivity, string>>
  }
  intrinsicAnchors: Record<string, Point>
}
```

例如：

- 猫爬架 adapter 可提供 `gaze-perch` 和 `play-target` 锚点。
- 柜子 adapter 可提供三个 `souvenir` 落点及桌沿遮挡层。
- 窗框 adapter 可提供 `treat` 和 `gaze` 窗台锚点。
- postcard-display adapter 只能消费 HomeForm 提供的陈列墙面投影。

## 深模块接口

调用者不应拼接层或判断兼容性。建议 seam：

```ts
listHomeForms(): readonly HomeFormSummary[]
listCompatiblePieces(
  formId: HomeFormId,
  socketId: HomeSocketId,
): readonly HomePieceSummary[]

resolveHomeScene(selection: HomeCustomization): ResolvedHomeScene
```

`resolveHomeScene` 内部负责：

- 校验 form、finish、piece 与 socket 兼容。
- 计算所有静态层、quad、锚点、z-index 和 occlusion。
- 将猫、明信片、纪念品和 Treat 投影到解析后的场景。
- 拒绝缺少落脚面、交互热区或活动锚点的组合。

`App.svelte` 只消费 `ResolvedHomeScene`，不认识具体主题名称和物件 ID。

## 主题预设与玩家选择

```ts
type HomeThemePreset = {
  id: HomeThemeId
  formId: HomeFormId
  finishId: HomeFinishId
  pieces: Partial<Record<HomeSocketId, HomePieceId>>
}

type HomeCustomization = {
  presetId?: HomeThemeId
  formId: HomeFormId
  finishId: HomeFinishId
  pieces: Record<HomeSocketId, HomePieceId>
}
```

- 选择主题：用 preset 填充一套协调组合。
- 单换物件：只覆盖一个 socket 的 `HomePieceId`。
- 更换 HomeForm：重新检查所有旧物件；兼容者保留，不兼容者回退到新 form
  的 preset 默认值。
- 存档只保存选择 ID，不保存派生坐标或图片路径。

## 层顺序

建议固定为：

1. exterior/time
2. shell surfaces
3. finish overlays
4. rear HomePieces
5. cat
6. postcard/souvenir dynamic content
7. foreground occlusion from individual HomePieces
8. lighting
9. interaction/UI

单件物件不得跨越多个不连续 z-band；需要前后遮挡时拆成 base 与
`foregroundOcclusion` 两层。

## 当前 Home v4 的迁移事实

当前 `src/lib/homeArt.ts` 已把以下内容部分拆开：

- exterior time layers
- lighting
- cat animations 与 `catPlacements`
- postcard wall fixture 与六个 slot
- souvenir anchors 与全局 souvenir occlusion
- Treat placement

但 `interior-foreground` 仍烘焙了：

- 窗框与窗台
- 猫爬架
- 水碗与食盆
- 地毯
- 柜子、书、篮筐
- 花瓶与植物
- 墙、地板和踢脚线

因此迁移不能靠继续增加 `interior-foreground-*` 变体。需要为选定的首批
HomeForm 重新产出干净 shell，再把上述可见物件分别生成透明资产。

## 首批实现切片

1. 选 A 与 F 作为第一批真实 HomeForm，形成第二个 adapter 后再建立 seam。
2. 每种 form 先提供一个 finish 和一套默认 pieces，验证完整运行时。
3. 优先拆出 `postcard-display`、`scratcher`、`feeding-set`、`cabinet` 四类；
   window-frame 与 rug 随后。
4. 加入一个 dev-only 配置器，逐 socket 切换并显示兼容性错误。
5. 最后才开放用户主题选择与单件替换，并迁移现有 Home 为默认 preset。
