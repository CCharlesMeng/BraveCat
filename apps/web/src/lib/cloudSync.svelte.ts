/**
 * web 端云同步编排：把 @bravecat/core/cloud 的 CloudSyncClient 接到
 * 浏览器（fetch + localStorage）并暴露 Svelte runes 状态给视图。
 *
 * 同步节奏：
 * - 启动（hydrate 完成后）：静默创建游客账号 → pull 比较（决策逻辑见
 *   @bravecat/core/cloud 的 decideStartupSync）→ 以云端为准前先把
 *   本地导出为下载备份。
 * - 会话内：controller 每次落盘经 notifyLocalSaved 通知，节流推送云端；
 *   推送失败只降级状态显示，改动仍在本地，下次落盘或下次启动时重试。
 * - 关闭页面时不做冲刺推送（unload 期间的请求不可靠）；尾窗内的改动
 *   由下次启动的「本地未保存改动优先推送」兜底，服务端 LWW 保证安全。
 */
import {
  createCloudSyncClient,
  decideStartupSync,
  type BindPhoneResult,
  type CloudCredentials,
  type SaveDocument,
  type SmsCodePurpose,
} from '@bravecat/core/cloud'
import type { GameState } from '@bravecat/core/game'

const CREDENTIALS_KEY = 'bravecat.cloud.credentials'
const LAST_LOCAL_CHANGE_KEY = 'bravecat.cloud.lastLocalChangeAt'
/** 落盘到推送的节流窗口；窗口内的多次落盘合并为一次推送。 */
const PUSH_THROTTLE_MS = 10_000

export type CloudSyncStatus =
  | 'connecting'
  | 'synced'
  | 'pending'
  | 'error'
  | 'upgrade-required'
  | 'server-off'

const STATUS_TEXT: Record<CloudSyncStatus, string> = {
  connecting: '正在和云端对上话……',
  synced: '云端已保存好这个家。',
  pending: '有新的变化，稍后会送到云端。',
  error: '这次没能连上云端，改动仍安全地留在本地。',
  'upgrade-required': '云端存档来自更新的版本，请先升级客户端再同步。',
  'server-off': '云同步暂时未开放。',
}

/** localStorage 不可用（隐私模式等）时静默降级：凭证不持久化。 */
const readStorage = (key: string): string | null => {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}
const writeStorage = (key: string, value: string) => {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // 忽略：仅影响下次会话的复用，不影响本次同步。
  }
}

const credentialStore = {
  load: (): CloudCredentials | null => {
    const raw = readStorage(CREDENTIALS_KEY)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as Partial<CloudCredentials>
      return typeof parsed.userId === 'string'
        && typeof parsed.token === 'string'
        ? { userId: parsed.userId, token: parsed.token }
        : null
    } catch {
      return null
    }
  },
  save: (credentials: CloudCredentials) => {
    writeStorage(CREDENTIALS_KEY, JSON.stringify(credentials))
  },
}

const readLastLocalChange = (): number | null => {
  const raw = readStorage(LAST_LOCAL_CHANGE_KEY)
  const parsed = raw === null ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export interface WebCloudSyncDeps {
  baseUrl: string
  exportDocument(): SaveDocument<GameState>
  importDocument(raw: unknown): Promise<void>
  /** 以云端为准前把本地存档导出为下载备份（数据安全优先）。 */
  backupLocal(document: SaveDocument<GameState>): void
  /** 本地还没有实质进度（未领养）时跳过备份，避免无意义的下载。 */
  hasLocalProgress(): boolean
  now?: () => number
}

export type WebCloudSync = ReturnType<typeof createWebCloudSync>

export const createWebCloudSync = (deps: WebCloudSyncDeps) => {
  const now = deps.now ?? Date.now
  const client = createCloudSyncClient({
    baseUrl: deps.baseUrl,
    fetch: (url, init) => fetch(url, init),
    credentials: credentialStore,
  })

  let status = $state<CloudSyncStatus>('connecting')
  let accountId = $state<string | null>(null)
  let creditsBalance = $state<number | null>(null)
  let notice = $state('')
  /** 服务端 aigcAvatar 开关；关闭时「生成专属形象」入口不出现。 */
  let aigcEnabled = $state(false)
  /** 已绑定手机号（脱敏，如 138****8000）；null = 未绑定或未知。 */
  let maskedPhone = $state<string | null>(null)

  let started = false
  /** 启动同步完成且未触发版本护栏后才允许节流推送。 */
  let ready = false
  let dirty = false
  let latestExport: (() => SaveDocument<GameState>) | null = null
  let pushTimer: number | null = null
  let lastLocalChangeAt = readLastLocalChange()

  const recordLocalChange = (at: number) => {
    lastLocalChangeAt = at
    writeStorage(LAST_LOCAL_CHANGE_KEY, String(at))
  }

  const pushNow = async (): Promise<'ok' | 'failed' | 'upgrade-required'> => {
    // exportedAt 写入「最后一次本地改动时间」而非推送时刻，
    // 使跨设备的较新者胜比较有稳定语义（见 core/cloud 的 decideStartupSync）。
    const exportedAt = lastLocalChangeAt ?? now()
    if (lastLocalChangeAt === null) recordLocalChange(exportedAt)
    const exportLatest = latestExport ?? deps.exportDocument
    const document = { ...exportLatest(), exportedAt }
    dirty = false
    latestExport = null
    try {
      const result = await client.pushSave(document)
      if (result.status === 'schema-too-new') {
        // 其他设备已用更新版本写入云端，本会话停止推送。
        ready = false
        status = 'upgrade-required'
        return 'upgrade-required'
      }
      // 推送期间又有新落盘（dirty 重新置位）时保持 pending，等下一轮。
      if (!dirty) status = 'synced'
      return 'ok'
    } catch {
      dirty = true
      status = 'error'
      return 'failed'
    }
  }

  const schedulePush = () => {
    status = 'pending'
    if (pushTimer !== null) return
    pushTimer = window.setTimeout(() => {
      pushTimer = null
      void pushNow()
    }, PUSH_THROTTLE_MS)
  }

  /** 生成次数余额只是展示信息，拉取失败不影响同步。 */
  const refreshCreditsBalance = async () => {
    try {
      creditsBalance = await client.getCreditsBalance()
    } catch {
      // 保留上一次的余额展示。
    }
  }

  /** 绑定状态只是展示信息；拉取失败保留上一次的值（启动时即 null）。 */
  const refreshIdentities = async () => {
    try {
      const { identities } = await client.getAuthIdentities()
      maskedPhone = identities.find(
        ({ provider }) => provider === 'phone',
      )?.maskedId ?? null
    } catch {
      // 保留上一次的绑定状态展示。
    }
  }

  /** 启动同步；在 controller.hydrate() 完成后调用一次。 */
  const start = async () => {
    started = true
    status = 'connecting'
    try {
      const meta = await client.getMeta()
      if (meta.platforms.web?.featureFlags?.cloudSave === false) {
        status = 'server-off'
        return
      }
      aigcEnabled = meta.platforms.web?.featureFlags?.aigcAvatar === true

      const credentials = await client.ensureGuestAccount()
      accountId = credentials.userId
      // 绑定状态与同步主流程无关，凭证就绪后异步拉取即可。
      void refreshIdentities()

      const decision = decideStartupSync(
        await client.pullSave(),
        lastLocalChangeAt,
      )
      if (decision.action === 'upgrade-required') {
        status = 'upgrade-required'
        return
      }
      let pushOutcome: 'ok' | 'failed' | 'upgrade-required' = 'ok'
      if (decision.action === 'adopt-cloud') {
        if (deps.hasLocalProgress()) {
          deps.backupLocal(deps.exportDocument())
          notice = '云端的进度更新一些，已换用云端存档；原来的本地存档已导出为备份文件。'
        }
        await deps.importDocument(decision.document)
      } else {
        pushOutcome = await pushNow()
      }
      if (pushOutcome === 'upgrade-required') return

      ready = true
      if (dirty) {
        schedulePush()
      } else if (pushOutcome === 'ok') {
        status = 'synced'
      }

      await refreshCreditsBalance()
    } catch {
      status = 'error'
    }
  }

  /** 薄透传：发码限流与失败文案都以服务端为权威。 */
  const requestSmsCode = (phoneNumber: string, purpose: SmsCodePurpose) =>
    client.requestSmsCode({ phoneNumber, purpose })

  /** 绑定手机号到当前账号；conflict 结果原样交回调用方走冲突弹窗。 */
  const bindPhone = async (
    phoneNumber: string,
    verificationCode: string,
  ): Promise<BindPhoneResult> => {
    const result = await client.bindPhone({ phoneNumber, verificationCode })
    if (result.status === 'bound') maskedPhone = result.maskedPhone
    return result
  }

  /**
   * 绑定冲突二选一里的「切换到已有账号」：备份本地 → 覆盖凭证 →
   * 采用目标账号的云端进度。复用 bind 时输入的同一组验证码——
   * 409 冲突不消费验证码，服务端接受仍有效的 bind 用途验证码登录。
   */
  const switchToPhoneAccount = async (
    phoneNumber: string,
    verificationCode: string,
  ): Promise<{ isNewUser: boolean }> => {
    // 数据安全优先：覆盖凭证前先把当前进度导出为下载备份。
    const backedUp = deps.hasLocalProgress()
    if (backedUp) deps.backupLocal(deps.exportDocument())

    // 换号期间暂停节流推送，避免把游客进度推到目标账号；
    // 登录失败（验证码错等）时凭证未被覆盖，恢复原状态继续游客同步。
    const wasReady = ready
    ready = false
    let login: { credentials: CloudCredentials; isNewUser: boolean }
    try {
      login = await client.loginWithPhone({ phoneNumber, verificationCode })
    } catch (error) {
      ready = wasReady
      throw error
    }

    // 凭证已覆盖：从这里起的失败停在 error 状态，改动仍在本地可重试。
    accountId = login.credentials.userId
    status = 'connecting'
    notice = ''
    // 新账号的余额与绑定状态只是展示信息，与同步结果无关，
    // 先行拉取让升级护栏等提前返回的路径也能刷新。
    void refreshCreditsBalance()
    void refreshIdentities()
    try {
      const pull = await client.pullSave()
      if (pull.status === 'schema-too-new') {
        status = 'upgrade-required'
        return { isNewUser: login.isNewUser }
      }
      if (pull.status === 'ok') {
        // 无条件采用云端：游客进度已在上面备份，不再做新旧比较。
        await deps.importDocument(pull.document)
        notice = backedUp
          ? '已切换到该手机号的账号并换用云端进度；原来的本地存档已导出为备份文件。'
          : '已切换到该手机号的账号，并换用它的云端进度。'
        ready = true
        // importDocument 落盘触发 notifyLocalSaved 置位 dirty，
        // 这里的节流推送只是回写同内容，无害。
        if (dirty) {
          schedulePush()
        } else {
          status = 'synced'
        }
      } else {
        // 目标账号云端还没有存档：保留当前进度并推送上去。
        ready = true
        const pushOutcome = await pushNow()
        if (pushOutcome === 'upgrade-required') {
          return { isNewUser: login.isNewUser }
        }
        notice = '已切换到该手机号的账号；它的云端还没有存档，已保留当前进度。'
      }
      return { isNewUser: login.isNewUser }
    } catch (error) {
      status = 'error'
      throw error
    }
  }

  /** controller 每次落盘后由 SaveStore 包装层调用。 */
  const notifyLocalSaved = (exportLatest: () => SaveDocument<GameState>) => {
    // hydrate 阶段的例行落盘不算玩家改动，不触发推送。
    if (!started) return
    recordLocalChange(now())
    dirty = true
    latestExport = exportLatest
    if (ready) schedulePush()
  }

  return {
    get status() {
      return status
    },
    get statusText() {
      return STATUS_TEXT[status]
    },
    get accountId() {
      return accountId
    },
    get creditsBalance() {
      return creditsBalance
    },
    get notice() {
      return notice
    },
    get aigcEnabled() {
      return aigcEnabled
    },
    get maskedPhone() {
      return maskedPhone
    },
    start,
    notifyLocalSaved,
    refreshCreditsBalance,
    refreshIdentities,
    requestSmsCode,
    bindPhone,
    switchToPhoneAccount,
    /** AIGC 形象生成闭环的客户端方法（PortraitStudio 与形象列表用）。 */
    portraits: {
      upload: client.uploadPortraitPhoto,
      submit: client.submitPortraitGeneration,
      wait: client.waitForPortraitGeneration,
      confirm: client.confirmPortraitGeneration,
      list: client.listPortraits,
      poseImage: client.getPortraitPoseImage,
    },
  }
}
