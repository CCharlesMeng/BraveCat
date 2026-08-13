/**
 * 家的日常节奏与抽屉 UI chrome。
 *
 * 房间外观（图层、坐标、投影）由 src/lib/homeTheme 的 resolveHomeScene
 * 负责，本模块不再持有任何 form 相关的几何或资产路径。
 */
import type { HomeActivity, HomeTime } from './homeTheme'

export type { HomeActivity, HomeTime } from './homeTheme'

export const HOME_ACTIVITY_SEQUENCE = [
  'sleep',
  'play',
  'eat',
  'gaze',
] as const satisfies readonly HomeActivity[]

export const HOME_ACTIVITY_LABELS = {
  sleep: '睡觉',
  play: '玩耍',
  eat: '吃饭',
  gaze: '看窗外',
} as const satisfies Record<HomeActivity, string>

export const nextHomeActivity = (activity: HomeActivity): HomeActivity => {
  const index = HOME_ACTIVITY_SEQUENCE.indexOf(activity)
  return HOME_ACTIVITY_SEQUENCE[(index + 1) % HOME_ACTIVITY_SEQUENCE.length]
}

export const homeTimeFor = (date: Date): HomeTime => {
  const hour = date.getHours()
  if (hour >= 5 && hour < 10) return 'morning'
  if (hour >= 10 && hour < 17) return 'noon'
  if (hour >= 17 && hour < 21) return 'dusk'
  return 'late-night'
}

export const homeActivityOverrideFor = (
  isDevelopment: boolean,
  search: string,
): HomeActivity | null => {
  if (!isDevelopment) return null
  const activity = new URLSearchParams(search).get('homeActivity')
  return activity === 'sleep'
    || activity === 'play'
    || activity === 'eat'
    || activity === 'gaze'
    ? activity
    : null
}

export type SouvenirDisplayKind = 'pin' | 'charm' | 'keepsake'

export const souvenirDisplayKindFor = (souvenirId: string): SouvenirDisplayKind => (
  souvenirId.endsWith('--postmark-pin')
    ? 'pin'
    : souvenirId.endsWith('--travel-charm')
      ? 'charm'
      : 'keepsake'
)

export const drawerArt = {
  nav: {
    pack: '/assets/home/nav-pack.png',
    shop: '/assets/home/nav-shop.png',
    album: '/assets/home/nav-album.png',
  },
  treat: '/assets/treat/treat-24.png',
  treatLarge: '/assets/treat/treat-96.png',
  packBase: '/assets/pack/base-382.png',
  packRim: '/assets/pack/rim-382.png',
  albumEmpty: '/assets/album/empty.png',
  close: '/assets/glyphs/close.svg',
  export: '/assets/glyphs/export.svg',
  import: '/assets/glyphs/import.svg',
} as const

export const packItemStyle = (
  index: number,
  itemId: string,
) => {
  const slot = [
    { left: 22, top: 49, width: 23 },
    { left: 39, top: 48, width: 23 },
    { left: 61, top: 48, width: 22 },
  ][index] ?? { left: 39, top: 48, width: 23 }
  const rotation = {
    'fish-biscuit': -9,
    'travel-tin': -5,
    'small-blanket': 1,
    'yarn-ball': -7,
    'small-bell': 5,
    'small-camera': 4,
    'small-telescope': -12,
    ticket: -3,
  }[itemId] ?? 0
  return [
    `left: ${slot.left}%`,
    `top: ${slot.top}%`,
    `width: ${slot.width}%`,
    `transform: rotate(${rotation}deg)`,
  ].join('; ')
}
