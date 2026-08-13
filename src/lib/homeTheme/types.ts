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

/** 玩家的家外观选择。只含 ID，不含派生坐标或图片路径。 */
export type HomeCustomization = {
  presetId?: HomeThemeId
  formId: HomeFormId
  finishId: HomeFinishId
  pieces: Readonly<Record<string, string>>
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
  finishIds: readonly HomeFinishId[]
  socketIds: readonly string[]
  exterior: Readonly<Record<HomeTime, string>>
  lighting: Readonly<Record<HomeTime, string | null>>
  shell: {
    default: string
    activityVariants: Readonly<Partial<Record<HomeActivity, string>>>
  }
  catPlacements: Readonly<Record<HomeActivity, CatPlacement>>
  catPaintBounds: Readonly<Partial<Record<HomeActivity, PaintBounds>>>
  catAnimationsByPortrait: Readonly<Record<
    string,
    Readonly<Record<HomeActivity, { src: string; frameCount: number }>>
  >>
  treatPlacement: CanvasRect
  postcardDisplay: {
    fixtureSrc: string
    slots: readonly ProjectedDisplayRect[]
    wallPlane: {
      cornerX: number
      cabinetPerspectiveReference: {
        rearSlope: number
        frontSlope: number
      }
    }
  }
  souvenirDisplay: {
    anchors: readonly DisplayRect[]
    occlusionSrc: string
    tableSkewY: number
  }
}

/**
 * 渲染层唯一消费的场景描述。调用方不拼接层、不认识具体 form 的坐标。
 */
export type ResolvedHomeScene = {
  formId: HomeFormId
  canvas: CanvasSize
  shippingEligible: boolean
  exterior: SceneImageLayer
  shell: SceneImageLayer
  lighting: SceneImageLayer | null
  cat: {
    placement: CatPlacement
    imageStyle: string
    sprite: {
      src: string
      frameCount: number
      style: string
    } | null
  }
  treat: {
    placement: CanvasRect
    style: string
  }
  postcardDisplay: {
    fixtureSrc: string
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
    occlusionSrc: string
  }
}
