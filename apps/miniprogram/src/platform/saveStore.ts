/**
 * SaveStore 的微信小程序实现：wx storage 里的单 JSON blob。
 *
 * 与 web 端（IndexedDB：库名 bravecat / 键 current，见
 * packages/core/src/save/index.ts）语义对齐：
 * - 键名 `${name}:current`，对应 web 的「库名 + current 键」；
 * - schemaVersion 语义一致：落盘为 SaveDocument 信封
 *   （schemaVersion + exportedAt + state），import 走与 core 相同的
 *   逐版本迁移链（迁移函数由 GameController 注入，v0→…→当前版本）；
 * - 相对 web 的增强：web 的 load 只回裸 state（旧档靠 restoreGameState
 *   宽松恢复），这里 load 也走完整迁移链——语义是 web 的超集，
 *   controller 侧行为不变。
 *
 * 容量注意：wx storage 单键 1MB、总量 10MB；当前存档远小于该值，
 * 超限会在 save 时抛错，由 controller 转成 saveFailed 提示。
 */
import Taro from '@tarojs/taro'
import { SAVE_SCHEMA_VERSION } from '@bravecat/contracts/save-document'
import type {
  SaveDocument,
  SaveStore,
  SaveStoreOptions,
} from '@bravecat/core'

const parseDocument = (raw: unknown): SaveDocument<unknown> => {
  if (
    typeof raw !== 'object'
    || raw === null
    || !('schemaVersion' in raw)
    || typeof raw.schemaVersion !== 'number'
    || !('exportedAt' in raw)
    || typeof raw.exportedAt !== 'number'
    || !('state' in raw)
  ) {
    throw new TypeError('存档文件结构无效')
  }
  return raw as SaveDocument<unknown>
}

export const createWxStorageSaveStore = <TState>(
  storageName = 'bravecat',
  options: SaveStoreOptions<TState> = {},
): SaveStore<TState> => {
  const key = `${storageName}:current`
  const validateState = options.validateState ?? (
    (_value: unknown): _value is TState => true
  )

  const migrateToCurrent = (document: SaveDocument<unknown>): TState => {
    let migrated = document
    while (migrated.schemaVersion < SAVE_SCHEMA_VERSION) {
      const migrate = options.migrations?.[migrated.schemaVersion]
      if (!migrate) {
        throw new RangeError(`不支持的存档版本：${migrated.schemaVersion}`)
      }

      const previousVersion = migrated.schemaVersion
      migrated = migrate(migrated)
      if (migrated.schemaVersion !== previousVersion + 1) {
        throw new RangeError(`存档迁移没有生成连续版本：${previousVersion}`)
      }
    }
    if (migrated.schemaVersion !== SAVE_SCHEMA_VERSION) {
      throw new RangeError(`不支持的存档版本：${migrated.schemaVersion}`)
    }
    if (!validateState(migrated.state)) {
      throw new TypeError('存档内容不完整或已损坏')
    }
    return migrated.state
  }

  const toDocument = (state: TState): SaveDocument<TState> => ({
    schemaVersion: SAVE_SCHEMA_VERSION,
    exportedAt: (options.now ?? Date.now)(),
    state,
  })

  const save = async (state: TState) => {
    await Taro.setStorage({ key, data: JSON.stringify(toDocument(state)) })
  }

  return {
    load: async () => {
      let raw: unknown
      try {
        raw = (await Taro.getStorage({ key })).data
      } catch {
        // 键不存在时 wx.getStorage 走 fail 分支，等价于「没有存档」。
        return undefined
      }
      if (raw === undefined || raw === null || raw === '') return undefined
      const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
      return migrateToCurrent(parseDocument(parsed))
    },
    save,
    export: (state) => toDocument(state),
    import: async (document) => {
      const state = migrateToCurrent(parseDocument(document))
      await save(state)
      return state
    },
  }
}
