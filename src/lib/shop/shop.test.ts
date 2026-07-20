import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { ItemDefinition } from '../assets'
import { createInitialGameState, type GameState } from '../game'
import { createIndexedDbSaveStore } from '../save'
import {
  beginPurchaseChoice,
  confirmPurchasedItemInPack,
  keepPurchasedItemAtHome,
  type ShopPurchaseFlowState,
} from './index'

const fishBiscuit: ItemDefinition = {
  id: 'fish-biscuit',
  name: '小鱼饼',
  kind: 'snack',
  price: 4,
  imageSrc: '/items/fish-biscuit.png',
  effectHint: '路上吃一点。',
}

const ticket: ItemDefinition = {
  id: 'ticket',
  name: '车票',
  kind: 'wish',
  price: 8,
  imageSrc: '/items/ticket.png',
  effectHint: '写下想去的地方。',
}

const createFlow = (): ShopPurchaseFlowState => {
  const game = createInitialGameState(1_000)

  return {
    game: {
      ...game,
      economy: {
        ...game.economy,
        treats: 12,
      },
      travelByCat: {
        minho: { kind: 'home' },
      },
    },
    pendingPurchase: null,
  }
}

const reload = async (game: GameState) => {
  const databaseName = `bravecat-shop-test-${crypto.randomUUID()}`
  await createIndexedDbSaveStore<GameState>(databaseName).save(game)
  return createIndexedDbSaveStore<GameState>(databaseName).load()
}

describe('Shop purchase choice', () => {
  it('购买只完成一次，选择先留在家里不会准备出发', async () => {
    const initial = createFlow()

    const purchased = beginPurchaseChoice(initial, fishBiscuit)
    const repeated = beginPurchaseChoice(purchased.state, fishBiscuit)
    const kept = keepPurchasedItemAtHome(repeated.state)
    const restored = await reload(kept.state.game)

    expect(purchased.status).toBe('awaiting-choice')
    expect(repeated.status).toBe('choice-pending')
    expect(kept.status).toBe('kept-at-home')
    expect(kept.state.pendingPurchase).toBeNull()
    expect(restored).toEqual({
      ...initial.game,
      economy: {
        ...initial.game.economy,
        treats: 8,
        ownedItems: {
          'fish-biscuit': 1,
        },
      },
    })
  })

  it('确认放进行囊不会再次扣款', async () => {
    const purchased = beginPurchaseChoice(createFlow(), fishBiscuit)

    const confirmed = confirmPurchasedItemInPack(purchased.state, {
      catId: 'minho',
      capacity: 3,
      packLocked: false,
    })
    const restored = await reload(confirmed.state.game)

    expect(confirmed.status).toBe('packed')
    expect(restored?.economy).toMatchObject({
      treats: 8,
      ownedItems: {
        'fish-biscuit': 0,
      },
      packs: {
        minho: [{
          itemId: 'fish-biscuit',
          kind: 'snack',
        }],
      },
    })
    expect(confirmed.state.pendingPurchase).toBeNull()
  })

  it('车票必须选好心愿地才能确认放入', () => {
    const withoutDestination = confirmPurchasedItemInPack(
      beginPurchaseChoice(createFlow(), ticket).state,
      {
        catId: 'minho',
        capacity: 3,
        packLocked: false,
      },
    )
    const withDestination = confirmPurchasedItemInPack(
      beginPurchaseChoice(createFlow(), ticket).state,
      {
        catId: 'minho',
        capacity: 3,
        packLocked: false,
        wishDestinationId: 'france-paris-eiffel-tower',
      },
    )

    expect(withoutDestination.status).toBe('pack-rejected')
    expect(withoutDestination.reason).toBe('wish-destination-required')
    expect(withoutDestination.state.game.economy.ownedItems.ticket).toBe(1)
    expect(withDestination.status).toBe('packed')
    expect(withDestination.state.game.economy.packs.minho).toEqual([{
      itemId: 'ticket',
      kind: 'wish',
      wishDestinationId: 'france-paris-eiffel-tower',
    }])
  })

  it('购买成功但行囊已满时把新物品留在家里并说明原因', async () => {
    const initial = createFlow()
    const fullPack = {
      ...initial,
      game: {
        ...initial.game,
        economy: {
          ...initial.game.economy,
          packs: {
            minho: [
              { itemId: 'travel-tin', kind: 'snack' as const },
              { itemId: 'yarn-ball', kind: 'toy' as const },
              { itemId: 'small-camera', kind: 'toy' as const },
            ],
          },
        },
      },
    }
    const purchased = beginPurchaseChoice(fullPack, fishBiscuit)

    const confirmed = confirmPurchasedItemInPack(purchased.state, {
      catId: 'minho',
      capacity: 3,
      packLocked: false,
    })
    const restored = await reload(confirmed.state.game)

    expect(confirmed.status).toBe('pack-rejected')
    expect(confirmed.reason).toBe('capacity-reached')
    expect(restored?.economy).toMatchObject({
      treats: 8,
      ownedItems: {
        'fish-biscuit': 1,
      },
      packs: fullPack.game.economy.packs,
    })
    expect(confirmed.state.pendingPurchase).toBeNull()
  })

  it('旅行锁定时确认失败并把已购买物品留在家里', () => {
    const purchased = beginPurchaseChoice(createFlow(), fishBiscuit)

    const confirmed = confirmPurchasedItemInPack(purchased.state, {
      catId: 'minho',
      capacity: 3,
      packLocked: true,
    })

    expect(confirmed).toMatchObject({
      status: 'pack-rejected',
      reason: 'pack-locked',
      state: {
        game: {
          economy: {
            treats: 8,
            ownedItems: {
              'fish-biscuit': 1,
            },
          },
        },
        pendingPurchase: null,
      },
    })
  })
})
