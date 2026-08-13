/**
 * 启动同步编排的单测：wx API 面（request / storage / login）全部由
 * taroMock 接管，HTTP 响应按路由脚本化，走真实的 CloudSyncClient +
 * decideStartupSync + wx 适配器整条链。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAVE_SCHEMA_VERSION, type SaveDocument } from '@bravecat/core/cloud'
import type { GameState } from '@bravecat/core/game'
import {
  resetTaroMock,
  state,
  storage,
  type MockRequestOptions,
  type MockRequestResponse,
} from '../platform/testing/taroMock'
import { createMiniCloudSync } from './cloudSync'

type RouteHandler = (options: MockRequestOptions) => MockRequestResponse

const DEFAULT_ROUTES: Record<string, RouteHandler> = {
  'GET /v1/meta': () => ({
    statusCode: 200,
    data: {
      platforms: {
        miniprogram: { minClientVersion: '0.0.0', featureFlags: {} },
      },
      serverTime: 0,
    },
  }),
  'POST /v1/auth/guest': () => ({
    statusCode: 201,
    data: { userId: 'user-uuid-abcdef', token: 'tok-1', tokenType: 'Bearer' },
  }),
  'GET /v1/save': () => ({
    statusCode: 404,
    data: { error: { code: 'SAVE_NOT_FOUND', message: '云端还没有存档' } },
  }),
  'PUT /v1/save': () => ({
    statusCode: 200,
    data: { savedAt: 500, schemaVersion: SAVE_SCHEMA_VERSION },
  }),
  'GET /v1/credits/balance': () => ({
    statusCode: 200,
    data: { balance: 3 },
  }),
}

const routeKey = (options: MockRequestOptions) => {
  const path = options.url.replace('https://api.test', '').split('?')[0]
  return `${options.method ?? 'GET'} ${path}`
}

const scriptRoutes = (overrides: Record<string, RouteHandler> = {}) => {
  state.requestHandler = (options) => {
    const handler = overrides[routeKey(options)]
      ?? DEFAULT_ROUTES[routeKey(options)]
    if (!handler) {
      throw { errMsg: `request:fail 未脚本化路由 ${routeKey(options)}` }
    }
    return handler(options)
  }
}

const requestsTo = (key: string) => (
  state.requests.filter((request) => routeKey(request) === key)
)

const localDocument = (
  exportedAt: number,
  marker = 'local',
): SaveDocument<GameState> => ({
  schemaVersion: SAVE_SCHEMA_VERSION,
  exportedAt,
  state: { marker },
}) as unknown as SaveDocument<GameState>

const cloudDocument = (exportedAt: number) => ({
  schemaVersion: SAVE_SCHEMA_VERSION,
  exportedAt,
  state: { marker: 'cloud' },
})

const createSync = (
  overrides: Partial<Parameters<typeof createMiniCloudSync>[0]> = {},
) => {
  const imported: unknown[] = []
  const sync = createMiniCloudSync({
    baseUrl: 'https://api.test',
    exportDocument: () => localDocument(100),
    importDocument: async (raw) => {
      imported.push(raw)
    },
    hasLocalProgress: () => true,
    now: () => 100,
    ...overrides,
  })
  return { sync, imported }
}

describe('createMiniCloudSync 启动同步', () => {
  beforeEach(() => {
    resetTaroMock()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('首次同步：静默建号、凭证落 wx storage、本地存档推上云端', async () => {
    scriptRoutes()
    const { sync, imported } = createSync()

    await sync.start()

    const snapshot = sync.getSnapshot()
    expect(snapshot.status).toBe('synced')
    expect(snapshot.accountId).toBe('user-uuid-abcdef')
    expect(snapshot.creditsBalance).toBe(3)
    expect(imported).toEqual([])

    // 凭证存取：ensureGuestAccount 的结果持久化到 wx storage。
    expect(storage.get('bravecat.cloud.credentials')).toBe(
      JSON.stringify({ userId: 'user-uuid-abcdef', token: 'tok-1' }),
    )
    // 推送带 bearer token，exportedAt 写入本地改动时间（now）。
    const [push] = requestsTo('PUT /v1/save')
    expect(push.header?.authorization).toBe('Bearer tok-1')
    const body = JSON.parse(push.data as string) as {
      document: { exportedAt: number }
    }
    expect(body.document.exportedAt).toBe(100)
    expect(storage.get('bravecat.cloud.lastLocalChangeAt')).toBe('100')
  })

  it('已有凭证时复用账号，不再 POST /auth/guest', async () => {
    scriptRoutes()
    storage.set(
      'bravecat.cloud.credentials',
      JSON.stringify({ userId: 'user-uuid-abcdef', token: 'tok-1' }),
    )
    const { sync } = createSync()

    await sync.start()

    expect(requestsTo('POST /v1/auth/guest')).toHaveLength(0)
    expect(sync.getSnapshot().accountId).toBe('user-uuid-abcdef')
  })

  it('版本护栏：云端 schema 更高（426）时提示升级，不覆盖也不推送', async () => {
    scriptRoutes({
      'GET /v1/save': () => ({
        statusCode: 426,
        data: {
          error: {
            code: 'SAVE_SCHEMA_TOO_NEW',
            message: '云端存档需要更新的客户端',
            details: { cloudSchemaVersion: SAVE_SCHEMA_VERSION + 1 },
          },
        },
      }),
    })
    const { sync, imported } = createSync()

    await sync.start()

    expect(sync.getSnapshot().status).toBe('upgrade-required')
    expect(imported).toEqual([])
    expect(requestsTo('PUT /v1/save')).toHaveLength(0)

    // 护栏触发后本会话停用推送：落盘通知不再排任何请求。
    const requestCount = state.requests.length
    sync.notifyLocalSaved(() => localDocument(999))
    expect(state.requests.length).toBe(requestCount)
  })

  it('版本护栏：推送被 409 拒绝时同样转为提示升级', async () => {
    scriptRoutes({
      'PUT /v1/save': () => ({
        statusCode: 409,
        data: {
          error: {
            code: 'SAVE_SCHEMA_TOO_NEW',
            message: '旧 schema 不得覆盖新 schema',
            details: { cloudSchemaVersion: SAVE_SCHEMA_VERSION + 1 },
          },
        },
      }),
    })
    const { sync } = createSync()

    await sync.start()

    expect(sync.getSnapshot().status).toBe('upgrade-required')
  })

  it('云端较新：先把本地存档写入备份槽，再换用云端存档', async () => {
    scriptRoutes({
      'GET /v1/save': () => ({
        statusCode: 200,
        data: { document: cloudDocument(200), savedAt: 900 },
      }),
    })
    storage.set('bravecat.cloud.lastLocalChangeAt', '100')
    const { sync, imported } = createSync({ now: () => 150 })

    await sync.start()

    // 备份槽：键带时间戳，内容是被覆盖前的本地存档。
    expect(storage.get('bravecat.cloud.backup:150')).toBe(
      JSON.stringify(localDocument(100)),
    )
    expect(imported).toEqual([cloudDocument(200)])
    const snapshot = sync.getSnapshot()
    expect(snapshot.status).toBe('synced')
    expect(snapshot.notice).toContain('备份')
  })

  it('本地还没有实质进度时直接采用云端，不占备份槽', async () => {
    scriptRoutes({
      'GET /v1/save': () => ({
        statusCode: 200,
        data: { document: cloudDocument(200), savedAt: 900 },
      }),
    })
    const { sync, imported } = createSync({ hasLocalProgress: () => false })

    await sync.start()

    expect(imported).toEqual([cloudDocument(200)])
    expect(storage.has('bravecat.cloud.backup:index')).toBe(false)
  })

  it('落盘后 10 秒节流合并推送，窗口结束才发最新导出', async () => {
    vi.useFakeTimers()
    scriptRoutes()
    let clock = 100
    const { sync } = createSync({ now: () => clock })

    await sync.start()
    expect(requestsTo('PUT /v1/save')).toHaveLength(1)

    clock = 200
    sync.notifyLocalSaved(() => localDocument(200, 'save-1'))
    clock = 205
    sync.notifyLocalSaved(() => localDocument(205, 'save-2'))
    expect(sync.getSnapshot().status).toBe('pending')
    expect(requestsTo('PUT /v1/save')).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(10_000)

    const pushes = requestsTo('PUT /v1/save')
    expect(pushes).toHaveLength(2)
    const body = JSON.parse(pushes[1].data as string) as {
      document: { exportedAt: number; state: { marker: string } }
    }
    expect(body.document.state.marker).toBe('save-2')
    expect(body.document.exportedAt).toBe(205)
    expect(sync.getSnapshot().status).toBe('synced')
  })

  it('服务端 featureFlags 关掉 cloudSave 时整体停用', async () => {
    scriptRoutes({
      'GET /v1/meta': () => ({
        statusCode: 200,
        data: {
          platforms: {
            miniprogram: {
              minClientVersion: '0.0.0',
              featureFlags: { cloudSave: false },
            },
          },
          serverTime: 0,
        },
      }),
    })
    const { sync } = createSync()

    await sync.start()

    expect(sync.getSnapshot().status).toBe('server-off')
    expect(requestsTo('POST /v1/auth/guest')).toHaveLength(0)
  })

  it('网络失败只降级状态显示，本地改动不受影响', async () => {
    // requestHandler 缺省即网络失败。
    const { sync, imported } = createSync()

    await sync.start()

    expect(sync.getSnapshot().status).toBe('error')
    expect(imported).toEqual([])
  })
})
