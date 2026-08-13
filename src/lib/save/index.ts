import Dexie, { type Table } from 'dexie'

export const SAVE_SCHEMA_VERSION = 4 as const

export interface SaveDocument<TState> {
  schemaVersion: number
  exportedAt: number
  state: TState
}

export interface SaveStore<TState> {
  load(): Promise<TState | undefined>
  save(state: TState): Promise<void>
  export(state: TState): SaveDocument<TState>
  import(document: unknown): Promise<TState>
}

export type SaveMigration = (
  document: SaveDocument<unknown>,
) => SaveDocument<unknown>

export interface SaveStoreOptions<TState> {
  validateState?: (value: unknown) => value is TState
  now?: () => number
  migrations?: Readonly<Record<number, SaveMigration>>
}

interface StoredState {
  key: 'current'
  state: unknown
}

class BraveCatDatabase extends Dexie {
  state!: Table<StoredState, StoredState['key']>

  constructor(name: string) {
    super(name)
    this.version(SAVE_SCHEMA_VERSION).stores({
      state: 'key',
    })
  }
}

export const createIndexedDbSaveStore = <TState>(
  databaseName = 'bravecat',
  options: SaveStoreOptions<TState> = {},
): SaveStore<TState> => {
  const database = new BraveCatDatabase(databaseName)
  const validateState = options.validateState ?? (
    (_value: unknown): _value is TState => true
  )

  const save = async (state: TState) => {
    await database.state.put({ key: 'current', state })
  }

  return {
    load: async () => {
      const stored = await database.state.get('current')
      return stored?.state as TState | undefined
    },
    save,
    export: (state) => ({
      schemaVersion: SAVE_SCHEMA_VERSION,
      exportedAt: (options.now ?? Date.now)(),
      state,
    }),
    import: async (document) => {
      if (
        typeof document !== 'object'
        || document === null
        || !('schemaVersion' in document)
        || typeof document.schemaVersion !== 'number'
        || !('exportedAt' in document)
        || typeof document.exportedAt !== 'number'
        || !('state' in document)
      ) {
        throw new TypeError('存档文件结构无效')
      }

      let migrated = document as SaveDocument<unknown>
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

      const state = migrated.state
      await save(state)
      return state
    },
  }
}
