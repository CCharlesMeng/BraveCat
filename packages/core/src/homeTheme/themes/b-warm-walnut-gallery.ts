/**
 * b-warm-walnut-gallery：暖胡桃旅行陈列小屋 furnished base plate。
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

const ART = '/home-release/b-warm-walnut-gallery'
const EXTERIOR = `${ART}/exterior-noon.webp`
const LIGHTING = `${ART}/lighting.webp`

const POSTCARD_QUADS = [
  [[831, 236], [908, 210], [908, 322], [831, 333]],
  [[969, 173], [1099, 131], [1099, 294], [969, 327]],
  [[831, 395], [908, 375], [908, 480], [831, 489]],
  [[969, 355], [1099, 329], [1099, 478], [969, 487]],
  [[831, 575], [908, 566], [908, 665], [831, 661]],
  [[969, 573], [1099, 568], [1099, 704], [969, 678]],
] as const satisfies readonly Quad[]

export const B_WARM_WALNUT_GALLERY_THEME = {
  kind: 'base-plate',
  id: 'b-warm-walnut-gallery',
  name: '暖胡桃旅行陈列',
  shippingEligible: true,
  canvas: { width: 1200, height: 1600 },
  basePlate: `${ART}/base-plate--aperture-alpha.webp`,
  exterior: exteriorAllTimes(EXTERIOR),
  lighting: lightingExceptNoon(LIGHTING),
  postcardDisplay: {
    slots: postcardSlotsFromQuads(POSTCARD_QUADS),
    wallPlane: { cornerX: 800 },
  },
  souvenirDisplay: {
    anchors: [
      { x: 780, y: 900, width: 56, height: 48, rotation: -6, skewY: 3, zIndex: 2 },
      { x: 840, y: 896, width: 54, height: 46, rotation: 8, skewY: 3, zIndex: 3 },
      { x: 900, y: 902, width: 52, height: 44, rotation: -3, skewY: 3, zIndex: 1 },
    ],
    tableSkewY: 3,
  },
  treatPlacement: { x: 410, y: 841, width: 155, height: 150 },
  catPlacements: {
    sleep: placementFromAnchor({ x: 205, y: 1215, flip: false }),
    play: placementFromAnchor({ x: 620, y: 1465, flip: false }),
    eat: placementFromAnchor({ x: 380, y: 1215, flip: false }),
    // Measured sill support: A/B y=880, F y=750; poster foot y=490/512.
    gaze: { x: 100, y: 555, width: 340, height: 340, flip: true },
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
