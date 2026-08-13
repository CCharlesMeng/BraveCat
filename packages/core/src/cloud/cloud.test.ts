import { describe, expect, it } from 'vitest'
import {
  CloudSyncError,
  createCloudSyncClient,
  decodeBase64,
  encodeBase64,
  isGenerationJobSettled,
  MAX_PORTRAIT_PHOTO_BYTES,
  SAVE_SCHEMA_VERSION,
  type CloudCredentials,
  type CloudFetch,
  type CloudHttpResponse,
  type GenerationJob,
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

describe('base64 编解码', () => {
  it('任意长度字节可无损往返（含填充分支）', () => {
    for (const length of [0, 1, 2, 3, 4, 5, 255]) {
      const bytes = new Uint8Array(length).map((_, index) => (index * 37) % 256)
      expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes)
    }
  })

  it('与标准 base64 编码一致', () => {
    expect(encodeBase64(new TextEncoder().encode('hello'))).toBe('aGVsbG8=')
    expect(new TextDecoder().decode(decodeBase64('aGVsbG8='))).toBe('hello')
  })

  it('非法字符抛错', () => {
    expect(() => decodeBase64('a!b@')).toThrow('非法 base64 字符')
  })
})

const sampleJob = (
  status: GenerationJob['status'],
  extra: Partial<GenerationJob> = {},
): GenerationJob => ({
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  status,
  photoKey: 'portraits/uploads/user-1/photo.png',
  createdAt: 1,
  updatedAt: 1,
  ...extra,
})

describe('CloudSync uploadPortraitPhoto', () => {
  it('把照片字节编码为 base64 提交，返回 photoKey', async () => {
    const { client, requests } = createClient([
      jsonResponse(201, { photoKey: 'portraits/uploads/user-1/p.png' }),
    ])
    const bytes = new Uint8Array([1, 2, 3, 4, 5])

    const photoKey = await client.uploadPortraitPhoto({
      bytes,
      contentType: 'image/png',
    })

    expect(photoKey).toBe('portraits/uploads/user-1/p.png')
    expect(requests[0]).toMatchObject({
      url: 'https://api.example.com/v1/portraits/photos',
      method: 'POST',
    })
    expect(requests[0].headers.authorization).toBe('Bearer token-1')
    expect(JSON.parse(requests[0].body ?? '')).toEqual({
      contentType: 'image/png',
      dataBase64: encodeBase64(bytes),
    })
  })

  it('空照片与超限照片本地直接拒绝，不发请求', async () => {
    const { client, requests } = createClient([])

    await expect(
      client.uploadPortraitPhoto({
        bytes: new Uint8Array(0),
        contentType: 'image/png',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    await expect(
      client.uploadPortraitPhoto({
        bytes: new Uint8Array(MAX_PORTRAIT_PHOTO_BYTES + 1),
        contentType: 'image/jpeg',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(requests).toHaveLength(0)
  })
})

describe('CloudSync submitPortraitGeneration', () => {
  it('提交生成请求，202 新建与 200 幂等重放都返回 job', async () => {
    const job = sampleJob('pending')
    const { client, requests } = createClient([
      jsonResponse(202, { job }),
      jsonResponse(200, { job }),
    ])
    const request = {
      idempotencyKey: 'gen-1',
      photoKey: 'portraits/uploads/user-1/p.png',
    }

    await expect(client.submitPortraitGeneration(request)).resolves.toEqual(job)
    await expect(client.submitPortraitGeneration(request)).resolves.toEqual(job)
    expect(requests[0]).toMatchObject({
      url: 'https://api.example.com/v1/portraits/generations',
      method: 'POST',
    })
    expect(JSON.parse(requests[0].body ?? '')).toEqual(request)
  })

  it('余额不足按 CloudSyncError 抛出并保留错误码', async () => {
    const { client } = createClient([
      errorResponse(422, 'CREDIT_INSUFFICIENT_BALANCE'),
    ])

    await expect(
      client.submitPortraitGeneration({
        idempotencyKey: 'gen-1',
        photoKey: 'p.png',
      }),
    ).rejects.toMatchObject({
      code: 'CREDIT_INSUFFICIENT_BALANCE',
      status: 422,
    })
  })
})

describe('CloudSync waitForPortraitGeneration', () => {
  it('轮询直到终态，逐轮通知 onUpdate，注入睡眠不真等', async () => {
    const jobId = sampleJob('pending').id
    const { client, requests } = createClient([
      jsonResponse(200, { job: sampleJob('moderating') }),
      jsonResponse(200, { job: sampleJob('generating') }),
      jsonResponse(200, { job: sampleJob('awaiting_confirm') }),
    ])
    const observed: string[] = []
    const sleeps: number[] = []

    const job = await client.waitForPortraitGeneration(jobId, {
      intervalMs: 250,
      onUpdate: (next) => observed.push(next.status),
      sleep: async (ms) => {
        sleeps.push(ms)
      },
    })

    expect(job.status).toBe('awaiting_confirm')
    expect(observed).toEqual(['moderating', 'generating', 'awaiting_confirm'])
    expect(sleeps).toEqual([250, 250])
    expect(requests.every(({ url }) => url.endsWith(
      `/v1/portraits/generations/${jobId}`,
    ))).toBe(true)
  })

  it('isCancelled 提前停止轮询并返回最近状态', async () => {
    const { client } = createClient([
      jsonResponse(200, { job: sampleJob('generating') }),
    ])

    const job = await client.waitForPortraitGeneration(sampleJob('pending').id, {
      isCancelled: () => true,
      sleep: async () => {},
    })

    expect(job.status).toBe('generating')
  })

  it('终态判断与状态机对齐', () => {
    expect(isGenerationJobSettled('pending')).toBe(false)
    expect(isGenerationJobSettled('generating')).toBe(false)
    expect(isGenerationJobSettled('awaiting_confirm')).toBe(true)
    expect(isGenerationJobSettled('confirmed')).toBe(true)
    expect(isGenerationJobSettled('failed')).toBe(true)
  })
})

describe('CloudSync confirmPortraitGeneration / listPortraits', () => {
  it('确认返回 job 与形象记录', async () => {
    const job = sampleJob('confirmed', {
      portraitId: 'bbbbbbbb-0000-4000-8000-000000000002',
    })
    const portrait = {
      id: 'bbbbbbbb-0000-4000-8000-000000000002',
      jobId: job.id,
      poses: { sit: 'portraits/generations/j1/sit.png' },
      createdAt: 2,
    }
    const { client, requests } = createClient([
      jsonResponse(200, { job, portrait }),
    ])

    await expect(client.confirmPortraitGeneration(job.id)).resolves.toEqual({
      job,
      portrait,
    })
    expect(requests[0]).toMatchObject({
      url: `https://api.example.com/v1/portraits/generations/${job.id}/confirm`,
      method: 'POST',
    })
  })

  it('列出当前账号全部已确认形象', async () => {
    const portraits = [
      {
        id: 'bbbbbbbb-0000-4000-8000-000000000002',
        jobId: 'aaaaaaaa-0000-4000-8000-000000000001',
        poses: {},
        createdAt: 2,
      },
    ]
    const { client, requests } = createClient([
      jsonResponse(200, { portraits }),
    ])

    await expect(client.listPortraits()).resolves.toEqual(portraits)
    expect(requests[0]).toMatchObject({
      url: 'https://api.example.com/v1/portraits',
      method: 'GET',
    })
    expect(requests[0].headers.authorization).toBe('Bearer token-1')
  })
})

describe('CloudSync getPortraitPoseImage', () => {
  it('把 base64 产出图解码为字节', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const jobId = sampleJob('awaiting_confirm').id
    const { client, requests } = createClient([
      jsonResponse(200, {
        contentType: 'image/png',
        dataBase64: encodeBase64(bytes),
      }),
    ])

    await expect(client.getPortraitPoseImage(jobId, 'sit')).resolves.toEqual({
      contentType: 'image/png',
      bytes,
    })
    expect(requests[0].url).toBe(
      `https://api.example.com/v1/portraits/generations/${jobId}/poses/sit`,
    )
  })

  it('缺少凭证时抛 TOKEN_MISSING', async () => {
    const { client } = createClient([], null)

    await expect(
      client.getPortraitPoseImage(sampleJob('pending').id, 'sit'),
    ).rejects.toMatchObject({ code: 'TOKEN_MISSING' })
  })
})
