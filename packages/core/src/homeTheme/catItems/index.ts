/**
 * 跨主题小猫用品：猫窝、软隧道与常驻双碗。
 * adapter 分区源自 geometry v02；摆放与猫锚点按正式合成复审调整。
 */
import type { CatItemDefinition, CatItemThemeAdapter } from '../types'

const art = (themeId: string, item: string, kind: 'base' | 'occlusion') => (
  `/home-release/${themeId}/cat-item--${item}--${kind}.webp`
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
      placement: { x: 30, y: 1000, width: 385, height: 245 },
      supportSurface: [
        [78, 1070], [367, 1070], [367, 1217], [78, 1217],
      ],
      interactionRegion: [
        [38, 1012], [407, 1012], [407, 1237], [38, 1237],
      ],
      catAnchor: { x: 225, y: 1160, flip: false },
    }),
    'b-warm-walnut-gallery': adapter('b-warm-walnut-gallery', 'rest-cloud-bed', {
      placement: { x: 20, y: 1015, width: 340, height: 250 },
      supportSurface: [
        [64, 1083], [316, 1083], [316, 1237], [64, 1237],
      ],
      interactionRegion: [
        [28, 1027], [352, 1027], [352, 1257], [28, 1257],
      ],
      catAnchor: { x: 190, y: 1180, flip: false },
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
      placement: { x: 610, y: 1250, width: 378, height: 252 },
      supportSurface: [
        [646, 1300], [952, 1300], [952, 1475], [646, 1475],
      ],
      interactionRegion: [
        [617, 1261], [981, 1261], [981, 1495], [617, 1495],
      ],
      catAnchor: { x: 799, y: 1421, flip: false },
    }),
    'b-warm-walnut-gallery': adapter('b-warm-walnut-gallery', 'play-soft-tunnel', {
      placement: { x: 470, y: 1295, width: 360, height: 234 },
      supportSurface: [
        [506, 1340], [794, 1340], [794, 1504], [506, 1504],
      ],
      interactionRegion: [
        [477, 1306], [823, 1306], [823, 1522], [477, 1522],
      ],
      catAnchor: { x: 650, y: 1457, flip: false },
    }),
    'f-moonwhite-bluegray': adapter('f-moonwhite-bluegray', 'play-soft-tunnel', {
      placement: { x: 460, y: 1240, width: 408, height: 238 },
      supportSurface: [
        [497, 1287], [831, 1287], [831, 1452], [497, 1452],
      ],
      interactionRegion: [
        [467, 1250], [861, 1250], [861, 1471], [467, 1471],
      ],
      catAnchor: { x: 664, y: 1406, flip: false },
    }),
  },
} as const satisfies CatItemDefinition

/** 常驻饭碗与水碗；沿用已有 feed 槽，和猫窝/隧道分开落地。 */
export const DAILY_BOWLS = {
  id: 'feed-daily-bowls', slot: 'feed', name: '饭碗与水碗',
  adapters: {
    'a-clear-sage': {
      base: '/home-release/a-clear-sage/cat-item--feed-daily-bowls--base.webp',
      placement: { x: 600, y: 1070, width: 280, height: 105 },
      supportSurface: [[600, 1122], [880, 1122], [880, 1175], [600, 1175]],
      interactionRegion: [[600, 1070], [880, 1070], [880, 1175], [600, 1175]],
      catAnchor: { x: 581, y: 1122, flip: true },
    },
    'b-warm-walnut-gallery': {
      base: '/home-release/b-warm-walnut-gallery/cat-item--feed-daily-bowls--base.webp',
      placement: { x: 490, y: 1140, width: 200, height: 83 },
      supportSurface: [[490, 1181], [690, 1181], [690, 1223], [490, 1223]],
      interactionRegion: [[490, 1140], [690, 1140], [690, 1223], [490, 1223]],
      catAnchor: { x: 463, y: 1190, flip: true },
    },
    'f-moonwhite-bluegray': {
      base: '/home-release/f-moonwhite-bluegray/cat-item--feed-daily-bowls--base.webp',
      placement: { x: 990, y: 1200, width: 200, height: 83 },
      supportSurface: [[990, 1241], [1190, 1241], [1190, 1283], [990, 1283]],
      interactionRegion: [[990, 1200], [1190, 1200], [1190, 1283], [990, 1283]],
      catAnchor: { x: 945, y: 1248, flip: true },
    },
  },
} as const satisfies CatItemDefinition

export const CAT_ITEMS: Readonly<Record<string, CatItemDefinition>> = {
  [DAILY_BOWLS.id]: DAILY_BOWLS,
  [REST_CLOUD_BED.id]: REST_CLOUD_BED,
  [PLAY_SOFT_TUNNEL.id]: PLAY_SOFT_TUNNEL,
}

export const catItemFor = (itemId: string): CatItemDefinition | null => (
  CAT_ITEMS[itemId] ?? null
)
