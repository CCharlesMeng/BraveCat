/**
 * PROTOTYPE — 用后即弃。
 *
 * 首屏右墙明信片陈列：近端窗龛转角 + 向画外右侧退深的记忆墙。
 * `?wallProto=p` 看布局，`?wallProto=g` 看同一布局的透视原理。
 *
 * 关键拓扑：记忆墙从窗龛近端转角 x≈660 向右退深，在 x≈1030 形成画内
 * 远端内角；随后右侧返回墙朝镜头展开，把房间封闭。记忆墙的实测灭点是
 * (2305,947)，同尺寸物件随 x 增大自然缩小。
 */

type CanvasPoint = readonly [x: number, y: number]
type Quad = readonly [
  topLeft: CanvasPoint,
  topRight: CanvasPoint,
  bottomRight: CanvasPoint,
  bottomLeft: CanvasPoint,
]

export type WallPrototypeSlot = {
  quad: Quad
  contentSkewY: number
  zIndex?: number
}

export type WallPrototypeDecor =
  | {
    kind: 'line'
    x1: number
    y1: number
    x2: number
    y2: number
    width: number
    color: string
    dash?: string
  }
  | {
    kind: 'rect'
    x: number
    y: number
    width: number
    height: number
    fill: string
    stroke?: string
    strokeWidth?: number
    radius?: number
  }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string }
  | {
    kind: 'polygon'
    points: readonly CanvasPoint[]
    fill: string
    stroke?: string
    strokeWidth?: number
    dash?: string
  }
  | { kind: 'text'; x: number; y: number; text: string; color?: string }

export type WallPrototypeVariant = {
  key: WallPrototypeVariantKey
  name: string
  summary: string
  layoutNote: string
  frameStyle: 'wood' | 'card'
  slots: readonly WallPrototypeSlot[]
  decor: readonly WallPrototypeDecor[]
}

export const WALL_PROTOTYPE_VARIANT_KEYS = ['p', 'g'] as const
export type WallPrototypeVariantKey =
  (typeof WALL_PROTOTYPE_VARIANT_KEYS)[number]

export const wallPrototypeVariantKeyFor = (
  isDevelopment: boolean,
  search: string,
): WallPrototypeVariantKey | null => {
  if (!isDevelopment) return null
  const raw = new URLSearchParams(search).get('wallProto')
  if (raw === null) return null
  const key = raw.toLowerCase()
  return (WALL_PROTOTYPE_VARIANT_KEYS as readonly string[]).includes(key)
    ? (key as WallPrototypeVariantKey)
    : 'p'
}

const round1 = (value: number) => Math.round(value * 10) / 10
const degreesOf = (slope: number) =>
  round1((Math.atan(slope) * 180) / Math.PI)

export const WALL_PERSPECTIVE = {
  horizonY: 947,
  nearJambX: 660,
  farCornerX: 1030,
  vanishingPoint: [2305, 947] as CanvasPoint,
  returnVanishingPoint: [230, 947] as CanvasPoint,
} as const

const {
  horizonY,
  nearJambX,
  farCornerX,
  vanishingPoint,
  returnVanishingPoint,
} = WALL_PERSPECTIVE
const [vanishingPointX] = vanishingPoint
const [returnVanishingPointX] = returnVanishingPoint

/**
 * 竖直墙面的单点透视比例。
 *
 * x=nearJambX 时比例为 1；向右接近画外灭点时比例单调减小。墙上同一真实
 * 高度 yAtNear 在任意 x 的投影，都落在连接 (nearJambX,yAtNear) 与灭点
 * 的直线上。
 */
const wallScaleAt = (x: number) =>
  (vanishingPointX - x) / (vanishingPointX - nearJambX)

export const wallLineY = (yAtNear: number, x: number) =>
  round1(horizonY + (yAtNear - horizonY) * wallScaleAt(x))

const returnWallLineY = (yAtCorner: number, x: number) =>
  round1(
    horizonY
    + (yAtCorner - horizonY)
      * (x - returnVanishingPointX)
      / (farCornerX - returnVanishingPointX),
  )

const wallCard = ({
  xLeft,
  xRight,
  topAtNear,
  bottomAtNear,
}: {
  xLeft: number
  xRight: number
  topAtNear: number
  bottomAtNear: number
}): WallPrototypeSlot => {
  const topLeftY = wallLineY(topAtNear, xLeft)
  const topRightY = wallLineY(topAtNear, xRight)
  const quad: Quad = [
    [xLeft, topLeftY],
    [xRight, topRightY],
    [xRight, wallLineY(bottomAtNear, xRight)],
    [xLeft, wallLineY(bottomAtNear, xLeft)],
  ]

  return {
    quad,
    contentSkewY: degreesOf((topRightY - topLeftY) / (xRight - xLeft)),
  }
}

const columns = [
  { xLeft: 720, xRight: 850 },
  { xLeft: 875, xRight: 990 },
] as const
const rows = [
  { topAtNear: 80, bottomAtNear: 185, railAtNear: 199 },
  { topAtNear: 220, bottomAtNear: 325, railAtNear: 339 },
  { topAtNear: 360, bottomAtNear: 465, railAtNear: 479 },
] as const

const perspectiveSlots = rows.flatMap((row) =>
  columns.map((column) => wallCard({ ...row, ...column })),
)

const WOOD = '#8a6f4f'
const GUIDE_BLUE = 'rgba(43, 92, 138, 0.82)'
const GUIDE_GREEN = 'rgba(52, 122, 72, 0.9)'
const GUIDE_ORANGE = 'rgba(205, 111, 35, 0.92)'
const GUIDE_PURPLE = 'rgba(118, 80, 145, 0.82)'

const railQuad = (yAtNear: number): Quad => {
  const xLeft = 700
  const xRight = 1020
  return [
    [xLeft, wallLineY(yAtNear, xLeft)],
    [xRight, wallLineY(yAtNear, xRight)],
    [xRight, wallLineY(yAtNear + 12, xRight)],
    [xLeft, wallLineY(yAtNear + 12, xLeft)],
  ]
}

const railDecor: WallPrototypeDecor[] = rows.map(
  ({ railAtNear }): WallPrototypeDecor => ({
    kind: 'polygon',
    points: railQuad(railAtNear),
    fill: WOOD,
    stroke: 'rgba(91, 67, 43, 0.45)',
    strokeWidth: 2,
  }),
)

const perspectiveRay = (
  yAtNear: number,
  color: string,
  dash = '10 8',
): WallPrototypeDecor => ({
  kind: 'line',
  x1: nearJambX,
  y1: yAtNear,
  x2: farCornerX,
  y2: wallLineY(yAtNear, farCornerX),
  width: 2.5,
  color,
  dash,
})

const returnPerspectiveRay = (yAtNear: number): WallPrototypeDecor => {
  const yAtCorner = wallLineY(yAtNear, farCornerX)
  return {
    kind: 'line',
    x1: farCornerX,
    y1: yAtCorner,
    x2: 1195,
    y2: returnWallLineY(yAtCorner, 1195),
    width: 2.5,
    color: GUIDE_PURPLE,
    dash: '8 7',
  }
}

const guideDecor: WallPrototypeDecor[] = [
  ...railDecor,
  perspectiveRay(80, GUIDE_ORANGE),
  perspectiveRay(220, GUIDE_ORANGE),
  perspectiveRay(360, GUIDE_ORANGE),
  perspectiveRay(479, GUIDE_ORANGE),
  perspectiveRay(1286, GUIDE_GREEN),
  returnPerspectiveRay(80),
  returnPerspectiveRay(220),
  returnPerspectiveRay(360),
  returnPerspectiveRay(947),
  returnPerspectiveRay(1286),
  {
    kind: 'line',
    x1: nearJambX,
    y1: horizonY,
    x2: 1195,
    y2: horizonY,
    width: 2.5,
    color: GUIDE_BLUE,
    dash: '18 10',
  },
  {
    kind: 'text',
    x: 690,
    y: 190,
    text: '记忆墙向右退深 →',
    color: GUIDE_ORANGE,
  },
  {
    kind: 'text',
    x: 825,
    y: 925,
    text: `水平线 y=${horizonY}`,
    color: GUIDE_BLUE,
  },
  {
    kind: 'text',
    x: 700,
    y: 1160,
    text: '地脚线向远端墙角上升 →',
    color: GUIDE_GREEN,
  },
  {
    kind: 'text',
    x: 760,
    y: 982,
    text: `右灭点在画外 (${vanishingPointX},${horizonY}) →`,
    color: GUIDE_BLUE,
  },
]

export const wallPrototypeVariants: Record<
  WallPrototypeVariantKey,
  WallPrototypeVariant
> = {
  p: {
    key: 'p',
    name: '封闭记忆角',
    summary: '记忆墙向右退深后在画内收口，右侧返回墙把小房间封闭',
    layoutNote: '三轨六卡共享记忆墙灭点；柜子位于返回墙，两个墙面不混用方向',
    frameStyle: 'card',
    slots: perspectiveSlots,
    decor: railDecor,
  },
  g: {
    key: 'g',
    name: '透视原理',
    summary: '同一布局叠加记忆墙、远端内角和右侧返回墙的两组灭点方向',
    layoutNote: 'x≈1030 是最深处；墙地交线在此形成 V，房间不再向右敞开',
    frameStyle: 'card',
    slots: perspectiveSlots,
    decor: guideDecor,
  },
}
