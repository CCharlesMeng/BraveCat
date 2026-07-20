import type { AssetCatalog } from './assets'
import type {
  Itinerary,
  ItineraryPlanner,
  ItineraryRequest,
  RandomSource,
} from './itinerary'
import type { ContentSelector, TripContent } from './selection'
import type { PortraitId } from './ids'

export interface PlanTripRequest extends ItineraryRequest {
  portraitId: PortraitId
  catalog: AssetCatalog
}

export interface PlannedTrip {
  itinerary: Itinerary
  content: TripContent
}

export interface PlanTripDependencies {
  planItinerary: ItineraryPlanner
  selectContent: ContentSelector
}

export type PlanTrip = (
  request: PlanTripRequest,
  random: RandomSource,
) => PlannedTrip

/**
 * 对外的旅行规划门面。它先锁定整段行程，再为时间线中的空位选取素材。
 */
export const createPlanTrip = (
  dependencies: PlanTripDependencies,
): PlanTrip => (
  request,
  random,
) => {
  const itinerary = dependencies.planItinerary(request, random)
  const content = dependencies.selectContent({
    itinerary,
    portraitId: request.portraitId,
    catalog: request.catalog,
  }, random)

  return { itinerary, content }
}
