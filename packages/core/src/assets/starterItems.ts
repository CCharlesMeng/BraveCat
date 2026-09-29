import type { ItemDefinition } from './index'

export const STARTER_ITEMS = [
  {
    id: 'fish-biscuit',
    name: '小鱼饼',
    kind: 'snack',
    price: 4,
    imageSrc: '/assets/items/item--snack--fish-biscuit--v02.png',
    effectHint: '普通旅行也许会想起好吃的，也更容易偶遇《雾港看归船》，不保证遇到。',
    effects: [
      { kind: 'pose-weight', pose: 'eat', multiplier: 1.5 },
      { kind: 'copy-tag-weight', tag: 'food', multiplier: 1.5 },
    ],
  },
  {
    id: 'travel-tin',
    name: '旅行罐头',
    kind: 'snack',
    price: 4,
    imageSrc: '/assets/items/item--snack--travel-tin--v02.png',
    effectHint: '带得足一点，路也许会走得远些。',
    effects: [
      { kind: 'travel-duration', multiplier: 1.25 },
    ],
  },
  {
    id: 'small-blanket',
    name: '小毛毯',
    kind: 'toy',
    price: 6,
    imageSrc: '/assets/items/item--toy--small-blanket--v02.png',
    effectHint: '困了就找个安静的地方蜷起来。',
    effects: [
      { kind: 'pose-weight', pose: 'sleep', multiplier: 1.5 },
    ],
  },
  {
    id: 'yarn-ball',
    name: '毛线球',
    kind: 'toy',
    price: 6,
    imageSrc: '/assets/items/item--toy--yarn-ball--v02.png',
    effectHint: '路上也可以玩一会儿。',
    effects: [
      { kind: 'pose-weight', pose: 'play', multiplier: 1.5 },
    ],
  },
  {
    id: 'small-bell',
    name: '小铃铛',
    kind: 'toy',
    price: 6,
    imageSrc: '/assets/items/item--toy--small-bell--v02.png',
    effectHint: '轻轻一响，也许会遇见新旅伴。',
    effects: [
      { kind: 'companion-chance', bonus: 0.1 },
    ],
  },
  {
    id: 'small-camera',
    name: '小相机',
    kind: 'toy',
    price: 6,
    imageSrc: '/assets/items/item--toy--small-camera--v02.png',
    effectHint: '说不定会多寄一张风景回来。',
    effects: [
      { kind: 'second-postcard-chance', bonus: 0.2 },
    ],
  },
  {
    id: 'small-telescope',
    name: '小望远镜',
    kind: 'toy',
    price: 6,
    imageSrc: '/assets/items/item--toy--small-telescope--v02.png',
    effectHint: '普通旅行适合眺望，也更容易偶遇《值夜观星》，不保证遇到。',
    effects: [
      { kind: 'pose-weight', pose: 'gaze', multiplier: 1.5 },
    ],
  },
  {
    id: 'ticket',
    name: '车票',
    kind: 'wish',
    price: 8,
    imageSrc: '/assets/items/item--wish--ticket--v02.png',
    effectHint: '写着一个心愿地，但小猫不一定照着走。',
  },
] as const satisfies readonly ItemDefinition[]
