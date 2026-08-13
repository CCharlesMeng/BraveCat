import { describe, expect, it } from 'vitest'
import {
  planItinerary,
  scheduleDeparture,
  type TripRhythm,
} from './index'

const HOUR = 60 * 60 * 1_000

const randomFrom = (...values: number[]) => {
  let index = 0
  return () => values[index++] ?? 0
}

describe('Itinerary', () => {
  it('默认出发与旅行时长分别落在 0.5–6 小时和 2–24 小时', () => {
    const readyAt = 10_000
    const earliestDeparture = scheduleDeparture(
      { readyAt },
      () => 0,
    )
    const latestDeparture = scheduleDeparture(
      { readyAt },
      () => 0.999_999,
    )
    const shortestTrip = planItinerary(
      {
        departsAt: earliestDeparture.departsAt,
        destinations: [{ id: 'paris', region: 'europe' }],
        packedItemIds: [],
      },
      randomFrom(0, 0, 0),
    )
    const longestTrip = planItinerary(
      {
        departsAt: latestDeparture.departsAt,
        destinations: [{ id: 'paris', region: 'europe' }],
        packedItemIds: [],
      },
      randomFrom(0, 0.999_999, 0),
    )

    expect(earliestDeparture.departsAt - readyAt).toBe(0.5 * HOUR)
    expect(latestDeparture.departsAt - readyAt).toBeLessThanOrEqual(6 * HOUR)
    expect(
      shortestTrip.returnsAt - shortestTrip.departsAt,
    ).toBe(2 * HOUR)
    expect(
      longestTrip.returnsAt - longestTrip.departsAt,
    ).toBeLessThanOrEqual(24 * HOUR)
  })

  it('行囊首次非空后在配置窗口内安排自主出发', () => {
    const rhythm: TripRhythm = {
      departureDelayMs: [1 * HOUR, 5 * HOUR],
      travelDurationMs: [2 * HOUR, 24 * HOUR],
      postcardCount: [1, 2],
      secondPostcardChance: 0.3,
    }

    const schedule = scheduleDeparture(
      { readyAt: 10_000, rhythm },
      () => 0.25,
    )

    expect(schedule).toEqual({
      readyAt: 10_000,
      departsAt: 10_000 + 2 * HOUR,
    })
  })

  it('车票以强引导但不保证的方式命中心愿地', () => {
    const itinerary = planItinerary(
      {
        departsAt: 10_000,
        destinations: [
          { id: 'kyoto', region: 'asia' },
          { id: 'singapore', region: 'asia' },
          { id: 'paris', region: 'europe' },
        ],
        packedItemIds: ['ticket'],
        wishDestinationId: 'kyoto',
      },
      () => 0.79,
    )

    expect(itinerary.destinationId).toBe('kyoto')
    expect(itinerary.routeKind).toBe('wish')
  })

  it('心愿未命中时优先在同区域绕路', () => {
    const itinerary = planItinerary(
      {
        departsAt: 10_000,
        destinations: [
          { id: 'kyoto', region: 'asia' },
          { id: 'singapore', region: 'asia' },
          { id: 'paris', region: 'europe' },
        ],
        packedItemIds: ['ticket'],
        wishDestinationId: 'kyoto',
      },
      randomFrom(0.8, 0, 0, 0),
    )

    expect(itinerary.destinationId).toBe('singapore')
    expect(itinerary.routeKind).toBe('regional-detour')
  })

  it('默认以三成概率安排第二张明信片', () => {
    const itinerary = planItinerary(
      {
        departsAt: 10_000,
        destinations: [{ id: 'paris', region: 'europe' }],
        packedItemIds: [],
      },
      randomFrom(0, 0, 0.29),
    )

    expect(itinerary.postcardSlots).toHaveLength(2)
  })

  it('旅行罐头让旅行倾向更长但不突破时长上限', () => {
    const withoutTin = planItinerary(
      {
        departsAt: 10_000,
        destinations: [{ id: 'paris', region: 'europe' }],
        packedItemIds: [],
      },
      randomFrom(0, 0.5, 0.5),
    )
    const withTin = planItinerary(
      {
        departsAt: 10_000,
        destinations: [{ id: 'paris', region: 'europe' }],
        packedItemIds: ['travel-tin'],
        packEffects: {
          travelDurationMultiplier: 1.25,
          secondPostcardChanceBonus: 0,
          companionChanceBonus: 0,
          poseWeights: {},
          copyTagWeights: {},
        },
      },
      randomFrom(0, 0.5, 0.5),
    )
    const cappedTrip = planItinerary(
      {
        departsAt: 10_000,
        destinations: [{ id: 'paris', region: 'europe' }],
        packedItemIds: ['travel-tin'],
        packEffects: {
          travelDurationMultiplier: 1.25,
          secondPostcardChanceBonus: 0,
          companionChanceBonus: 0,
          poseWeights: {},
          copyTagWeights: {},
        },
      },
      randomFrom(0, 0.99, 0.5),
    )

    expect(withTin.returnsAt - withTin.departsAt).toBeGreaterThan(
      withoutTin.returnsAt - withoutTin.departsAt,
    )
    expect(cappedTrip.returnsAt - cappedTrip.departsAt).toBe(24 * HOUR)
  })

  it('小相机把第二张明信片概率从三成提高到五成', () => {
    const withoutCamera = planItinerary(
      {
        departsAt: 10_000,
        destinations: [{ id: 'paris', region: 'europe' }],
        packedItemIds: [],
      },
      randomFrom(0, 0, 0.35),
    )
    const withCamera = planItinerary(
      {
        departsAt: 10_000,
        destinations: [{ id: 'paris', region: 'europe' }],
        packedItemIds: ['small-camera'],
        packEffects: {
          travelDurationMultiplier: 1,
          secondPostcardChanceBonus: 0.2,
          companionChanceBonus: 0,
          poseWeights: {},
          copyTagWeights: {},
        },
      },
      randomFrom(0, 0, 0.35),
    )

    expect(withoutCamera.postcardSlots).toHaveLength(1)
    expect(withCamera.postcardSlots).toHaveLength(2)
  })

  it('按 80/15/5 分配心愿命中、同区域绕路和全球意外', () => {
    const routeKinds = Array.from({ length: 100 }, (_, index) => planItinerary(
      {
        departsAt: 10_000,
        destinations: [
          { id: 'kyoto', region: 'asia' },
          { id: 'singapore', region: 'asia' },
          { id: 'paris', region: 'europe' },
        ],
        packedItemIds: ['ticket'],
        wishDestinationId: 'kyoto',
      },
      randomFrom(index / 100, 0, 0, 0),
    ).routeKind)

    expect(routeKinds.filter((kind) => kind === 'wish')).toHaveLength(80)
    expect(
      routeKinds.filter((kind) => kind === 'regional-detour'),
    ).toHaveLength(15)
    expect(
      routeKinds.filter((kind) => kind === 'global-unexpected'),
    ).toHaveLength(5)
  })
})
