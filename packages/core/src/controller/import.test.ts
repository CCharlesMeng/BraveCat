import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createGameController } from './index'
import { adoptCat, createInitialGameState, type GameState } from '../game'
import { createIndexedDbSaveStore } from '../save'
import { lockStory, STORIES } from '../stories'

const cat = { id: 'minho', name: '米诺', portraitId: 'minho', adoptedAt: 0 }
const setup = async (now = 2000) => {
  const db = `import-${crypto.randomUUID()}`
  const stored = createIndexedDbSaveStore<GameState>(db)
  await stored.save(adoptCat(createInitialGameState(now), cat))
  const ports = {
    createSaveStore: (options: Parameters<typeof createIndexedDbSaveStore<GameState>>[1]) => createIndexedDbSaveStore<GameState>(db, options),
    random: { nextUint32: () => 1 }, realNow: () => now,
  }
  const controller = createGameController(ports, { storiesEnabled: true })
  await controller.hydrate()
  return { controller, stored, ports }
}

describe('完整备份导入', () => {
  it.each([0, 1, 2, 3])('v%s 损坏的集合/引用不能覆盖内存或 IndexedDB', async schemaVersion => {
    const { controller, stored } = await setup()
    const before = controller.exportDocument().state
    const corruptions = [
      { cats: null }, { cats: undefined }, { cats: [{}] },
      { travelByCat: null }, { travelByCat: [] }, { travelByCat: undefined }, { travelByCat: { minho: {} } },
      { postcards: null }, { postcards: {} }, { postcards: { received: null } },
      { postcards: { received: [{}] } }, { souvenirs: null },
      { activeCatId: 'missing' }, { clockNow: NaN }, { homeCustomization: null },
    ]
    for (const corruption of corruptions) {
      await expect(controller.importDocument({ schemaVersion, exportedAt: 0, state: { ...before, stateVersion: 3, ...corruption } })).rejects.toThrow()
      expect(controller.exportDocument().state).toEqual(before)
      expect(await stored.load()).toEqual(before)
    }
  })

  it('仍能导入早期纯经济备份与缺少新字段的 v3 备份', async () => {
    const { controller } = await setup()
    const initial = adoptCat(createInitialGameState(0), cat)
    const { stories: _stories, homeCustomization: _home, ...legacy } = initial
    await controller.importDocument({ schemaVersion: 3, exportedAt: 0, state: { ...legacy, stateVersion: 3 } })
    expect(controller.exportDocument().state.cats).toEqual([cat])
    expect(controller.exportDocument().state.stories.collections).toEqual([])
    await controller.importDocument({ schemaVersion: 0, exportedAt: 0, state: initial.economy })
    expect(controller.exportDocument().state.cats).toEqual([])
    expect(controller.exportDocument().state.economy.treats).toBe(initial.economy.treats)
  })

  it.each([2000, 500])('导入立即补齐到有效时间并持久化，刷新不重复结算：现实时间 %s', async now => {
    const { controller, stored, ports } = await setup(now)
    const story = lockStory(STORIES[0], cat.id, cat.name, 0, 1000)
    const state: GameState = {
      ...adoptCat(createInitialGameState(now === 500 ? 2000 : 0), cat),
      travelByCat: { minho: {
        kind: 'planned', note: '出门了',
        packedItems: [{ itemId: 'small-telescope', kind: 'toy' }],
        itemOutcomes: [{ itemId: 'small-telescope', kind: 'toy', disposition: 'return-home' }],
        plan: { story, itinerary: { destinationId: `story:${story.storyId}`, departsAt: 0, returnsAt: 1000, postcardSlots: [], routeKind: 'story', isDetour: false }, content: { postcards: [], souvenirIds: [] } },
      } },
    }
    await controller.importDocument({ schemaVersion: 5, exportedAt: 0, state })
    const restored = controller.exportDocument().state
    expect(restored.clockNow).toBe(2000)
    expect(restored.stories.collections).toHaveLength(1)
    expect(restored.stories.collections[0].acts).toHaveLength(4)
    expect(restored.stories.collections[0].closing).toBe(story.closing)
    expect(restored.travelByCat.minho?.kind).toBe('home')
    expect(await stored.load()).toEqual(restored)
    const reload = createGameController(ports, { storiesEnabled: true })
    await reload.hydrate()
    expect(reload.exportDocument().state).toEqual(restored)
  })
})
