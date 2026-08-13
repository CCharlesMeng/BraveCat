import { describe, expect, it } from 'vitest'
import {
  CloudSyncError,
  createCloudSyncClient,
  SAVE_SCHEMA_VERSION,
  type CloudCredentials,
  type CloudFetch,
  type CloudHttpResponse,
  type SaveDocument,
} from './index'

interface RecordedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

/** 按调用顺序吐出预置响应的 fetch mock，并记录每次请求。 */
const createFetchMock = (responses: CloudHttpResponse[]) => {
  const requests: RecordedRequest[] = []
  const fetch: CloudFetch = async (url, init) => {
    requests.push({
      url,
      method: init?.method ?? 'GET',
      headers: init?.headers ?? {},
      body: init?.body,
    })
    const response = responses.shift()
    if (!response) throw new Error(`没有为请求预置响应：${url}`)
    return response
  }
  return { fetch, requests }
}

const jsonResponse = (status: number, body: unknown): CloudHttpResponse => ({
  status,
  json: async () => body,
})

const errorResponse = (
  status: number,
  code: string,
  details?: unknown,
): CloudHttpResponse => (
  jsonResponse(status, { error: { code, message: `测试错误 ${code}`, details } })
)

const createMemoryCredentialStore = (initial: CloudCredentials | null = null) => {
  let stored = initial
  return {
    load: () => stored,
    save: (credentials: CloudCredentials) => {
      stored = credentials
    },
  }
}

const GUEST: CloudCredentials = { userId: 'user-1', token: 'token-1' }

const sampleDocument: SaveDocument = {
  schemaVersion: SAVE_SCHEMA_VERSION,
  exportedAt: 1_755_000_000_000,
  state: { cats: [] },
}

const createClient = (
  responses: CloudHttpResponse[],
  credentials: CloudCredentials | null = GUEST,
) => {
  const { fetch, requests } = createFetchMock(responses)
  const store = createMemoryCredentialStore(credentials)
  const client = createCloudSyncClient({
    baseUrl: 'https://api.example.com',
    fetch,
    credentials: store,
  })
  return { client, requests, store }
}

describe('CloudSync ensureGuestAccount', () => {
  it('首次调用创建游客账号并持久化凭证', async () => {
    const { client, requests, store } = createClient([
      jsonResponse(201, { userId: 'u-9', token: 't-9', tokenType: 'Bearer' }),
    ], null)

    const credentials = await client.ensureGuestAccount()

    expect(credentials).toEqual({ userId: 'u-9', token: 't-9' })
    expect(store.load()).toEqual({ userId: 'u-9', token: 't-9' })
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      url: 'https://api.example.com/v1/auth/guest',
      method: 'POST',
    })
  })

  it('已有凭证时直接复用，不再请求服务端', async () => {
    const { client, requests } = createClient([])

    const credentials = await client.ensureGuestAccount()

    expect(credentials).toEqual(GUEST)
    expect(requests).toHaveLength(0)
  })
})

describe('CloudSync pushSave', () => {
  it('缺少凭证时抛 TOKEN_MISSING，且不发出请求', async () => {
    const { client, requests } = createClient([], null)

    await expect(client.pushSave(sampleDocument)).rejects.toMatchObject({
      name: 'CloudSyncError',
      code: 'TOKEN_MISSING',
    })
    expect(requests).toHaveLength(0)
  })

  it('携带 bearer token PUT 整份存档，成功返回服务端 savedAt', async () => {
    const { client, requests } = createClient([
      jsonResponse(200, { savedAt: 42, schemaVersion: SAVE_SCHEMA_VERSION }),
    ])

    const result = await client.pushSave(sampleDocument)

    expect(result).toEqual({
      status: 'ok',
      savedAt: 42,
      schemaVersion: SAVE_SCHEMA_VERSION,
    })
    expect(requests[0]).toMatchObject({
      url: 'https://api.example.com/v1/save',
      method: 'PUT',
    })
    expect(requests[0].headers.authorization).toBe('Bearer token-1')
    expect(JSON.parse(requests[0].body ?? '')).toEqual({
      document: sampleDocument,
    })
  })

  it('云端已有更新 schema 时（409）返回 schema-too-new 结果', async () => {
    const { client } = createClient([
      errorResponse(409, 'SAVE_SCHEMA_TOO_NEW', {
        cloudSchemaVersion: SAVE_SCHEMA_VERSION + 1,
        uploadedSchemaVersion: SAVE_SCHEMA_VERSION,
      }),
    ])

    const result = await client.pushSave(sampleDocument)

    expect(result).toEqual({
      status: 'schema-too-new',
      cloudSchemaVersion: SAVE_SCHEMA_VERSION + 1,
    })
  })
})

describe('CloudSync pullSave', () => {
  it('默认声明当前构建支持的最高 schemaVersion', async () => {
    const { client, requests } = createClient([
      jsonResponse(200, { document: sampleDocument, savedAt: 7 }),
    ])

    const result = await client.pullSave()

    expect(requests[0].url).toBe(
      `https://api.example.com/v1/save?maxSchemaVersion=${SAVE_SCHEMA_VERSION}`,
    )
    expect(requests[0].headers.authorization).toBe('Bearer token-1')
    expect(result).toEqual({
      status: 'ok',
      document: sampleDocument,
      savedAt: 7,
    })
  })

  it('云端暂无存档（404 SAVE_NOT_FOUND）返回 empty', async () => {
    const { client } = createClient([errorResponse(404, 'SAVE_NOT_FOUND')])

    await expect(client.pullSave()).resolves.toEqual({ status: 'empty' })
  })

  it('云端版本更高（426）返回 schema-too-new 与云端版本号', async () => {
    const { client } = createClient([
      errorResponse(426, 'SAVE_SCHEMA_TOO_NEW', {
        cloudSchemaVersion: SAVE_SCHEMA_VERSION + 2,
        maxSupportedSchemaVersion: SAVE_SCHEMA_VERSION,
      }),
    ])

    await expect(client.pullSave()).resolves.toEqual({
      status: 'schema-too-new',
      cloudSchemaVersion: SAVE_SCHEMA_VERSION + 2,
    })
  })

  it('缺少凭证时抛 TOKEN_MISSING', async () => {
    const { client } = createClient([], null)

    await expect(client.pullSave()).rejects.toMatchObject({
      code: 'TOKEN_MISSING',
    })
  })

  it('非预期错误按 CloudSyncError 抛出并保留错误码', async () => {
    const { client } = createClient([errorResponse(401, 'UNAUTHORIZED')])

    const failure = await client.pullSave().catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(CloudSyncError)
    expect(failure).toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
  })
})

describe('CloudSync getCreditsBalance', () => {
  it('返回服务端权威余额', async () => {
    const { client, requests } = createClient([
      jsonResponse(200, { balance: 5 }),
    ])

    await expect(client.getCreditsBalance()).resolves.toBe(5)
    expect(requests[0]).toMatchObject({
      url: 'https://api.example.com/v1/credits/balance',
      method: 'GET',
    })
    expect(requests[0].headers.authorization).toBe('Bearer token-1')
  })

  it('缺少凭证时抛 TOKEN_MISSING', async () => {
    const { client } = createClient([], null)

    await expect(client.getCreditsBalance()).rejects.toMatchObject({
      code: 'TOKEN_MISSING',
    })
  })
})

describe('CloudSync getMeta', () => {
  it('无需认证即可拉取平台元信息', async () => {
    const meta = {
      platforms: {
        web: { minClientVersion: '0.0.0', featureFlags: { cloudSave: true } },
      },
      serverTime: 1,
    }
    const { client, requests } = createClient([jsonResponse(200, meta)], null)

    await expect(client.getMeta()).resolves.toEqual(meta)
    expect(requests[0].headers.authorization).toBeUndefined()
  })
})
