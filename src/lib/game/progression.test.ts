import { describe, expect, it } from 'vitest'
import type { EconomyState } from '../economy'
import type { TravelState } from '../travel'
import {
  advanceGameEvents,
  createInitialGameState,
} from './index'

describe('Game progression', () => {
  it('回家结算奖励与行囊后回到可再次准备旅行的 home 状态', () => {
    const initial = createInitialGameState(1_000)
    const economy: EconomyState = {
      ...initial.economy,
      packs: {
        minho: [
          { itemId: 'ticket', kind: 'wish' },
          { itemId: 'small-blanket', kind: 'toy' },
        ],
      },
    }
    const travel: Extract<TravelState, { kind: 'planned' }> = {
      kind: 'planned',
      note: '我出去看看。',
      packedItems: economy.packs.minho,
      itemOutcomes: [
        { itemId: 'ticket', kind: 'wish', disposition: 'consumed' },
        {
          itemId: 'small-blanket',
          kind: 'toy',
          disposition: 'return-home',
        },
      ],
      plan: {
        itinerary: {
          destinationId: 'paris',
          departsAt: 1_500,
          returnsAt: 4_000,
          postcardSlots: [{
            destinationId: 'paris',
            revealAt: 2_000,
          }],
          routeKind: 'wish',
          isDetour: false,
        },
        content: {
          postcards: [{
            sceneVariantId: 'paris-day',
            portraitId: 'minho',
            pose: 'gaze',
            note: '今天的风很轻。',
          }],
          souvenirIds: ['paris-postmark-pin'],
        },
      },
    }
    const traveling = {
      ...initial,
      economy,
      travelByCat: { minho: travel },
    }

    const returned = advanceGameEvents(traveling, {
      catId: 'minho',
      now: 4_000,
      economy,
      travel,
    })
    const retried = advanceGameEvents(returned, {
      catId: 'minho',
      now: 4_000,
      economy: returned.economy,
      travel: returned.travelByCat.minho!,
    })

    expect(returned.travelByCat.minho).toEqual({ kind: 'home' })
    expect(returned.economy.packs.minho).toEqual([])
    expect(returned.economy.ownedItems['small-blanket']).toBe(1)
    expect(returned.postcards.received).toHaveLength(1)
    expect(returned.souvenirs.received).toHaveLength(1)
    expect(returned.clockNow).toBe(4_000)
    expect(retried).toBe(returned)
  })
})
