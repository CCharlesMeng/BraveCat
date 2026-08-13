/**
 * 小程序端云同步编排（对应 web 端 apps/web/src/lib/cloudSync.svelte.ts）：
 * 把 @bravecat/core/cloud 的 CloudSyncClient 接到 wx（Taro.request +
 * wx storage），状态经 subscribe/getSnapshot 暴露给 React
 * （useSyncExternalStore），不含框架原语。
 *
 * 同步节奏（与 web 端对齐）：
 * - 启动（hydrate 完成后）：静默创建游客账号 → pull 比较（决策纯函数
 *   decideStartupSync 在 @bravecat/core/cloud）→ 以云端为准前先把
 *   本地存档写入备份槽（小程序没有文件下载，见 platform/cloudBackup.ts；
 *   备份写入失败则不覆盖本地——数据安全优先）。
 * - 会话内：controller 每次落盘经 notifyLocalSaved 通知，10 秒节流
 *   合并推送；推送失败只降级状态显示，改动仍在本地，下次落盘或
 *   下次启动时重试。
 * - 退出小程序时不做冲刺推送；尾窗内的改动由下次启动的「本地未保存
 *   改动优先推送」兜底，服务端 LWW 保证安全。
 */
import Taro from '@tarojs/taro'
import {
  createCloudSyncClient,
  decideStartupSync,
  type SaveDocument,
} from '@bravecat/core/cloud'
import type { GameState } from '@bravecat/core/game'
import { taroCloudFetch } from '../platform/cloudFetch'
import { wxCloudCredentialStore } from '../platform/cloudCredentials'
import { writeCloudBackup } from '../platform/cloudBackup'

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
  'upgrade-required': '云端存档来自更新的版本，请先升级小程序再同步。',
  'server-off': '云同步暂时未开放。',
}

export interface CloudSyncSnapshot {
  status: CloudSyncStatus
  statusText: string
  accountId: string | null
  creditsBalance: number | null
  notice: string
}

const readLastLocalChange = async (): Promise<number | null> => {
  try {
    const { data } = await Taro.getStorage({ key: LAST_LOCAL_CHANGE_KEY })
    const parsed = Number(data)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

const writeLastLocalChange = (at: number) => {
  Taro.setStorage({ key: LAST_LOCAL_CHANGE_KEY, data: String(at) })
    .catch(() => {
      // 忽略：仅影响下次会话的较新者胜比较基准。
    })
}

export interface MiniCloudSyncDeps {
  baseUrl: string
  exportDocument(): SaveDocument<GameState>
  importDocument(raw: unknown): Promise<void>
  /** 本地还没有实质进度（未领养）时跳过备份，避免无意义的备份槽占用。 */
  hasLocalProgress(): boolean
  now?: () => number
}

export type MiniCloudSync = ReturnType<typeof createMiniCloudSync>

export const createMiniCloudSync = (deps: MiniCloudSyncDeps) => {
  const now = deps.now ?? Date.now
  const client = createCloudSyncClient({
    baseUrl: deps.baseUrl,
    fetch: taroCloudFetch,
    credentials: wxCloudCredentialStore,
  })

  let snapshot: CloudSyncSnapshot = {
    status: 'connecting',
    statusText: STATUS_TEXT.connecting,
    accountId: null,
    creditsBalance: null,
    notice: '',
  }
  const listeners = new Set<() => void>()

  const setState = (
    patch: Partial<Omit<CloudSyncSnapshot, 'statusText'>>,
  ) => {
    const next = { ...snapshot, ...patch }
    next.statusText = STATUS_TEXT[next.status]
    snapshot = next
    for (const listener of listeners) listener()
  }

  let started = false
  /** 启动同步完成且未触发版本护栏后才允许节流推送。 */
  let ready = false
  let dirty = false
  let latestExport: (() => SaveDocument<GameState>) | null = null
  let pushTimer: ReturnType<typeof setTimeout> | null = null
  let lastLocalChangeAt: number | null = null

  const recordLocalChange = (at: number) => {
    lastLocalChangeAt = at
    writeLastLocalChange(at)
  }

  const pushNow = async (): Promise<'ok' | 'failed' | 'upgrade-required'> => {
    // exportedAt 写入「最后一次本地改动时间」而非推送时刻，
    // 使跨设备的较新者胜比较有稳定语义（见 core cloud 的 decideStartupSync）。
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
        setState({ status: 'upgrade-required' })
        return 'upgrade-required'
      }
      // 推送期间又有新落盘（dirty 重新置位）时保持 pending，等下一轮。
      if (!dirty) setState({ status: 'synced' })
      return 'ok'
    } catch {
      dirty = true
      setState({ status: 'error' })
      return 'failed'
    }
  }

  const schedulePush = () => {
    setState({ status: 'pending' })
    if (pushTimer !== null) return
    pushTimer = setTimeout(() => {
      pushTimer = null
      void pushNow()
    }, PUSH_THROTTLE_MS)
  }

  /** 启动同步；在 hydrateOnce() 完成后调用一次。 */
  const start = async () => {
    started = true
    setState({ status: 'connecting' })
    try {
      const stored = await readLastLocalChange()
      // 读取期间已有落盘记录时以内存值为准（更新）。
      if (lastLocalChangeAt === null) lastLocalChangeAt = stored

      const meta = await client.getMeta()
      if (meta.platforms.miniprogram?.featureFlags?.cloudSave === false) {
        setState({ status: 'server-off' })
        return
      }

      const credentials = await client.ensureGuestAccount()
      setState({ accountId: credentials.userId })

      const decision = decideStartupSync(
        await client.pullSave(),
        lastLocalChangeAt,
      )
      if (decision.action === 'upgrade-required') {
        setState({ status: 'upgrade-required' })
        return
      }
      let pushOutcome: 'ok' | 'failed' | 'upgrade-required' = 'ok'
      if (decision.action === 'adopt-cloud') {
        if (deps.hasLocalProgress()) {
          // 备份失败会抛到外层 catch：不备份就不覆盖本地。
          await writeCloudBackup(deps.exportDocument(), now())
          setState({
            notice: '云端的进度更新一些，已换用云端存档；'
              + '原来的本地存档已存入备份槽，可以在下方恢复。',
          })
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
        setState({ status: 'synced' })
      }

      try {
        setState({ creditsBalance: await client.getCreditsBalance() })
      } catch {
        // 余额只是展示信息，拉取失败不影响同步。
      }
    } catch {
      setState({ status: 'error' })
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
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start,
    notifyLocalSaved,
  }
}
