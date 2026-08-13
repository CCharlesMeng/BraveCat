import { beforeEach, describe, expect, it } from 'vitest'
import { SAVE_SCHEMA_VERSION } from '@bravecat/contracts/save-document'
import type { SaveDocument, SaveMigration } from '@bravecat/core'
import { resetTaroMock, storage } from './testing/taroMock'
import { createWxStorageSaveStore } from './saveStore'

interface FakeState {
  treats: number
}

const isFakeState = (value: unknown): value is FakeState => (
  typeof value === 'object'
  && value !== null
  && 'treats' in value
  && typeof value.treats === 'number'
)

describe('createWxStorageSaveStore', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('以单 JSON blob 落盘：键名 bravecat:current、信封带当前 schemaVersion', async () => {
    const store = createWxStorageSaveStore<FakeState>('bravecat', {
      now: () => 1_234,
    })
    await store.save({ treats: 7 })

    const raw = storage.get('bravecat:current')
    expect(typeof raw).toBe('string')
    expect(JSON.parse(raw as string)).toEqual({
      schemaVersion: SAVE_SCHEMA_VERSION,
      exportedAt: 1_234,
      state: { treats: 7 },
    })
  })

  it('save 后 load 还原同一状态', async () => {
    const store = createWxStorageSaveStore<FakeState>('bravecat', {
      validateState: isFakeState,
    })
    await store.save({ treats: 3 })
    await expect(store.load()).resolves.toEqual({ treats: 3 })
  })

  it('没有存档时 load 返回 undefined', async () => {
    const store = createWxStorageSaveStore<FakeState>()
    await expect(store.load()).resolves.toBeUndefined()
  })

  it('load 对旧版本存档走注入的迁移链', async () => {
    const migrations: Record<number, SaveMigration> = {
      [SAVE_SCHEMA_VERSION - 1]: (document) => ({
        ...document,
        schemaVersion: SAVE_SCHEMA_VERSION,
        state: {
          treats: (document.state as { fish: number }).fish,
        },
      }),
    }
    storage.set('bravecat:current', JSON.stringify({
      schemaVersion: SAVE_SCHEMA_VERSION - 1,
      exportedAt: 1,
      state: { fish: 42 },
    }))

    const store = createWxStorageSaveStore<FakeState>('bravecat', {
      validateState: isFakeState,
      migrations,
    })
    await expect(store.load()).resolves.toEqual({ treats: 42 })
  })

  it('import 校验信封结构并持久化迁移结果', async () => {
    const store = createWxStorageSaveStore<FakeState>('bravecat', {
      validateState: isFakeState,
    })

    await expect(store.import({ not: 'a document' }))
      .rejects.toThrow('存档文件结构无效')
    await expect(store.import({
      schemaVersion: SAVE_SCHEMA_VERSION + 1,
      exportedAt: 1,
      state: { treats: 1 },
    })).rejects.toThrow(`不支持的存档版本：${SAVE_SCHEMA_VERSION + 1}`)
    await expect(store.import({
      schemaVersion: SAVE_SCHEMA_VERSION,
      exportedAt: 1,
      state: { broken: true },
    })).rejects.toThrow('存档内容不完整或已损坏')

    await store.import({
      schemaVersion: SAVE_SCHEMA_VERSION,
      exportedAt: 1,
      state: { treats: 9 },
    })
    const raw = JSON.parse(
      storage.get('bravecat:current') as string,
    ) as SaveDocument<FakeState>
    expect(raw.state).toEqual({ treats: 9 })
  })

  it('拒绝没有生成连续版本的迁移', async () => {
    const store = createWxStorageSaveStore<FakeState>('bravecat', {
      migrations: {
        0: (document) => ({ ...document, schemaVersion: 2 }),
      },
    })
    await expect(store.import({
      schemaVersion: 0,
      exportedAt: 1,
      state: { treats: 1 },
    })).rejects.toThrow('存档迁移没有生成连续版本：0')
  })

  it('export 输出带当前版本的信封，不触碰存储', () => {
    const store = createWxStorageSaveStore<FakeState>('bravecat', {
      now: () => 9_999,
    })
    expect(store.export({ treats: 5 })).toEqual({
      schemaVersion: SAVE_SCHEMA_VERSION,
      exportedAt: 9_999,
      state: { treats: 5 },
    })
    expect(storage.size).toBe(0)
  })
})
