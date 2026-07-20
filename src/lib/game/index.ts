import {
  createInitialEconomyState,
  type EconomyState,
} from '../economy'
import type { CatId, PortraitId } from '../ids'
import {
  createInitialPostcardState,
  type PostcardState,
} from '../postcards'
import {
  createInitialSouvenirState,
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
