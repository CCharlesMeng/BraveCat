import {
  createInitialEconomyState,
  type EconomyState,
} from '../economy'
import type { AssetCatalog } from '../assets'
import type { CatId, PortraitId } from '../ids'
import {
  createInitialPostcardState,
  type PostcardState,
  type ReceivedPostcard,
} from '../postcards'
import {
  isPostcardRecipe,
  restoreSelectedPostcard,
  type TripContent,
} from '../selection'
import type { PlannedItemOutcome, TravelState } from '../travel'

export const GAME_STATE_VERSION = 2 as const

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
    && isTripContent(value.plan.content)
    && typeof value.note === 'string'
    && Array.isArray(value.packedItems)
    && value.packedItems.every(isPackedItem)
    && Array.isArray(value.itemOutcomes)
    && value.itemOutcomes.every(isPlannedItemOutcome)
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

const isPlannedItemOutcome = (
  value: unknown,
): value is PlannedItemOutcome => (
  isRecord(value)
  && (
    value.disposition === 'consumed'
    || value.disposition === 'return-home'
  )
  && isPackedItem(value)
)

const isTripContent = (value: unknown): value is TripContent => (
  isRecord(value)
  && Array.isArray(value.postcards)
  && value.postcards.every((postcard) => (
    isRecord(postcard)
    && isPostcardRecipe(postcard.recipe)
  ))
  && Array.isArray(value.souvenirIds)
  && value.souvenirIds.every((id) => typeof id === 'string')
)

const restoreTripContent = (
  value: unknown,
  travelerCatId: CatId,
  catalog?: AssetCatalog,
): TripContent | undefined => {
  if (
    !isRecord(value)
    || !Array.isArray(value.postcards)
    || !Array.isArray(value.souvenirIds)
    || !value.souvenirIds.every((id) => typeof id === 'string')
  ) return undefined

  const postcards = value.postcards.map((postcard) => {
    if (
      isRecord(postcard)
      && isPostcardRecipe(postcard.recipe)
      && postcard.recipe.travelerCatId === travelerCatId
    ) {
      return { recipe: postcard.recipe }
    }
    return catalog
      ? restoreSelectedPostcard(postcard, travelerCatId, catalog)
      : undefined
  })
  if (postcards.some((postcard) => postcard === undefined)) return undefined

  return {
    postcards: postcards as TripContent['postcards'],
    souvenirIds: value.souvenirIds,
  }
}

const restoreTravelState = (
  value: unknown,
  travelerCatId: CatId,
  catalog?: AssetCatalog,
): TravelState | undefined => {
  if (
    isTravelState(value)
    && (
      value.kind !== 'planned'
      || value.plan.content.postcards.every(
        ({ recipe }) => recipe.travelerCatId === travelerCatId,
      )
    )
  ) return value
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
    || !Array.isArray(value.plan.content.souvenirIds)
    || typeof value.note !== 'string'
    || !Array.isArray(value.packedItems)
    || !value.packedItems.every(isPackedItem)
  ) return undefined

  const content = restoreTripContent(
    value.plan.content,
    travelerCatId,
    catalog,
  )
  if (!content) return undefined
  const itemOutcomes = Array.isArray(value.itemOutcomes)
    && value.itemOutcomes.every(isPlannedItemOutcome)
    ? value.itemOutcomes
    : value.packedItems.map((item) => ({
        ...item,
        disposition: item.kind === 'wish'
          ? 'consumed' as const
          : 'return-home' as const,
      }))

  return {
    ...(value as unknown as Extract<TravelState, { kind: 'planned' }>),
    plan: {
      ...(value.plan as unknown as Extract<
        TravelState,
        { kind: 'planned' }
      >['plan']),
      content,
    },
    packedItems: value.packedItems,
    itemOutcomes,
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
    && isPostcardRecipe(postcard.recipe)
    && typeof postcard.isRead === 'boolean'
  ))
)

const restorePostcardState = (
  value: unknown,
  cats: readonly CatProfile[],
  activeCatId: CatId | null,
  catalog?: AssetCatalog,
): PostcardState => {
  if (!isRecord(value) || !Array.isArray(value.received)) {
    return createInitialPostcardState()
  }

  const received = value.received.flatMap((postcard): ReceivedPostcard[] => {
    if (
      !isRecord(postcard)
      || typeof postcard.id !== 'string'
      || typeof postcard.tripId !== 'string'
      || typeof postcard.destinationId !== 'string'
      || typeof postcard.revealAt !== 'number'
      || typeof postcard.isRead !== 'boolean'
    ) return []

    if (isPostcardRecipe(postcard.recipe)) {
      return [{
        id: postcard.id,
        tripId: postcard.tripId,
        destinationId: postcard.destinationId,
        revealAt: postcard.revealAt,
        recipe: postcard.recipe,
        isRead: postcard.isRead,
      }]
    }
    if (!catalog) return []

    const portraitId = typeof postcard.portraitId === 'string'
      ? postcard.portraitId
      : undefined
    const tripId = postcard.tripId
    const travelerCatId = cats
      .filter(({ id }) => tripId.startsWith(`${id}-`))
      .sort((left, right) => right.id.length - left.id.length)[0]?.id
      ?? cats.find((cat) => cat.portraitId === portraitId)?.id
      ?? activeCatId
      ?? cats[0]?.id
      ?? portraitId
    if (!travelerCatId) return []

    const selected = restoreSelectedPostcard(
      postcard,
      travelerCatId,
      catalog,
    )
    if (!selected) return []

    return [{
      id: postcard.id,
      tripId: postcard.tripId,
      destinationId: postcard.destinationId,
      revealAt: postcard.revealAt,
      ...selected,
      isRead: postcard.isRead,
    }]
  })

  return { received }
}

export const isGameState = (value: unknown): value is GameState => {
  if (
    !isRecord(value)
    || value.stateVersion !== GAME_STATE_VERSION
    || !isEconomyState(value.economy)
    || !isRecord(value.travelByCat)
    || !Object.entries(value.travelByCat).every(([catId, travel]) => (
      isTravelState(travel)
      && (
        travel.kind !== 'planned'
        || travel.plan.content.postcards.every(
          ({ recipe }) => recipe.travelerCatId === catId,
        )
      )
    ))
    || !Array.isArray(value.cats)
    || !value.cats.every(isCatProfile)
    || !isPostcardState(value.postcards)
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
  catalog?: AssetCatalog,
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
    const postcards = restorePostcardState(
      stored.postcards,
      cats,
      activeCatId,
      catalog,
    )
    const travelByCat = Object.fromEntries(
      Object.entries(stored.travelByCat).flatMap(([catId, travel]) => {
        const restored = restoreTravelState(travel, catId, catalog)
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
    }
  }

  return createInitialGameState(now)
}
