/**
 * base-plate 主题共享：Minho 动画复用 classic-v4 贴片；明信片 skew 由
 * 冻结 quad 顶边推算；猫落位由 catAnchor 扩成画布矩形。
 */
import type {
  CatPlacement,
  HomeActivity,
  ProjectedDisplayRect,
  Quad,
} from '../types'

export const CLASSIC_ANIMATION_ROOT = '/dev-art/home-v4/cat-animations'

export const MINHO_ANIMATIONS = {
  sleep: {
    src: `${CLASSIC_ANIMATION_ROOT}/cat--minho--sleep--ambient--v03.webp`,
    posterSrc: `${CLASSIC_ANIMATION_ROOT}/cat--minho--sleep--ambient--poster--v03.webp`,
    frameCount: 128,
  },
  play: {
    src: `${CLASSIC_ANIMATION_ROOT}/cat--minho--play--ambient--v03.webp`,
    posterSrc: `${CLASSIC_ANIMATION_ROOT}/cat--minho--play--ambient--poster--v03.webp`,
    frameCount: 64,
  },
  eat: {
    src: `${CLASSIC_ANIMATION_ROOT}/cat--minho--eat--ambient--v03.webp`,
    posterSrc: `${CLASSIC_ANIMATION_ROOT}/cat--minho--eat--ambient--poster--v03.webp`,
    frameCount: 64,
  },
  gaze: {
    src: `${CLASSIC_ANIMATION_ROOT}/cat--minho--gaze--ambient--v03.webp`,
    posterSrc: `${CLASSIC_ANIMATION_ROOT}/cat--minho--gaze--ambient--poster--v03.webp`,
    frameCount: 64,
  },
} as const satisfies Record<HomeActivity, {
  src: string
  posterSrc: string
  frameCount: number
}>

/** 精灵贴片含大量透明边；落位框约 360 贴近 dressed QA 的视觉比例。 */
export const CAT_BOX = 360

export const placementFromAnchor = (
  anchor: { x: number, y: number, flip?: boolean },
  box = CAT_BOX,
): CatPlacement => ({
  x: Math.round(anchor.x - box / 2),
  y: Math.round(anchor.y - box * 0.78),
  width: box,
  height: box,
  flip: anchor.flip,
})

export const contentSkewYFromQuad = (quad: Quad): number => {
  const [[x0, y0], [x1, y1]] = quad
  if (x1 === x0) return 0
  return Math.round(
    (Math.atan2(y1 - y0, x1 - x0) * (180 / Math.PI)) * 10,
  ) / 10
}

export const postcardSlotsFromQuads = (
  quads: readonly Quad[],
): readonly ProjectedDisplayRect[] => quads.map((quad) => ({
  quad,
  contentSkewY: contentSkewYFromQuad(quad),
}))

/** 正午母版复用到全时段；时间变体待美术补齐。 */
export const exteriorAllTimes = (noonSrc: string) => ({
  morning: noonSrc,
  noon: noonSrc,
  dusk: noonSrc,
  'late-night': noonSrc,
} as const)

/** noon 无灯；其余时段叠程序化 lighting 层。 */
export const lightingExceptNoon = (lightingSrc: string) => ({
  morning: lightingSrc,
  noon: null,
  dusk: lightingSrc,
  'late-night': lightingSrc,
} as const)
