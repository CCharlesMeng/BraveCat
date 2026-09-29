import { chooseStory, lockStory, type StoryPlan, type StorySelectionContext } from './stories'
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
  storyContext?: StorySelectionContext
  travelerName?: string
  travelerCatId: CatId
  portraitId: PortraitId
  catalog: AssetCatalog
  recentPostcardRecipes?: readonly Pick<PostcardRecipe, 'scene' | 'copy'>[]
}

export interface PlannedTrip {
  story?: StoryPlan
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
  const story = request.storyContext && itinerary.routeKind !== 'wish'
    ? chooseStory(request.storyContext, request.packedItemIds, random)
    : undefined
  if (story) {
    return {
      story: lockStory(story, request.travelerCatId, request.travelerName ?? request.travelerCatId, itinerary.departsAt, itinerary.returnsAt),
      itinerary: { ...itinerary, destinationId: `story:${story.id}`, routeKind: 'story', isDetour: false, postcardSlots: [] },
      content: { postcards: [], souvenirIds: [] },
    }
  }
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
