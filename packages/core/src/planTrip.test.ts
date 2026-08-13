import { describe, expect, it } from 'vitest'
import { PRODUCTION_STARTER_CATALOG } from './assets/starterCatalog'
import type { Itinerary } from './itinerary'
import { createPlanTrip } from './planTrip'

const itinerary: Itinerary = {
  destinationId: 'paris',
  departsAt: 1_000,
  returnsAt: 3_000,
  postcardSlots: [],
  routeKind: 'unwished',
  isDetour: false,
}

describe('Plan trip', () => {
  it('只解析一次行囊效果并同时交给行程与内容选取', () => {
    let itineraryEffects: unknown
    let selectionEffects: unknown
    const planTrip = createPlanTrip({
      planItinerary: (request) => {
        itineraryEffects = request.packEffects
        return itinerary
      },
      selectContent: (request) => {
        selectionEffects = request.packEffects
        return { postcards: [], souvenirIds: [] }
      },
    })

    planTrip({
      departsAt: 1_000,
      destinations: [{ id: 'paris', region: 'europe' }],
      packedItemIds: ['travel-tin', 'small-camera'],
      travelerCatId: 'cat-1',
      portraitId: 'minho',
      catalog: PRODUCTION_STARTER_CATALOG,
    }, () => 0)

    expect(itineraryEffects).toEqual({
      travelDurationMultiplier: 1.25,
      secondPostcardChanceBonus: 0.2,
      companionChanceBonus: 0,
      poseWeights: {},
      copyTagWeights: {},
    })
    expect(selectionEffects).toBe(itineraryEffects)
  })
})
