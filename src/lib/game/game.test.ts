import { describe, expect, it } from 'vitest'
import type { AssetCatalog } from '../assets'
import { createInitialEconomyState } from '../economy'
import { defaultHomeCustomization } from '../homeTheme'
import { createInitialPostcardState } from '../postcards'
import { createInitialSouvenirState } from '../souvenirs'
import {
  MAX_CATS_PER_HOME,
  adoptCat,
  changeCatPortrait,
  createInitialGameState,
  isGameState,
  restoreGameState,
  selectActiveCat,
} from './index'

const catalog: AssetCatalog = {
  sceneSetRevision: 'scenes-r1',
  sceneRevisions: {
    'paris-day': 'paris-day-r1',
  },
  portraitSetRevisions: {
    minho: 'portraits-r1',
  },
  destinations: [{
    id: 'paris',
    name: '巴黎',
    sceneVariants: [{
      id: 'paris-day',
      destinationId: 'paris',
      imageSrc: '/scenes/paris-day.png',
      compositionSlot: {
        x: 0.2,
        y: 0.8,
        scale: 0.3,
        pose: 'gaze',
        flip: false,
      },
      hasCompanion: false,
    }],
  }],
  portraits: [{
    id: 'minho',
    name: 'Minho',
    poses: {
      sit: '/portraits/minho/sit.png',
      sleep: '/portraits/minho/sleep.png',
      walk: '/portraits/minho/walk.png',
      eat: '/portraits/minho/eat.png',
      play: '/portraits/minho/play.png',
      gaze: '/portraits/minho/gaze.png',
    },
  }],
  items: [],
  souvenirs: [],
  copy: {
    postcardNotes: ['旧旅程的风很轻。'],
    travelNotes: ['我出去看看。'],
  },
}

const catalogWithRevisedScenePose: AssetCatalog = {
  ...catalog,
  sceneSetRevision: 'scenes-r2',
  sceneRevisions: {
    'paris-day': 'paris-day-r2',
  },
  destinations: [{
    ...catalog.destinations[0],
    sceneVariants: [{
      ...catalog.destinations[0].sceneVariants[0],
      compositionSlot: {
        ...catalog.destinations[0].sceneVariants[0].compositionSlot,
        pose: 'sit',
      },
    }],
  }],
}

const catalogWithAlternatePortrait: AssetCatalog = {
  ...catalog,
  portraitSetRevisions: {
    ...catalog.portraitSetRevisions,
    luna: 'portraits-luna-r1',
  },
  portraits: [
    ...catalog.portraits,
    {
      id: 'luna',
      name: 'Luna',
      poses: {
        sit: '/portraits/luna/sit.png',
        sleep: '/portraits/luna/sleep.png',
        walk: '/portraits/luna/walk.png',
        eat: '/portraits/luna/eat.png',
        play: '/portraits/luna/play.png',
        gaze: '/portraits/luna/gaze.png',
      },
    },
  ],
}

describe('Game state', () => {
  it('新存档同时建立经济与多猫旅行状态容器', () => {
    expect(createInitialGameState(1_000)).toEqual({
      stateVersion: 4,
      clockNow: 1_000,
      economy: createInitialEconomyState(1_000),
      travelByCat: {},
      cats: [],
      activeCatId: null,
      postcards: createInitialPostcardState(),
      souvenirs: createInitialSouvenirState(),
      homeCustomization: defaultHomeCustomization(),
    })
  })

  it('把旧版纯经济存档无损升级为根存档', () => {
    const legacyEconomy = {
      ...createInitialEconomyState(1_000),
      treats: 7,
      ownedItems: { 'fish-biscuit': 2 },
    }

    expect(restoreGameState(legacyEconomy, 9_000)).toEqual({
      stateVersion: 4,
      clockNow: 9_000,
      economy: legacyEconomy,
      travelByCat: {},
      cats: [],
      activeCatId: null,
      postcards: createInitialPostcardState(),
      souvenirs: createInitialSouvenirState(),
      homeCustomization: defaultHomeCustomization(),
    })
  })

  it('恢复时保留旧存档的家外观选择，缺失或损坏时用默认预设', () => {
    const withRetiredIds = {
      ...createInitialGameState(1_000),
      homeCustomization: {
        formId: 'retired-form',
        finishId: 'retired-finish',
        pieces: { scratcher: 'retired-piece' },
      },
    }
    expect(restoreGameState(withRetiredIds, 9_000).homeCustomization)
      .toEqual(withRetiredIds.homeCustomization)

    const { homeCustomization: _missing, ...withoutCustomization } = (
      createInitialGameState(1_000)
    )
    expect(restoreGameState(withoutCustomization, 9_000).homeCustomization)
      .toEqual(defaultHomeCustomization())

    const withBrokenShape = {
      ...createInitialGameState(1_000),
      homeCustomization: { formId: 7 },
    }
    expect(restoreGameState(withBrokenShape, 9_000).homeCustomization)
      .toEqual(defaultHomeCustomization())
  })

  it('领养时保存小猫身份、名字和已批准形象', () => {
    const adopted = adoptCat(createInitialGameState(1_000), {
      id: 'minho',
      name: '米诺',
      portraitId: 'minho',
      adoptedAt: 2_000,
    })

    expect(adopted.cats).toEqual([
      {
        id: 'minho',
        name: '米诺',
        portraitId: 'minho',
        adoptedAt: 2_000,
      },
    ])
    expect(adopted.activeCatId).toBe('minho')
  })

  it('同一个家最多领养三只身份与形象均唯一的小猫', () => {
    let state = createInitialGameState(1_000)
    for (let index = 1; index <= MAX_CATS_PER_HOME; index += 1) {
      state = adoptCat(state, {
        id: `cat-${index}`,
        name: `小猫 ${index}`,
        portraitId: `portrait-${index}`,
        adoptedAt: 1_000 + index,
      })
    }

    expect(state.cats).toHaveLength(3)
    expect(state.activeCatId).toBe('cat-3')
    expect(() => adoptCat(state, {
      id: 'cat-4',
      name: '小猫 4',
      portraitId: 'portrait-4',
      adoptedAt: 2_000,
    })).toThrow('一个家最多住 3 只小猫')
  })

  it('拒绝重复 Cat 身份或让两只小猫共用同一形象', () => {
    const adopted = adoptCat(createInitialGameState(1_000), {
      id: 'first-cat',
      name: '第一只',
      portraitId: 'first-portrait',
      adoptedAt: 2_000,
    })

    expect(() => adoptCat(adopted, {
      id: 'first-cat',
      name: '重复身份',
      portraitId: 'second-portrait',
      adoptedAt: 3_000,
    })).toThrow('家中已经有这只小猫：first-cat')
    expect(() => adoptCat(adopted, {
      id: 'second-cat',
      name: '重复形象',
      portraitId: 'first-portrait',
      adoptedAt: 3_000,
    })).toThrow('形象已经属于另一只小猫：first-portrait')
  })

  it('切换当前小猫只改变 Home 焦点，不移动任何进度', () => {
    const first = adoptCat(createInitialGameState(1_000), {
      id: 'first-cat',
      name: '第一只',
      portraitId: 'first-portrait',
      adoptedAt: 2_000,
    })
    const second = adoptCat(first, {
      id: 'second-cat',
      name: '第二只',
      portraitId: 'second-portrait',
      adoptedAt: 3_000,
    })

    const selected = selectActiveCat(second, 'first-cat')

    expect(selected.activeCatId).toBe('first-cat')
    expect(selected.cats).toBe(second.cats)
    expect(selected.economy).toBe(second.economy)
    expect(selected.travelByCat).toBe(second.travelByCat)
    expect(selected.postcards).toBe(second.postcards)
    expect(selected.souvenirs).toBe(second.souvenirs)
    expect(restoreGameState(selected, 9_000)).toMatchObject({
      cats: second.cats,
      activeCatId: 'first-cat',
    })
    expect(() => selectActiveCat(second, 'missing-cat')).toThrow(
      '家中没有这只小猫：missing-cat',
    )
  })

  it('刷新后恢复同一只小猫的名字与形象', () => {
    const saved = adoptCat(createInitialGameState(1_000), {
      id: 'minho',
      name: '米诺',
      portraitId: 'minho',
      adoptedAt: 2_000,
    })

    const restored = restoreGameState(saved, 9_000)

    expect(restored.cats).toEqual(saved.cats)
    expect(restored.activeCatId).toBe('minho')
  })

  it('更换形象时保留小猫身份、名字与全部共享进度', () => {
    const adopted = adoptCat(createInitialGameState(1_000), {
      id: 'minho',
      name: '米诺',
      portraitId: 'minho',
      adoptedAt: 2_000,
    })
    const waiting = {
      kind: 'waiting' as const,
      schedule: {
        readyAt: 3_000,
        departsAt: 4_000,
      },
      tripSeed: 42,
    }
    const beforeChange = {
      ...adopted,
      travelByCat: { minho: waiting },
    }

    const changed = changeCatPortrait(beforeChange, {
      catId: 'minho',
      portraitId: 'luna',
    }, catalogWithAlternatePortrait)

    expect(changed.cats).toEqual([{
      id: 'minho',
      name: '米诺',
      portraitId: 'luna',
      adoptedAt: 2_000,
    }])
    expect(changed.activeCatId).toBe(beforeChange.activeCatId)
    expect(changed.economy).toBe(beforeChange.economy)
    expect(changed.travelByCat).toBe(beforeChange.travelByCat)
    expect(changed.postcards).toBe(beforeChange.postcards)
    expect(changed.souvenirs).toBe(beforeChange.souvenirs)
    expect(
      restoreGameState(changed, 9_000, catalogWithAlternatePortrait)
        .cats[0].portraitId,
    ).toBe('luna')
  })

  it('更换形象不追溯重绘已经收藏的明信片', () => {
    const adopted = adoptCat(createInitialGameState(1_000), {
      id: 'minho',
      name: '米诺',
      portraitId: 'minho',
      adoptedAt: 2_000,
    })
    const withLegacyPostcard = {
      ...adopted,
      postcards: {
        received: [{
          id: 'minho-2000--postcard-1',
          tripId: 'minho-2000',
          destinationId: 'paris',
          revealAt: 3_000,
          sceneVariantId: 'paris-day',
          portraitId: 'minho',
          pose: 'gaze',
          note: '旧旅程的风很轻。',
          isRead: true,
        }],
      },
    }
    const restored = restoreGameState(
      withLegacyPostcard,
      4_000,
      catalogWithAlternatePortrait,
    )

    const changed = changeCatPortrait(restored, {
      catId: 'minho',
      portraitId: 'luna',
    }, catalogWithAlternatePortrait)

    expect(changed.cats[0].portraitId).toBe('luna')
    expect(changed.postcards).toBe(restored.postcards)
    expect(changed.postcards.received[0].recipe.portrait.id).toBe('minho')
    expect(changed.postcards.received[0].recipe.layers[1].src).toBe(
      '/portraits/minho/gaze.png',
    )
  })

  it('拒绝不存在的小猫或未进入素材目录的形象', () => {
    const adopted = adoptCat(createInitialGameState(1_000), {
      id: 'minho',
      name: '米诺',
      portraitId: 'minho',
      adoptedAt: 2_000,
    })

    expect(() => changeCatPortrait(adopted, {
      catId: 'missing-cat',
      portraitId: 'luna',
    }, catalogWithAlternatePortrait)).toThrow(
      '家中没有这只小猫：missing-cat',
    )
    expect(() => changeCatPortrait(adopted, {
      catId: 'minho',
      portraitId: 'missing-portrait',
    }, catalogWithAlternatePortrait)).toThrow(
      '素材目录缺少形象：missing-portrait',
    )
  })

  it('只把字段完整的当前版本对象认作可导入根存档', () => {
    const valid = createInitialGameState(1_000)

    expect(isGameState(valid)).toBe(true)
    expect(isGameState({ ...valid, clockNow: undefined })).toBe(false)
    expect(isGameState({ ...valid, postcards: undefined })).toBe(false)
    expect(isGameState({ ...valid, homeCustomization: undefined })).toBe(false)
    expect(isGameState({
      ...valid,
      homeCustomization: { formId: 7, finishId: 'x', pieces: {} },
    })).toBe(false)
    // 引用已下架内容的选择形状合法，不算损坏，由解析时回退。
    expect(isGameState({
      ...valid,
      homeCustomization: {
        formId: 'retired-form',
        finishId: 'retired-finish',
        pieces: { scratcher: 'retired-piece' },
      },
    })).toBe(true)
    expect(isGameState({
      ...valid,
      cats: [{ id: 'minho', name: 7 }],
    })).toBe(false)
    expect(isGameState({
      ...valid,
      cats: Array.from({ length: 4 }, (_, index) => ({
        id: `cat-${index}`,
        name: `小猫 ${index}`,
        portraitId: `portrait-${index}`,
        adoptedAt: index,
      })),
      activeCatId: 'cat-0',
    })).toBe(false)
    expect(isGameState({
      ...valid,
      cats: [
        {
          id: 'first-cat',
          name: '第一只',
          portraitId: 'shared-portrait',
          adoptedAt: 1,
        },
        {
          id: 'second-cat',
          name: '第二只',
          portraitId: 'shared-portrait',
          adoptedAt: 2,
        },
      ],
      activeCatId: 'first-cat',
    })).toBe(false)
  })

  it('升级早期根存档中尚未记录物品去向的旅行', () => {
    const earlyRoot = {
      ...createInitialGameState(1_000),
      travelByCat: {
        minho: {
          kind: 'planned',
          note: '我出去看看。',
          packedItems: [
            { itemId: 'ticket', kind: 'wish' },
            { itemId: 'blanket', kind: 'toy' },
          ],
          plan: {
            itinerary: {
              destinationId: 'paris',
              departsAt: 2_000,
              returnsAt: 4_000,
              postcardSlots: [],
              routeKind: 'wish',
              isDetour: false,
            },
            content: {
              postcards: [],
              souvenirIds: [],
            },
          },
        },
      },
    }

    expect(
      restoreGameState(earlyRoot, 9_000).travelByCat.minho,
    ).toMatchObject({
      itemOutcomes: [
        { itemId: 'ticket', kind: 'wish', disposition: 'consumed' },
        { itemId: 'blanket', kind: 'toy', disposition: 'return-home' },
      ],
    })
  })

  it('把旧版已规划旅行升级为带旅行者与冻结素材的配方', () => {
    const legacyRoot = {
      ...createInitialGameState(1_000),
      stateVersion: 1,
      cats: [{
        id: 'minho',
        name: '米诺',
        portraitId: 'minho',
        adoptedAt: 500,
      }],
      activeCatId: 'minho',
      travelByCat: {
        minho: {
          kind: 'planned',
          note: '我出去看看。',
          packedItems: [],
          itemOutcomes: [],
          plan: {
            itinerary: {
              destinationId: 'paris',
              departsAt: 2_000,
              returnsAt: 4_000,
              postcardSlots: [{
                destinationId: 'paris',
                revealAt: 3_000,
              }],
              routeKind: 'unwished',
              isDetour: false,
            },
            content: {
              postcards: [{
                sceneVariantId: 'paris-day',
                portraitId: 'minho',
                pose: 'gaze',
                note: '旧旅程的风很轻。',
              }],
              souvenirIds: [],
            },
          },
        },
      },
    }

    const restored = restoreGameState(
      legacyRoot,
      9_000,
      catalogWithRevisedScenePose,
    )

    expect(restored.stateVersion).toBe(4)
    expect(
      restored.travelByCat.minho?.kind === 'planned'
        ? restored.travelByCat.minho.plan.content.postcards[0]
        : undefined,
    ).toEqual({
      recipe: {
        recipeVersion: 1,
        travelerCatId: 'minho',
        scene: {
          id: 'paris-day',
          revision: 'paris-day-r2',
        },
        portrait: {
          id: 'minho',
          setRevision: 'portraits-r1',
        },
        composition: {
          id: 'paris-day--default',
          x: 0.2,
          y: 0.8,
          scale: 0.3,
          flip: false,
        },
        pose: 'gaze',
        layers: [
          {
            id: 'scene',
            kind: 'scene',
            src: '/scenes/paris-day.png',
          },
          {
            id: 'portrait',
            kind: 'portrait',
            src: '/portraits/minho/gaze.png',
          },
        ],
        copy: {
          id: 'postcard-note-1',
          text: '旧旅程的风很轻。',
        },
      },
    })
  })

  it('把旧版已收明信片升级后仍保留原文案与可解析图层', () => {
    const legacyRoot = {
      ...createInitialGameState(1_000),
      stateVersion: 1,
      cats: [{
        id: 'minho',
        name: '米诺',
        portraitId: 'minho',
        adoptedAt: 500,
      }],
      activeCatId: 'minho',
      postcards: {
        received: [{
          id: 'minho-2000--postcard-1',
          tripId: 'minho-2000',
          destinationId: 'paris',
          revealAt: 3_000,
          sceneVariantId: 'paris-day',
          portraitId: 'minho',
          pose: 'gaze',
          note: '旧旅程的风很轻。',
          isRead: true,
        }],
      },
    }

    const restored = restoreGameState(legacyRoot, 9_000, catalog)

    expect(restored.postcards.received).toEqual([{
      id: 'minho-2000--postcard-1',
      tripId: 'minho-2000',
      destinationId: 'paris',
      revealAt: 3_000,
      recipe: {
        recipeVersion: 1,
        travelerCatId: 'minho',
        scene: {
          id: 'paris-day',
          revision: 'paris-day-r1',
        },
        portrait: {
          id: 'minho',
          setRevision: 'portraits-r1',
        },
        composition: {
          id: 'paris-day--default',
          x: 0.2,
          y: 0.8,
          scale: 0.3,
          flip: false,
        },
        pose: 'gaze',
        layers: [
          {
            id: 'scene',
            kind: 'scene',
            src: '/scenes/paris-day.png',
          },
          {
            id: 'portrait',
            kind: 'portrait',
            src: '/portraits/minho/gaze.png',
          },
        ],
        copy: {
          id: 'postcard-note-1',
          text: '旧旅程的风很轻。',
        },
      },
      isRead: true,
    }])
  })

  it('恢复存档时以虚拟 Clock、经济与已揭晓内容的最大时刻为检查点', () => {
    const stored = {
      ...createInitialGameState(1_000),
      stateVersion: 2,
      clockNow: 86_000,
      economy: {
        ...createInitialGameState(1_000).economy,
        accrual: {
          ...createInitialGameState(1_000).economy.accrual,
          lastAccruedAt: 86_401_000,
        },
      },
      souvenirs: {
        received: [{
          id: 'trip--souvenir-1',
          tripId: 'trip',
          souvenirId: 'paris-postmark-pin',
          destinationId: 'paris',
          revealedAt: 86_402_000,
        }],
      },
    }

    expect(restoreGameState(stored, 2_000).clockNow).toBe(86_402_000)
  })

  it('升级未保存 Clock 的旧存档时从经济检查点继续', () => {
    const { clockNow: _clockNow, ...legacyState } = createInitialGameState(1_000)
    const stored = {
      ...legacyState,
      stateVersion: 2,
      economy: {
        ...legacyState.economy,
        accrual: {
          ...legacyState.economy.accrual,
          lastAccruedAt: 86_401_000,
        },
      },
    }

    expect(restoreGameState(stored, 2_000).clockNow).toBe(86_401_000)
  })
})
