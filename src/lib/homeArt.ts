export type HomeActivity = 'sleep' | 'play' | 'eat'
export type HomeTime = 'morning' | 'noon' | 'dusk' | 'late-night'

export const homeTimeFor = (date: Date): HomeTime => {
  const hour = date.getHours()
  if (hour >= 5 && hour < 10) return 'morning'
  if (hour >= 10 && hour < 17) return 'noon'
  if (hour >= 17 && hour < 21) return 'dusk'
  return 'late-night'
}

export const homeArt = {
  exterior: {
    morning: '/assets/home/exterior-morning.png',
    noon: '/assets/home/exterior-noon.png',
    dusk: '/assets/home/exterior-dusk.png',
    'late-night': '/assets/home/exterior-late-night.png',
  },
  lighting: {
    morning: '/assets/home/lighting-morning.png',
    noon: null,
    dusk: '/assets/home/lighting-dusk.png',
    'late-night': '/assets/home/lighting-late-night.png',
  },
  catRects: {
    sleep: { x: 480, y: 1001, width: 420, height: 420 },
    play: { x: 485, y: 1014, width: 450, height: 450 },
    eat: { x: 335, y: 864, width: 450, height: 450 },
  },
  nav: {
    pack: '/assets/home/nav-pack.png',
    shop: '/assets/home/nav-shop.png',
    album: '/assets/home/nav-album.png',
  },
} as const

export const canvasStyle = (
  rect: { x: number; y: number; width: number; height: number },
) => [
  `left: ${(rect.x / 1200) * 100}%`,
  `top: ${(rect.y / 1600) * 100}%`,
  `width: ${(rect.width / 1200) * 100}%`,
  `height: ${(rect.height / 1600) * 100}%`,
].join('; ')

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
