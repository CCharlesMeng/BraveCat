import type { AssetCatalog } from './assets'
import type {
  Itinerary,
  ItineraryPlanner,
  ItineraryRequest,
  RandomSource,
} from './itinerary'
import type {
  ContentSelector,
  PostcardRecipe,
  TripContent,
} from './selection'
import type { CatId, PortraitId } from './ids'
import { resolvePackEffects } from './packEffects'

export interface PlanTripRequest extends ItineraryRequest {
  travelerCatId: CatId
  portraitId: PortraitId
  catalog: AssetCatalog
  recentPostcardRecipes?: readonly Pick<PostcardRecipe, 'scene' | 'copy'>[]
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
  const packEffects = resolvePackEffects(
    request.catalog.items,
    request.packedItemIds,
  )
  const itinerary = dependencies.planItinerary({
    ...request,
    packEffects,
  }, random)
  const content = dependencies.selectContent({
    itinerary,
    travelerCatId: request.travelerCatId,
    portraitId: request.portraitId,
    catalog: request.catalog,
    recentPostcardRecipes: request.recentPostcardRecipes,
    packEffects,
  }, random)

  return { itinerary, content }
}
