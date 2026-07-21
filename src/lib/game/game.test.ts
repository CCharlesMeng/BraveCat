import { describe, expect, it } from 'vitest'
import type { AssetCatalog } from '../assets'
import { createInitialEconomyState } from '../economy'
import { createInitialPostcardState } from '../postcards'
import { createInitialSouvenirState } from '../souvenirs'
import {
  adoptCat,
  createInitialGameState,
  isGameState,
  restoreGameState,
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

describe('Game state', () => {
  it('新存档同时建立经济与多猫旅行状态容器', () => {
    expect(createInitialGameState(1_000)).toEqual({
      stateVersion: 3,
      clockNow: 1_000,
      economy: createInitialEconomyState(1_000),
      travelByCat: {},
      cats: [],
      activeCatId: null,
      postcards: createInitialPostcardState(),
      souvenirs: createInitialSouvenirState(),
    })
  })

  it('把旧版纯经济存档无损升级为根存档', () => {
    const legacyEconomy = {
      ...createInitialEconomyState(1_000),
      treats: 7,
      ownedItems: { 'fish-biscuit': 2 },
    }

    expect(restoreGameState(legacyEconomy, 9_000)).toEqual({
      stateVersion: 3,
      clockNow: 9_000,
      economy: legacyEconomy,
      travelByCat: {},
      cats: [],
      activeCatId: null,
      postcards: createInitialPostcardState(),
      souvenirs: createInitialSouvenirState(),
    })
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

  it('只把字段完整的当前版本对象认作可导入根存档', () => {
    const valid = createInitialGameState(1_000)

    expect(isGameState(valid)).toBe(true)
    expect(isGameState({ ...valid, clockNow: undefined })).toBe(false)
    expect(isGameState({ ...valid, postcards: undefined })).toBe(false)
    expect(isGameState({
      ...valid,
      cats: [{ id: 'minho', name: 7 }],
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

    expect(restored.stateVersion).toBe(3)
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
