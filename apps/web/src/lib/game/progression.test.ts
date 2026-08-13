import { describe, expect, it } from 'vitest'
import { reduceEconomy, type EconomyState } from '../economy'
import type { TravelState } from '../travel'
import {
  advanceAllGameEvents,
  advanceGameEvents,
  adoptCat,
  createInitialGameState,
} from './index'

describe('Game progression', () => {
  it('回家时原子交付纪念品、结算行囊并恢复为可再次准备的 Home', () => {
    const initial = createInitialGameState(1_000)
    const economy: EconomyState = {
      ...initial.economy,
      packs: {
        minho: [
          { itemId: 'ticket', kind: 'wish', wishDestinationId: 'paris' },
          { itemId: 'small-blanket', kind: 'toy' },
        ],
      },
    }
    const travel: Extract<TravelState, { kind: 'planned' }> = {
      kind: 'planned',
      note: '我出去看看。',
      packedItems: economy.packs.minho,
      itemOutcomes: [
        {
          itemId: 'ticket',
          kind: 'wish',
          wishDestinationId: 'paris',
          disposition: 'consumed',
        },
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
            recipe: {
              recipeVersion: 1,
              travelerCatId: 'minho',
              scene: { id: 'paris-day', revision: 'paris-day-r1' },
              portrait: { id: 'minho', setRevision: 'portraits-r1' },
              composition: {
                id: 'paris-day--default',
                x: 0.2,
                y: 0.8,
                scale: 0.3,
                flip: false,
              },
              pose: 'gaze',
              layers: [
                { id: 'scene', kind: 'scene', src: '/scenes/paris-day.png' },
                {
                  id: 'portrait',
                  kind: 'portrait',
                  src: '/portraits/minho/gaze.png',
                },
              ],
              copy: { id: 'postcard-note-1', text: '今天的风很轻。' },
            },
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
    const preparedAgain = reduceEconomy(returned.economy, {
      type: 'itemAddedToPack',
      catId: 'minho',
      itemId: 'small-blanket',
      itemKind: 'toy',
      capacity: 3,
      packLocked: false,
    })

    expect(returned.travelByCat.minho).toEqual({ kind: 'home' })
    expect(returned.economy.packs.minho).toEqual([])
    expect(returned.economy.ownedItems['small-blanket']).toBe(1)
    expect(returned.economy.ownedItems.ticket ?? 0).toBe(0)
    expect(returned.postcards.received).toHaveLength(1)
    expect(returned.souvenirs.received).toHaveLength(1)
    expect(returned.clockNow).toBe(4_000)
    expect(retried).toBe(returned)
    expect(preparedAgain.packs.minho).toEqual([
      { itemId: 'small-blanket', kind: 'toy' },
    ])
  })

  it('同一次 Clock 推进会结算所有小猫，不要求逐只切换查看', () => {
    const firstAdopted = adoptCat(createInitialGameState(1_000), {
      id: 'first-cat',
      name: '第一只',
      portraitId: 'first-portrait',
      adoptedAt: 1_100,
    })
    const adopted = adoptCat(firstAdopted, {
      id: 'second-cat',
      name: '第二只',
      portraitId: 'second-portrait',
      adoptedAt: 1_200,
    })
    const firstTravel: Extract<TravelState, { kind: 'planned' }> = {
      kind: 'planned',
      note: '我出去看看。',
      packedItems: [{ itemId: 'first-toy', kind: 'toy' }],
      itemOutcomes: [{
        itemId: 'first-toy',
        kind: 'toy',
        disposition: 'return-home',
      }],
      plan: {
        itinerary: {
          destinationId: 'paris',
          departsAt: 1_500,
          returnsAt: 3_000,
          postcardSlots: [],
          routeKind: 'unwished',
          isDetour: false,
        },
        content: { postcards: [], souvenirIds: [] },
      },
    }
    const secondTravel: Extract<TravelState, { kind: 'planned' }> = {
      ...firstTravel,
      packedItems: [{ itemId: 'second-snack', kind: 'snack' }],
      itemOutcomes: [{
        itemId: 'second-snack',
        kind: 'snack',
        disposition: 'consumed',
      }],
      plan: {
        ...firstTravel.plan,
        itinerary: {
          ...firstTravel.plan.itinerary,
          returnsAt: 4_000,
        },
      },
    }
    const economy: EconomyState = {
      ...adopted.economy,
      packs: {
        'first-cat': firstTravel.packedItems,
        'second-cat': secondTravel.packedItems,
      },
    }
    const traveling = {
      ...adopted,
      economy,
      travelByCat: {
        'first-cat': firstTravel,
        'second-cat': secondTravel,
      },
    }

    const returned = advanceAllGameEvents(traveling, {
      now: 4_000,
      economy,
      travelByCat: traveling.travelByCat,
    })

    expect(returned.travelByCat).toMatchObject({
      'first-cat': { kind: 'home' },
      'second-cat': { kind: 'home' },
    })
    expect(returned.economy.packs['first-cat']).toEqual([])
    expect(returned.economy.packs['second-cat']).toEqual([])
    expect(returned.economy.ownedItems['first-toy']).toBe(1)
    expect(returned.economy.ownedItems['second-snack'] ?? 0).toBe(0)
    expect(returned.clockNow).toBe(4_000)
  })
})
