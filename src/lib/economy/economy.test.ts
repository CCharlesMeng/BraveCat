import { describe, expect, it } from 'vitest'
import {
  createInitialEconomyState,
  reduceEconomy,
  type EconomyState,
} from './index'

const HOUR = 60 * 60 * 1_000

const createEconomy = (
  overrides: Partial<EconomyState> = {},
): EconomyState => ({
  treats: 0,
  windowsillTreats: 1,
  accrual: {
    lastAccruedAt: 1_000,
    amountPerHour: 2,
    capacity: 10,
  },
  ownedItems: {},
  packs: {},
  ...overrides,
})

describe('Economy', () => {
  it('按已锁定的轻量节奏建立初始经济状态', () => {
    expect(createInitialEconomyState(1_000)).toEqual({
      treats: 12,
      windowsillTreats: 0,
      accrual: {
        lastAccruedAt: 1_000,
        amountPerHour: 1,
        capacity: 24,
      },
      ownedItems: {},
      packs: {},
    })
  })

  it('按经过的现实时间在窗台积累小鱼干', () => {
    const economy = createEconomy()

    const result = reduceEconomy(economy, {
      type: 'timePassed',
      now: 1_000 + 1.5 * HOUR,
    })

    expect(result.windowsillTreats).toBe(4)
  })

  it('窗台达到容量后停止积累小鱼干', () => {
    const economy = createEconomy({
      windowsillTreats: 4,
      accrual: {
        lastAccruedAt: 1_000,
        amountPerHour: 2,
        capacity: 5,
      },
    })

    const result = reduceEconomy(economy, {
      type: 'timePassed',
      now: 1_000 + 10 * HOUR,
    })

    expect(result.windowsillTreats).toBe(5)
  })

  it('收取窗台小鱼干后转入全家共享余额', () => {
    const economy = createEconomy({
      treats: 12,
      windowsillTreats: 4,
    })

    const result = reduceEconomy(economy, {
      type: 'windowsillCollected',
    })

    expect(result.treats).toBe(16)
    expect(result.windowsillTreats).toBe(0)
  })

  it('开发补给可以连续增加共享小鱼干且不结算窗台', () => {
    const economy = createEconomy({
      treats: 5,
      windowsillTreats: 7,
    })

    const firstGrant = reduceEconomy(economy, {
      type: 'treatsGranted',
      amount: 24,
    })
    const secondGrant = reduceEconomy(firstGrant, {
      type: 'treatsGranted',
      amount: 24,
    })

    expect(secondGrant).toEqual({
      ...economy,
      treats: 53,
    })
  })

  it('现实时间倒退时不扣除也不额外生成小鱼干', () => {
    const economy = createEconomy()

    const result = reduceEconomy(economy, {
      type: 'timePassed',
      now: 500,
    })

    expect(result).toBe(economy)
  })

  it('在小铺购买物品会扣除小鱼干并增加持有数量', () => {
    const economy = createEconomy({
      treats: 12,
      ownedItems: { 'fish-biscuit': 1 },
    })

    const result = reduceEconomy(economy, {
      type: 'itemPurchased',
      itemId: 'fish-biscuit',
      price: 4,
    })

    expect(result.treats).toBe(8)
    expect(result.ownedItems['fish-biscuit']).toBe(2)
  })

  it('小鱼干不足时不能购买物品', () => {
    const economy = createEconomy({ treats: 3 })

    const result = reduceEconomy(economy, {
      type: 'itemPurchased',
      itemId: 'fish-biscuit',
      price: 4,
    })

    expect(result).toBe(economy)
  })

  it('把持有物品放进行囊时会从可用数量中移走', () => {
    const economy = createEconomy({
      ownedItems: { 'fish-biscuit': 1 },
    })

    const result = reduceEconomy(economy, {
      type: 'itemAddedToPack',
      catId: 'first-cat',
      itemId: 'fish-biscuit',
      itemKind: 'snack',
      capacity: 3,
      packLocked: false,
    })

    expect(result.ownedItems['fish-biscuit']).toBe(0)
    expect(result.packs['first-cat']).toEqual([
      { itemId: 'fish-biscuit', kind: 'snack' },
    ])
  })

  it('同一种物品不能在行囊中重复放置', () => {
    const economy = createEconomy({
      ownedItems: { 'fish-biscuit': 1 },
      packs: {
        'first-cat': [{ itemId: 'fish-biscuit', kind: 'snack' }],
      },
    })

    const result = reduceEconomy(economy, {
      type: 'itemAddedToPack',
      catId: 'first-cat',
      itemId: 'fish-biscuit',
      itemKind: 'snack',
      capacity: 3,
      packLocked: false,
    })

    expect(result).toBe(economy)
  })

  it('行囊最多只能放入一张作为心愿的车票', () => {
    const economy = createEconomy({
      ownedItems: { 'ticket-paris': 1 },
      packs: {
        'first-cat': [{ itemId: 'ticket-kyoto', kind: 'wish' }],
      },
    })

    const result = reduceEconomy(economy, {
      type: 'itemAddedToPack',
      catId: 'first-cat',
      itemId: 'ticket-paris',
      itemKind: 'wish',
      capacity: 3,
      packLocked: false,
    })

    expect(result).toBe(economy)
  })

  it('心愿车票会随行囊保存对应目的地', () => {
    const economy = createEconomy({
      ownedItems: { ticket: 1 },
    })

    const result = reduceEconomy(economy, {
      type: 'itemAddedToPack',
      catId: 'first-cat',
      itemId: 'ticket',
      itemKind: 'wish',
      wishDestinationId: 'france-paris-eiffel-tower',
      capacity: 3,
      packLocked: false,
    })

    expect(result.packs['first-cat']).toEqual([
      {
        itemId: 'ticket',
        kind: 'wish',
        wishDestinationId: 'france-paris-eiffel-tower',
      },
    ])
  })

  it('从行囊取出的物品会回到可用数量', () => {
    const economy = createEconomy({
      ownedItems: { 'yarn-ball': 0 },
      packs: {
        'first-cat': [{ itemId: 'yarn-ball', kind: 'toy' }],
      },
    })

    const result = reduceEconomy(economy, {
      type: 'itemRemovedFromPack',
      catId: 'first-cat',
      itemId: 'yarn-ball',
    })

    expect(result.ownedItems['yarn-ball']).toBe(1)
    expect(result.packs['first-cat']).toEqual([])
  })

  it('行囊达到容量后不能再放入物品', () => {
    const economy = createEconomy({
      ownedItems: { 'small-camera': 1 },
      packs: {
        'first-cat': [
          { itemId: 'fish-biscuit', kind: 'snack' },
          { itemId: 'travel-tin', kind: 'snack' },
          { itemId: 'yarn-ball', kind: 'toy' },
        ],
      },
    })

    const result = reduceEconomy(economy, {
      type: 'itemAddedToPack',
      catId: 'first-cat',
      itemId: 'small-camera',
      itemKind: 'toy',
      capacity: 3,
      packLocked: false,
    })

    expect(result).toBe(economy)
  })

  it('小猫旅行途中会锁定行囊', () => {
    const economy = createEconomy({
      ownedItems: { 'fish-biscuit': 1 },
    })

    const result = reduceEconomy(economy, {
      type: 'itemAddedToPack',
      catId: 'first-cat',
      itemId: 'fish-biscuit',
      itemKind: 'snack',
      capacity: 3,
      packLocked: true,
    })

    expect(result).toBe(economy)
  })
})
