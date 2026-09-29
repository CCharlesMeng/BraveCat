import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { chooseStory, createInitialStoryState, isStoryState, lockStory, revealStory, STORIES, type StorySelectionContext } from './index'
import { createPlanTrip } from '../planTrip'
import { planItinerary } from '../itinerary'
import { STARTER_CATALOG, STARTER_DESTINATIONS } from '../assets/starterCatalog'
import { selectTripContent } from '../selection'
import { advanceGameEvents, adoptCat, createInitialGameState, isGameState, restoreGameState } from '../game'
import { createGameController } from '../controller'
import { createIndexedDbSaveStore } from '../save'
import { createSeededRandom } from '../travel'
import { renderPostcardCanvas, resolveStoryComposition } from '../postcards'

const context: StorySelectionContext = { completedStoryIds: [], reservedStoryIds: [], needsOrdinaryTrip: false }
const rolls = (...values: number[]) => () => { const next = values.shift(); if (next === undefined) throw new Error('Unexpected random draw'); return next }
const planTrip = createPlanTrip({ planItinerary, selectContent: selectTripContent })
const request = { departsAt: 1000, destinations: STARTER_DESTINATIONS, packedItemIds: [], travelerCatId: 'minho', travelerName: '米诺', portraitId: 'minho', catalog: STARTER_CATALOG, storyContext: context }
const planned = (seed = 1) => {
  for (let i = seed; i < 10000; i++) {
    const plan = planTrip(request, createSeededRandom(i))
    if (plan.story) return plan
  }
  throw new Error('No deterministic story fixture')
}
const cat = { id: 'minho', name: '米诺', portraitId: 'minho', adoptedAt: 0 }

describe('自然四幕故事', () => {
  it('20% / 30% 边界，物品加权但不叠加概率，无门票要求', () => {
    expect(chooseStory(context, [], rolls(.199999, 0))?.id).toBe(STORIES[0].id)
    expect(chooseStory(context, [], rolls(.2))).toBeUndefined()
    expect(chooseStory(context, ['small-telescope'], rolls(.299999, .66))?.id).toBe(STORIES[0].id)
    expect(chooseStory(context, ['small-telescope'], rolls(.1, .67))?.id).toBe(STORIES[1].id)
    expect(chooseStory(context, ['small-telescope', 'fish-biscuit'], rolls(.3))).toBeUndefined()
    expect(chooseStory(context, ['fish-biscuit'], rolls(.1, .34))?.id).toBe(STORIES[1].id)
  })
  it('优先未完成，排除并发占用，冷却期间或无候选不抽随机数', () => {
    expect(chooseStory({ ...context, completedStoryIds: [STORIES[0].id] }, [], rolls(0, 0))?.id).toBe(STORIES[1].id)
    expect(chooseStory({ ...context, completedStoryIds: STORIES.map(s => s.id), lastCompletedStoryId: STORIES[1].id }, [], rolls(0, 0))?.id).toBe(STORIES[0].id)
    expect(chooseStory({ ...context, reservedStoryIds: STORIES.map(s => s.id) }, [], rolls())).toBeUndefined()
    expect(chooseStory({ ...context, needsOrdinaryTrip: true }, [], rolls())).toBeUndefined()
    expect(chooseStory({ ...context, reservedStoryIds: [STORIES[0].id] }, ['small-telescope'], rolls(.2))).toBeUndefined()
  })
  it('车票命中保持普通旅行，绕路仍可偶遇故事', () => {
    const wish = STARTER_DESTINATIONS[0].id
    const hit = planTrip({ ...request, wishDestinationId: wish }, () => 0)
    expect(hit.story).toBeUndefined()
    expect(hit.itinerary.destinationId).toBe(wish)
    const detour = planTrip({ ...request, wishDestinationId: wish }, rolls(.81, 0, 0, 0, 0, 0))
    expect(detour.story).toBeDefined()
    expect(detour.itinerary.destinationId).toMatch(/^story:/)
    expect(detour.content).toEqual({ postcards: [], souvenirIds: [] })
  })
  it('相机不添加第五幕；揭晓固定在20/40/60/80%，没有地标或额外奖励', () => {
    const trip = planTrip({ ...request, packedItemIds: ['small-camera'] }, () => 0)
    expect(trip.story?.acts.map(a => a.revealAt)).toEqual([.2, .4, .6, .8].map(f => request.departsAt + (trip.itinerary.returnsAt - request.departsAt) * f))
    expect(trip.content.souvenirIds).toEqual([])
    expect(trip.itinerary.postcardSlots).toEqual([])
  })
  it('首幕前没有相册记录，离线补齐，尾页仅第四幕解锁且重复推进幂等', () => {
    const story = lockStory(STORIES[0], 'minho', '米诺', 0, 1000)
    const empty = createInitialStoryState()
    expect(revealStory(empty, story, 199)).toBe(empty)
    const first = revealStory(empty, story, 200)
    expect(first.collections[0].acts).toHaveLength(1)
    expect(first.collections[0].closing).toBeUndefined()
    const all = revealStory(first, story, 5000)
    expect(all.collections[0].acts).toHaveLength(4)
    expect(all.collections[0].closing).toBe(story.closing)
    expect(revealStory(all, story, 5000)).toBe(all)
    expect(revealStory(all, story, 100)).toBe(all)
    expect(revealStory(all, story, 400)).toBe(all)
    expect(isStoryState(all)).toBe(true)
    expect(revealStory(all, lockStory(STORIES[0], 'minho', '米诺', 6000, 7000), 8000).collections).toHaveLength(2)
  })
  it('跨归家补齐并只返还一次，故事后需完成普通旅行', () => {
    const initial = adoptCat(createInitialGameState(0), cat)
    const plan = planned()
    const travel = { kind: 'planned' as const, plan, note: '出门了', packedItems: [{ itemId: 'small-telescope', kind: 'toy' as const }], itemOutcomes: [{ itemId: 'small-telescope', kind: 'toy' as const, disposition: 'return-home' as const }] }
    const state = { ...initial, travelByCat: { minho: travel } }
    const returned = advanceGameEvents(state, { catId: 'minho', now: plan.itinerary.returnsAt + 1, economy: state.economy, travel })
    expect(returned.stories.collections[0].acts).toHaveLength(4)
    expect(returned.stories.lastTripByCat.minho).toBe('story')
    expect(returned.postcards.received).toHaveLength(0)
    expect(returned.souvenirs.received).toHaveLength(0)
    expect(advanceGameEvents(returned, { catId: 'minho', now: returned.clockNow, economy: returned.economy, travel: returned.travelByCat.minho! })).toBe(returned)
    const ordinary = { ...travel, plan: planTrip({ ...request, storyContext: { ...context, needsOrdinaryTrip: true } }, () => 0) }
    const afterOrdinary = advanceGameEvents(returned, { catId: 'minho', now: ordinary.plan.itinerary.returnsAt + 1, economy: returned.economy, travel: ordinary })
    expect(afterOrdinary.stories.lastTripByCat.minho).toBe('ordinary')
  })
  it('旧v4计划不重抽；损坏和未知版本导入保留原存档，故事可往返恢复', async () => {
    const db = `story-${crypto.randomUUID()}`
    const controller = createGameController({ createSaveStore: (options) => createIndexedDbSaveStore(db, options), random: { nextUint32: () => 1 }, realNow: () => 1000 })
    await controller.hydrate()
    const original = controller.exportDocument()
    await expect(controller.importDocument({ ...original, schemaVersion: 999 })).rejects.toThrow()
    await expect(controller.importDocument({ schemaVersion: 4, exportedAt: 0, state: {} })).rejects.toThrow()
    for (const schemaVersion of [0, 1, 2, 3]) {
      await expect(controller.importDocument({ schemaVersion, exportedAt: 0, state: {} })).rejects.toThrow()
    }
    expect(controller.exportDocument().state).toEqual(original.state)
    const ordinary = planTrip({ ...request, storyContext: undefined }, () => 0)
    const state = { ...adoptCat(createInitialGameState(1000), cat), travelByCat: { minho: { kind: 'planned' as const, plan: ordinary, note: '出门了', packedItems: [], itemOutcomes: [] } } }
    const { stories: _stories, ...legacy } = state
    await controller.importDocument({ schemaVersion: 4, exportedAt: 1000, state: { ...legacy, stateVersion: 4 } })
    expect(controller.getSnapshot().game.travelByCat.minho).toEqual(state.travelByCat.minho)
    const story = lockStory(STORIES[1], 'minho', '米诺', -10000, -1000)
    const withStory = { ...state, stories: revealStory(createInitialStoryState(), story, 0) }
    await controller.importDocument({ ...original, state: withStory })
    expect(controller.getSnapshot().game.stories).toEqual(withStory.stories)
    expect(isGameState(controller.getSnapshot().game)).toBe(true)
    expect(restoreGameState(withStory, 1000).stories).toEqual(withStory.stories)
    const malformed = structuredClone(controller.exportDocument())
    malformed.state.stories.collections[0].acts[0].revealAt = Infinity
    await expect(controller.importDocument(malformed)).rejects.toThrow()
    expect(controller.getSnapshot().game.stories).toEqual(withStory.stories)
  })
  it('同刻多猫按稳定顺序锁定不同故事，刷新保留锁定结果', async () => {
    let seed = 0
    while (!planTrip({ ...request, packedItemIds: ['small-telescope'] }, createSeededRandom(seed)).story) seed++
    const initial = adoptCat(createInitialGameState(1000), cat)
    const second = { ...cat, id: 'other', portraitId: 'other', name: '小二' }
    const state = {
      ...initial, cats: [second, cat],
      economy: { ...initial.economy, packs: { minho: [{ itemId: 'small-telescope', kind: 'toy' as const }], other: [{ itemId: 'small-telescope', kind: 'toy' as const }] } },
      travelByCat: Object.fromEntries(['other', 'minho'].map(id => [id, { kind: 'waiting' as const, schedule: { readyAt: 0, departsAt: 1000 }, tripSeed: seed }])),
    }
    const db = `multi-story-${crypto.randomUUID()}`
    await createIndexedDbSaveStore(db).save(state)
    const ports = { createSaveStore: (options: Parameters<typeof createIndexedDbSaveStore<typeof initial>>[1]) => createIndexedDbSaveStore<typeof initial>(db, options), random: { nextUint32: () => 1 }, realNow: () => 1000 }
    const controller = createGameController(ports, { storiesEnabled: true })
    await controller.hydrate()
    const locked = Object.values(controller.getSnapshot().game.travelByCat).map(travel => travel?.kind === 'planned' ? travel.plan.story?.storyId : null)
    expect(new Set(locked)).toEqual(new Set(STORIES.map(story => story.id)))
    const before = controller.exportDocument().state.travelByCat
    const reload = createGameController(ports, { storiesEnabled: true })
    await reload.hydrate()
    expect(reload.exportDocument().state.travelByCat).toEqual(before)
    await createIndexedDbSaveStore(db).save({ ...state, cats: [cat, second] })
    const reordered = createGameController(ports, { storiesEnabled: true })
    await reordered.hydrate()
    expect(reordered.exportDocument().state.travelByCat).toEqual(before)
  })
  it('翻页取消后，迟到的上一幕不能覆盖当前画面', async () => {
    const story = lockStory(STORIES[0], 'minho', '米诺', 0, 1000)
    const drawImage = vi.fn()
    const context2d = new Proxy({}, { get: (_target, key) => key === 'drawImage' ? drawImage : key === 'measureText' ? () => ({ width: 10 }) : vi.fn(), set: () => true })
    const canvas = { getContext: () => context2d } as unknown as HTMLCanvasElement
    let finishFirst!: (image: HTMLImageElement) => void
    const firstImage = {} as HTMLImageElement
    const secondImage = {} as HTMLImageElement
    const loadImage = vi.fn().mockImplementationOnce(() => new Promise<HTMLImageElement>(resolve => { finishFirst = resolve })).mockResolvedValueOnce(secondImage)
    const dependencies = { loadImage, createCanvas: vi.fn() }
    const first = new AbortController()
    const pending = renderPostcardCanvas(canvas, resolveStoryComposition(story.acts[0]), story.place, dependencies, first.signal)
    first.abort()
    await renderPostcardCanvas(canvas, resolveStoryComposition(story.acts[1]), story.place, dependencies)
    finishFirst(firstImage)
    await pending
    expect(drawImage).toHaveBeenCalledExactlyOnceWith(secondImage, 0, 0, 1200, 660)
  })
  it('故事渲染只加载完整画面，绝不叠第二只猫', async () => {
    const story = lockStory(STORIES[0], 'minho', '米诺', 0, 1000)
    const context2d = new Proxy({}, { get: (_target, key) => key === 'measureText' ? () => ({ width: 10 }) : vi.fn(), set: () => true })
    const canvas = { getContext: () => context2d } as unknown as HTMLCanvasElement
    const loadImage = vi.fn().mockResolvedValue({})
    const createCanvas = vi.fn()
    await renderPostcardCanvas(canvas, resolveStoryComposition(story.acts[0]), story.place, { loadImage, createCanvas })
    expect(loadImage).toHaveBeenCalledExactlyOnceWith(story.acts[0].recipe.src)
    expect(createCanvas).not.toHaveBeenCalled()
    expect(canvas.width).toBe(1200)
  })
})
