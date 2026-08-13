/**
 * CloudSync：客户端（web / 小程序）访问 services/api 云功能的纯 TS 模块。
 *
 * 平台差异全部经注入解决：HTTP 用最小化的 `CloudFetch` 端口（浏览器传
 * 原生 fetch，小程序可包 Taro.request，测试可包 fastify inject），凭证
 * 持久化用 `CloudCredentialStore` 端口（localStorage / wx.storage / 内存）。
 * 类型与错误码全部来自 @bravecat/contracts；本文件只做 type-only 导入，
 * 不引入 zod 运行时，客户端 bundle 零额外依赖。
 *
 * 冲突语义（刻意简单，取舍如下）：
 * - 服务端是 last-writer-wins 的黑盒 blob 存储，带两道版本护栏：
 *   下发时云端 schemaVersion 更高则 426 拒绝（提示升级客户端），
 *   上传时旧 schema 不得覆盖新 schema（409）。
 * - 客户端策略是「本地未保存改动优先推送」：会话内本地永远是事实来源，
 *   落盘后推送覆盖云端；只有启动时发现云端 exportedAt 更新才反向覆盖
 *   本地（覆盖前由调用方先做本地备份，见 apps/web 的接线）。
 * - 取舍：接受「两台设备同时离线游玩时，较旧一方的改动被覆盖（留有
 *   导出备份兜底）」，换取无向量时钟、无字段级合并的极简实现——
 *   单人休闲游戏的并发写入窗口极小，不值得为它引入合并复杂度。
 */
import {
  SAVE_SCHEMA_VERSION,
  type SaveDocument,
} from '@bravecat/contracts/save-document'
import {
  MAX_PORTRAIT_PHOTO_BYTES,
  PORTRAIT_PHOTO_CONTENT_TYPES,
  SETTLED_GENERATION_JOB_STATUSES,
  type PortraitPhotoContentType,
} from '@bravecat/contracts/portrait-generation'
import type {
  ApiErrorCode,
  ApiErrorResponse,
  AuthTokenResponse,
  ConfirmGenerationResponse,
  CreditBalanceResponse,
  GenerationFailure,
  GenerationJob,
  GenerationJobResponse,
  GenerationJobStatus,
  GetSaveResponse,
  ListPortraitsResponse,
  MetaResponse,
  PortraitPose,
  PortraitPoseImageResponse,
  PutSaveRequest,
  PutSaveResponse,
  SubmitGenerationRequest,
  UploadPortraitPhotoRequest,
  UploadPortraitPhotoResponse,
  UserPortrait,
} from '@bravecat/contracts'

export {
  MAX_PORTRAIT_PHOTO_BYTES,
  PORTRAIT_PHOTO_CONTENT_TYPES,
  SAVE_SCHEMA_VERSION,
}
export type {
  ConfirmGenerationResponse,
  GenerationFailure,
  GenerationJob,
  GenerationJobStatus,
  MetaResponse,
  PortraitPhotoContentType,
  PortraitPose,
  SaveDocument,
  UserPortrait,
}

// 错误码字面量经类型注解与 contracts 对齐：contracts 改名时这里编译失败。
// 不直接 import ErrorCode 常量，避免把 contracts 主入口的 zod 带进客户端 bundle。
const SAVE_NOT_FOUND: ApiErrorCode = 'SAVE_NOT_FOUND'
const SAVE_SCHEMA_TOO_NEW: ApiErrorCode = 'SAVE_SCHEMA_TOO_NEW'
const INTERNAL_ERROR: ApiErrorCode = 'INTERNAL_ERROR'
const VALIDATION_FAILED: ApiErrorCode = 'VALIDATION_FAILED'

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const BASE64_INDEX = new Map(
  [...BASE64_CHARS].map((char, index) => [char, index] as const),
)

/** 平台无关的 base64 编码（浏览器无 Buffer、btoa 对二进制不友好）。 */
export const encodeBase64 = (bytes: Uint8Array): string => {
  let output = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const byte0 = bytes[i]
    const byte1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const byte2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    output += BASE64_CHARS[byte0 >> 2]
    output += BASE64_CHARS[((byte0 & 0b11) << 4) | (byte1 >> 4)]
    output += i + 1 < bytes.length
      ? BASE64_CHARS[((byte1 & 0b1111) << 2) | (byte2 >> 6)]
      : '='
    output += i + 2 < bytes.length ? BASE64_CHARS[byte2 & 0b111111] : '='
  }
  return output
}

/** 平台无关的 base64 解码；非法字符抛错。 */
export const decodeBase64 = (text: string): Uint8Array => {
  const trimmed = text.replace(/=+$/u, '')
  const bytes = new Uint8Array(Math.floor((trimmed.length * 3) / 4))
  let cursor = 0
  let buffer = 0
  let bits = 0
  for (const char of trimmed) {
    const value = BASE64_INDEX.get(char)
    if (value === undefined) {
      throw new Error(`非法 base64 字符：${char}`)
    }
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes[cursor] = (buffer >> bits) & 0xff
      cursor += 1
    }
  }
  return bytes
}

/** 生成 job 是否已到终态（轮询可以停止）。 */
export const isGenerationJobSettled = (
  status: GenerationJobStatus,
): boolean =>
  (SETTLED_GENERATION_JOB_STATUSES as readonly GenerationJobStatus[]).includes(
    status,
  )

/** 最小化 HTTP 响应：只要求状态码与 JSON 解码。 */
export interface CloudHttpResponse {
  status: number
  json(): Promise<unknown>
}

/** 最小化 HTTP 端口；浏览器原生 fetch 可直接赋值。 */
export type CloudFetch = (
  url: string,
  init?: {
    method?: 'GET' | 'POST' | 'PUT'
    headers?: Record<string, string>
    body?: string
  },
) => Promise<CloudHttpResponse>

export interface CloudCredentials {
  userId: string
  /** 不透明 bearer token，服务端只存哈希；丢失即账号丢失（ADR-0009）。 */
  token: string
}

/** 凭证持久化端口：web 用 localStorage，小程序用 wx.storage。 */
export interface CloudCredentialStore {
  load(): CloudCredentials | null | Promise<CloudCredentials | null>
  save(credentials: CloudCredentials): void | Promise<void>
}

export type CloudSyncErrorCode = ApiErrorCode | 'TOKEN_MISSING'

/** 非预期分支的统一错误；预期分支（无存档 / 版本护栏）走结果联合类型。 */
export class CloudSyncError extends Error {
  constructor(
    readonly code: CloudSyncErrorCode,
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'CloudSyncError'
  }
}

export type PullSaveResult =
  | { status: 'ok'; document: SaveDocument; savedAt: number }
  /** 云端还没有存档（首次同步）。 */
  | { status: 'empty' }
  /** 版本护栏：云端 schemaVersion 高于客户端声明，需提示升级。 */
  | { status: 'schema-too-new'; cloudSchemaVersion: number }

export type PushSaveResult =
  | { status: 'ok'; savedAt: number; schemaVersion: number }
  /** 版本护栏：云端已有更新 schema 的存档，旧客户端不得覆盖。 */
  | { status: 'schema-too-new'; cloudSchemaVersion: number }

export interface CloudSyncClientOptions {
  /** API 服务地址（如 http://localhost:3000），不带尾部斜杠。 */
  baseUrl: string
  fetch: CloudFetch
  credentials: CloudCredentialStore
}

export type CloudSyncClient = ReturnType<typeof createCloudSyncClient>

const readCloudSchemaVersion = (details: unknown): number => {
  if (
    typeof details === 'object'
    && details !== null
    && 'cloudSchemaVersion' in details
    && typeof details.cloudSchemaVersion === 'number'
  ) {
    return details.cloudSchemaVersion
  }
  return 0
}

export const createCloudSyncClient = (options: CloudSyncClientOptions) => {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const url = (path: string) => `${baseUrl}/v1${path}`

  const parseError = async (
    response: CloudHttpResponse,
  ): Promise<{ code: ApiErrorCode; message: string; details?: unknown }> => {
    try {
      const body = (await response.json()) as ApiErrorResponse
      return body.error
    } catch {
      return {
        code: INTERNAL_ERROR,
        message: `响应无法解析（HTTP ${response.status}）`,
        details: undefined,
      }
    }
  }

  const throwFrom = async (response: CloudHttpResponse): Promise<never> => {
    const error = await parseError(response)
    throw new CloudSyncError(
      error.code,
      error.message,
      response.status,
      error.details,
    )
  }

  const requireCredentials = async (): Promise<CloudCredentials> => {
    const credentials = await options.credentials.load()
    if (!credentials) {
      throw new CloudSyncError(
        'TOKEN_MISSING',
        '本地没有云端账号凭证，请先调用 ensureGuestAccount',
      )
    }
    return credentials
  }

  const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

  /** 已有凭证直接复用；没有则静默创建游客账号并持久化（ADR-0009）。 */
  const ensureGuestAccount = async (): Promise<CloudCredentials> => {
    const existing = await options.credentials.load()
    if (existing) return existing

    const response = await options.fetch(url('/auth/guest'), {
      method: 'POST',
    })
    if (response.status !== 201) return throwFrom(response)
    const body = (await response.json()) as AuthTokenResponse
    const credentials: CloudCredentials = {
      userId: body.userId,
      token: body.token,
    }
    await options.credentials.save(credentials)
    return credentials
  }

  /** 上传整份存档（服务端 LWW）；exportedAt 语义由调用方决定。 */
  const pushSave = async (document: SaveDocument): Promise<PushSaveResult> => {
    const { token } = await requireCredentials()
    const payload: PutSaveRequest = { document }
    const response = await options.fetch(url('/save'), {
      method: 'PUT',
      headers: { ...bearer(token), 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (response.status === 200) {
      const body = (await response.json()) as PutSaveResponse
      return {
        status: 'ok',
        savedAt: body.savedAt,
        schemaVersion: body.schemaVersion,
      }
    }
    if (response.status === 409) {
      const error = await parseError(response)
      if (error.code === SAVE_SCHEMA_TOO_NEW) {
        return {
          status: 'schema-too-new',
          cloudSchemaVersion: readCloudSchemaVersion(error.details),
        }
      }
      throw new CloudSyncError(error.code, error.message, 409, error.details)
    }
    return throwFrom(response)
  }

  /** 下载云存档；默认声明当前构建支持的最高 schemaVersion。 */
  const pullSave = async (
    maxSchemaVersion: number = SAVE_SCHEMA_VERSION,
  ): Promise<PullSaveResult> => {
    const { token } = await requireCredentials()
    const response = await options.fetch(
      url(`/save?maxSchemaVersion=${maxSchemaVersion}`),
      { headers: bearer(token) },
    )
    if (response.status === 200) {
      const body = (await response.json()) as GetSaveResponse
      return { status: 'ok', document: body.document, savedAt: body.savedAt }
    }
    const error = await parseError(response)
    if (response.status === 404 && error.code === SAVE_NOT_FOUND) {
      return { status: 'empty' }
    }
    if (response.status === 426 && error.code === SAVE_SCHEMA_TOO_NEW) {
      return {
        status: 'schema-too-new',
        cloudSchemaVersion: readCloudSchemaVersion(error.details),
      }
    }
    throw new CloudSyncError(
      error.code,
      error.message,
      response.status,
      error.details,
    )
  }

  /** 生成次数余额：严格服务端权威（ADR-0006），客户端只读展示。 */
  const getCreditsBalance = async (): Promise<number> => {
    const { token } = await requireCredentials()
    const response = await options.fetch(url('/credits/balance'), {
      headers: bearer(token),
    })
    if (response.status !== 200) return throwFrom(response)
    const body = (await response.json()) as CreditBalanceResponse
    return body.balance
  }

  /** 平台元信息（最低版本 / 功能开关），无需认证。 */
  const getMeta = async (): Promise<MetaResponse> => {
    const response = await options.fetch(url('/meta'))
    if (response.status !== 200) return throwFrom(response)
    return (await response.json()) as MetaResponse
  }

  /**
   * 上传形象生成用的照片，返回提交生成时引用的 photoKey。
   * 字节走 JSON + base64（服务端复用 bodyLimit 与 AssetStorage 端口，
   * 客户端复用字符串体的 CloudFetch 端口；生产接 OSS 后换预签名 URL）。
   */
  const uploadPortraitPhoto = async (input: {
    bytes: Uint8Array
    contentType: PortraitPhotoContentType
  }): Promise<string> => {
    if (input.bytes.length === 0) {
      throw new CloudSyncError(VALIDATION_FAILED, '照片内容为空')
    }
    if (input.bytes.length > MAX_PORTRAIT_PHOTO_BYTES) {
      throw new CloudSyncError(
        VALIDATION_FAILED,
        `照片超过大小上限（${MAX_PORTRAIT_PHOTO_BYTES} 字节）`,
      )
    }
    const { token } = await requireCredentials()
    const payload: UploadPortraitPhotoRequest = {
      contentType: input.contentType,
      dataBase64: encodeBase64(input.bytes),
    }
    const response = await options.fetch(url('/portraits/photos'), {
      method: 'POST',
      headers: { ...bearer(token), 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (response.status !== 201) return throwFrom(response)
    return ((await response.json()) as UploadPortraitPhotoResponse).photoKey
  }

  /** 提交生成 job（预扣 1 次）；同幂等键重放返回同一 job（202 新建 / 200 重放）。 */
  const submitPortraitGeneration = async (
    input: SubmitGenerationRequest,
  ): Promise<GenerationJob> => {
    const { token } = await requireCredentials()
    const response = await options.fetch(url('/portraits/generations'), {
      method: 'POST',
      headers: { ...bearer(token), 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (response.status !== 202 && response.status !== 200) {
      return throwFrom(response)
    }
    return ((await response.json()) as GenerationJobResponse).job
  }

  /** 查询生成 job 当前状态。 */
  const getPortraitGeneration = async (
    jobId: string,
  ): Promise<GenerationJob> => {
    const { token } = await requireCredentials()
    const response = await options.fetch(
      url(`/portraits/generations/${jobId}`),
      { headers: bearer(token) },
    )
    if (response.status !== 200) return throwFrom(response)
    return ((await response.json()) as GenerationJobResponse).job
  }

  /**
   * 轮询生成 job 直到终态（awaiting_confirm / confirmed / failed）。
   * 每轮经 onUpdate 通知最新状态；isCancelled 返回 true 时提前停止
   * 并返回最近一次状态（页面关闭等场景由调用方兜底）。
   */
  const waitForPortraitGeneration = async (
    jobId: string,
    waitOptions: {
      intervalMs?: number
      onUpdate?: (job: GenerationJob) => void
      isCancelled?: () => boolean
      /** 可注入睡眠，单测用；默认 setTimeout。 */
      sleep?: (ms: number) => Promise<void>
    } = {},
  ): Promise<GenerationJob> => {
    const intervalMs = waitOptions.intervalMs ?? 2_000
    const sleep = waitOptions.sleep
      ?? ((ms: number) => new Promise<void>((resolve) => {
        setTimeout(resolve, ms)
      }))
    for (;;) {
      const job = await getPortraitGeneration(jobId)
      waitOptions.onUpdate?.(job)
      if (isGenerationJobSettled(job.status) || waitOptions.isCancelled?.()) {
        return job
      }
      await sleep(intervalMs)
    }
  }

  /** 确认生成结果：落定消耗并产出形象记录（ADR-0004 只向未来生效）。 */
  const confirmPortraitGeneration = async (
    jobId: string,
  ): Promise<ConfirmGenerationResponse> => {
    const { token } = await requireCredentials()
    const response = await options.fetch(
      url(`/portraits/generations/${jobId}/confirm`),
      { method: 'POST', headers: bearer(token) },
    )
    if (response.status !== 200) return throwFrom(response)
    return (await response.json()) as ConfirmGenerationResponse
  }

  /** 当前账号全部已确认形象（按创建时间升序）。 */
  const listPortraits = async (): Promise<UserPortrait[]> => {
    const { token } = await requireCredentials()
    const response = await options.fetch(url('/portraits'), {
      headers: bearer(token),
    })
    if (response.status !== 200) return throwFrom(response)
    return ((await response.json()) as ListPortraitsResponse).portraits
  }

  /** 读取某个 job 的姿势产出图字节（确认页预览与已确认形象渲染共用）。 */
  const getPortraitPoseImage = async (
    jobId: string,
    pose: PortraitPose,
  ): Promise<{ contentType: string; bytes: Uint8Array }> => {
    const { token } = await requireCredentials()
    const response = await options.fetch(
      url(`/portraits/generations/${jobId}/poses/${pose}`),
      { headers: bearer(token) },
    )
    if (response.status !== 200) return throwFrom(response)
    const body = (await response.json()) as PortraitPoseImageResponse
    return {
      contentType: body.contentType,
      bytes: decodeBase64(body.dataBase64),
    }
  }

  return {
    ensureGuestAccount,
    pushSave,
    pullSave,
    getCreditsBalance,
    getMeta,
    uploadPortraitPhoto,
    submitPortraitGeneration,
    getPortraitGeneration,
    waitForPortraitGeneration,
    confirmPortraitGeneration,
    listPortraits,
    getPortraitPoseImage,
  }
}

export type StartupSyncDecision =
  | { action: 'push-local' }
  | { action: 'adopt-cloud'; document: SaveDocument; savedAt: number }
  | { action: 'upgrade-required'; cloudSchemaVersion: number }

/**
 * 启动同步的纯决策逻辑（与 UI / 网络解耦，便于各端复用与单测）。
 *
 * 策略（简单优先，取舍见本模块头注释与 ADR-0009）：
 * - 版本护栏最优先：云端 schemaVersion 更高 → 提示升级，本会话停用推送。
 * - exportedAt 较新者胜。云端文档的 exportedAt 语义是「来源设备最后一次
 *   本地改动的时间」（推送时由来源端写入），与本地记录的
 *   lastLocalChangeAt 直接可比：同设备回访时两者相等 → 本地未保存
 *   改动优先推送，不会误触备份下载。
 * - 云端较新（其他设备玩过）→ 以云端为准；覆盖本地前由调用方先备份
 *   本地存档——数据安全优先于同步便利。
 */
export const decideStartupSync = (
  pull: PullSaveResult,
  /** 本地最后一次真实改动的时间戳；null = 本设备从未记录过改动。 */
  lastLocalChangeAt: number | null,
): StartupSyncDecision => {
  if (pull.status === 'schema-too-new') {
    return {
      action: 'upgrade-required',
      cloudSchemaVersion: pull.cloudSchemaVersion,
    }
  }
  if (pull.status === 'empty') {
    return { action: 'push-local' }
  }
  if (pull.document.exportedAt > (lastLocalChangeAt ?? 0)) {
    return {
      action: 'adopt-cloud',
      document: pull.document,
      savedAt: pull.savedAt,
    }
  }
  return { action: 'push-local' }
}
