<script lang="ts">
  import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import type { PackItemRejectionReason } from '@bravecat/core/economy'
  import type { ItemDefinition } from '@bravecat/core/assets'
  import {
    LANDMARK_SCENES_SHIPPING_ELIGIBLE,
    PRODUCTION_STARTER_CATALOG,
    STARTER_CATALOG,
  } from '@bravecat/core/assets/starterCatalog'
  import { STARTER_ITEMS } from '@bravecat/core/assets/starterItems'
  import {
    drawerArt,
    HOME_ACTIVITY_LABELS,
    homeActivityOverrideFor,
    homeTimeFor,
    nextHomeActivity,
    packItemStyle,
    souvenirDisplayKindFor,
    type HomeActivity,
  } from './lib/homeArt'
  import {
    HOME_THEME_PRESETS,
    listCompatiblePieces,
    listHomeFinishes,
    listHomeForms,
    resolveHomeScene,
    type HomeCustomization,
  } from '@bravecat/core/homeTheme'
  import HomeThemePicker from './lib/HomeThemePicker.svelte'
  // dev-only 家主题配置器，生产构建不会挂载。
  import ThemeLab from './lib/ThemeLab.svelte'
  import { createGameController, resolveAssetUrl } from '@bravecat/core'
  import type { GameState } from '@bravecat/core/game'
  import Postcard from './lib/Postcard.svelte'
  import {
    createPostcardPng,
    postcardFileName,
    resolvePostcardComposition,
    shareOrDownloadPostcard,
  } from '@bravecat/core/postcards'
  import { createIndexedDbSaveStore } from '@bravecat/core/save'
  import type { DestinationId, PortraitId } from '@bravecat/core/ids'
  import type { TravelState } from '@bravecat/core/travel'
  import { bridgeGameController } from './lib/gameClient.svelte'
  import {
    downloadBlob,
    installWebAssetResolver,
    saveTransferPort,
    sharePort,
    webPostcardCanvas,
    webRandom,
  } from './lib/platform/ports'
  // PROTOTYPE — 右退深墙面原型，验证后随 wallLayoutPrototype.ts 一起删除。
  import WallLayoutPrototype from './lib/WallLayoutPrototype.svelte'
  import { wallPrototypeVariantKeyFor } from './lib/wallLayoutPrototype'

  type DrawerName = 'pack' | 'shop' | 'album'
  type AlbumView = 'postcards' | 'souvenirs'
  type ShopCategory = ItemDefinition['kind']
  type AlbumDetail = {
    kind: AlbumView
    id: string
  } | null
  const HOME_TRAVEL_STATE = { kind: 'home' } as const satisfies TravelState
  const isDevelopment = import.meta.env.DEV
  const readHomeActivityOverride = () => homeActivityOverrideFor(
    isDevelopment,
    globalThis.location?.search ?? '',
  )
  // PROTOTYPE — dev 环境 ?wallProto=p|g 时替换底图与正式明信片墙。
  const wallPrototypeVariantKey = wallPrototypeVariantKeyFor(
    isDevelopment,
    globalThis.location?.search ?? '',
  )
  // dev 环境 ?themeLab 打开家主题配置器；只覆盖内存选择，不写存档。
  // ?themeLab=<presetId> 直接预选主题；?themePieces=socket:piece,…
  // 在预设之上覆盖单个部件，供截图与 QA 复现。
  const themeLabSearch = new URLSearchParams(
    isDevelopment ? globalThis.location?.search ?? '' : '',
  )
  const themeLabParam = themeLabSearch.get('themeLab')
  const themeLabEnabled = themeLabParam !== null
  const themeLabInitialPreset = HOME_THEME_PRESETS.find(
    ({ id }) => id === themeLabParam,
  )
  const themeLabPieceOverrides = Object.fromEntries(
    (themeLabSearch.get('themePieces') ?? '')
      .split(',')
      .map((entry) => entry.split(':'))
      .filter((pair): pair is [string, string] => (
        pair.length === 2 && pair.every(Boolean)
      )),
  )
  let themeLabSelection = $state<HomeCustomization | null>(
    themeLabInitialPreset
      ? {
        presetId: themeLabInitialPreset.id,
        formId: themeLabInitialPreset.formId,
        finishId: themeLabSearch.get('themeFinish')
          ?? themeLabInitialPreset.finishId,
        pieces: { ...themeLabInitialPreset.pieces, ...themeLabPieceOverrides },
      }
      : null,
  )
  let wallPerspectiveBackground = $state<string | null>(null)
  onMount(() => {
    if (!import.meta.env.DEV || !wallPrototypeVariantKey) return
    void import(
      '../../../docs/art/candidates/home-wall-prototype/2026-08-13-right-recede/interior-foreground--right-recede--candidate-v03.png?url'
    ).then(({ default: src }) => {
      wallPerspectiveBackground = src
    })
  })
  const canRenderLandmarkScenes = (
    import.meta.env.DEV || LANDMARK_SCENES_SHIPPING_ELIGIBLE
  )
  const switchablePortraits = STARTER_CATALOG.portraits.filter(
    ({ id }) => PRODUCTION_STARTER_CATALOG.portraits.some(
      (portrait) => portrait.id === id,
    ),
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
    gaze: {
      pose: 'gaze',
      alt: '坐在窗台上看窗外',
      copy: '坐上窗台以后，远处的风景可以看很久。',
    },
  } as const

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
  let albumView = $state<AlbumView>('postcards')
  let albumDetail = $state<AlbumDetail>(null)
  let shopCategory = $state<ShopCategory>('snack')

  // web 端资产走相对根路径（恒等解析），行为与端口引入前一致。
  installWebAssetResolver()
  // 模板里直接引用素材目录路径时统一走 AssetResolver。
  const asset = resolveAssetUrl
  // 平台端口注入：IndexedDB 存档、crypto 随机源；编排逻辑都在 core。
  const controller = createGameController({
    createSaveStore: (options) => createIndexedDbSaveStore('bravecat', options),
    random: webRandom,
  }, {
    homeActivityOverride: readHomeActivityOverride,
    homeActivityPool: () => (
      (Object.keys(homeActivities) as HomeActivity[]).filter(
        (activity) => showHomeArtPreview || activity !== 'gaze',
      )
    ),
  })
  const client = bridgeGameController(controller)
  const PACK_CAPACITY = controller.packCapacity

  let adoptionName = $state('Minho')
  let adoptionNotice = $state('')
  let hydrateNotice = $state('')
  let activityNotice = $state('')
  let transferNotice = $state('')
  let postcardExportNotice = $state('')
  let postcardExportBusy = $state(false)
  let developmentGrantAmount = $state(24)
  let purchaseFlowBusy = $state(false)
  let shopNotice = $state('')
  let portraitChoicesOpen = $state(false)
  let themeChoicesOpen = $state(false)
  let selectedWishDestinationId = $state<DestinationId>(
    controller.catalog.destinations[0].id,
  )
  const game = $derived(client.snapshot.game)
  const gameNow = $derived(client.snapshot.now)
  const hydrated = $derived(client.snapshot.hydrated)
  const homeActivity = $derived(client.snapshot.homeActivity)
  const pendingPurchase = $derived(client.snapshot.pendingPurchase)
  const persistenceNotice = $derived(
    client.snapshot.saveFailed ? '这次没能保存，先别关闭页面。' : hydrateNotice,
  )
  const drawer = $derived(activeDrawer ? drawerDetails[activeDrawer] : null)
  const economy = $derived(game.economy)
  const activeCatId = $derived(
    game.activeCatId ?? game.cats[0]?.id ?? null,
  )
  const activeCatKey = $derived(controller.activeCatKeyOf(game))
  const catProfile = $derived(
    game.cats.find(({ id }) => id === activeCatId) ?? null,
  )
  const catName = $derived(catProfile?.name ?? 'Minho')
  const activeHomeActivity = $derived(homeActivities[homeActivity])
  const activePortrait = $derived(
    STARTER_CATALOG.portraits.find(
      ({ id }) => id === (catProfile?.portraitId ?? 'minho'),
    ) ?? STARTER_CATALOG.portraits[0],
  )
  const homePortraitSrc = $derived(
    resolveAssetUrl(activePortrait.poses[activeHomeActivity.pose]),
  )
  const homeTime = $derived(homeTimeFor(new Date(gameNow)))
  const homeScene = $derived(resolveHomeScene(
    themeLabSelection ?? game.homeCustomization,
    {
      time: homeTime,
      activity: homeActivity,
      portraitId: activePortrait.id,
    },
  ))
  const showHomeArtPreview = $derived(
    isDevelopment && !homeScene.shippingEligible,
  )
  // 有多于一个可选主题/风格/部件才展示「布置家」；生产环境按放行过滤。
  const themeChoicesAvailable = $derived.by(() => {
    const eligiblePresets = HOME_THEME_PRESETS.filter(({ formId }) => (
      isDevelopment
      || listHomeForms().find(({ id }) => id === formId)?.shippingEligible
    ))
    if (eligiblePresets.length > 1) return true
    if (listHomeFinishes(homeScene.formId).length > 1) return true
    return homeScene.pieces.some(({ socketId }) => (
      listCompatiblePieces(homeScene.formId, socketId)
        .filter((piece) => isDevelopment || piece.shippingEligible)
        .length > 1
    ))
  })
  const homeBackdropLayers = $derived(homeScene.backdrop.map((layer) => (
    layer.id === 'shell' && wallPrototypeVariantKey && wallPerspectiveBackground
      ? { ...layer, src: wallPerspectiveBackground }
      : layer
  )))
  const treats = $derived(economy.treats)
  const windowsillTreats = $derived(economy.windowsillTreats)
  const pack = $derived(economy.packs[activeCatKey] ?? [])
  const travel = $derived(
    game.travelByCat[activeCatKey] ?? HOME_TRAVEL_STATE,
  )
  const travelPresence = $derived(
    controller.presence(game, activeCatKey, gameNow),
  )
  const currentTripId = $derived(
    travel.kind === 'planned'
      ? `${activeCatKey}-${travel.plan.itinerary.departsAt}`
      : null,
  )
  const currentTripSouvenirCount = $derived(
    currentTripId
      ? game.souvenirs.received.filter(
        ({ tripId }) => tripId === currentTripId,
      ).length
      : 0,
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
          ? currentTripSouvenirCount > 0
            ? `${catName}回家了，还带回 ${currentTripSouvenirCount} 件纪念品。`
            : `${catName}已经沿着熟悉的路回到家。`
          : '',
  )
  const availableItems = $derived(STARTER_ITEMS.filter(
    ({ id }) => (economy.ownedItems[id] ?? 0) > 0,
  ))
  const shopItems = $derived(STARTER_ITEMS.filter(
    ({ kind }) => kind === shopCategory,
  ))
  const postcardsByPostmark = $derived(
    [...game.postcards.received].sort((left, right) => (
      right.revealAt - left.revealAt
    )),
  )
  const souvenirsByReturn = $derived(
    [...game.souvenirs.received].sort((left, right) => (
      right.revealedAt - left.revealedAt
    )),
  )
  const displayedVisitedPlaces = $derived.by(() => {
    const seenDestinationIds = new Set<string>()

    return postcardsByPostmark.filter((postcard) => {
      if (seenDestinationIds.has(postcard.destinationId)) return false
      seenDestinationIds.add(postcard.destinationId)
      return true
    }).slice(0, 6)
  })
  const displayedSouvenirs = $derived.by(() => {
    const seenSouvenirIds = new Set<string>()

    return souvenirsByReturn.filter((souvenir) => {
      if (seenSouvenirIds.has(souvenir.souvenirId)) return false
      seenSouvenirIds.add(souvenir.souvenirId)
      return true
    }).slice(0, 3)
  })
  const itemKindLabels = {
    snack: '零食',
    toy: '小玩具',
    wish: '心愿',
  } as const

  const findItem = (itemId: string) => STARTER_ITEMS.find(
    ({ id }) => id === itemId,
  )
  const pendingPurchaseItem = $derived(
    pendingPurchase ? findItem(pendingPurchase.itemId) ?? null : null,
  )
  const pendingPurchasePackRejection = $derived(
    pendingPurchaseItem
      ? controller.packRejectionFor(
        client.snapshot,
        pendingPurchaseItem,
        pendingPurchaseItem.kind === 'wish'
          ? selectedWishDestinationId
          : undefined,
      )
      : undefined,
  )
  const findDestination = (destinationId?: string) => (
    STARTER_CATALOG.destinations.find(({ id }) => id === destinationId)
  )
  // PROTOTYPE — 供画框布局原型使用的真实明信片数据。
  const wallPrototypePostcards = $derived(
    wallPrototypeVariantKey
      ? displayedVisitedPlaces.map((postcard) => ({
        id: postcard.id,
        sceneSrc: resolvePostcardComposition(STARTER_CATALOG, postcard).scene.src,
        name: findDestination(postcard.destinationId)?.name ?? '远方',
      }))
      : [],
  )
  const findSouvenir = (souvenirId: string) => (
    STARTER_CATALOG.souvenirs.find(({ id }) => id === souvenirId)
  )
  const selectedPostcard = $derived.by(() => {
    const detail = albumDetail
    return detail?.kind === 'postcards'
      ? postcardsByPostmark.find(({ id }) => id === detail.id) ?? null
      : null
  })
  const selectedSouvenir = $derived.by(() => {
    const detail = albumDetail
    return detail?.kind === 'souvenirs'
      ? souvenirsByReturn.find(({ id }) => id === detail.id) ?? null
      : null
  })
  const describePackRejection = (
    reason: PackItemRejectionReason | undefined,
    itemName: string,
  ) => {
    switch (reason) {
      case 'pack-locked':
        return `${catName}正在旅行，${itemName}先留在家里。`
      case 'capacity-reached':
        return `行囊已经满了，${itemName}先留在家里。`
      case 'duplicate-item':
        return `行囊里已经有${itemName}了，新买的这件先留在家里。`
      case 'wish-already-packed':
        return `行囊里已经有一张心愿车票，${itemName}先留在家里。`
      case 'wish-destination-required':
        return `还没有选好心愿地，${itemName}先留在家里。`
      case 'item-not-owned':
        return `家里没有找到${itemName}，行囊没有变化。`
      default:
        return `${itemName}没有放进行囊，已经留在家里。`
    }
  }
  const announceShopOutcome = (message: string) => {
    shopNotice = message
    activityNotice = message
  }

  const cycleHomeActivity = () => {
    const nextActivity = nextHomeActivity(homeActivity)
    controller.setHomeActivity(nextActivity)
    const url = new URL(window.location.href)
    url.searchParams.set('homeActivity', nextActivity)
    window.history.replaceState(window.history.state, '', url)
  }

  const completeAdoption = async () => {
    try {
      await controller.adopt(adoptionName)
      adoptionNotice = ''
      hydrateNotice = ''
    } catch (error) {
      adoptionNotice = error instanceof Error
        ? error.message
        : '这次没有完成领养，请再试一次。'
    }
  }

  const openDrawer = async (name: DrawerName) => {
    activeDrawer = name
    if (name !== 'album') albumDetail = null
    if (name !== 'album' || unreadPostcardCount === 0) return

    await controller.markAllPostcardsRead()
  }

  const openAlbumDetail = async (
    detail: Exclude<AlbumDetail, null>,
  ) => {
    albumView = detail.kind
    albumDetail = detail
    postcardExportNotice = ''
    await openDrawer('album')
  }

  const openAlbum = () => {
    albumDetail = null
    void openDrawer('album')
  }

  const exportGame = async () => {
    const document = controller.exportDocument()
    const json = JSON.stringify(document, null, 2)
    const fileName = `bravecat-save-${new Date(document.exportedAt)
      .toISOString()
      .slice(0, 10)}.json`

    // 原生壳里锚点下载不可用，改走缓存文件 + 系统分享面板。
    if (saveTransferPort) {
      try {
        const result = await saveTransferPort.exportSave(json, fileName)
        transferNotice = result === 'shared'
          ? '完整存档已经导出。'
          : '这次没有分享，存档没有导出。'
      } catch {
        transferNotice = '这次没能导出存档，请稍后再试。'
      }
      return
    }

    downloadBlob(new Blob([json], { type: 'application/json' }), fileName)
    transferNotice = '完整存档已经导出。'
  }

  const exportSelectedPostcard = async () => {
    if (!selectedPostcard || postcardExportBusy) return
    if (!canRenderLandmarkScenes) {
      postcardExportNotice = '场景仍在发布审核中，暂时不能导出。'
      return
    }

    postcardExportBusy = true
    postcardExportNotice = '正在把明信片铺平……'
    try {
      const destinationName = findDestination(
        selectedPostcard.destinationId,
      )?.name ?? '远方'
      const composition = resolvePostcardComposition(
        STARTER_CATALOG,
        selectedPostcard,
      )
      const blob = await createPostcardPng(
        composition,
        destinationName,
        webPostcardCanvas,
      )
      const result = await shareOrDownloadPostcard(
        blob,
        postcardFileName(destinationName, composition.postmarkDate),
        sharePort,
      )
      postcardExportNotice = result === 'shared'
        ? '明信片已经交给系统分享。'
        : result === 'downloaded'
          ? '设备不支持文件分享，明信片已保存为 PNG。'
          : '这次没有分享，明信片仍好好留在相册里。'
    } catch {
      postcardExportNotice = '这次没能保存明信片，请稍后再试。'
    } finally {
      postcardExportBusy = false
    }
  }

  const importGame = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    try {
      await controller.importDocument(JSON.parse(await file.text()))
      shopNotice = ''
      transferNotice = '完整存档已经恢复。'
    } catch (error) {
      transferNotice = error instanceof Error
        ? `没有导入：${error.message}`
        : '没有导入：存档文件无法读取。'
    } finally {
      input.value = ''
    }
  }

  // 原生壳里 <input type=file> 不可用，改走系统文件选择器；
  // 校验与迁移仍是 controller.importDocument 里 core 的那条链。
  const importGameFromPicker = async () => {
    if (!saveTransferPort) return

    try {
      const text = await saveTransferPort.pickSaveFile()
      if (text === null) return
      await controller.importDocument(JSON.parse(text))
      shopNotice = ''
      transferNotice = '完整存档已经恢复。'
    } catch (error) {
      transferNotice = error instanceof Error
        ? `没有导入：${error.message}`
        : '没有导入：存档文件无法读取。'
    }
  }

  const settleGame = async () => {
    const { returnedCats } = await controller.settle()
    if (returnedCats.length === 0) return

    if (returnedCats.length === 1) {
      const returnedCat = returnedCats[0]
      activityNotice = returnedCat.souvenirCount > 0
        ? `${returnedCat.name}回家了，还带回 ${returnedCat.souvenirCount} 件纪念品。`
        : `${returnedCat.name}回家了，正在熟悉的垫子上休息。`
    } else {
      activityNotice = `${returnedCats.length} 只小猫先后回家了。`
    }
  }

  const setTimeAcceleration = async (multiplier: number) => {
    controller.setTimeAcceleration(multiplier)
    activityNotice = multiplier === 1
      ? '开发时钟已恢复为实时。'
      : `开发时钟已切换为 ${multiplier.toLocaleString()} 倍。`
    await settleGame()
  }

  const grantDevelopmentTreats = async () => {
    if (
      !Number.isInteger(developmentGrantAmount)
      || developmentGrantAmount <= 0
    ) {
      activityNotice = '补给数量需要是大于零的整数。'
      return
    }

    const granted = await controller.applyEconomyAction({
      type: 'treatsGranted',
      amount: developmentGrantAmount,
    })
    if (granted) {
      activityNotice = `测试补给已经加入：+${developmentGrantAmount} 条小鱼干。`
    }
  }

  onMount(() => {
    void controller.hydrate().then(({ loadFailed }) => {
      if (loadFailed) {
        hydrateNotice = '没有读到上次的家，暂时从这里开始。'
      }
    })

    const interval = window.setInterval(() => {
      void settleGame()
    }, isDevelopment ? 250 : 60_000)

    return () => {
      window.clearInterval(interval)
    }
  })

  const collectTreats = async () => {
    if (windowsillTreats === 0) return

    await controller.collectTreats()
    activityNotice = `窗台空了。${catName}好像听见了小鱼干的声音。`
  }

  const describeCatPresence = (cat: GameState['cats'][number]) => {
    const presence = controller.presence(game, cat.id, gameNow)
    return presence === 'traveling'
      ? '在路上'
      : presence === 'waiting'
        ? '在准备'
        : presence === 'returned'
          ? '刚回来'
          : '在家'
  }

  const switchActiveCat = async (catId: string) => {
    try {
      const result = await controller.switchActiveCat(catId)
      if (result === 'unchanged') return
      portraitChoicesOpen = false
    } catch (error) {
      activityNotice = error instanceof Error
        ? error.message
        : '这次没能找到这只小猫。'
    }
  }

  const applyHomeCustomization = async (
    customization: HomeCustomization,
  ) => {
    try {
      const result = await controller.applyHomeCustomization(customization)
      if (result === 'unchanged') return
      activityNotice = '家换上了新的布置。'
    } catch (error) {
      activityNotice = error instanceof Error
        ? error.message
        : '这次没能换上新的布置。'
    }
  }

  const switchPortrait = async (portraitId: PortraitId) => {
    try {
      const result = await controller.switchPortrait(portraitId)
      portraitChoicesOpen = false
      if (result === 'unchanged') return

      const portraitName = STARTER_CATALOG.portraits.find(
        ({ id }) => id === portraitId,
      )?.name ?? '新形象'
      activityNotice = travel.kind === 'planned'
        ? `${catName}换好了${portraitName}形象；已出发的旅行仍保留原来的样子。`
        : `${catName}已经换好${portraitName}形象。`
    } catch (error) {
      activityNotice = error instanceof Error
        ? error.message
        : '这次没能更换形象。'
    }
  }

  const purchaseItem = async (item: ItemDefinition) => {
    if (purchaseFlowBusy) return
    if (pendingPurchase) {
      announceShopOutcome('先决定刚买下的物品放在哪里吧。')
      return
    }

    purchaseFlowBusy = true
    try {
      shopNotice = ''
      const status = await controller.purchaseItem(item)
      if (status !== 'awaiting-choice') {
        announceShopOutcome(status === 'purchase-rejected'
          ? '还差一些小鱼干，先看看别的吧。'
          : '先决定刚买下的物品放在哪里吧。')
        return
      }

      activityNotice = `${item.name}已经买下。选一个去处吧。`
    } finally {
      purchaseFlowBusy = false
    }
  }

  const leavePurchasedItemAtHome = async () => {
    if (purchaseFlowBusy || !pendingPurchaseItem) return

    purchaseFlowBusy = true
    try {
      const itemName = pendingPurchaseItem.name
      await controller.keepPurchasedItemAtHome()
      announceShopOutcome(`${itemName}已经留在家里。`)
    } finally {
      purchaseFlowBusy = false
    }
  }

  const packPurchasedItem = async () => {
    if (purchaseFlowBusy || !pendingPurchaseItem) return

    purchaseFlowBusy = true
    try {
      const item = pendingPurchaseItem
      const result = await controller.packPurchasedItem(
        item.kind === 'wish' ? selectedWishDestinationId : undefined,
      )
      if (result.status === 'packed') {
        announceShopOutcome(`${item.name}已经放进行囊。`)
      } else {
        announceShopOutcome(
          describePackRejection(result.reason, item.name),
        )
      }
    } finally {
      purchaseFlowBusy = false
    }
  }

  const addItemToPack = async (item: ItemDefinition) => {
    const added = await controller.addItemToPack(
      item,
      item.kind === 'wish' ? selectedWishDestinationId : undefined,
    )
    activityNotice = added
      ? `${item.name}已经放进行囊。`
      : '行囊没有变化。'
  }

  const removeItemFromPack = async (item: ItemDefinition) => {
    const removed = await controller.removeItemFromPack(item)
    if (removed) activityNotice = `${item.name}已经放回家里。`
  }

  const handlePackDrop = (event: DragEvent) => {
    event.preventDefault()
    const itemId = event.dataTransfer?.getData('text/plain')
    const item = itemId ? findItem(itemId) : undefined
    if (!item || pack.some(({ itemId: packedId }) => packedId === item.id)) return
    void addItemToPack(item)
  }

  const handleHomeDrop = (event: DragEvent) => {
    event.preventDefault()
    const itemId = event.dataTransfer?.getData('text/plain')
    const item = itemId ? findItem(itemId) : undefined
    if (!item || !pack.some(({ itemId: packedId }) => packedId === item.id)) return
    void removeItemFromPack(item)
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
          src={asset('/portraits/minho/portrait--minho--sit--v01.png')}
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
      <img src={asset(drawerArt.treat)} alt="" aria-hidden="true" />
      <strong>{treats}</strong>
    </div>
  </header>

  {#if game.cats.length > 1}
    <nav class="cat-switcher" aria-label="家里的小猫">
      {#each game.cats as cat}
        {@const portrait = STARTER_CATALOG.portraits.find(
          ({ id }) => id === cat.portraitId,
        )}
        <button
          type="button"
          class:active={cat.id === activeCatId}
          aria-pressed={cat.id === activeCatId}
          onclick={() => void switchActiveCat(cat.id)}
        >
          {#if portrait}
            <img src={asset(portrait.poses.sit)} alt="" aria-hidden="true" />
          {/if}
          <span>{cat.name}</span>
          <small>{describeCatPresence(cat)}</small>
        </button>
      {/each}
    </nav>
  {/if}

  {#if isDevelopment}
    <aside class="developer-clock" aria-label="开发工具">
      <div class="developer-control">
        <span>开发时钟</span>
        <button type="button" onclick={() => setTimeAcceleration(1)}>实时</button>
        <button type="button" onclick={() => setTimeAcceleration(3_600)}>
          1 小时/秒
        </button>
        <button type="button" onclick={() => setTimeAcceleration(86_400)}>
          1 天/秒
        </button>
      </div>
      <div
        class="developer-control"
        data-development-control="home-activity"
      >
        <span>小猫姿势</span>
        <button
          type="button"
          aria-label={`切换小猫姿势，当前是${HOME_ACTIVITY_LABELS[homeActivity]}`}
          disabled={isCatAway}
          onclick={cycleHomeActivity}
        >
          {HOME_ACTIVITY_LABELS[homeActivity]} →
        </button>
      </div>
      <div
        class="developer-control"
        data-development-control="treat-grant"
      >
        <label for="development-treat-grant">测试补给</label>
        <input
          id="development-treat-grant"
          type="number"
          min="1"
          step="1"
          bind:value={developmentGrantAmount}
          aria-label="每次补充的小鱼干数量"
        />
        <button
          type="button"
          disabled={!Number.isInteger(developmentGrantAmount)
            || developmentGrantAmount <= 0}
          onclick={grantDevelopmentTreats}
        >
          补充 +{developmentGrantAmount}
        </button>
      </div>
    </aside>
  {/if}

  <main>
    <section
      class="room"
      class:home-art-preview={showHomeArtPreview}
      data-home-time={showHomeArtPreview ? homeTime : undefined}
      data-home-activity={!isCatAway ? homeActivity : undefined}
      aria-label={`${catName}的家`}
    >
      {#if showHomeArtPreview}
        <div class="home-art-canvas" aria-hidden="true">
          {#each homeBackdropLayers as layer (layer.id)}
            <img
              class="home-art-layer"
              src={layer.src}
              alt=""
            />
          {/each}
          {#each homeScene.rearPieces as layer (layer.id)}
            <img
              class="home-art-layer"
              src={layer.src}
              alt=""
            />
          {/each}
          {#if !isCatAway}
            {#if homeScene.cat.sprite}
              <div
                class="home-art-cat home-art-cat-animated"
                style={homeScene.cat.sprite.style}
              ></div>
            {:else}
              <img
                class="home-art-cat"
                src={homePortraitSrc}
                alt=""
                style={homeScene.cat.imageStyle}
              />
            {/if}
          {/if}
        </div>
      {/if}

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
          class:empty={windowsillTreats === 0}
          style={showHomeArtPreview ? homeScene.treat.style : undefined}
          aria-label={windowsillTreats > 0
            ? `收取窗台上的 ${windowsillTreats} 条小鱼干`
            : '窗台上的小鱼干已经收取'}
        >
          <span class="treat-pile" aria-hidden="true">
            {#if windowsillTreats > 0}
              <img src={asset(drawerArt.treatLarge)} alt="" />
              <strong>+{windowsillTreats}</strong>
            {:else}
              <span class="empty-sill-mark">·</span>
            {/if}
          </span>
          <span class="collect-label">
            <strong>{windowsillTreats > 0 ? '收取' : '已收好'}</strong>
            <small>{windowsillTreats > 0 ? '小鱼干' : '晚点再来'}</small>
          </span>
        </button>
      </div>

      {#if wallPrototypeVariantKey}
        <!-- PROTOTYPE — 右退深墙面布局，替换正式明信片墙渲染。 -->
        <WallLayoutPrototype
          initialVariantKey={wallPrototypeVariantKey}
          postcards={wallPrototypePostcards}
        />
      {:else}
      <section class="travel-wall home-display-canvas" aria-label="去过的地方">
        {#if homeScene.postcardDisplay.fixtureSrc}
          <img
            class="home-display-fixture postcard-wall-fixture"
            src={homeScene.postcardDisplay.fixtureSrc}
            alt=""
            aria-hidden="true"
          />
        {/if}
        {#each homeScene.postcardDisplay.slots as slot, index}
          {@const postcard = displayedVisitedPlaces[index]}
          {#if postcard}
            {@const destination = findDestination(postcard.destinationId)}
            {@const composition = resolvePostcardComposition(STARTER_CATALOG, postcard)}
            <button
              class="display-postcard"
              type="button"
              style={slot.style}
              aria-label={`查看${destination?.name ?? '远方'}的明信片`}
              onclick={() => void openAlbumDetail({
                kind: 'postcards',
                id: postcard.id,
              })}
            >
              {#if canRenderLandmarkScenes}
                <img
                  src={composition.scene.src}
                  alt=""
                  aria-hidden="true"
                />
              {:else}
                <span class="display-postcard-art" aria-hidden="true"></span>
              {/if}
            </button>
          {:else}
            <span
              class="display-postcard empty"
              style={slot.style}
              aria-hidden="true"
            ></span>
          {/if}
        {/each}
      </section>
      {/if}

      {#if !wallPrototypeVariantKey}
        <section
          class="souvenir-display home-display-canvas"
          aria-label="带回的纪念品"
        >
          <div class="table-souvenirs">
            {#each displayedSouvenirs as receivedSouvenir, index}
              {@const souvenir = findSouvenir(receivedSouvenir.souvenirId)}
              {@const displayKind = souvenirDisplayKindFor(receivedSouvenir.souvenirId)}
              <button
                type="button"
                data-souvenir-kind={displayKind}
                style={homeScene.souvenirDisplay.anchors[index].style}
                aria-label={`查看纪念品${souvenir?.name ?? '远方带回的小物'}`}
                onclick={() => void openAlbumDetail({
                  kind: 'souvenirs',
                  id: receivedSouvenir.id,
                })}
              >
                <span class="souvenir-support" aria-hidden="true"></span>
                {#if souvenir?.imageSrc}
                  <img src={asset(souvenir.imageSrc)} alt="" aria-hidden="true" />
                {:else}
                  <span aria-hidden="true">{souvenir?.visualToken ?? '念'}</span>
                {/if}
              </button>
            {/each}
          </div>
          {#if homeScene.souvenirDisplay.occlusionSrc}
            <img
              class="souvenir-occlusion"
              src={homeScene.souvenirDisplay.occlusionSrc}
              alt=""
              aria-hidden="true"
            />
          {/if}
        </section>
      {/if}

      {#if showHomeArtPreview && homeScene.lighting}
        <img
          class="home-art-lighting"
          src={homeScene.lighting.src}
          alt=""
          aria-hidden="true"
        />
      {/if}

      {#if themeLabEnabled}
        <ThemeLab
          selection={themeLabSelection ?? game.homeCustomization}
          scene={homeScene}
          onSelect={(selection) => {
            themeLabSelection = selection
          }}
        />
      {/if}

      {#if isCatAway && travel.kind === 'planned'}
        <article class="departure-note" aria-label={`${catName}留下的字条`}>
          <span>留给家里</span>
          <p>{travel.note}</p>
          <small>— {catName}</small>
        </article>
      {:else if !showHomeArtPreview}
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
        <div class="cat-name-row">
          <p class="cat-name">{catName}</p>
          {#if switchablePortraits.length > 1}
            <button
              class="portrait-choice-toggle"
              type="button"
              aria-expanded={portraitChoicesOpen}
              onclick={() => {
                portraitChoicesOpen = !portraitChoicesOpen
                themeChoicesOpen = false
              }}
            >更换形象</button>
          {/if}
          {#if themeChoicesAvailable}
            <button
              class="portrait-choice-toggle"
              type="button"
              aria-expanded={themeChoicesOpen}
              onclick={() => {
                themeChoicesOpen = !themeChoicesOpen
                portraitChoicesOpen = false
              }}
            >布置家</button>
          {/if}
        </div>
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

      {#if portraitChoicesOpen && switchablePortraits.length > 1}
        <div class="portrait-choices" aria-label={`为${catName}更换形象`}>
          {#each switchablePortraits as portrait}
            <button
              type="button"
              class:active={portrait.id === activePortrait.id}
              disabled={portrait.id === activePortrait.id}
              aria-label={`使用${portrait.name}形象`}
              onclick={() => void switchPortrait(portrait.id)}
            >
              <img src={asset(portrait.poses.sit)} alt="" aria-hidden="true" />
              <span>{portrait.name}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if themeChoicesOpen && themeChoicesAvailable}
        <HomeThemePicker
          customization={game.homeCustomization}
          scene={homeScene}
          {isDevelopment}
          onApply={(customization) => {
            void applyHomeCustomization(customization)
          }}
        />
      {/if}
    </section>

    <nav class="home-nav" aria-label="家里的去处">
    <button type="button" onclick={() => void openDrawer('pack')}>
      <img class="nav-icon" src={asset(drawerArt.nav.pack)} alt="" aria-hidden="true" />
      <span>行囊</span>
    </button>
    <button type="button" onclick={() => void openDrawer('shop')}>
      <img class="nav-icon" src={asset(drawerArt.nav.shop)} alt="" aria-hidden="true" />
      <span>小铺</span>
    </button>
    <button type="button" onclick={openAlbum}>
      <img class="nav-icon" src={asset(drawerArt.nav.album)} alt="" aria-hidden="true" />
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
      ><img src={asset(drawerArt.close)} alt="" aria-hidden="true" /></button>
    </header>
    {#if activeDrawer === 'shop'}
      <div class="drawer-content">
        <p class="drawer-intro">基础物品一直都在，不用赶时间。</p>
        {#if shopNotice}
          <p class="shop-notice" role="status">{shopNotice}</p>
        {/if}
        <div class="shop-tabs" aria-label="小铺分类">
          {#each Object.entries(itemKindLabels) as [kind, label]}
            <button
              type="button"
              class:active={shopCategory === kind}
              aria-pressed={shopCategory === kind}
              onclick={() => shopCategory = kind as ShopCategory}
            >{label}</button>
          {/each}
        </div>
        <ul class="catalog-grid" aria-label={`${itemKindLabels[shopCategory]}物品`}>
          {#each shopItems as item}
            <li class="catalog-card">
              <img class="item-token" src={asset(item.imageSrc)} alt="" aria-hidden="true" />
              <div class="catalog-copy">
                <div class="item-title">
                  <h3>{item.name}</h3>
                </div>
                <p>{item.effectHint}</p>
                <small>家里有 {economy.ownedItems[item.id] ?? 0} 件</small>
              </div>
              {#if pendingPurchaseItem?.id === item.id}
                <div class="purchase-choice" aria-label={`${item.name}的去向`}>
                  {#if item.kind === 'wish'}
                    <p>写下心愿地</p>
                    <div class="wish-destination-grid">
                      {#each STARTER_CATALOG.destinations as destination}
                        <button
                          type="button"
                          class:active={selectedWishDestinationId === destination.id}
                          aria-pressed={selectedWishDestinationId === destination.id}
                          onclick={() => selectedWishDestinationId = destination.id}
                        >{destination.name}</button>
                      {/each}
                    </div>
                  {/if}
                  <div class="purchase-choice-actions">
                    <button
                      type="button"
                      disabled={purchaseFlowBusy}
                      onclick={leavePurchasedItemAtHome}
                    >带回家</button>
                    <button
                      type="button"
                      disabled={purchaseFlowBusy || pendingPurchasePackRejection !== undefined}
                      title={pendingPurchasePackRejection === 'capacity-reached'
                        ? '行囊已满，请先调整'
                        : undefined}
                      onclick={packPurchasedItem}
                    >装入行囊</button>
                  </div>
                  {#if pendingPurchasePackRejection === 'capacity-reached'}
                    <small>行囊已满，请先调整。</small>
                  {/if}
                </div>
              {:else}
                <button
                  class="item-action"
                  type="button"
                  disabled={treats < item.price
                    || purchaseFlowBusy
                    || pendingPurchase !== null}
                  aria-label={`购买${item.name}，需要 ${item.price} 条小鱼干`}
                  onclick={() => purchaseItem(item)}
                >
                  {purchaseFlowBusy
                    ? '购买中…'
                    : pendingPurchase
                      ? '请先选择'
                      : treats >= item.price
                        ? `${item.price} 条小鱼干`
                        : `还差 ${item.price - treats}`}
                </button>
              {/if}
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

        <div class="pack-art" aria-label={`打开的行囊，已放入 ${pack.length} 件物品`}>
          <img class="pack-layer" src={asset(drawerArt.packBase)} alt="" />
          {#each pack as packedItem, index}
            {@const item = findItem(packedItem.itemId)}
            {#if item}
              <img
                class="pack-item"
                src={asset(item.imageSrc)}
                alt={item.name}
                style={packItemStyle(index, item.id)}
              />
            {/if}
          {/each}
          <img class="pack-layer pack-rim" src={asset(drawerArt.packRim)} alt="" />
        </div>

        <section class="pack-section" aria-labelledby="packed-title">
          <h3 id="packed-title">已装行囊</h3>
          <ul
            class="pack-grid"
            aria-label="已装进行囊的物品"
            ondragover={(event) => event.preventDefault()}
            ondrop={handlePackDrop}
          >
            {#each Array(PACK_CAPACITY) as _, index}
              {@const packedItem = pack[index]}
              {@const item = packedItem ? findItem(packedItem.itemId) : undefined}
              <li class:empty-pack-slot={!item} class="pack-card">
                {#if item && packedItem}
                  <img
                    class="item-token"
                    src={asset(item.imageSrc)}
                    alt=""
                    aria-hidden="true"
                    draggable={!isPackLocked}
                    ondragstart={(event) => event.dataTransfer?.setData(
                      'text/plain',
                      item.id,
                    )}
                  />
                  <div class="catalog-copy">
                    <div class="item-title">
                      <h3>{item.name}</h3>
                      <span>{itemKindLabels[item.kind]}</span>
                    </div>
                    {#if packedItem.wishDestinationId}
                      <small>
                        心愿地：{findDestination(packedItem.wishDestinationId)?.name}
                      </small>
                    {/if}
                  </div>
                  <button
                    class="item-action secondary"
                    type="button"
                    disabled={isPackLocked}
                    onclick={() => removeItemFromPack(item)}
                  >取回</button>
                {:else}
                  <span aria-hidden="true">＋</span>
                  <p>拖入一件小物</p>
                {/if}
              </li>
            {/each}
          </ul>
        </section>

        <section class="pack-section" aria-labelledby="available-title">
          <h3 id="available-title">家中物品</h3>
          {#if availableItems.length > 0}
            <ul
              class="pack-grid"
              aria-label="家中可用物品"
              ondragover={(event) => event.preventDefault()}
              ondrop={handleHomeDrop}
            >
              {#each availableItems as item}
                {@const itemAlreadyPacked = pack.some(
                  ({ itemId }) => itemId === item.id,
                )}
                <li class="pack-card">
                  <img
                    class="item-token"
                    src={asset(item.imageSrc)}
                    alt=""
                    aria-hidden="true"
                    draggable={!isPackLocked && !itemAlreadyPacked}
                    ondragstart={(event) => event.dataTransfer?.setData(
                      'text/plain',
                      item.id,
                    )}
                  />
                  <div class="catalog-copy">
                    <div class="item-title">
                      <h3>{item.name}</h3>
                      <span>有 {economy.ownedItems[item.id] ?? 0}</span>
                    </div>
                    {#if item.kind === 'wish'}
                      <label class="pack-wish-select">
                        <span>心愿地</span>
                        <select bind:value={selectedWishDestinationId}>
                          {#each STARTER_CATALOG.destinations as destination}
                            <option value={destination.id}>{destination.name}</option>
                          {/each}
                        </select>
                      </label>
                    {/if}
                  </div>
                  <button
                    class="item-action"
                    type="button"
                    disabled={pack.length >= PACK_CAPACITY
                      || isPackLocked
                      || itemAlreadyPacked}
                    onclick={() => addItemToPack(item)}
                  >{itemAlreadyPacked ? '已放入' : '装入'}</button>
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
        {#if albumDetail}
          <section class="album-detail" aria-label="收藏详情">
            <button
              class="detail-back"
              type="button"
              onclick={() => albumDetail = null}
            >返回相册</button>
            {#if selectedPostcard}
              {@const composition = resolvePostcardComposition(
                STARTER_CATALOG,
                selectedPostcard,
              )}
              <Postcard
                {composition}
                destinationName={findDestination(selectedPostcard.destinationId)?.name ?? '远方'}
                renderScene={canRenderLandmarkScenes}
              />
              <div class="postcard-export">
                <button
                  type="button"
                  disabled={postcardExportBusy || !canRenderLandmarkScenes}
                  onclick={exportSelectedPostcard}
                >
                  {postcardExportBusy ? '正在生成…' : '保存或分享明信片'}
                </button>
                {#if postcardExportNotice}
                  <p aria-live="polite">{postcardExportNotice}</p>
                {/if}
              </div>
            {:else if selectedSouvenir}
              {@const souvenir = findSouvenir(selectedSouvenir.souvenirId)}
              <div class="souvenir-detail">
                {#if souvenir?.imageSrc}
                  <img src={asset(souvenir.imageSrc)} alt="" />
                {:else}
                  <span aria-hidden="true">{souvenir?.visualToken ?? '念'}</span>
                {/if}
                <h3>{souvenir?.name ?? '远方带回的小物'}</h3>
                <p>{findDestination(selectedSouvenir.destinationId)?.name ?? '远方'}</p>
                <time datetime={new Date(selectedSouvenir.revealedAt).toISOString()}>
                  {new Date(selectedSouvenir.revealedAt).toISOString().slice(0, 10)}
                </time>
              </div>
            {/if}
          </section>
        {:else}
          <div class="album-tabs" aria-label="相册分类">
            <button
              type="button"
              class:active={albumView === 'postcards'}
              aria-pressed={albumView === 'postcards'}
              onclick={() => albumView = 'postcards'}
            >
              明信片
              <span>{game.postcards.received.length}</span>
            </button>
            <button
              type="button"
              class:active={albumView === 'souvenirs'}
              aria-pressed={albumView === 'souvenirs'}
              onclick={() => albumView = 'souvenirs'}
            >
              纪念品
              <span>{game.souvenirs.received.length}</span>
            </button>
          </div>

          {#if albumView === 'postcards'}
            {#if postcardsByPostmark.length > 0}
              <p class="drawer-intro">按邮戳时间排列，最近寄到家的在前。</p>
              <ul class="collection-grid" aria-label="收到的明信片">
                {#each postcardsByPostmark as postcard}
                  {@const composition = resolvePostcardComposition(
                    STARTER_CATALOG,
                    postcard,
                  )}
                  <li>
                    <button
                      class="collection-card postcard-collection-card"
                      type="button"
                      aria-label={`查看${findDestination(postcard.destinationId)?.name ?? '远方'}的明信片`}
                      onclick={() => void openAlbumDetail({
                        kind: 'postcards',
                        id: postcard.id,
                      })}
                    >
                      <span class="postcard-thumbnail" aria-hidden="true">
                        {#if canRenderLandmarkScenes}
                          <img class="scene" src={composition.scene.src} alt="" />
                          <img
                            class="portrait"
                            src={composition.portrait.src}
                            alt=""
                            style={`left: ${composition.portrait.anchorX * 100}%; top: ${composition.portrait.anchorY * 100}%; height: ${composition.portrait.heightScale * 100}%; transform: translate(-50%, -100%) scaleX(${composition.portrait.flip ? -1 : 1});`}
                          />
                        {:else}
                          <span class="postcard-placeholder"></span>
                        {/if}
                      </span>
                      <span class="collection-copy">
                        <strong>{findDestination(postcard.destinationId)?.name ?? '远方'}</strong>
                        <small>{composition.postmarkDate.slice(0, 10)}</small>
                      </span>
                    </button>
                  </li>
                {/each}
              </ul>
            {:else}
              <div class="empty-state">
                <img class="album-empty-art" src={asset(drawerArt.albumEmpty)} alt="" />
                <h3>{drawer.empty}</h3>
                <p>小猫寄回的明信片会收在这一页。</p>
              </div>
            {/if}
          {:else if souvenirsByReturn.length > 0}
            <p class="drawer-intro">小猫回家时带回的小物件会留在这里。</p>
            <ul class="collection-grid" aria-label="带回家的纪念品">
              {#each souvenirsByReturn as receivedSouvenir}
                {@const souvenir = findSouvenir(receivedSouvenir.souvenirId)}
                <li>
                  <button
                    class="collection-card"
                    type="button"
                    aria-label={`查看纪念品${souvenir?.name ?? '远方带回的小物'}`}
                    onclick={() => void openAlbumDetail({
                      kind: 'souvenirs',
                      id: receivedSouvenir.id,
                    })}
                  >
                    {#if souvenir?.imageSrc}
                      <img class="souvenir-art" src={asset(souvenir.imageSrc)} alt="" />
                    {:else}
                      <span class="souvenir-token" aria-hidden="true">
                        {souvenir?.visualToken ?? '念'}
                      </span>
                    {/if}
                    <span class="collection-copy">
                      <strong>{souvenir?.name ?? '远方带回的小物'}</strong>
                      <small>{findDestination(receivedSouvenir.destinationId)?.name ?? '远方'}</small>
                    </span>
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <div class="empty-state">
              <img class="album-empty-art" src={asset(drawerArt.albumEmpty)} alt="" />
              <h3>还没有带回纪念品</h3>
              <p>旅行结束回到家时，纪念品会收在这一页。</p>
            </div>
          {/if}

          <section class="save-transfer" aria-labelledby="save-transfer-title">
            <div>
              <h3 id="save-transfer-title">带走这个家</h3>
              <p>导出会包含小猫、行囊、旅行、相册和未读状态。</p>
            </div>
            <div class="save-transfer-actions">
              <button type="button" onclick={exportGame}>
                <img src={asset(drawerArt.export)} alt="" aria-hidden="true" />
                导出存档
              </button>
              {#if saveTransferPort}
                <button type="button" onclick={importGameFromPicker}>
                  <img src={asset(drawerArt.import)} alt="" aria-hidden="true" />
                  导入存档
                </button>
              {:else}
                <label>
                  <span>
                    <img src={asset(drawerArt.import)} alt="" aria-hidden="true" />
                    导入存档
                  </span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onchange={importGame}
                  />
                </label>
              {/if}
            </div>
            {#if transferNotice}
              <p class="transfer-notice" aria-live="polite">{transferNotice}</p>
            {/if}
          </section>
        {/if}
      </div>
    {:else}
      <div class="empty-state">
        <img class="album-empty-art" src={asset(drawerArt.albumEmpty)} alt="" />
        <h3>{drawer.empty}</h3>
        <p>{drawer.hint}</p>
      </div>
    {/if}
  </dialog>
{/if}
{/if}
