import { describe, expect, it } from 'vitest'
import {
  createCloudSyncClient,
  SAVE_SCHEMA_VERSION,
  type CloudCredentials,
  type CloudFetch,
  type SaveDocument,
} from '@bravecat/core/cloud'
import { createTestApp, type TestApp } from './helpers.js'

/**
 * 集成验证：客户端 CloudSync 模块打真实 Fastify 应用（fastify inject，
 * 内存仓库），跑通「游客注册 → push → pull」往返与版本护栏。
 */

/** 把 CloudSync 的 fetch 端口适配到 fastify inject，无需起监听端口。 */
const fetchViaInject = (app: TestApp): CloudFetch => async (url, init) => {
  const response = await app.inject({
    method: init?.method ?? 'GET',
    url,
    headers: init?.headers,
    payload: init?.body,
  })
  return {
    status: response.statusCode,
    json: async () => response.json() as unknown,
  }
}

const createMemoryCredentialStore = () => {
  let stored: CloudCredentials | null = null
  return {
    load: () => stored,
    save: (credentials: CloudCredentials) => {
      stored = credentials
    },
  }
}

const createClient = (app: TestApp) => {
  const credentials = createMemoryCredentialStore()
  const client = createCloudSyncClient({
    baseUrl: '',
    fetch: fetchViaInject(app),
    credentials,
  })
  return { client, credentials }
}

describe('CloudSync 集成（真实 api 应用）', () => {
  it('游客注册 → push → pull 往返，存档与服务端时间戳一致', async () => {
    const { app, clock } = createTestApp()
    const { client, credentials } = createClient(app)

    const account = await client.ensureGuestAccount()
    expect(account.userId).toMatch(/^[0-9a-f-]{36}$/)
    expect(credentials.load()).toEqual(account)

    // 云端还没有存档。
    await expect(client.pullSave()).resolves.toEqual({ status: 'empty' })

    const document: SaveDocument = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      exportedAt: clock.now(),
      state: { cats: [{ id: 'minho', name: '敏镐' }], treats: 3 },
    }
    const pushed = await client.pushSave(document)
    expect(pushed).toEqual({
      status: 'ok',
      savedAt: clock.now(),
      schemaVersion: SAVE_SCHEMA_VERSION,
    })

    clock.advance(60_000)
    const pulled = await client.pullSave()
    expect(pulled).toEqual({
      status: 'ok',
      document,
      savedAt: pushed.status === 'ok' ? pushed.savedAt : -1,
    })

    // 生成次数余额从零开始（服务端权威）。
    await expect(client.getCreditsBalance()).resolves.toBe(0)
  })

  it('版本护栏贯通：低版本客户端 pull 高版本云端存档被拒并提示升级', async () => {
    const { app, clock } = createTestApp()
    const { client } = createClient(app)

    await client.ensureGuestAccount()
    await client.pushSave({
      schemaVersion: SAVE_SCHEMA_VERSION,
      exportedAt: clock.now(),
      state: {},
    })

    await expect(
      client.pullSave(SAVE_SCHEMA_VERSION - 1),
    ).resolves.toEqual({
      status: 'schema-too-new',
      cloudSchemaVersion: SAVE_SCHEMA_VERSION,
    })
  })

  it('两个游客账号的云存档相互隔离', async () => {
    const { app, clock } = createTestApp()
    const first = createClient(app)
    const second = createClient(app)

    await first.client.ensureGuestAccount()
    await second.client.ensureGuestAccount()
    await first.client.pushSave({
      schemaVersion: SAVE_SCHEMA_VERSION,
      exportedAt: clock.now(),
      state: { owner: 'first' },
    })

    await expect(second.client.pullSave()).resolves.toEqual({
      status: 'empty',
    })
  })
})
