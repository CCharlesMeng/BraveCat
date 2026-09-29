/**
 * Home Theme 分层合成的公共类型。
 *
 * 设计契约见 docs/art/candidates/home-theme-prototypes/2026-08-13/
 * modular-composition-contract.md；本切片只承载 classic-v4 这一个
 * HomeForm，socket/piece 机制随后续切片扩展。
 */
export type HomeActivity = 'sleep' | 'play' | 'eat' | 'gaze'
export type HomeTime = 'morning' | 'noon' | 'dusk' | 'late-night'

/**
 * ID 一律用开放字符串：存档可能引用已下架的 form/finish/piece，
 * 形状校验只看结构，未知 ID 由 normalizeHomeCustomization 在
 * 解析时回退到预设默认值。
 */
export type HomeFormId = string
export type HomeFinishId = string
export type HomeThemeId = string

export type CanvasSize = {
  readonly width: number
  readonly height: number
}

export type CanvasRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CanvasPoint = readonly [x: number, y: number]

export type Quad = readonly [
  topLeft: CanvasPoint,
  topRight: CanvasPoint,
  bottomRight: CanvasPoint,
  bottomLeft: CanvasPoint,
]

export type CatPlacement = CanvasRect & {
  flip?: boolean
}

export type PaintBounds = CanvasRect & {
  sourceWidth: number
  sourceHeight: number
}

export type DisplayRect = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  skewY?: number
  zIndex?: number
}

export type ProjectedDisplayRect = {
  quad: Quad
  contentSkewY: number
  zIndex?: number
}

export type HomePieceKind =
  | 'window-frame'
  | 'postcard-display'
  | 'scratcher'
  | 'feeding-set'
  | 'cabinet'
  | 'rug'
  | 'plant'

/** HomeForm 上一个可独立换件的物理位置。 */
export type HomeSocket = {
  id: string
  kind: HomePieceKind
  /** 与 HomePiece.compatibleProfiles 匹配才允许装入。 */
  compatibilityProfile: string
  /** 部件占用的画布参考区域，供 Theme Lab 参考线与校验使用。 */
  region: CanvasRect
}

export type HomePieceArt = {
  /**
   * 整幅画布尺寸的透明 PNG；迁移期烘焙在 shell 里的部件为 null
   * （只提供遮挡层或投影数据）。
   */
  base: string | null
  /** 渲染在动态内容之前的前景遮挡层（如柜前的书与篮筐）。 */
  foregroundOcclusion?: string
  activityVariants?: Readonly<Partial<Record<HomeActivity, string>>>
}

export type HomePiece = {
  id: string
  kind: HomePieceKind
  name: string
  compatibleProfiles: readonly string[]
  /** 资产是否已通过上线验收；生产环境只向玩家提供已放行部件。 */
  shippingEligible: boolean
  art: HomePieceArt
}

/**
 * 一套表面风格：连续表面（墙面/地板 wash）、窗外时间层与室内
 * lighting 随 finish 出资产；不创建独立可识别的家具。
 */
export type HomeFinishDefinition = {
  id: HomeFinishId
  name: string
  /** 无独立窗外时间层的 finish（窗景烘焙在 shell 里）为 null。 */
  exterior: Readonly<Record<HomeTime, string>> | null
  lighting: Readonly<Record<HomeTime, string | null>>
  shell: {
    default: string
    activityVariants: Readonly<Partial<Record<HomeActivity, string>>>
  }
}

/** 首版四个固定小猫用品活动位置。 */
export type CatItemSlot = 'scratch' | 'feed' | 'rest' | 'play'

/** 某 Cat Item 在一个 Home Theme 上的主题专属适配。 */
export type CatItemThemeAdapter = {
  base: string
  foregroundOcclusion?: string
  placement: CanvasRect
  supportSurface: readonly CanvasPoint[]
  interactionRegion: readonly CanvasPoint[]
  catAnchor: { x: number, y: number, flip?: boolean }
}

/**
 * 跨主题稳定的小猫用品定义。同一 id 在不同主题由 adapter 适配外观与落位。
 * 缺少任一已注册 base-plate 主题的 adapter 时不得出现在 listCatItems。
 */
export type CatItemDefinition = {
  id: string
  slot: CatItemSlot
  name: string
  adapters: Readonly<Partial<Record<HomeThemeId, CatItemThemeAdapter>>>
}

/**
 * base-plate 主题：固定家具烘焙在基底板上，玩家只选 Cat Item。
 * 与旧 HomeForm（form + finish + piece）并存；resolve 按 homeThemeId 分流。
 */
export type HomeThemeDefinition = {
  kind: 'base-plate'
  id: HomeThemeId
  name: string
  shippingEligible: boolean
  canvas: CanvasSize
  basePlate: string
  exterior: Readonly<Record<HomeTime, string>> | null
  lighting: Readonly<Record<HomeTime, string | null>>
  postcardDisplay: {
    slots: readonly ProjectedDisplayRect[]
    wallPlane: {
      cornerX: number
    }
  }
  souvenirDisplay: {
    anchors: readonly DisplayRect[]
    tableSkewY: number
  }
  treatPlacement: CanvasRect
  /** 无对应槽位用品时的默认猫落位。 */
  catPlacements: Readonly<Record<HomeActivity, CatPlacement>>
  catPaintBounds: Readonly<Partial<Record<HomeActivity, PaintBounds>>>
  catAnimationsByPortrait: Readonly<Record<
    string,
    Readonly<Record<HomeActivity, {
      src: string
      posterSrc: string
      frameCount: number
    }>>
  >>
  /** 本主题开放的 Cat Item 槽位（本轮 rest / play）。 */
  slots: readonly CatItemSlot[]
  /** 各槽缺省用品 id。 */
  defaultCatItems: Readonly<Partial<Record<CatItemSlot, string>>>
}

/** 玩家的家外观选择。只含 ID，不含派生坐标或图片路径。 */
export type HomeCustomization = {
  presetId?: HomeThemeId
  /** base-plate 主题 id；命中注册表时走新解析路径。 */
  homeThemeId?: HomeThemeId
  formId: HomeFormId
  finishId: HomeFinishId
  pieces: Readonly<Record<string, string>>
  /** 按槽位选择的小猫用品；仅 base-plate 路径消费。 */
  catItems?: Readonly<Partial<Record<CatItemSlot, string>>>
}

/** 解析场景所需的动态上下文；不属于换肤资产。 */
export type HomeSceneContext = {
  time: HomeTime
  activity: HomeActivity
  portraitId: string
}

export type SceneImageLayer = {
  id: string
  src: string
}

export type HomeThemePreset = {
  id: HomeThemeId
  formId: HomeFormId
  finishId: HomeFinishId
  pieces: Readonly<Record<string, string>>
}

/**
 * 一个 HomeForm 冻结的物理事实与随之出资产的图层清单。
 * 后续切片会把可替换 socket 从命名字段升级为类型化插槽列表。
 */
export type HomeFormDefinition = {
  id: HomeFormId
  name: string
  shippingEligible: boolean
  canvas: CanvasSize
  /** 至少一个；预设默认 finish 必须在列。 */
  finishes: readonly HomeFinishDefinition[]
  sockets: readonly HomeSocket[]
  catPlacements: Readonly<Record<HomeActivity, CatPlacement>>
  catPaintBounds: Readonly<Partial<Record<HomeActivity, PaintBounds>>>
  catAnimationsByPortrait: Readonly<Record<
    string,
    Readonly<Record<HomeActivity, {
      src: string
      posterSrc: string
      frameCount: number
    }>>
  >>
  treatPlacement: CanvasRect
  postcardDisplay: {
    slots: readonly ProjectedDisplayRect[]
    wallPlane: {
      cornerX: number
      horizonY?: number
      vanishingPointX?: number
      cabinetPerspectiveReference?: {
        rearSlope: number
        frontSlope: number
      }
    }
  }
  souvenirDisplay: {
    anchors: readonly DisplayRect[]
    tableSkewY: number
  }
}

/** 解析后可点击的小猫用品层（base + 热区）。 */
export type ResolvedCatItemLayer = {
  slot: CatItemSlot
  itemId: string
  itemName: string
  src: string
  style: string
  interactionStyle: string
}

/**
 * 渲染层唯一消费的场景描述。调用方不拼接层、不认识具体 form 的坐标。
 */
export type ResolvedHomeScene = {
  formId: HomeFormId
  finishId: HomeFinishId
  /** base-plate 路径下等于主题 id；旧 form 路径为 null。 */
  homeThemeId: HomeThemeId | null
  canvas: CanvasSize
  shippingEligible: boolean
  /** 猫与动态内容之下的静态图层，按 z 序排列；shell 层 id 固定为 'shell'。 */
  backdrop: readonly SceneImageLayer[]
  /** backdrop 之上、猫之下的部件层（猫爬架、柜体等），按 socket 声明序。 */
  rearPieces: readonly SceneImageLayer[]
  /** 每个 socket 当前解析到的部件，供 Theme Lab 换件 UI 使用。 */
  pieces: readonly {
    socketId: string
    kind: HomePieceKind
    pieceId: string
    pieceName: string
  }[]
  /**
   * Cat Item base 层（猫之下）。旧 form 路径返回空数组。
   * 图层次序：exterior → shell/base plate → catItems → cat → …
   */
  catItems: readonly ResolvedCatItemLayer[]
  /** Cat Item 前景遮挡（明信片/纪念品/Treat 之上、lighting 之下）。 */
  catItemOcclusion: readonly (SceneImageLayer & { style: string })[]
  lighting: SceneImageLayer | null
  cat: {
    placement: CatPlacement
    imageStyle: string
    sprite: {
      src: string
      posterSrc: string
      frameCount: number
      style: string
    } | null
  }
  treat: {
    placement: CanvasRect
    style: string
  }
  postcardDisplay: {
    fixtureSrc: string | null
    slots: readonly {
      quad: Quad
      contentSkewY: number
      style: string
    }[]
  }
  souvenirDisplay: {
    anchors: readonly {
      style: string
    }[]
    occlusionSrc: string | null
  }
}
