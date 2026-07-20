import {
  createInitialEconomyState,
  reduceEconomy,
  type EconomyState,
} from '../economy'
import type { CatId, PortraitId } from '../ids'
import {
  createInitialPostcardState,
  reducePostcards,
  type PostcardState,
} from '../postcards'
import {
  createInitialSouvenirState,
  reduceSouvenirs,
  type SouvenirState,
} from '../souvenirs'
import type { TravelState } from '../travel'

export const GAME_STATE_VERSION = 1 as const

export interface CatProfile {
  id: CatId
  name: string
  portraitId: PortraitId
  adoptedAt: number
}

export interface GameState {
  stateVersion: typeof GAME_STATE_VERSION
  clockNow: number
  economy: EconomyState
  travelByCat: Readonly<Partial<Record<CatId, TravelState>>>
  cats: readonly CatProfile[]
  activeCatId: CatId | null
  postcards: PostcardState
  souvenirs: SouvenirState
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

const isEconomyState = (value: unknown): value is EconomyState => (
  isRecord(value)
  && typeof value.treats === 'number'
  && typeof value.windowsillTreats === 'number'
  && isRecord(value.accrual)
  && isRecord(value.ownedItems)
  && isRecord(value.packs)
)

const isCatProfile = (value: unknown): value is CatProfile => (
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.name === 'string'
  && value.name.trim().length > 0
  && typeof value.portraitId === 'string'
  && typeof value.adoptedAt === 'number'
)

const isTravelState = (value: unknown): value is TravelState => {
  if (!isRecord(value) || typeof value.kind !== 'string') return false
  if (value.kind === 'home') return true
  if (value.kind === 'waiting') {
    return (
      isRecord(value.schedule)
      && typeof value.schedule.readyAt === 'number'
      && typeof value.schedule.departsAt === 'number'
      && typeof value.tripSeed === 'number'
    )
  }
  if (value.kind !== 'planned') return false

  return (
    isRecord(value.plan)
    && isRecord(value.plan.itinerary)
    && typeof value.plan.itinerary.destinationId === 'string'
    && typeof value.plan.itinerary.departsAt === 'number'
    && typeof value.plan.itinerary.returnsAt === 'number'
    && Array.isArray(value.plan.itinerary.postcardSlots)
    && isRecord(value.plan.content)
    && Array.isArray(value.plan.content.postcards)
    && Array.isArray(value.plan.content.souvenirIds)
    && typeof value.note === 'string'
    && Array.isArray(value.packedItems)
    && Array.isArray(value.itemOutcomes)
  )
}

const isPackedItem = (value: unknown): value is {
  itemId: string
  kind: 'snack' | 'wish' | 'toy'
  wishDestinationId?: string
} => (
  isRecord(value)
  && typeof value.itemId === 'string'
  && (
    value.kind === 'snack'
    || value.kind === 'wish'
    || value.kind === 'toy'
  )
  && (
    value.wishDestinationId === undefined
    || typeof value.wishDestinationId === 'string'
  )
)

const restoreTravelState = (value: unknown): TravelState | undefined => {
  if (isTravelState(value)) return value
  if (
    !isRecord(value)
    || value.kind !== 'planned'
    || !isRecord(value.plan)
    || !isRecord(value.plan.itinerary)
    || typeof value.plan.itinerary.destinationId !== 'string'
    || typeof value.plan.itinerary.departsAt !== 'number'
    || typeof value.plan.itinerary.returnsAt !== 'number'
    || !Array.isArray(value.plan.itinerary.postcardSlots)
    || !isRecord(value.plan.content)
    || !Array.isArray(value.plan.content.postcards)
    || typeof value.note !== 'string'
    || !Array.isArray(value.packedItems)
    || !value.packedItems.every(isPackedItem)
  ) return undefined

  return {
    ...(value as unknown as Extract<TravelState, { kind: 'planned' }>),
    plan: {
      ...(value.plan as unknown as Extract<
        TravelState,
        { kind: 'planned' }
      >['plan']),
      content: {
        ...(value.plan.content as unknown as Extract<
          TravelState,
          { kind: 'planned' }
        >['plan']['content']),
        souvenirIds: Array.isArray(value.plan.content.souvenirIds)
          ? value.plan.content.souvenirIds as string[]
          : [],
      },
    },
    packedItems: value.packedItems,
    itemOutcomes: value.packedItems.map((item) => ({
      ...item,
      disposition: item.kind === 'wish'
        ? 'consumed' as const
        : 'return-home' as const,
    })),
  }
}

const isPostcardState = (value: unknown): value is PostcardState => (
  isRecord(value)
  && Array.isArray(value.received)
  && value.received.every((postcard) => (
    isRecord(postcard)
    && typeof postcard.id === 'string'
    && typeof postcard.tripId === 'string'
    && typeof postcard.destinationId === 'string'
    && typeof postcard.revealAt === 'number'
    && typeof postcard.sceneVariantId === 'string'
    && typeof postcard.portraitId === 'string'
    && typeof postcard.pose === 'string'
    && typeof postcard.note === 'string'
    && typeof postcard.isRead === 'boolean'
  ))
)

const isSouvenirState = (value: unknown): value is SouvenirState => (
  isRecord(value)
  && Array.isArray(value.received)
  && value.received.every((souvenir) => (
    isRecord(souvenir)
    && typeof souvenir.id === 'string'
    && typeof souvenir.tripId === 'string'
    && typeof souvenir.souvenirId === 'string'
    && typeof souvenir.destinationId === 'string'
    && typeof souvenir.revealedAt === 'number'
  ))
)

export const isGameState = (value: unknown): value is GameState => {
  if (
    !isRecord(value)
    || value.stateVersion !== GAME_STATE_VERSION
    || typeof value.clockNow !== 'number'
    || !isEconomyState(value.economy)
    || !isRecord(value.travelByCat)
    || !Object.values(value.travelByCat).every(isTravelState)
    || !Array.isArray(value.cats)
    || !value.cats.every(isCatProfile)
    || !isPostcardState(value.postcards)
    || !isSouvenirState(value.souvenirs)
  ) return false

  return (
    value.activeCatId === null
    || (
      typeof value.activeCatId === 'string'
      && value.cats.some(({ id }) => id === value.activeCatId)
    )
  )
}

export const createInitialGameState = (now: number): GameState => ({
  stateVersion: GAME_STATE_VERSION,
  clockNow: now,
  economy: createInitialEconomyState(now),
  travelByCat: {},
  cats: [],
  activeCatId: null,
  postcards: createInitialPostcardState(),
  souvenirs: createInitialSouvenirState(),
})

export interface AdoptCatRequest extends CatProfile {}

export const adoptCat = (
  state: GameState,
  request: AdoptCatRequest,
): GameState => {
  const name = request.name.trim()
  if (name.length === 0) throw new RangeError('小猫名字不能为空')

  return {
    ...state,
    cats: [
      ...state.cats,
      { ...request, name },
    ],
    activeCatId: request.id,
  }
}

const inferStoredClockNow = (
  stored: Record<string, unknown>,
  now: number,
): number => {
  const observedTimes = [now]
  if (
    isRecord(stored.economy)
    && isRecord(stored.economy.accrual)
    && typeof stored.economy.accrual.lastAccruedAt === 'number'
  ) {
    observedTimes.push(stored.economy.accrual.lastAccruedAt)
  }
  if (isRecord(stored.postcards) && Array.isArray(stored.postcards.received)) {
    for (const postcard of stored.postcards.received) {
      if (isRecord(postcard) && typeof postcard.revealAt === 'number') {
        observedTimes.push(postcard.revealAt)
      }
    }
  }
  if (isRecord(stored.souvenirs) && Array.isArray(stored.souvenirs.received)) {
    for (const souvenir of stored.souvenirs.received) {
      if (isRecord(souvenir) && typeof souvenir.revealedAt === 'number') {
        observedTimes.push(souvenir.revealedAt)
      }
    }
  }
  return Math.max(...observedTimes)
}

export const restoreGameState = (
  stored: unknown,
  now: number,
): GameState => {
  if (
    isRecord(stored)
    && isEconomyState(stored.economy)
    && isRecord(stored.travelByCat)
  ) {
    const cats = Array.isArray(stored.cats)
      ? stored.cats.filter(isCatProfile)
      : []
    const activeCatId = typeof stored.activeCatId === 'string'
      && cats.some(({ id }) => id === stored.activeCatId)
      ? stored.activeCatId
      : (cats[0]?.id ?? null)
    const postcards = isRecord(stored.postcards)
      && Array.isArray(stored.postcards.received)
      ? stored.postcards as unknown as PostcardState
      : createInitialPostcardState()
    const souvenirs = isSouvenirState(stored.souvenirs)
      ? stored.souvenirs
      : createInitialSouvenirState()
    const travelByCat = Object.fromEntries(
      Object.entries(stored.travelByCat).flatMap(([catId, travel]) => {
        const restored = restoreTravelState(travel)
        return restored ? [[catId, restored]] : []
      }),
    ) as GameState['travelByCat']

    return {
      stateVersion: GAME_STATE_VERSION,
      clockNow: typeof stored.clockNow === 'number'
        ? Math.max(now, stored.clockNow)
        : inferStoredClockNow(stored, now),
      economy: stored.economy,
      travelByCat,
      cats,
      activeCatId,
      postcards,
      souvenirs,
    }
  }

  if (isEconomyState(stored)) {
    return {
      stateVersion: GAME_STATE_VERSION,
      clockNow: now,
      economy: stored,
      travelByCat: {},
      cats: [],
      activeCatId: null,
      postcards: createInitialPostcardState(),
      souvenirs: createInitialSouvenirState(),
    }
  }

  return createInitialGameState(now)
}

export interface AdvanceGameEventsInput {
  catId: CatId
  now: number
  economy: EconomyState
  travel: TravelState
}

const CLOCK_CHECKPOINT_MS = 1_000

export const advanceGameEvents = (
  current: GameState,
  input: AdvanceGameEventsInput,
): GameState => {
  let postcards = current.postcards
  let souvenirs = current.souvenirs
  let economy = input.economy
  let travel = input.travel

  if (input.travel.kind === 'planned') {
    const tripId = `${input.catId}-${input.travel.plan.itinerary.departsAt}`
    postcards = reducePostcards(postcards, {
      type: 'timePassed',
      now: input.now,
      tripId,
      itinerary: input.travel.plan.itinerary,
      content: input.travel.plan.content,
    })
    souvenirs = reduceSouvenirs(souvenirs, {
      type: 'timePassed',
      now: input.now,
      tripId,
      itinerary: input.travel.plan.itinerary,
      content: input.travel.plan.content,
    })

    if (input.now >= input.travel.plan.itinerary.returnsAt) {
      economy = reduceEconomy(economy, {
        type: 'tripReturned',
        catId: input.catId,
        itemOutcomes: input.travel.itemOutcomes,
      })
      travel = { kind: 'home' }
    }
  }

  const currentTravel = current.travelByCat[input.catId]
  const shouldCheckpointClock = (
    Math.abs(input.now - current.clockNow) >= CLOCK_CHECKPOINT_MS
  )
  if (
    economy === current.economy
    && travel === currentTravel
    && postcards === current.postcards
    && souvenirs === current.souvenirs
    && !shouldCheckpointClock
  ) return current

  return {
    ...current,
    clockNow: input.now,
    economy,
    postcards,
    souvenirs,
    travelByCat: {
      ...current.travelByCat,
      [input.catId]: travel,
    },
  }
}
