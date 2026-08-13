import type { AssetCatalog } from '../assets'
import type { PackedItem } from '../economy'
import {
  scheduleDeparture,
  type DepartureSchedule,
  type ItineraryDestination,
  type RandomSource,
  type TripRhythm,
} from '../itinerary'
import type { CatId, DestinationId, PortraitId } from '../ids'
import type { PlanTrip, PlannedTrip } from '../planTrip'
import type { PostcardRecipe } from '../selection'

export const createSeededRandom = (seed: number): RandomSource => {
  let value = seed >>> 0

  return () => {
    value = (value + 0x6D2B79F5) >>> 0
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

export interface PlannedItemOutcome extends PackedItem {
  disposition: 'consumed' | 'return-home'
}

export type TravelState =
  | { kind: 'home' }
  | {
    kind: 'waiting'
    schedule: DepartureSchedule
    tripSeed: number
  }
  | {
    kind: 'planned'
    plan: PlannedTrip
    note: string
    packedItems: readonly PackedItem[]
    itemOutcomes: readonly PlannedItemOutcome[]
  }

export interface TravelAdvanceInput {
  now: number
  pack: readonly PackedItem[]
  portraitId?: PortraitId
  wishDestinationId?: DestinationId
  recentPostcardRecipes?: readonly Pick<PostcardRecipe, 'scene' | 'copy'>[]
}

export type TravelPresence = 'home' | 'waiting' | 'traveling' | 'returned'

export interface TravelLifecycle {
  advance(state: TravelState, input: TravelAdvanceInput): TravelState
  getPresence(state: TravelState, now: number): TravelPresence
}

export interface TravelLifecycleConfig {
  catalog: AssetCatalog
  travelerCatId: CatId
  portraitId: PortraitId
  destinations: readonly ItineraryDestination[]
  rhythm: TripRhythm
  planTrip: PlanTrip
  createSeed(): number
  randomFromSeed(seed: number): RandomSource
  snackUseChance?: number
}

export const createTravelLifecycle = (
  config: TravelLifecycleConfig,
): TravelLifecycle => {
  const advance: TravelLifecycle['advance'] = (state, input) => {
    if (state.kind === 'waiting' && input.pack.length === 0) {
      return { kind: 'home' }
    }

    if (state.kind === 'waiting') {
      if (input.now < state.schedule.departsAt) return state

      const random = config.randomFromSeed(state.tripSeed)
      const plan = config.planTrip({
        departsAt: state.schedule.departsAt,
        destinations: config.destinations,
        packedItemIds: input.pack.map(({ itemId }) => itemId),
        wishDestinationId: input.wishDestinationId,
        rhythm: config.rhythm,
        travelerCatId: config.travelerCatId,
        portraitId: input.portraitId ?? config.portraitId,
        catalog: config.catalog,
        recentPostcardRecipes: input.recentPostcardRecipes,
      }, random)
      const notes = config.catalog.copy.travelNotes
      if (notes.length === 0) {
        throw new RangeError('字条文案库不能为空')
      }
      const note = notes[Math.min(
        notes.length - 1,
        Math.floor(random() * notes.length),
      )]
      const snackUseChance = config.snackUseChance ?? 0.75
      const itemOutcomes = input.pack.map((item): PlannedItemOutcome => ({
        ...item,
        disposition: item.kind === 'wish'
          ? 'consumed'
          : item.kind === 'toy'
            ? 'return-home'
            : random() < snackUseChance
              ? 'consumed'
              : 'return-home',
      }))

      return {
        kind: 'planned',
        plan,
        note,
        packedItems: input.pack.map((item) => ({ ...item })),
        itemOutcomes,
      }
    }

    if (state.kind !== 'home' || input.pack.length === 0) return state

    const scheduleSeed = config.createSeed()
    const schedule = scheduleDeparture(
      { readyAt: input.now, rhythm: config.rhythm },
      config.randomFromSeed(scheduleSeed),
    )

    return {
      kind: 'waiting',
      schedule,
      tripSeed: config.createSeed(),
    }
  }

  return {
    advance,
    getPresence: (state, now) => {
      if (state.kind === 'home') return 'home'
      if (state.kind === 'waiting') return 'waiting'
      if (now < state.plan.itinerary.departsAt) return 'waiting'
      if (now < state.plan.itinerary.returnsAt) return 'traveling'
      return 'returned'
    },
  }
}
