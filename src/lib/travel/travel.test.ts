import { describe, expect, it } from 'vitest'
import type { AssetCatalog } from '../assets'
import type { PackedItem } from '../economy'
import {
  planItinerary,
  type ItineraryDestination,
  type TripRhythm,
} from '../itinerary'
import { createPlanTrip } from '../planTrip'
import { selectTripContent } from '../selection'
import {
  createSeededRandom,
  createTravelLifecycle,
} from './index'

const catalog: AssetCatalog = {
  sceneSetRevision: 'scenes-r1',
  sceneRevisions: {
    'kyoto-day': 'kyoto-day-r1',
  },
  portraitSetRevisions: {
    minho: 'portraits-r1',
  },
  destinations: [
    {
      id: 'kyoto',
      name: '京都',
      sceneVariants: [
        {
          id: 'kyoto-day',
          destinationId: 'kyoto',
          imageSrc: '/scenes/kyoto-day.png',
          compositionSlot: {
            x: 0.2,
            y: 0.8,
            scale: 0.3,
            pose: 'gaze',
            flip: false,
          },
          hasCompanion: false,
        },
      ],
    },
  ],
  portraits: [
    {
      id: 'minho',
      name: 'Minho',
      poses: {
        sit: '/portraits/minho/sit.png',
        sleep: '/portraits/minho/sleep.png',
        walk: '/portraits/minho/walk.png',
        eat: '/portraits/minho/eat.png',
        play: '/portraits/minho/play.png',
        gaze: '/portraits/minho/gaze.png',
      },
    },
  ],
  items: [],
  souvenirs: [],
  copy: {
    postcardNotes: ['风很轻，我在这里坐了一会儿。'],
    travelNotes: ['窗边有风，我出去看看。'],
  },
}

const catalogWithAlternatePortrait: AssetCatalog = {
  ...catalog,
  portraitSetRevisions: {
    ...catalog.portraitSetRevisions,
    luna: 'portraits-luna-r1',
  },
  portraits: [
    ...catalog.portraits,
    {
      id: 'luna',
      name: 'Luna',
      poses: {
        sit: '/portraits/luna/sit.png',
        sleep: '/portraits/luna/sleep.png',
        walk: '/portraits/luna/walk.png',
        eat: '/portraits/luna/eat.png',
        play: '/portraits/luna/play.png',
        gaze: '/portraits/luna/gaze.png',
      },
    },
  ],
}

const destinations: readonly ItineraryDestination[] = [
  { id: 'kyoto', region: 'asia' },
]

const rhythm: TripRhythm = {
  departureDelayMs: [100, 200],
  travelDurationMs: [1_000, 2_000],
  postcardCount: [1, 1],
  secondPostcardChance: 0,
}

const pack: readonly PackedItem[] = [
  { itemId: 'fish-biscuit', kind: 'snack' },
]

const makeLifecycle = (
  randomValue = 0.5,
  lifecycleCatalog = catalog,
) => createTravelLifecycle({
  catalog: lifecycleCatalog,
  travelerCatId: 'minho',
  portraitId: 'minho',
  destinations,
  rhythm,
  planTrip: createPlanTrip({
    planItinerary,
    selectContent: selectTripContent,
  }),
  createSeed: (() => {
    let seed = 0
    return () => ++seed
  })(),
  randomFromSeed: () => () => randomValue,
})

describe('Travel lifecycle', () => {
  it('相同种子在重试规划时得到相同随机序列', () => {
    const first = createSeededRandom(42)
    const retried = createSeededRandom(42)

    expect([first(), first(), first()]).toEqual([
      retried(),
      retried(),
      retried(),
    ])
  })

  it('行囊首次非空后只安排自主出发，不立即生成旅行', () => {
    const lifecycle = makeLifecycle()

    const state = lifecycle.advance(
      { kind: 'home' },
      { now: 1_000, pack },
    )

    expect(state).toEqual({
      kind: 'waiting',
      schedule: {
        readyAt: 1_000,
        departsAt: 1_150,
      },
      tripSeed: 2,
    })
  })

  it('待出发时清空行囊会取消安排', () => {
    const lifecycle = makeLifecycle()
    const waiting = lifecycle.advance(
      { kind: 'home' },
      { now: 1_000, pack },
    )

    const state = lifecycle.advance(
      waiting,
      { now: 1_100, pack: [] },
    )

    expect(state).toEqual({ kind: 'home' })
  })

  it('待出发时修改非空行囊不会重抽出发时刻', () => {
    const lifecycle = makeLifecycle()
    const waiting = lifecycle.advance(
      { kind: 'home' },
      { now: 1_000, pack },
    )

    const state = lifecycle.advance(
      waiting,
      {
        now: 1_100,
        pack: [...pack, { itemId: 'yarn-ball', kind: 'toy' }],
      },
    )

    expect(state).toBe(waiting)
  })

  it('到达出发时刻后一次性生成完整旅行与持久字条', () => {
    const lifecycle = makeLifecycle()
    const waiting = lifecycle.advance(
      { kind: 'home' },
      { now: 1_000, pack },
    )

    expect(
      lifecycle.advance(waiting, { now: 1_149, pack }),
    ).toBe(waiting)

    const state = lifecycle.advance(
      waiting,
      { now: 1_150, pack },
    )

    expect(state).toMatchObject({
      kind: 'planned',
      note: '窗边有风，我出去看看。',
      packedItems: pack,
      itemOutcomes: [
        {
          itemId: 'fish-biscuit',
          kind: 'snack',
          disposition: 'consumed',
        },
      ],
      plan: {
        itinerary: {
          destinationId: 'kyoto',
          departsAt: 1_150,
          returnsAt: 2_650,
          routeKind: 'unwished',
        },
        content: {
          postcards: [
            {
              recipe: {
                recipeVersion: 1,
                travelerCatId: 'minho',
                scene: {
                  id: 'kyoto-day',
                  revision: 'kyoto-day-r1',
                },
                portrait: {
                  id: 'minho',
                  setRevision: 'portraits-r1',
                },
                composition: {
                  id: 'kyoto-day--default',
                  x: 0.2,
                  y: 0.8,
                  scale: 0.3,
                  flip: false,
                },
                pose: 'gaze',
                layers: [
                  {
                    id: 'scene',
                    kind: 'scene',
                    src: '/scenes/kyoto-day.png',
                  },
                  {
                    id: 'portrait',
                    kind: 'portrait',
                    src: '/portraits/minho/gaze.png',
                  },
                ],
                copy: {
                  id: 'postcard-note-1',
                  text: '风很轻，我在这里坐了一会儿。',
                },
              },
            },
          ],
        },
      },
    })
  })

  it('完整旅行生成后不会因再次打开或行囊变化而重抽', () => {
    const lifecycle = makeLifecycle()
    const waiting = lifecycle.advance(
      { kind: 'home' },
      { now: 1_000, pack },
    )
    const planned = lifecycle.advance(
      waiting,
      { now: 1_150, pack },
    )

    const reopened = lifecycle.advance(
      planned,
      { now: 2_000, pack: [] },
    )

    expect(reopened).toBe(planned)
  })

  it('待出发时更换形象，出发后只让新旅行使用新形象', () => {
    const lifecycle = makeLifecycle(0.5, catalogWithAlternatePortrait)
    const waiting = lifecycle.advance(
      { kind: 'home' },
      { now: 1_000, pack },
    )

    const planned = lifecycle.advance(waiting, {
      now: 1_150,
      pack,
      portraitId: 'luna',
    })

    expect(
      planned.kind === 'planned'
        ? planned.plan.content.postcards[0].recipe
        : undefined,
    ).toMatchObject({
      travelerCatId: 'minho',
      portrait: {
        id: 'luna',
        setRevision: 'portraits-luna-r1',
      },
      layers: [
        { kind: 'scene' },
        {
          kind: 'portrait',
          src: '/portraits/luna/gaze.png',
        },
      ],
    })
  })

  it('出发时锁定车票、零食和玩具的最终去向', () => {
    const lifecycle = makeLifecycle(0.99)
    const packedItems: readonly PackedItem[] = [
      {
        itemId: 'ticket',
        kind: 'wish',
        wishDestinationId: 'kyoto',
      },
      { itemId: 'fish-biscuit', kind: 'snack' },
      { itemId: 'yarn-ball', kind: 'toy' },
    ]
    const waiting = lifecycle.advance(
      { kind: 'home' },
      { now: 1_000, pack: packedItems },
    )
    const planned = lifecycle.advance(
      waiting,
      { now: 1_200, pack: packedItems, wishDestinationId: 'kyoto' },
    )

    expect(planned).toMatchObject({
      kind: 'planned',
      itemOutcomes: [
        {
          itemId: 'ticket',
          kind: 'wish',
          disposition: 'consumed',
        },
        {
          itemId: 'fish-biscuit',
          kind: 'snack',
          disposition: 'return-home',
        },
        {
          itemId: 'yarn-ball',
          kind: 'toy',
          disposition: 'return-home',
        },
      ],
    })
  })

  it('只在旅行时间窗内把小猫投影为不在家', () => {
    const lifecycle = makeLifecycle()
    const waiting = lifecycle.advance(
      { kind: 'home' },
      { now: 1_000, pack },
    )
    const planned = lifecycle.advance(
      waiting,
      { now: 1_150, pack },
    )

    expect(lifecycle.getPresence(waiting, 1_149)).toBe('waiting')
    expect(lifecycle.getPresence(planned, 1_000)).toBe('waiting')
    expect(lifecycle.getPresence(planned, 1_150)).toBe('traveling')
    expect(lifecycle.getPresence(planned, 2_649)).toBe('traveling')
    expect(lifecycle.getPresence(planned, 2_650)).toBe('returned')
  })
})
