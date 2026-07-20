import { describe, expect, it } from 'vitest'
import { selectTripContent } from './index'
import type { AssetCatalog } from '../assets'
import type { Itinerary } from '../itinerary'
import { createSeededRandom } from '../travel'

const randomFrom = (...values: number[]) => {
  let index = 0
  return () => values[index++] ?? 0
}

const catalog: AssetCatalog = {
  destinations: [
    {
      id: 'paris',
      name: '巴黎',
      sceneVariants: [
        {
          id: 'paris-day',
          destinationId: 'paris',
          imageSrc: '/scenes/paris-day.png',
          compositionSlot: {
            x: 0.2,
            y: 0.8,
            scale: 0.3,
            pose: 'gaze',
            flip: false,
          },
          hasCompanion: false,
        },
        {
          id: 'paris-dusk',
          destinationId: 'paris',
          imageSrc: '/scenes/paris-dusk.png',
          compositionSlot: {
            x: 0.8,
            y: 0.8,
            scale: 0.3,
            pose: 'sit',
            flip: true,
          },
          hasCompanion: false,
        },
        {
          id: 'paris-companion',
          destinationId: 'paris',
          imageSrc: '/scenes/paris-companion.png',
          compositionSlot: {
            x: 0.2,
            y: 0.8,
            scale: 0.3,
            pose: 'gaze',
            flip: false,
          },
          hasCompanion: true,
        },
      ],
    },
  ],
  portraits: [
    {
      id: 'my-cat',
      name: '小猫',
      poses: {
        sit: '/portraits/sit.png',
        sleep: '/portraits/sleep.png',
        walk: '/portraits/walk.png',
        eat: '/portraits/eat.png',
        play: '/portraits/play.png',
        gaze: '/portraits/gaze.png',
      },
    },
  ],
  items: [],
  souvenirs: [
    {
      id: 'paris-tower-pin',
      destinationId: 'paris',
      name: '铁塔纪念章',
      visualToken: '塔',
    },
    {
      id: 'paris-wind-charm',
      destinationId: 'paris',
      name: '塞纳河风铃',
      visualToken: '风',
    },
    {
      id: 'kyoto-torii-charm',
      destinationId: 'kyoto',
      name: '鸟居御守',
      visualToken: '守',
    },
  ],
  copy: {
    postcardNotes: ['风很轻。'],
    travelNotes: ['我出去看看。'],
  },
}

describe('Selection', () => {
  it('只从旅行目的地的素材中选取场景、姿势和文案', () => {
    const itinerary: Itinerary = {
      destinationId: 'paris',
      departsAt: 1_000,
      returnsAt: 3_000,
      postcardSlots: [{ destinationId: 'paris', revealAt: 2_000 }],
      routeKind: 'unwished',
      isDetour: false,
    }

    const content = selectTripContent(
      { itinerary, portraitId: 'my-cat', catalog },
      randomFrom(0.5, 0, 0),
    )

    expect(content.postcards).toEqual([
      {
        sceneVariantId: 'paris-day',
        portraitId: 'my-cat',
        pose: 'gaze',
        note: '风很轻。',
      },
    ])
  })

  it('普通场景常见、旅伴场景稀有，且相同种子稳定复现', () => {
    const itinerary: Itinerary = {
      destinationId: 'paris',
      departsAt: 1_000,
      returnsAt: 3_000,
      postcardSlots: [{ destinationId: 'paris', revealAt: 2_000 }],
      routeKind: 'unwished',
      isDetour: false,
    }

    const selections = Array.from({ length: 1_000 }, (_, seed) => {
      const request = { itinerary, portraitId: 'my-cat', catalog }
      const selected = selectTripContent(request, createSeededRandom(seed))
      const retried = selectTripContent(request, createSeededRandom(seed))

      expect(retried).toEqual(selected)
      return selected.postcards[0].sceneVariantId
    })
    const companionCount = selections.filter(
      (sceneVariantId) => sceneVariantId === 'paris-companion',
    ).length

    expect(companionCount).toBeGreaterThan(0)
    expect(companionCount).toBeLessThan(250)
  })

  it('在出发时用种子锁定零至两件旅行目的地的纪念品', () => {
    const itinerary: Itinerary = {
      destinationId: 'paris',
      departsAt: 1_000,
      returnsAt: 3_000,
      postcardSlots: [{ destinationId: 'paris', revealAt: 2_000 }],
      routeKind: 'unwished',
      isDetour: false,
    }
    const request = { itinerary, portraitId: 'my-cat', catalog }
    const matchingSouvenirIds = new Set([
      'paris-tower-pin',
      'paris-wind-charm',
    ])
    const counts = new Set<number>()

    for (let seed = 0; seed < 200; seed += 1) {
      const selected = selectTripContent(request, createSeededRandom(seed))
      const retried = selectTripContent(request, createSeededRandom(seed))

      expect(retried).toEqual(selected)
      expect(selected.souvenirIds.length).toBeLessThanOrEqual(2)
      expect(new Set(selected.souvenirIds).size).toBe(
        selected.souvenirIds.length,
      )
      expect(
        selected.souvenirIds.every((id) => matchingSouvenirIds.has(id)),
      ).toBe(true)
      counts.add(selected.souvenirIds.length)
    }

    expect([...counts].sort()).toEqual([0, 1, 2])
  })

  it('按锁定的 45/45/10 概率边界选择纪念品数量', () => {
    const itinerary: Itinerary = {
      destinationId: 'paris',
      departsAt: 1_000,
      returnsAt: 3_000,
      postcardSlots: [],
      routeKind: 'unwished',
      isDetour: false,
    }
    const countAt = (countRoll: number) => {
      let callCount = 0
      return selectTripContent(
        { itinerary, portraitId: 'my-cat', catalog },
        () => callCount++ === 0 ? countRoll : 0,
      ).souvenirIds.length
    }

    expect(countAt(0.449)).toBe(0)
    expect(countAt(0.45)).toBe(1)
    expect(countAt(0.899)).toBe(1)
    expect(countAt(0.9)).toBe(2)
  })
})
