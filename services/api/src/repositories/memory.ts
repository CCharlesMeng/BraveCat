import type {
  CreditEntry,
  LedgerEntry,
  Repositories,
  StoredSave,
  UserRecord,
} from './types.js'

/** 内存实现：单测与本地无库开发用，与 Postgres 实现行为对齐。 */
export const createMemoryRepositories = (): Repositories => {
  const users = new Map<string, UserRecord>()
  const tokensByHash = new Map<string, string>()
  const saves = new Map<string, StoredSave>()
  const ledgerEntries: LedgerEntry[] = []
  const ledgerKeys = new Set<string>()
  const creditEntries: CreditEntry[] = []
  const creditKeys = new Set<string>()

  const compositeKey = (userId: string, idempotencyKey: string) =>
    `${userId}\u0000${idempotencyKey}`

  return {
    users: {
      create: async (user) => {
        users.set(user.id, { ...user })
      },
      findById: async (id) => users.get(id),
    },
    tokens: {
      insert: async (tokenHash, userId) => {
        tokensByHash.set(tokenHash, userId)
      },
      findUserIdByTokenHash: async (tokenHash) => tokensByHash.get(tokenHash),
    },
    saves: {
      get: async (userId) => saves.get(userId),
      put: async (userId, save) => {
        saves.set(userId, save)
      },
    },
    ledger: {
      findExistingIdempotencyKeys: async (userId, keys) => {
        const existing = new Set<string>()
        for (const key of keys) {
          if (ledgerKeys.has(compositeKey(userId, key))) {
            existing.add(key)
          }
        }
        return existing
      },
      insertMany: async (entries) => {
        for (const entry of entries) {
          const key = compositeKey(entry.userId, entry.idempotencyKey)
          if (ledgerKeys.has(key)) {
            continue
          }
          ledgerKeys.add(key)
          ledgerEntries.push({ ...entry })
        }
      },
      getBalance: async (userId) =>
        ledgerEntries
          .filter((entry) => entry.userId === userId)
          .reduce((sum, entry) => sum + entry.amount, 0),
      getTotalEarned: async (userId) =>
        ledgerEntries
          .filter((entry) => entry.userId === userId && entry.amount > 0)
          .reduce((sum, entry) => sum + entry.amount, 0),
    },
    generationCredits: {
      findExistingIdempotencyKeys: async (userId, keys) => {
        const existing = new Set<string>()
        for (const key of keys) {
          if (creditKeys.has(compositeKey(userId, key))) {
            existing.add(key)
          }
        }
        return existing
      },
      insertMany: async (entries) => {
        for (const entry of entries) {
          const key = compositeKey(entry.userId, entry.idempotencyKey)
          if (creditKeys.has(key)) {
            continue
          }
          creditKeys.add(key)
          creditEntries.push({ ...entry })
        }
      },
      getBalance: async (userId) =>
        creditEntries
          .filter((entry) => entry.userId === userId)
          .reduce((sum, entry) => sum + entry.amount, 0),
      listByUser: async (userId) =>
        creditEntries
          .filter((entry) => entry.userId === userId)
          .map((entry) => ({ ...entry })),
    },
  }
}
