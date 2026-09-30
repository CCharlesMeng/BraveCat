/**
 * f-moonwhite-bluegray：月白蓝灰错层小屋 furnished base plate。
 * 几何内联自 geometry--furnished-base-plate--measured-freeze-v02.json。
 * 注意：与旧 split-level-den form（shell 路径）是不同注册条目。
 */
import type { HomeThemeDefinition, Quad } from '../types'
import {
  exteriorAllTimes,
  lightingExceptNoon,
  MINHO_ANIMATIONS,
  placementFromAnchor,
  postcardSlotsFromQuads,
} from './shared'

const ART = '/home-release/f-moonwhite-bluegray'
const EXTERIOR = `${ART}/exterior-noon.webp`
const LIGHTING = `${ART}/lighting.webp`

const POSTCARD_QUADS = [
  [[700, 280], [790, 280], [790, 362], [700, 362]],
  [[870, 280], [960, 280], [960, 362], [870, 362]],
  [[700, 432], [790, 432], [790, 509], [700, 509]],
  [[870, 432], [960, 432], [960, 509], [870, 509]],
  [[700, 583], [790, 583], [790, 654], [700, 654]],
  [[870, 583], [960, 583], [960, 654], [870, 654]],
] as const satisfies readonly Quad[]

export const F_MOONWHITE_BLUEGRAY_THEME = {
  kind: 'base-plate',
  id: 'f-moonwhite-bluegray',
  name: '月白蓝灰错层',
  shippingEligible: true,
  canvas: { width: 1200, height: 1600 },
  basePlate: `${ART}/base-plate--aperture-alpha.webp`,
  exterior: exteriorAllTimes(EXTERIOR),
  lighting: lightingExceptNoon(LIGHTING),
  postcardDisplay: {
    slots: postcardSlotsFromQuads(POSTCARD_QUADS),
    wallPlane: { cornerX: 680 },
  },
  souvenirDisplay: {
    anchors: [
      { x: 760, y: 790, width: 54, height: 46, rotation: -5, skewY: 2, zIndex: 2 },
      { x: 820, y: 788, width: 52, height: 44, rotation: 7, skewY: 2, zIndex: 3 },
      { x: 875, y: 792, width: 50, height: 42, rotation: -2, skewY: 2, zIndex: 1 },
    ],
    tableSkewY: 2,
  },
  treatPlacement: { x: 355, y: 711, width: 155, height: 150 },
  catPlacements: {
    sleep: placementFromAnchor({ x: 248, y: 980, flip: false }),
    play: placementFromAnchor({ x: 580, y: 1395, flip: false }),
    eat: placementFromAnchor({ x: 945, y: 1248, flip: true }, 360),
    // Measured sill support: A/B y=880, F y=750; poster foot y=490/512.
    gaze: { x: 90, y: 444, width: 320, height: 320, flip: true },
  },
  catPaintBounds: {
    gaze: {
      x: 249,
      y: 64,
      width: 526,
      height: 896,
      sourceWidth: 1024,
      sourceHeight: 1024,
    },
  },
  catAnimationsByPortrait: { minho: MINHO_ANIMATIONS },
  slots: ['rest', 'play', 'feed'],
  defaultCatItems: {
    feed: 'feed-daily-bowls',
    rest: 'rest-cloud-bed',
    play: 'play-soft-tunnel',
  },
} as const satisfies HomeThemeDefinition
