import {
  createInitialEconomyState,
  reduceEconomy,
  type EconomyState,
} from '../economy'
import type { AssetCatalog } from '../assets'
import type { CatId, PortraitId } from '../ids'
import {
  createInitialPostcardState,
  reducePostcards,
  type PostcardState,
  type ReceivedPostcard,
} from '../postcards'
import {
  isPostcardRecipe,
  restoreSelectedPostcard,
  type TripContent,
} from '../selection'
import {
  createInitialSouvenirState,
  reduceSouvenirs,
  type SouvenirState,
} from '../souvenirs'
import type { PlannedItemOutcome, TravelState } from '../travel'

export const GAME_STATE_VERSION = 3 as const

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
  ) return undefined

  const souvenirIds = Array.isArray(value.souvenirIds)
    && value.souvenirIds.every((id) => typeof id === 'string')
    ? value.souvenirIds
    : []

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
    souvenirIds,
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
    || typeof value.clockNow !== 'number'
    || !Number.isFinite(value.clockNow)
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
    const souvenirs = isSouvenirState(stored.souvenirs)
      ? stored.souvenirs
      : createInitialSouvenirState()
    const travelByCat = Object.fromEntries(
      Object.entries(stored.travelByCat).flatMap(([catId, travel]) => {
        const restored = restoreTravelState(travel, catId, catalog)
        return restored ? [[catId, restored]] : []
      }),
    ) as GameState['travelByCat']

    return {
      stateVersion: GAME_STATE_VERSION,
      clockNow: inferStoredClockNow(stored, now),
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

const inferStoredClockNow = (
  stored: Record<string, unknown>,
  now: number,
): number => {
  const observedTimes = [now]
  if (typeof stored.clockNow === 'number' && Number.isFinite(stored.clockNow)) {
    observedTimes.push(stored.clockNow)
  }
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

export interface AdvanceGameEventsInput {
  catId: CatId
  now: number
  economy: EconomyState
  travel: TravelState
}

export const advanceGameEvents = (
  current: GameState,
  input: AdvanceGameEventsInput,
): GameState => {
  let postcards = current.postcards
  let souvenirs = current.souvenirs
  let economy = input.economy
  let travel = input.travel

  if (travel.kind === 'planned') {
    const { content, itinerary } = travel.plan
    const tripId = `${input.catId}-${itinerary.departsAt}`
    postcards = reducePostcards(postcards, {
      type: 'timePassed',
      now: input.now,
      tripId,
      itinerary,
      content,
    })
    souvenirs = reduceSouvenirs(souvenirs, {
      type: 'timePassed',
      now: input.now,
      tripId,
      itinerary,
      content,
    })

    if (input.now >= itinerary.returnsAt) {
      economy = reduceEconomy(economy, {
        type: 'tripReturned',
        catId: input.catId,
        itemOutcomes: travel.itemOutcomes,
      })
      travel = { kind: 'home' }
    }
  }

  const clockNow = Math.max(current.clockNow, input.now)
  const currentTravel = current.travelByCat[input.catId]
  if (
    economy === current.economy
    && travel === currentTravel
    && postcards === current.postcards
    && souvenirs === current.souvenirs
    && clockNow === current.clockNow
  ) return current

  return {
    ...current,
    clockNow,
    economy,
    postcards,
    souvenirs,
    travelByCat: {
      ...current.travelByCat,
      [input.catId]: travel,
    },
  }
}
