import { describe, expect, it } from 'vitest'
import type { Itinerary } from '../itinerary'
import type { TripContent } from '../selection'
import {
  createInitialSouvenirState,
  reduceSouvenirs,
} from './index'

const itinerary: Itinerary = {
  destinationId: 'paris',
  departsAt: 1_000,
  returnsAt: 4_000,
  routeKind: 'unwished',
  isDetour: false,
  postcardSlots: [],
}

const content: TripContent = {
  postcards: [],
  souvenirIds: ['paris-tower-pin', 'paris-wind-charm'],
}

describe('Souvenir return', () => {
  it('只在回家时揭晓纪念品，并在重复结算时保持幂等', () => {
    const initial = createInitialSouvenirState()
    const beforeReturn = reduceSouvenirs(initial, {
      type: 'timePassed',
      now: 3_999,
      tripId: 'minho-1000',
      itinerary,
      content,
    })
    const returned = reduceSouvenirs(beforeReturn, {
      type: 'timePassed',
      now: 4_000,
      tripId: 'minho-1000',
      itinerary,
      content,
    })
    const retried = reduceSouvenirs(returned, {
      type: 'timePassed',
      now: 9_000,
      tripId: 'minho-1000',
      itinerary,
      content,
    })

    expect(beforeReturn).toBe(initial)
    expect(returned.received).toEqual([
      {
        id: 'minho-1000--souvenir-1',
        tripId: 'minho-1000',
        souvenirId: 'paris-tower-pin',
        destinationId: 'paris',
        revealedAt: 4_000,
      },
      {
        id: 'minho-1000--souvenir-2',
        tripId: 'minho-1000',
        souvenirId: 'paris-wind-charm',
        destinationId: 'paris',
        revealedAt: 4_000,
      },
    ])
    expect(retried).toBe(returned)
  })
})
