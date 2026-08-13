import type { DestinationId, ItemId } from '../ids'
import {
  EMPTY_PACK_EFFECTS,
  type PackEffects,
} from '../packEffects'

export type RandomSource = () => number

export interface TripRhythm {
  departureDelayMs: readonly [minimum: number, maximum: number]
  travelDurationMs: readonly [minimum: number, maximum: number]
  postcardCount: readonly [minimum: number, maximum: number]
  secondPostcardChance: number
}

export const DEFAULT_TRIP_RHYTHM: TripRhythm = {
  departureDelayMs: [30 * 60 * 1_000, 6 * 60 * 60 * 1_000],
  travelDurationMs: [2 * 60 * 60 * 1_000, 24 * 60 * 60 * 1_000],
  postcardCount: [1, 2],
  secondPostcardChance: 0.3,
}

export interface DepartureScheduleRequest {
  readyAt: number
  rhythm?: TripRhythm
}

export interface DepartureSchedule {
  readyAt: number
  departsAt: number
}

/**
 * 行囊首次变为非空时只安排出发时刻；目的地和旅行内容仍到出发时才确定。
 */
export const scheduleDeparture = (
  request: DepartureScheduleRequest,
  random: RandomSource,
): DepartureSchedule => {
  const [minimum, maximum] = (
    request.rhythm ?? DEFAULT_TRIP_RHYTHM
  ).departureDelayMs
  const delay = minimum + (maximum - minimum) * random()

  return {
    readyAt: request.readyAt,
    departsAt: request.readyAt + delay,
  }
}

export interface ItineraryRequest {
  departsAt: number
  destinations: readonly ItineraryDestination[]
  packedItemIds: readonly ItemId[]
  wishDestinationId?: DestinationId
  rhythm?: TripRhythm
  wishRouteOdds?: WishRouteOdds
  packEffects?: PackEffects
}

export interface ItineraryDestination {
  id: DestinationId
  region: string
}

export interface WishRouteOdds {
  wish: number
  regionalDetour: number
  globalUnexpected: number
}

export interface PostcardSlot {
  destinationId: DestinationId
  revealAt: number
}

export type RouteKind =
  | 'unwished'
  | 'wish'
  | 'regional-detour'
  | 'global-unexpected'

export interface Itinerary {
  destinationId: DestinationId
  departsAt: number
  returnsAt: number
  postcardSlots: readonly PostcardSlot[]
  routeKind: RouteKind
  isDetour: boolean
}

export const DEFAULT_WISH_ROUTE_ODDS: WishRouteOdds = {
  wish: 0.8,
  regionalDetour: 0.15,
  globalUnexpected: 0.05,
}

const selectOne = <T>(values: readonly T[], random: RandomSource): T => {
  if (values.length === 0) {
    throw new RangeError('旅行至少需要一个可选目的地')
  }

  return values[Math.min(values.length - 1, Math.floor(random() * values.length))]
}

const chooseDestination = (
  request: ItineraryRequest,
  random: RandomSource,
): { destination: ItineraryDestination; routeKind: RouteKind } => {
  const wish = request.destinations.find(
    ({ id }) => id === request.wishDestinationId,
  )
  if (!wish) {
    return {
      destination: selectOne(request.destinations, random),
      routeKind: 'unwished',
    }
  }

  const odds = request.wishRouteOdds ?? DEFAULT_WISH_ROUTE_ODDS
  const oddsScale = 1_000_000
  const routeRoll = Math.floor(random() * oddsScale)
  const wishThreshold = Math.round(odds.wish * oddsScale)
  const regionalThreshold = wishThreshold
    + Math.round(odds.regionalDetour * oddsScale)
  if (routeRoll < wishThreshold) {
    return { destination: wish, routeKind: 'wish' }
  }

  const otherDestinations = request.destinations.filter(
    ({ id }) => id !== wish.id,
  )
  if (routeRoll < regionalThreshold) {
    const regionalDestinations = otherDestinations.filter(
      ({ region }) => region === wish.region,
    )
    if (regionalDestinations.length > 0) {
      return {
        destination: selectOne(regionalDestinations, random),
        routeKind: 'regional-detour',
      }
    }
  }

  return {
    destination: otherDestinations.length > 0
      ? selectOne(otherDestinations, random)
      : wish,
    routeKind: otherDestinations.length > 0 ? 'global-unexpected' : 'wish',
  }
}

export const planItinerary: ItineraryPlanner = (request, random) => {
  const rhythm = request.rhythm ?? DEFAULT_TRIP_RHYTHM
  const { destination, routeKind } = chooseDestination(request, random)
  const [minimumDuration, maximumDuration] = rhythm.travelDurationMs
  const baseDuration = minimumDuration
    + (maximumDuration - minimumDuration) * random()
  const effects = request.packEffects ?? EMPTY_PACK_EFFECTS
  const duration = Math.min(
    maximumDuration,
    baseDuration * effects.travelDurationMultiplier,
  )
  const [minimumPostcards, maximumPostcards] = rhythm.postcardCount
  const postcardRoll = random()
  const secondPostcardChance = Math.min(
    1,
    rhythm.secondPostcardChance + effects.secondPostcardChanceBonus,
  )
  const postcardCount = minimumPostcards === 1 && maximumPostcards === 2
    ? (postcardRoll < secondPostcardChance ? 2 : 1)
    : minimumPostcards + Math.floor(
      postcardRoll * (maximumPostcards - minimumPostcards + 1),
    )
  const returnsAt = request.departsAt + duration
  const postcardSlots = Array.from({ length: postcardCount }, (_, index) => ({
    destinationId: destination.id,
    revealAt: request.departsAt
      + duration * ((index + 1) / (postcardCount + 1)),
  }))

  return {
    destinationId: destination.id,
    departsAt: request.departsAt,
    returnsAt,
    postcardSlots,
    routeKind,
    isDetour: routeKind === 'regional-detour',
  }
}

/**
 * 行程只负责决定「何时、去哪、多久」；具体场景与文案由选取器填充。
 */
export type ItineraryPlanner = (
  request: ItineraryRequest,
  random: RandomSource,
) => Itinerary
