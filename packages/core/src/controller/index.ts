/**
 * 平台无关的游戏编排层（GameController）。
 *
 * 持有游戏主循环推进、启动水合、存档迁移表、旅行节奏参数与
 * 购买 / 行囊 / 领养 / 换装等编排逻辑；表现层（Svelte / Taro / …）
 * 只实例化 controller、订阅快照并渲染，玩家可见文案由各端根据
 * 方法返回的结构化结果自行拼写。
 *
 * 不使用任何框架响应式原语：状态经 `subscribe` 以不可变快照下发，
 * web 端用薄适配把快照桥到 Svelte runes。
 */
import type { AssetCatalog, ItemDefinition } from '../assets'
import {
  STARTER_CATALOG,
  STARTER_DESTINATIONS,
} from '../assets/starterCatalog'
import { STARTER_ITEMS } from '../assets/starterItems'
import {
  getPackItemRejectionReason,
  reduceEconomy,
  type EconomyAction,
  type PackItemRejectionReason,
} from '../economy'
import {
  advanceAllGameEvents,
  adoptCat,
  changeCatPortrait,
  createInitialGameState,
  isGameState,
  restoreGameState,
  selectActiveCat,
  setHomeCustomization,
  type GameState,
} from '../game'
import type { HomeActivity, HomeCustomization } from '../homeTheme'
import type { CatId, DestinationId, PortraitId } from '../ids'
import {
  planItinerary,
  type ItineraryDestination,
  type TripRhythm,
} from '../itinerary'
import { createPlanTrip } from '../planTrip'
import { reducePostcards } from '../postcards'
import type { RandomPort } from '../ports/random'
import type {
  SaveDocument,
  SaveStore,
  SaveStoreOptions,
} from '../save'
import { selectTripContent } from '../selection'
import {
  beginPurchaseChoice,
  confirmPurchasedItemInPack,
  keepPurchasedItemAtHome as keepPurchasedItemAtHomeFlow,
  type PendingPurchase,
} from '../shop'
import { createClock } from '../time'
import {
  createSeededRandom,
  createTravelLifecycle,
  type TravelPresence,
  type TravelState,
} from '../travel'

const HOME_TRAVEL_STATE = { kind: 'home' } as const satisfies TravelState
const POSTCARD_VARIETY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1_000

export const DEFAULT_PACK_CAPACITY = 3

/** 小猫出发 / 旅途时长 / 明信片数量的节奏参数。 */
export const DEFAULT_TRIP_RHYTHM = {
  departureDelayMs: [30 * 60 * 1_000, 6 * 60 * 60 * 1_000],
  travelDurationMs: [2 * 60 * 60 * 1_000, 24 * 60 * 60 * 1_000],
  postcardCount: [1, 2],
  secondPostcardChance: 0.3,
} as const satisfies TripRhythm

/** 正式美术未放行 gaze，默认姿势池不含它；预览环境由各端扩池。 */
const DEFAULT_HOME_ACTIVITY_POOL = [
  'sleep',
  'play',
  'eat',
] as const satisfies readonly HomeActivity[]

export interface GameControllerPorts {
  /** controller 自带领域校验与迁移表，平台只提供存储介质。 */
  createSaveStore(options: SaveStoreOptions<GameState>): SaveStore<GameState>
  random: RandomPort
  /** 真实时间来源，默认 Date.now；测试可注入。 */
  realNow?: () => number
}

export interface GameControllerOptions {
  catalog?: AssetCatalog
  destinations?: readonly ItineraryDestination[]
  items?: readonly ItemDefinition[]
  rhythm?: TripRhythm
  packCapacity?: number
  /** 初次领养的小猫身份（id 与已验收形象）。 */
  initialCat?: { id: CatId; portraitId: PortraitId }
  /** 随机抽取姿势时的候选池；按次求值，预览环境可临时扩池。 */
  homeActivityPool?: () => readonly HomeActivity[]
  /** 返回非 null 时跳过随机直接采用（web dev 的 URL 覆写）。 */
  homeActivityOverride?: () => HomeActivity | null
}

export interface GameSnapshot {
  game: GameState
  /** 游戏时钟当前投影时间（settle 时刷新）。 */
  now: number
  hydrated: boolean
  /** 最近一次持久化是否失败，视图据此提示玩家。 */
  saveFailed: boolean
  pendingPurchase: PendingPurchase | null
  homeActivity: HomeActivity
}

export interface ReturnedCatOutcome {
  id: CatId
  name: string
  souvenirCount: number
}

export interface SettleOutcome {
  returnedCats: readonly ReturnedCatOutcome[]
}

export type GameController = ReturnType<typeof createGameController>

export const createGameController = (
  ports: GameControllerPorts,
  options: GameControllerOptions = {},
) => {
  const catalog = options.catalog ?? STARTER_CATALOG
  const destinations = options.destinations ?? STARTER_DESTINATIONS
  const items = options.items ?? STARTER_ITEMS
  const rhythm = options.rhythm ?? DEFAULT_TRIP_RHYTHM
  const packCapacity = options.packCapacity ?? DEFAULT_PACK_CAPACITY
  const initialCat = options.initialCat
    ?? { id: 'minho', portraitId: 'minho' }

  const clock = createClock({ realNow: ports.realNow })
  const createTripSeed = () => ports.random.nextUint32()

  // 存档迁移表：版本链 v0→…→v4，宽松恢复统一走 restoreGameState。
  const saveStore = ports.createSaveStore({
    validateState: isGameState,
    migrations: {
      0: (document) => ({
        ...document,
        schemaVersion: 1,
      }),
      1: (document) => ({
        ...document,
        schemaVersion: 2,
      }),
      2: (document) => ({
        ...document,
        schemaVersion: 3,
        state: restoreGameState(document.state, clock.now(), catalog),
      }),
      // v4 起根存档携带全家共享的 homeCustomization；宽松恢复会注入默认预设。
      3: (document) => ({
        ...document,
        schemaVersion: 4,
        state: restoreGameState(document.state, clock.now(), catalog),
      }),
    },
  })

  const planTrip = createPlanTrip({
    planItinerary,
    selectContent: selectTripContent,
  })
  const travelLifecycleFor = (
    travelerCatId: CatId,
    portraitId: PortraitId,
  ) => createTravelLifecycle({
    catalog,
    travelerCatId,
    portraitId,
    destinations,
    rhythm,
    planTrip,
    createSeed: createTripSeed,
    randomFromSeed: createSeededRandom,
  })

  let game = createInitialGameState(clock.now())
  let gameNow = clock.now()
  let hydrated = false
  let saveFailed = false
  let pendingPurchase: PendingPurchase | null = null
  let homeActivity: HomeActivity = 'sleep'

  let snapshot: GameSnapshot = {
    game,
    now: gameNow,
    hydrated,
    saveFailed,
    pendingPurchase,
    homeActivity,
  }
  const listeners = new Set<(next: GameSnapshot) => void>()
  const emit = () => {
    snapshot = {
      game,
      now: gameNow,
      hydrated,
      saveFailed,
      pendingPurchase,
      homeActivity,
    }
    for (const listener of listeners) listener(snapshot)
  }

  const activeCatKey = () => (
    game.activeCatId ?? game.cats[0]?.id ?? initialCat.id
  )

  const presence = (
    state: GameState,
    catId: CatId,
    now: number,
  ): TravelPresence => {
    const cat = state.cats.find(({ id }) => id === catId)
    const travel = state.travelByCat[catId] ?? HOME_TRAVEL_STATE
    return travelLifecycleFor(
      catId,
      cat?.portraitId ?? initialCat.portraitId,
    ).getPresence(travel, now)
  }

  const isPackLocked = () => (
    presence(game, activeCatKey(), gameNow) === 'traveling'
  )

  const saveGame = async () => {
    try {
      await saveStore.save(game)
      saveFailed = false
    } catch {
      saveFailed = true
    }
  }

  const advanceGame = (
    current: GameState,
    nextEconomy: GameState['economy'],
    now: number,
  ): GameState => {
    const recentPostcardRecipes = current.postcards.received
      .filter(({ revealAt }) => (
        revealAt <= now && now - revealAt < POSTCARD_VARIETY_COOLDOWN_MS
      ))
      .map(({ recipe }) => recipe)
    const travelByCat = Object.fromEntries(current.cats.map((cat) => {
      const currentTravel = current.travelByCat[cat.id] ?? HOME_TRAVEL_STATE
      const nextPack = nextEconomy.packs[cat.id] ?? []
      const nextTravel = travelLifecycleFor(cat.id, cat.portraitId).advance(
        currentTravel,
        {
          now,
          pack: nextPack,
          portraitId: cat.portraitId,
          wishDestinationId: nextPack.find(
            ({ kind, wishDestinationId }) => (
              kind === 'wish' && wishDestinationId
            ),
          )?.wishDestinationId,
          recentPostcardRecipes,
        },
      )
      return [cat.id, nextTravel]
    }))

    return advanceAllGameEvents(current, {
      now,
      economy: nextEconomy,
      travelByCat,
    })
  }

  const randomizeHomeActivity = () => {
    const override = options.homeActivityOverride?.()
    if (override) {
      homeActivity = override
      return
    }
    const pool = options.homeActivityPool?.() ?? DEFAULT_HOME_ACTIVITY_POOL
    homeActivity = pool[ports.random.nextUint32() % pool.length]
  }

  const applyEconomyAction = async (action: EconomyAction) => {
    const nextEconomy = reduceEconomy(game.economy, action)
    if (nextEconomy === game.economy) {
      return false
    }

    const now = clock.now()
    gameNow = now
    game = advanceGame(game, nextEconomy, now)
    await saveGame()
    emit()
    return true
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: (next: GameSnapshot) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    packCapacity,

    /** 启动水合；返回是否读档失败（视图据此提示「从这里开始」）。 */
    hydrate: async (): Promise<{ loadFailed: boolean }> => {
      try {
        const saved = await saveStore.load()
        const realNow = clock.now()
        const restored = restoreGameState(saved, realNow, catalog)
        clock.setAcceleration(1)
        clock.setNow(restored.clockNow)
        const now = clock.now()
        const settledEconomy = reduceEconomy(restored.economy, {
          type: 'timePassed',
          now,
        })
        gameNow = now
        game = advanceGame(restored, settledEconomy, now)
        randomizeHomeActivity()
        hydrated = true
        await saveGame()
        emit()
        return { loadFailed: false }
      } catch {
        hydrated = true
        emit()
        return { loadFailed: true }
      }
    },

    /** 游戏主循环推进：结算经济、推进旅行，返回刚回家的小猫。 */
    settle: async (): Promise<SettleOutcome> => {
      if (!hydrated) return { returnedCats: [] }

      const now = clock.now()
      gameNow = now
      const settledEconomy = reduceEconomy(game.economy, {
        type: 'timePassed',
        now,
      })
      const previousTravelByCat = game.travelByCat
      const next = advanceGame(game, settledEconomy, now)
      if (next === game) {
        if (saveFailed) await saveGame()
        emit()
        return { returnedCats: [] }
      }

      const returnedCats = game.cats
        .filter(({ id }) => (
          previousTravelByCat[id]?.kind === 'planned'
          && next.travelByCat[id]?.kind === 'home'
        ))
        .map((cat) => {
          const previousTravel = previousTravelByCat[cat.id]
          const tripId = previousTravel?.kind === 'planned'
            ? `${cat.id}-${previousTravel.plan.itinerary.departsAt}`
            : null
          return {
            id: cat.id,
            name: cat.name,
            souvenirCount: tripId
              ? next.souvenirs.received.filter(
                (souvenir) => souvenir.tripId === tripId,
              ).length
              : 0,
          }
        })
      game = next
      if (returnedCats.length > 0) randomizeHomeActivity()
      await saveGame()
      emit()
      return { returnedCats }
    },

    setTimeAcceleration: (multiplier: number) => {
      clock.setAcceleration(multiplier)
    },

    adopt: async (name: string) => {
      game = adoptCat(game, {
        id: initialCat.id,
        name,
        portraitId: initialCat.portraitId,
        adoptedAt: clock.now(),
      })
      randomizeHomeActivity()
      await saveGame()
      emit()
    },

    setHomeActivity: (activity: HomeActivity) => {
      homeActivity = activity
      emit()
    },
    randomizeHomeActivity: () => {
      randomizeHomeActivity()
      emit()
    },

    applyEconomyAction,

    collectTreats: async () => {
      if (game.economy.windowsillTreats === 0) return false
      return applyEconomyAction({ type: 'windowsillCollected' })
    },

    addItemToPack: async (
      item: ItemDefinition,
      wishDestinationId?: DestinationId,
    ) => applyEconomyAction({
      type: 'itemAddedToPack',
      catId: activeCatKey(),
      itemId: item.id,
      itemKind: item.kind,
      wishDestinationId: item.kind === 'wish' ? wishDestinationId : undefined,
      capacity: packCapacity,
      packLocked: isPackLocked(),
    }),

    removeItemFromPack: async (item: ItemDefinition) => applyEconomyAction({
      type: 'itemRemovedFromPack',
      catId: activeCatKey(),
      itemId: item.id,
    }),

    /** 供视图预判「装入行囊」是否会被拒（购买去向按钮的禁用态）。 */
    packRejectionFor: (
      state: GameSnapshot,
      item: ItemDefinition,
      wishDestinationId?: DestinationId,
    ): PackItemRejectionReason | undefined => {
      const catId = state.game.activeCatId
        ?? state.game.cats[0]?.id
        ?? initialCat.id
      return getPackItemRejectionReason(state.game.economy, {
        type: 'itemAddedToPack',
        catId,
        itemId: item.id,
        itemKind: item.kind,
        wishDestinationId: item.kind === 'wish' ? wishDestinationId : undefined,
        capacity: packCapacity,
        packLocked: presence(state.game, catId, state.now) === 'traveling',
      })
    },

    purchaseItem: async (item: ItemDefinition) => {
      const result = beginPurchaseChoice({ game, pendingPurchase }, item)
      if (result.status !== 'awaiting-choice') {
        return result.status
      }

      game = result.state.game
      await saveGame()
      pendingPurchase = result.state.pendingPurchase
      emit()
      return result.status
    },

    keepPurchasedItemAtHome: async () => {
      const result = keepPurchasedItemAtHomeFlow({ game, pendingPurchase })
      game = result.state.game
      pendingPurchase = result.state.pendingPurchase
      await saveGame()
      emit()
    },

    packPurchasedItem: async (wishDestinationId?: DestinationId) => {
      const result = confirmPurchasedItemInPack(
        { game, pendingPurchase },
        {
          catId: activeCatKey(),
          capacity: packCapacity,
          packLocked: isPackLocked(),
          wishDestinationId,
        },
      )
      pendingPurchase = result.state.pendingPurchase
      if (result.status === 'packed') {
        const now = clock.now()
        gameNow = now
        game = advanceGame(
          result.state.game,
          result.state.game.economy,
          now,
        )
      } else {
        game = result.state.game
      }
      await saveGame()
      emit()
      return { status: result.status, reason: result.reason }
    },

    switchActiveCat: async (catId: CatId) => {
      const next = selectActiveCat(game, catId)
      if (next === game) return 'unchanged' as const
      game = next
      randomizeHomeActivity()
      await saveGame()
      emit()
      return 'switched' as const
    },

    applyHomeCustomization: async (customization: HomeCustomization) => {
      const next = setHomeCustomization(game, customization)
      if (next === game) return 'unchanged' as const
      game = next
      await saveGame()
      emit()
      return 'applied' as const
    },

    switchPortrait: async (portraitId: PortraitId) => {
      const next = changeCatPortrait(game, {
        catId: activeCatKey(),
        portraitId,
      }, catalog)
      if (next === game) return 'unchanged' as const
      game = next
      await saveGame()
      emit()
      return 'changed' as const
    },

    markAllPostcardsRead: async () => {
      let postcards = game.postcards
      for (const postcard of postcards.received) {
        if (postcard.isRead) continue
        postcards = reducePostcards(postcards, {
          type: 'postcardViewed',
          postcardId: postcard.id,
        })
      }
      if (postcards === game.postcards) return
      game = { ...game, postcards }
      await saveGame()
      emit()
    },

    exportDocument: (): SaveDocument<GameState> => saveStore.export(game),

    /** 导入完整存档；结构 / 版本错误按原样抛出，由视图转成提示。 */
    importDocument: async (raw: unknown) => {
      const imported = await saveStore.import(raw)
      clock.setAcceleration(1)
      clock.setNow(imported.clockNow)
      const now = clock.now()
      const settledEconomy = reduceEconomy(imported.economy, {
        type: 'timePassed',
        now,
      })
      gameNow = now
      game = advanceGame(imported, settledEconomy, now)
      pendingPurchase = null
      await saveGame()
      emit()
    },

    /** 纯函数：给定快照数据推导某只猫的在途状态。 */
    presence,

    /** 供视图访问运行配置（目录、物品、活动小猫键）。 */
    catalog,
    items,
    activeCatKeyOf: (state: GameState) => (
      state.activeCatId ?? state.cats[0]?.id ?? initialCat.id
    ),
  }
}
