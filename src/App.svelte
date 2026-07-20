<script lang="ts">
  import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import {
    reduceEconomy,
    type EconomyAction,
  } from './lib/economy'
  import type { ItemDefinition } from './lib/assets'
  import {
    LANDMARK_SCENES_SHIPPING_ELIGIBLE,
    STARTER_CATALOG,
    STARTER_DESTINATIONS,
  } from './lib/assets/starterCatalog'
  import { STARTER_ITEMS } from './lib/assets/starterItems'
  import {
    adoptCat,
    createInitialGameState,
    isGameState,
    restoreGameState,
    type GameState,
  } from './lib/game'
  import { planItinerary } from './lib/itinerary'
  import { createPlanTrip } from './lib/planTrip'
  import Postcard from './lib/postcards/Postcard.svelte'
  import {
    reducePostcards,
    resolvePostcardComposition,
  } from './lib/postcards'
  import { createIndexedDbSaveStore } from './lib/save'
  import { selectTripContent } from './lib/selection'
  import { createClock } from './lib/time'
  import {
    createSeededRandom,
    createTravelLifecycle,
    type TravelState,
  } from './lib/travel'
  import type { DestinationId } from './lib/ids'

  type DrawerName = 'pack' | 'shop' | 'album'
  const PRIMARY_CAT_ID = 'minho'
  const PACK_CAPACITY = 3
  const HOME_TRAVEL_STATE = { kind: 'home' } as const satisfies TravelState
  const isDevelopment = import.meta.env.DEV
  const canRenderLandmarkScenes = (
    import.meta.env.DEV || LANDMARK_SCENES_SHIPPING_ELIGIBLE
  )
  const homeActivities = {
    sleep: {
      pose: 'sleep',
      alt: '蜷在软垫上睡觉',
      copy: '今天也在窗边睡得很香。',
    },
    play: {
      pose: 'play',
      alt: '抱着毛线球玩',
      copy: '刚才有一团毛线自己滚了过来。',
    },
    eat: {
      pose: 'eat',
      alt: '低头认真吃东西',
      copy: '先把碗里这一点吃完，再看窗外。',
    },
  } as const
  type HomeActivity = keyof typeof homeActivities

  const drawerDetails = {
    pack: {
      title: '行囊',
      eyebrow: '为下一次旅行',
      empty: '还没有放入物品',
      hint: '准备好行囊后，小猫会自己决定何时出发。',
    },
    shop: {
      title: '小铺',
      eyebrow: '今日的小物',
      empty: '小铺正在理货',
      hint: '零食、车票和小玩具很快会摆上架。',
    },
    album: {
      title: '相册',
      eyebrow: '寄回家的风景',
      empty: '第一张明信片还在路上',
      hint: '小猫寄来的明信片和带回的纪念品都会收在这里。',
    },
  } satisfies Record<DrawerName, {
    title: string
    eyebrow: string
    empty: string
    hint: string
  }>

  let activeDrawer = $state<DrawerName | null>(null)
  const clock = createClock()
  const saveStore = createIndexedDbSaveStore<GameState>('bravecat', {
    validateState: isGameState,
    migrations: {
      0: (document) => ({
        ...document,
        schemaVersion: 1,
      }),
      1: (document) => ({
        ...document,
        schemaVersion: 2,
        state: restoreGameState(
          document.state,
          clock.now(),
          STARTER_CATALOG,
        ),
      }),
    },
  })
  const planTrip = createPlanTrip({
    planItinerary,
    selectContent: selectTripContent,
  })
  const travelLifecycle = createTravelLifecycle({
    catalog: STARTER_CATALOG,
    travelerCatId: PRIMARY_CAT_ID,
    portraitId: 'minho',
    destinations: STARTER_DESTINATIONS,
    rhythm: {
      departureDelayMs: [30 * 60 * 1_000, 6 * 60 * 60 * 1_000],
      travelDurationMs: [2 * 60 * 60 * 1_000, 24 * 60 * 60 * 1_000],
      postcardCount: [1, 2],
      secondPostcardChance: 0.3,
    },
    planTrip,
    createSeed: () => {
      const values = new Uint32Array(1)
      crypto.getRandomValues(values)
      return values[0]
    },
    randomFromSeed: createSeededRandom,
  })
  let game = $state(createInitialGameState(clock.now()))
  let gameNow = $state(clock.now())
  let hydrated = $state(false)
  let adoptionName = $state('Minho')
  let adoptionNotice = $state('')
  let homeActivity = $state<HomeActivity>('sleep')
  let activityNotice = $state('')
  let persistenceNotice = $state('')
  let transferNotice = $state('')
  let selectedWishDestinationId = $state<DestinationId>(
    STARTER_DESTINATIONS[0].id,
  )
  const drawer = $derived(activeDrawer ? drawerDetails[activeDrawer] : null)
  const economy = $derived(game.economy)
  const catProfile = $derived(
    game.cats.find(({ id }) => id === PRIMARY_CAT_ID) ?? null,
  )
  const catName = $derived(catProfile?.name ?? 'Minho')
  const activeHomeActivity = $derived(homeActivities[homeActivity])
  const activePortrait = $derived(
    STARTER_CATALOG.portraits.find(
      ({ id }) => id === (catProfile?.portraitId ?? 'minho'),
    ) ?? STARTER_CATALOG.portraits[0],
  )
  const homePortraitSrc = $derived(
    activePortrait.poses[activeHomeActivity.pose],
  )
  const treats = $derived(economy.treats)
  const windowsillTreats = $derived(economy.windowsillTreats)
  const pack = $derived(economy.packs[PRIMARY_CAT_ID] ?? [])
  const travel = $derived(
    game.travelByCat[PRIMARY_CAT_ID] ?? HOME_TRAVEL_STATE,
  )
  const travelPresence = $derived(
    travelLifecycle.getPresence(travel, gameNow),
  )
  const unreadPostcardCount = $derived(
    game.postcards.received.filter(({ isRead }) => !isRead).length,
  )
  const isCatAway = $derived(travelPresence === 'traveling')
  const isPackLocked = $derived(travelPresence === 'traveling')
  const travelStatus = $derived(
    travelPresence === 'waiting'
      ? `${catName}把行囊看了又看，像是在等一个合适的时候。`
      : travelPresence === 'traveling'
        ? `${catName}已经出门了。房间里留着一张字条。`
        : travelPresence === 'returned'
          ? `${catName}已经沿着熟悉的路回到家。`
          : '',
  )
  const availableItems = $derived(STARTER_ITEMS.filter(
    ({ id }) => (economy.ownedItems[id] ?? 0) > 0
      && !pack.some(({ itemId }) => itemId === id),
  ))
  const itemKindLabels = {
    snack: '零食',
    toy: '小玩具',
    wish: '心愿',
  } as const

  const findItem = (itemId: string) => STARTER_ITEMS.find(
    ({ id }) => id === itemId,
  )
  const findDestination = (destinationId?: string) => (
    STARTER_CATALOG.destinations.find(({ id }) => id === destinationId)
  )

  const saveGame = async () => {
    try {
      await saveStore.save($state.snapshot(game))
      persistenceNotice = ''
    } catch {
      persistenceNotice = '这次没能保存，先别关闭页面。'
    }
  }

  const chooseHomeActivity = () => {
    const values = Object.keys(homeActivities) as HomeActivity[]
    const randomValue = new Uint32Array(1)
    crypto.getRandomValues(randomValue)
    homeActivity = values[randomValue[0] % values.length]
  }

  const completeAdoption = async () => {
    try {
      game = adoptCat(game, {
        id: PRIMARY_CAT_ID,
        name: adoptionName,
        portraitId: 'minho',
        adoptedAt: clock.now(),
      })
      adoptionNotice = ''
      chooseHomeActivity()
      await saveGame()
    } catch (error) {
      adoptionNotice = error instanceof Error
        ? error.message
        : '这次没有完成领养，请再试一次。'
    }
  }

  const advanceGame = (
    current: GameState,
    nextEconomy: GameState['economy'],
    now: number,
  ): GameState => {
    const currentTravel = current.travelByCat[PRIMARY_CAT_ID]
      ?? HOME_TRAVEL_STATE
    const nextPack = nextEconomy.packs[PRIMARY_CAT_ID] ?? []
    const nextTravel = travelLifecycle.advance(currentTravel, {
      now,
      pack: nextPack,
      wishDestinationId: nextPack.find(
        ({ kind, wishDestinationId }) => kind === 'wish' && wishDestinationId,
      )?.wishDestinationId,
    })
    const nextPostcards = nextTravel.kind === 'planned'
      ? reducePostcards(current.postcards, {
        type: 'timePassed',
        now,
        tripId: `${PRIMARY_CAT_ID}-${nextTravel.plan.itinerary.departsAt}`,
        itinerary: nextTravel.plan.itinerary,
        content: nextTravel.plan.content,
      })
      : current.postcards
    if (
      nextEconomy === current.economy
      && nextTravel === currentTravel
      && nextPostcards === current.postcards
    ) return current

    return {
      ...current,
      economy: nextEconomy,
      postcards: nextPostcards,
      travelByCat: {
        ...current.travelByCat,
        [PRIMARY_CAT_ID]: nextTravel,
      },
    }
  }

  const openDrawer = async (name: DrawerName) => {
    activeDrawer = name
    if (name !== 'album' || unreadPostcardCount === 0) return

    let postcards = game.postcards
    for (const postcard of postcards.received) {
      if (postcard.isRead) continue
      postcards = reducePostcards(postcards, {
        type: 'postcardViewed',
        postcardId: postcard.id,
      })
    }
    game = { ...game, postcards }
    await saveGame()
  }

  const exportGame = () => {
    const document = saveStore.export($state.snapshot(game))
    const blob = new Blob(
      [JSON.stringify(document, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = `bravecat-save-${new Date(document.exportedAt)
      .toISOString()
      .slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    transferNotice = '完整存档已经导出。'
  }

  const importGame = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    try {
      const imported = await saveStore.import(JSON.parse(await file.text()))
      const now = clock.now()
      const settledEconomy = reduceEconomy(imported.economy, {
        type: 'timePassed',
        now,
      })
      gameNow = now
      game = advanceGame(imported, settledEconomy, now)
      await saveGame()
      transferNotice = '完整存档已经恢复。'
    } catch (error) {
      transferNotice = error instanceof Error
        ? `没有导入：${error.message}`
        : '没有导入：存档文件无法读取。'
    } finally {
      input.value = ''
    }
  }

  const settleGame = async () => {
    if (!hydrated) return

    const now = clock.now()
    gameNow = now
    const settledEconomy = reduceEconomy(game.economy, {
      type: 'timePassed',
      now,
    })
    const next = advanceGame(game, settledEconomy, now)
    if (next === game) {
      if (persistenceNotice) await saveGame()
      return
    }

    game = next
    await saveGame()
  }

  const applyEconomy = async (action: EconomyAction) => {
    const nextEconomy = reduceEconomy(game.economy, action)
    if (nextEconomy === game.economy) return false

    const now = clock.now()
    gameNow = now
    game = advanceGame(game, nextEconomy, now)
    await saveGame()
    return true
  }

  const setTimeAcceleration = async (multiplier: number) => {
    clock.setAcceleration(multiplier)
    activityNotice = multiplier === 1
      ? '开发时钟已恢复为实时。'
      : `开发时钟已切换为 ${multiplier.toLocaleString()} 倍。`
    await settleGame()
  }

  onMount(() => {
    let cancelled = false

    void (async () => {
      try {
        const saved = await saveStore.load()
        if (cancelled) return

        const now = clock.now()
        const restored = restoreGameState(saved, now, STARTER_CATALOG)
        const settledEconomy = reduceEconomy(
          restored.economy,
          { type: 'timePassed', now },
        )
        gameNow = now
        game = advanceGame(restored, settledEconomy, now)
        chooseHomeActivity()
        hydrated = true
        await saveGame()
      } catch {
        if (!cancelled) {
          hydrated = true
          persistenceNotice = '没有读到上次的家，暂时从这里开始。'
        }
      }
    })()

    const interval = window.setInterval(() => {
      void settleGame()
    }, isDevelopment ? 250 : 60_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  })

  const collectTreats = async () => {
    if (windowsillTreats === 0) return

    await applyEconomy({
      type: 'windowsillCollected',
    })
    activityNotice = `窗台空了。${catName}好像听见了小鱼干的声音。`
  }

  const purchaseItem = async (item: ItemDefinition) => {
    const purchased = await applyEconomy({
      type: 'itemPurchased',
      itemId: item.id,
      price: item.price,
    })
    activityNotice = purchased
      ? `${item.name}已经收进家里。`
      : `还差一些小鱼干，先看看别的吧。`
  }

  const addItemToPack = async (item: ItemDefinition) => {
    const added = await applyEconomy({
      type: 'itemAddedToPack',
      catId: PRIMARY_CAT_ID,
      itemId: item.id,
      itemKind: item.kind,
      wishDestinationId: item.kind === 'wish'
        ? selectedWishDestinationId
        : undefined,
      capacity: PACK_CAPACITY,
    })
    activityNotice = added
      ? `${item.name}已经放进行囊。`
      : '行囊没有变化。'
  }

  const removeItemFromPack = async (item: ItemDefinition) => {
    const removed = await applyEconomy({
      type: 'itemRemovedFromPack',
      catId: PRIMARY_CAT_ID,
      itemId: item.id,
    })
    if (removed) activityNotice = `${item.name}已经放回家里。`
  }
</script>

<svelte:head>
  <title>{unreadPostcardCount > 0 ? `(${unreadPostcardCount}) 咪游记` : '咪游记'}</title>
  <meta
    name="description"
    content="为小猫备好行囊，等它从远方寄回一张明信片。"
  />
  <meta name="theme-color" content="#879b70" />
</svelte:head>

{#if !hydrated}
  <main class="adoption-shell loading" aria-label="正在打开小猫的家">
    <p class="brand-kicker">BraveCat</p>
    <h1>咪游记</h1>
    <p>正在把家里的东西摆回原位……</p>
  </main>
{:else if !catProfile}
  <main class="adoption-shell" aria-labelledby="adoption-title">
    <div class="adoption-heading">
      <p class="brand-kicker">BraveCat · 初次见面</p>
      <h1 id="adoption-title">让它住进家里</h1>
      <p>这是根据你提供的照片完成并通过验收的唯一形象。</p>
    </div>

    <form
      class="adoption-card"
      onsubmit={(event) => {
        event.preventDefault()
        void completeAdoption()
      }}
    >
      <div class="adoption-portrait">
        <img
          src="/portraits/minho/portrait--minho--sit--v01.png"
          alt="等待领养的 Minho 坐姿形象"
        />
        <span>已批准 · 六姿势完整</span>
      </div>

      <label class="adoption-name">
        <span>给小猫取一个名字</span>
        <input
          bind:value={adoptionName}
          maxlength="12"
          autocomplete="off"
          required
          aria-describedby="adoption-hint"
        />
      </label>
      <p id="adoption-hint">
        名字以后仍属于同一只小猫，不会因为更换形象而丢失进度。
      </p>
      {#if adoptionNotice}
        <p class="adoption-error" role="alert">{adoptionNotice}</p>
      {/if}
      <button type="submit">让它住进家里</button>
    </form>
  </main>
{:else}
<div class="app-shell">
  <header class="topbar">
    <div>
      <p class="brand-kicker">BraveCat</p>
      <h1>咪游记</h1>
    </div>
    <div class="treat-balance" aria-label={`共有 ${treats} 条小鱼干`}>
      <span aria-hidden="true">🐟</span>
      <strong>{treats}</strong>
    </div>
  </header>

  {#if isDevelopment}
    <aside class="developer-clock" aria-label="开发时间加速">
      <span>开发时钟</span>
      <button type="button" onclick={() => setTimeAcceleration(1)}>实时</button>
      <button type="button" onclick={() => setTimeAcceleration(3_600)}>
        1 小时/秒
      </button>
      <button type="button" onclick={() => setTimeAcceleration(86_400)}>
        1 天/秒
      </button>
    </aside>
  {/if}

  <main>
    <section class="room" aria-label={`${catName}的家`}>
      <div class="sunwash" aria-hidden="true"></div>

      <div class="window" aria-label="窗外是安静的山野">
        <div class="window-sky"></div>
        <div class="window-hill hill-back"></div>
        <div class="window-hill hill-front"></div>
        <div class="window-frame window-frame-vertical"></div>
        <div class="window-frame window-frame-horizontal"></div>
        <button
          class="windowsill"
          type="button"
          onclick={collectTreats}
          disabled={windowsillTreats === 0}
          aria-label={windowsillTreats > 0
            ? `收取窗台上的 ${windowsillTreats} 条小鱼干`
            : '窗台上的小鱼干已经收取'}
        >
          <span class="fish-plate" aria-hidden="true">
            <span>🐟</span>
            <span>🐟</span>
          </span>
          <span class="collect-label">
            {windowsillTreats > 0 ? `收取 +${windowsillTreats}` : '晚点再来'}
          </span>
        </button>
      </div>

      <div class="wall-note" aria-hidden="true">
        <span>慢</span>
        <span>慢</span>
        <span>走</span>
      </div>

      <div class="side-table" aria-hidden="true">
        <div class="vase">
          <i></i>
          <i></i>
          <i></i>
        </div>
        <div class="table-top"></div>
        <div class="table-body">
          <span></span>
        </div>
        <div class="table-leg left"></div>
        <div class="table-leg right"></div>
      </div>

      {#if isCatAway && travel.kind === 'planned'}
        <article class="departure-note" aria-label={`${catName}留下的字条`}>
          <span>留给家里</span>
          <p>{travel.note}</p>
          <small>— {catName}</small>
        </article>
      {:else}
        <div class="cat-stage">
          <img
            class="cat-portrait"
            src={homePortraitSrc}
            alt={`${catName}${activeHomeActivity.alt}`}
          />
          <div class="cushion" aria-hidden="true"></div>
        </div>
      {/if}

      <div class="room-copy">
        <p class="cat-name">{catName}</p>
        <p>
          {travelPresence === 'waiting'
            ? '我还在听风。什么时候走，由我来决定。'
            : travelPresence === 'traveling'
              ? '这会儿不在家。'
              : travelPresence === 'returned'
                ? '我回来了，先在熟悉的垫子上歇一会儿。'
                : activeHomeActivity.copy}
        </p>
      </div>
    </section>

    <nav class="home-nav" aria-label="家里的去处">
      <button type="button" onclick={() => void openDrawer('pack')}>
        <span class="nav-icon" aria-hidden="true">包</span>
        <span>行囊</span>
      </button>
      <button type="button" onclick={() => void openDrawer('shop')}>
        <span class="nav-icon" aria-hidden="true">铺</span>
        <span>小铺</span>
      </button>
      <button type="button" onclick={() => void openDrawer('album')}>
        <span class="nav-icon" aria-hidden="true">册</span>
        <span>相册</span>
        {#if unreadPostcardCount > 0}
          <span class="unread-badge" aria-label={`${unreadPostcardCount} 张未读明信片`}>
            {unreadPostcardCount}
          </span>
        {/if}
      </button>
    </nav>
  </main>

  <p class="status-line" aria-live="polite">
    {persistenceNotice
      || transferNotice
      || travelStatus
      || (unreadPostcardCount > 0
        ? `有 ${unreadPostcardCount} 张新明信片寄到了。`
        : '')
      || activityNotice
      || '屋里很安静，风从窗外吹进来。'}
  </p>
</div>

{#if drawer}
  <button
    class="drawer-backdrop"
    type="button"
    aria-label={`关闭${drawer.title}`}
    onclick={() => activeDrawer = null}
    transition:fade={{ duration: 140 }}
  ></button>
  <dialog
    open
    class="drawer"
    aria-labelledby="drawer-title"
    transition:fly={{ y: 72, duration: 220 }}
  >
    <div class="drawer-handle" aria-hidden="true"></div>
    <header>
      <div>
        <p>{drawer.eyebrow}</p>
        <h2 id="drawer-title">{drawer.title}</h2>
      </div>
      <button
        class="drawer-close"
        type="button"
        aria-label={`关闭${drawer.title}`}
        onclick={() => activeDrawer = null}
      >×</button>
    </header>
    {#if activeDrawer === 'shop'}
      <div class="drawer-content">
        <p class="drawer-intro">基础物品一直都在，不用赶时间。</p>
        <ul class="item-list" aria-label="小铺物品">
          {#each STARTER_ITEMS as item}
            <li class="item-card">
              <span class="item-token" aria-hidden="true">
                {item.name.slice(0, 1)}
              </span>
              <div class="item-copy">
                <div class="item-title">
                  <h3>{item.name}</h3>
                  <span>{itemKindLabels[item.kind]}</span>
                </div>
                <p>{item.effectHint}</p>
                <small>家里有 {economy.ownedItems[item.id] ?? 0} 件</small>
              </div>
              <button
                class="item-action"
                type="button"
                disabled={treats < item.price}
                aria-label={`购买${item.name}，需要 ${item.price} 条小鱼干`}
                onclick={() => purchaseItem(item)}
              >
                {treats >= item.price
                  ? `${item.price} 🐟`
                  : `还差 ${item.price - treats}`}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {:else if activeDrawer === 'pack'}
      <div class="drawer-content">
        <div class="pack-summary">
          <div>
            <strong>{pack.length} / {PACK_CAPACITY}</strong>
            <span>行囊格数</span>
          </div>
          <p>
            {travelPresence === 'waiting'
              ? '已经准备好了。还可以调整，但不能命令它立刻出发。'
              : travelPresence === 'traveling'
                ? '这些物品正在旅途中，回来前不能调整。'
                : '放入第一件物品后，小猫会自己等待合适的出发时机。'}
          </p>
        </div>

        <section class="pack-section" aria-labelledby="packed-title">
          <h3 id="packed-title">已经放好</h3>
          {#if pack.length > 0}
            <ul class="item-list compact">
              {#each pack as packedItem}
                {@const item = findItem(packedItem.itemId)}
                {#if item}
                  <li class="item-card">
                    <span class="item-token" aria-hidden="true">
                      {item.name.slice(0, 1)}
                    </span>
                    <div class="item-copy">
                      <div class="item-title">
                        <h3>{item.name}</h3>
                        <span>{itemKindLabels[item.kind]}</span>
                      </div>
                      <p>{item.effectHint}</p>
                      {#if packedItem.wishDestinationId}
                        <small>
                          心愿地：
                          {findDestination(packedItem.wishDestinationId)?.name}
                        </small>
                      {/if}
                    </div>
                    <button
                      class="item-action secondary"
                      type="button"
                      disabled={isPackLocked}
                      onclick={() => removeItemFromPack(item)}
                    >取出</button>
                  </li>
                {/if}
              {/each}
            </ul>
          {:else}
            <p class="section-empty">还没有放入物品。</p>
          {/if}
        </section>

        <section class="pack-section" aria-labelledby="available-title">
          <h3 id="available-title">家里可用</h3>
          {#if availableItems.length > 0}
            <ul class="item-list compact">
              {#each availableItems as item}
                <li class="item-card">
                  <span class="item-token" aria-hidden="true">
                    {item.name.slice(0, 1)}
                  </span>
                  <div class="item-copy">
                    <div class="item-title">
                      <h3>{item.name}</h3>
                      <span>有 {economy.ownedItems[item.id] ?? 0}</span>
                    </div>
                    <p>{item.effectHint}</p>
                    {#if item.kind === 'wish'}
                      <label class="wish-select">
                        <span>心愿地</span>
                        <select bind:value={selectedWishDestinationId}>
                          {#each STARTER_CATALOG.destinations as destination}
                            <option value={destination.id}>
                              {destination.name}
                            </option>
                          {/each}
                        </select>
                      </label>
                    {/if}
                  </div>
                  <button
                    class="item-action"
                    type="button"
                    disabled={pack.length >= PACK_CAPACITY || isPackLocked}
                    onclick={() => addItemToPack(item)}
                  >放入</button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="section-empty">先去小铺挑一件小物吧。</p>
          {/if}
        </section>
      </div>
    {:else if activeDrawer === 'album'}
      <div class="drawer-content album-content">
        {#if game.postcards.received.length > 0}
          <p class="drawer-intro">已经寄到家的明信片会一直留在这里。</p>
          <ul class="postcard-list" aria-label="收到的明信片">
            {#each game.postcards.received as postcard}
              {@const composition = resolvePostcardComposition(
                STARTER_CATALOG,
                postcard,
              )}
              <li>
                <Postcard
                  {composition}
                  destinationName={findDestination(postcard.destinationId)?.name ?? '远方'}
                  renderScene={canRenderLandmarkScenes}
                />
              </li>
            {/each}
          </ul>
        {:else}
          <div class="empty-state">
            <span aria-hidden="true">· · ·</span>
            <h3>{drawer.empty}</h3>
            <p>{drawer.hint}</p>
          </div>
        {/if}

        <section class="save-transfer" aria-labelledby="save-transfer-title">
          <div>
            <h3 id="save-transfer-title">带走这个家</h3>
            <p>导出会包含小猫、行囊、旅行、相册和未读状态。</p>
          </div>
          <div class="save-transfer-actions">
            <button type="button" onclick={exportGame}>导出存档</button>
            <label>
              <span>导入存档</span>
              <input
                type="file"
                accept="application/json,.json"
                onchange={importGame}
              />
            </label>
          </div>
          {#if transferNotice}
            <p class="transfer-notice" aria-live="polite">{transferNotice}</p>
          {/if}
        </section>
      </div>
    {:else}
      <div class="empty-state">
        <span aria-hidden="true">· · ·</span>
        <h3>{drawer.empty}</h3>
        <p>{drawer.hint}</p>
      </div>
    {/if}
  </dialog>
{/if}
{/if}
