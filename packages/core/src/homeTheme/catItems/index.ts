/**
 * 首批跨主题小猫用品：rest-cloud-bed 与 play-soft-tunnel。
 * adapter 坐标内联自各主题 geometry v02 的 catItemSlots。
 */
import type { CatItemDefinition, CatItemThemeAdapter } from '../types'

const art = (themeId: string, item: string, kind: 'base' | 'occlusion') => (
  `/dev-art/home-theme/${themeId}/cat-item--${item}--${kind}.png`
)

const adapter = (
  themeId: string,
  item: 'rest-cloud-bed' | 'play-soft-tunnel',
  data: Omit<CatItemThemeAdapter, 'base' | 'foregroundOcclusion'>,
): CatItemThemeAdapter => ({
  base: art(themeId, item, 'base'),
  foregroundOcclusion: art(themeId, item, 'occlusion'),
  ...data,
})

/** 云朵猫窝 — rest 槽。 */
export const REST_CLOUD_BED = {
  id: 'rest-cloud-bed',
  slot: 'rest',
  name: '云朵猫窝',
  adapters: {
    'a-clear-sage': adapter('a-clear-sage', 'rest-cloud-bed', {
      placement: { x: 55, y: 1045, width: 385, height: 245 },
      supportSurface: [
        [103, 1115], [392, 1115], [392, 1262], [103, 1262],
      ],
      interactionRegion: [
        [63, 1057], [432, 1057], [432, 1282], [63, 1282],
      ],
      catAnchor: { x: 250, y: 1205, flip: false },
    }),
    'b-warm-walnut-gallery': adapter('b-warm-walnut-gallery', 'rest-cloud-bed', {
      placement: { x: 35, y: 1050, width: 340, height: 250 },
      supportSurface: [
        [79, 1118], [331, 1118], [331, 1272], [79, 1272],
      ],
      interactionRegion: [
        [43, 1062], [367, 1062], [367, 1292], [43, 1292],
      ],
      catAnchor: { x: 205, y: 1215, flip: false },
    }),
    'f-moonwhite-bluegray': adapter('f-moonwhite-bluegray', 'rest-cloud-bed', {
      placement: { x: 45, y: 820, width: 395, height: 245 },
      supportSurface: [
        [93, 890], [392, 890], [392, 1037], [93, 1037],
      ],
      interactionRegion: [
        [53, 832], [432, 832], [432, 1057], [53, 1057],
      ],
      catAnchor: { x: 248, y: 980, flip: false },
    }),
  },
} as const satisfies CatItemDefinition

/** 软隧道 — play 槽。 */
export const PLAY_SOFT_TUNNEL = {
  id: 'play-soft-tunnel',
  slot: 'play',
  name: '软隧道',
  adapters: {
    'a-clear-sage': adapter('a-clear-sage', 'play-soft-tunnel', {
      placement: { x: 480, y: 1220, width: 420, height: 280 },
      supportSurface: [
        [520, 1275], [860, 1275], [860, 1470], [520, 1470],
      ],
      interactionRegion: [
        [488, 1232], [892, 1232], [892, 1492], [488, 1492],
      ],
      catAnchor: { x: 690, y: 1410, flip: false },
    }),
    'b-warm-walnut-gallery': adapter('b-warm-walnut-gallery', 'play-soft-tunnel', {
      placement: { x: 420, y: 1285, width: 400, height: 260 },
      supportSurface: [
        [460, 1335], [780, 1335], [780, 1517], [460, 1517],
      ],
      interactionRegion: [
        [428, 1297], [812, 1297], [812, 1537], [428, 1537],
      ],
      catAnchor: { x: 620, y: 1465, flip: false },
    }),
    'f-moonwhite-bluegray': adapter('f-moonwhite-bluegray', 'play-soft-tunnel', {
      placement: { x: 340, y: 1200, width: 480, height: 280 },
      supportSurface: [
        [384, 1255], [776, 1255], [776, 1450], [384, 1450],
      ],
      interactionRegion: [
        [348, 1212], [812, 1212], [812, 1472], [348, 1472],
      ],
      catAnchor: { x: 580, y: 1395, flip: false },
    }),
  },
} as const satisfies CatItemDefinition

export const CAT_ITEMS: Readonly<Record<string, CatItemDefinition>> = {
  [REST_CLOUD_BED.id]: REST_CLOUD_BED,
  [PLAY_SOFT_TUNNEL.id]: PLAY_SOFT_TUNNEL,
}

export const catItemFor = (itemId: string): CatItemDefinition | null => (
  CAT_ITEMS[itemId] ?? null
)
