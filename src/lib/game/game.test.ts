import { describe, expect, it } from 'vitest'
import { createInitialEconomyState } from '../economy'
import { createInitialPostcardState } from '../postcards'
import {
  adoptCat,
  createInitialGameState,
  isGameState,
  restoreGameState,
} from './index'

describe('Game state', () => {
  it('新存档同时建立经济与多猫旅行状态容器', () => {
    expect(createInitialGameState(1_000)).toEqual({
      stateVersion: 1,
      economy: createInitialEconomyState(1_000),
      travelByCat: {},
      cats: [],
      activeCatId: null,
      postcards: createInitialPostcardState(),
    })
  })

  it('把旧版纯经济存档无损升级为根存档', () => {
    const legacyEconomy = {
      ...createInitialEconomyState(1_000),
      treats: 7,
      ownedItems: { 'fish-biscuit': 2 },
    }

    expect(restoreGameState(legacyEconomy, 9_000)).toEqual({
      stateVersion: 1,
      economy: legacyEconomy,
      travelByCat: {},
      cats: [],
      activeCatId: null,
      postcards: createInitialPostcardState(),
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
})
