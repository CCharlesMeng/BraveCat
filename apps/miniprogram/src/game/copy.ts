/**
 * 玩家可见文案与 UI chrome 素材路径（复用 web 端中文文案；
 * 来源 apps/web/src/App.svelte 与 apps/web/src/lib/homeArt.ts）。
 * controller 只回结构化结果，文案由表现层拼写。
 */
import type { PackItemRejectionReason } from '@bravecat/core/economy'
import type { HomeActivity, HomeTime } from '@bravecat/core/homeTheme'
import type { TravelPresence } from '@bravecat/core/travel'

export const homeActivities = {
  sleep: {
    pose: 'sleep',
    alt: '蜷在软垫上睡觉',
    copy: '今天也在窗边睡得很香。',
  },
  play: {
    pose: 'play',
    alt: '抱着毛线球玩',
    copy: '刚才有一团毛线自己滚了过来。',
  },
  eat: {
    pose: 'eat',
    alt: '低头认真吃东西',
    copy: '先把碗里这一点吃完，再看窗外。',
  },
  gaze: {
    pose: 'gaze',
    alt: '坐在窗台上看窗外',
    copy: '坐上窗台以后，远处的风景可以看很久。',
  },
} as const satisfies Record<
  HomeActivity,
  { pose: string, alt: string, copy: string }
>

export const itemKindLabels = {
  snack: '零食',
  toy: '小玩具',
  wish: '心愿',
} as const

export const homeTimeFor = (date: Date): HomeTime => {
  const hour = date.getHours()
  if (hour >= 5 && hour < 10) return 'morning'
  if (hour >= 10 && hour < 17) return 'noon'
  if (hour >= 17 && hour < 21) return 'dusk'
  return 'late-night'
}

export const presenceLabel = (presence: TravelPresence) => (
  presence === 'traveling'
    ? '在路上'
    : presence === 'waiting'
      ? '在准备'
      : presence === 'returned'
        ? '刚回来'
        : '在家'
)

export const roomCopy = (
  presence: TravelPresence,
  activity: HomeActivity,
) => (
  presence === 'waiting'
    ? '我还在听风。什么时候走，由我来决定。'
    : presence === 'traveling'
      ? '这会儿不在家。'
      : presence === 'returned'
        ? '我回来了，先在熟悉的垫子上歇一会儿。'
        : homeActivities[activity].copy
)

export const travelStatusCopy = (
  presence: TravelPresence,
  catName: string,
  souvenirCount: number,
) => (
  presence === 'waiting'
    ? `${catName}把行囊看了又看，像是在等一个合适的时候。`
    : presence === 'traveling'
      ? `${catName}已经出门了。房间里留着一张字条。`
      : presence === 'returned'
        ? souvenirCount > 0
          ? `${catName}回家了，还带回 ${souvenirCount} 件纪念品。`
          : `${catName}已经沿着熟悉的路回到家。`
        : ''
)

export const describePackRejection = (
  reason: PackItemRejectionReason | undefined,
  itemName: string,
  catName: string,
) => {
  switch (reason) {
    case 'pack-locked':
      return `${catName}正在旅行，${itemName}先留在家里。`
    case 'capacity-reached':
      return `行囊已经满了，${itemName}先留在家里。`
    case 'duplicate-item':
      return `行囊里已经有${itemName}了，新买的这件先留在家里。`
    case 'wish-already-packed':
      return `行囊里已经有一张心愿车票，${itemName}先留在家里。`
    case 'wish-destination-required':
      return `还没有选好心愿地，${itemName}先留在家里。`
    case 'item-not-owned':
      return `家里没有找到${itemName}，行囊没有变化。`
    default:
      return `${itemName}没有放进行囊，已经留在家里。`
  }
}

/** 行囊摊开图里物品的摆位（与 web 端 homeArt.packItemStyle 一致）。 */
export const packItemStyle = (index: number, itemId: string) => {
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

/** 抽屉/导航的 UI chrome 素材（根相对路径，渲染前经 asset() 解析）。 */
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
} as const
