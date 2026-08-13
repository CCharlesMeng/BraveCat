import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { reduceEconomy } from '../economy'
import {
  createInitialGameState,
  isGameState,
  restoreGameState,
  type GameState,
} from '../game'
import { defaultHomeCustomization } from '../homeTheme'
import { createIndexedDbSaveStore } from './index'

describe('Save', () => {
  it('刷新后仍能从 IndexedDB 读回同一份状态', async () => {
    const databaseName = `bravecat-test-${crypto.randomUUID()}`
    const state = {
      treats: 16,
      windowsillTreats: 0,
      lastAccruedAt: 1_000,
    }

    await createIndexedDbSaveStore<typeof state>(databaseName).save(state)

    await expect(
      createIndexedDbSaveStore<typeof state>(databaseName).load(),
    ).resolves.toEqual(state)
  })

  it('刷新后保留开发补给余额和原来的窗台结算状态', async () => {
    const databaseName = `bravecat-test-${crypto.randomUUID()}`
    const initial = createInitialGameState(1_000)
    const economy = {
      ...initial.economy,
      treats: 5,
      windowsillTreats: 7,
      accrual: {
        ...initial.economy.accrual,
        lastAccruedAt: 500,
      },
    }
    const granted = {
      ...initial,
      economy: reduceEconomy(economy, {
        type: 'treatsGranted',
        amount: 24,
      }),
    }

    await createIndexedDbSaveStore<GameState>(databaseName).save(granted)

    await expect(
      createIndexedDbSaveStore<GameState>(databaseName).load(),
    ).resolves.toMatchObject({
      economy: {
        treats: 29,
        windowsillTreats: 7,
        accrual: {
          lastAccruedAt: 500,
        },
      },
    })
  })

  it('拒绝损坏状态且保留当前存档', async () => {
    const databaseName = `bravecat-test-${crypto.randomUUID()}`
    const current = { treats: 16 }
    const store = createIndexedDbSaveStore<typeof current>(databaseName, {
      validateState: (value): value is typeof current => (
        typeof value === 'object'
        && value !== null
        && typeof (value as { treats?: unknown }).treats === 'number'
      ),
    })
    await store.save(current)

    await expect(store.import({
      schemaVersion: 4,
      exportedAt: 2_000,
      state: { treats: '很多' },
    })).rejects.toThrow('存档内容不完整或已损坏')
    await expect(store.load()).resolves.toEqual(current)
  })

  it('通过迁移钩子导入已知旧版本', async () => {
    const databaseName = `bravecat-test-${crypto.randomUUID()}`
    const store = createIndexedDbSaveStore<{ treats: number }>(databaseName, {
      validateState: (value): value is { treats: number } => (
        typeof value === 'object'
        && value !== null
        && typeof (value as { treats?: unknown }).treats === 'number'
      ),
      migrations: {
        0: (document) => ({
          ...document,
          schemaVersion: 1,
          state: {
            treats: (document.state as { fish: number }).fish,
          },
        }),
        1: (document) => ({
          ...document,
          schemaVersion: 2,
        }),
        2: (document) => ({
          ...document,
          schemaVersion: 3,
        }),
        3: (document) => ({
          ...document,
          schemaVersion: 4,
        }),
      },
    })

    await expect(store.import({
      schemaVersion: 0,
      exportedAt: 1_000,
      state: { fish: 12 },
    })).resolves.toEqual({ treats: 12 })
    await expect(store.load()).resolves.toEqual({ treats: 12 })
  })

  it('把 v3 根存档迁移为带家外观选择的 v4', async () => {
    const {
      homeCustomization: _dropped,
      ...v3State
    } = createInitialGameState(1_000)
    const store = createIndexedDbSaveStore<GameState>(
      `bravecat-test-${crypto.randomUUID()}`,
      {
        validateState: isGameState,
        migrations: {
          3: (document) => ({
            ...document,
            schemaVersion: 4,
            state: restoreGameState(document.state, 9_000),
          }),
        },
      },
    )

    const imported = await store.import({
      schemaVersion: 3,
      exportedAt: 2_000,
      state: { ...v3State, stateVersion: 3 },
    })

    expect(imported.stateVersion).toBe(4)
    expect(imported.homeCustomization).toEqual(defaultHomeCustomization())
    await expect(store.load()).resolves.toEqual(imported)
  })

  it('JSON 导出再导入会恢复完整行为状态', async () => {
    const state: GameState = {
      ...createInitialGameState(1_000),
      economy: {
        ...createInitialGameState(1_000).economy,
        treats: 9,
        packs: {
          minho: [{ itemId: 'ticket', kind: 'wish', wishDestinationId: 'paris' }],
        },
      },
      cats: [{
        id: 'minho',
        name: '米诺',
        portraitId: 'minho',
        adoptedAt: 1_500,
      }],
      activeCatId: 'minho',
      travelByCat: {
        minho: { kind: 'home' },
      },
      postcards: {
        received: [{
          id: 'trip--postcard-1',
          tripId: 'trip',
          destinationId: 'paris',
          revealAt: 2_000,
          recipe: {
            recipeVersion: 1,
            travelerCatId: 'minho',
            scene: {
              id: 'paris-day',
              revision: 'scenes-r1',
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
              text: '今天的风很轻。',
            },
          },
          isRead: false,
        }],
      },
    }
    const source = createIndexedDbSaveStore<GameState>(
      `bravecat-test-${crypto.randomUUID()}`,
      { now: () => 5_000 },
    )
    const target = createIndexedDbSaveStore<GameState>(
      `bravecat-test-${crypto.randomUUID()}`,
      { validateState: isGameState },
    )

    const json = JSON.stringify(source.export(state))
    const imported = await target.import(JSON.parse(json))

    expect(JSON.parse(json)).toMatchObject({
      schemaVersion: 4,
      exportedAt: 5_000,
    })
    expect(imported).toEqual(state)
    await expect(target.load()).resolves.toEqual(state)
  })
})
