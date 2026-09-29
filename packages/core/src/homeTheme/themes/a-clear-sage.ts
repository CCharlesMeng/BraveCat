/**
 * a-clear-sage：鼠尾草清水小屋 furnished base plate。
 * 几何内联自 geometry--furnished-base-plate--measured-freeze-v02.json。
 */
import type { HomeThemeDefinition, Quad } from '../types'
import {
  exteriorAllTimes,
  lightingExceptNoon,
  MINHO_ANIMATIONS,
  placementFromAnchor,
  postcardSlotsFromQuads,
} from './shared'

const ART = '/home-release/a-clear-sage'
const EXTERIOR = `${ART}/exterior-noon.webp`
const LIGHTING = `${ART}/lighting.webp`

const POSTCARD_QUADS = [
  [[589, 337], [677, 337], [677, 413], [589, 413]],
  [[703, 337], [790, 337], [790, 413], [703, 413]],
  [[589, 458], [677, 458], [677, 535], [589, 535]],
  [[703, 458], [790, 458], [790, 535], [703, 535]],
  [[589, 583], [677, 583], [677, 660], [589, 660]],
  [[703, 583], [790, 583], [790, 660], [703, 660]],
] as const satisfies readonly Quad[]

export const A_CLEAR_SAGE_THEME = {
  kind: 'base-plate',
  id: 'a-clear-sage',
  name: '鼠尾草清水小屋',
  shippingEligible: true,
  canvas: { width: 1200, height: 1600 },
  basePlate: `${ART}/base-plate--aperture-alpha.webp`,
  exterior: exteriorAllTimes(EXTERIOR),
  lighting: lightingExceptNoon(LIGHTING),
  postcardDisplay: {
    slots: postcardSlotsFromQuads(POSTCARD_QUADS),
    wallPlane: { cornerX: 560 },
  },
  souvenirDisplay: {
    anchors: [
      { x: 960, y: 880, width: 56, height: 48, rotation: -8, skewY: 4, zIndex: 2 },
      { x: 1010, y: 882, width: 52, height: 46, rotation: 6, skewY: 4, zIndex: 3 },
      { x: 1055, y: 878, width: 50, height: 44, rotation: -2, skewY: 4, zIndex: 1 },
    ],
    tableSkewY: 4,
  },
  // 窗台近 aperture 底沿（windowAperture.bottom ≈ 853）。
  treatPlacement: { x: 250, y: 800, width: 110, height: 98 },
  catPlacements: {
    sleep: placementFromAnchor({ x: 250, y: 1205, flip: false }),
    play: placementFromAnchor({ x: 690, y: 1410, flip: false }),
    eat: placementFromAnchor({ x: 375, y: 1185, flip: false }),
    gaze: { x: 80, y: 420, width: 340, height: 340, flip: true },
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
  slots: ['rest', 'play'],
  defaultCatItems: {
    rest: 'rest-cloud-bed',
    play: 'play-soft-tunnel',
  },
} as const satisfies HomeThemeDefinition
