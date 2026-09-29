import type {
  AuthIdentityRecord,
  CreditEntry,
  GenerationJobRecord,
  LedgerEntry,
  Repositories,
  SmsCodeRecord,
  StoredSave,
  UserPortraitRecord,
  UserRecord,
} from './types.js'

/** 内存实现：单测与本地无库开发用，与 Postgres 实现行为对齐。 */
export const createMemoryRepositories = (): Repositories => {
  const users = new Map<string, UserRecord>()
  const tokensByHash = new Map<string, string>()
  const identities: AuthIdentityRecord[] = []
  const smsCodes: SmsCodeRecord[] = []
  const saves = new Map<string, StoredSave>()
  const ledgerEntries: LedgerEntry[] = []
  const ledgerKeys = new Set<string>()
  const creditEntries: CreditEntry[] = []
  const creditKeys = new Set<string>()
  const generationJobs = new Map<string, GenerationJobRecord>()
  const userPortraits = new Map<string, UserPortraitRecord>()

  const cloneJob = (job: GenerationJobRecord): GenerationJobRecord =>
    structuredClone(job)

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
    identities: {
      bind: async (identity) => {
        const conflict = identities.some(
          (existing) =>
            existing.provider === identity.provider
            && existing.externalId === identity.externalId,
        )
        if (conflict) {
          throw new Error(
            `身份已绑定：${identity.provider}/${identity.externalId}`,
          )
        }
        identities.push({ ...identity })
      },
      findUserIdByIdentity: async (provider, externalId) =>
        identities.find(
          (identity) =>
            identity.provider === provider
            && identity.externalId === externalId,
        )?.userId,
      listByUser: async (userId) =>
        identities
          .filter((identity) => identity.userId === userId)
          .map((identity) => ({ ...identity })),
    },
    smsCodes: {
      insert: async (record) => {
        smsCodes.push({ ...record })
      },
      findLatest: async (phone, purpose) => {
        const matched = smsCodes
          .filter((record) => record.phone === phone && record.purpose === purpose)
          .sort((left, right) => right.createdAt - left.createdAt)[0]
        return matched ? { ...matched } : undefined
      },
      findLastSentAt: async (phone) =>
        smsCodes
          .filter((record) => record.phone === phone)
          .reduce<number | undefined>(
            (latest, record) =>
              latest === undefined ? record.createdAt : Math.max(latest, record.createdAt),
            undefined,
          ),
      countSentSince: async (phone, since) =>
        smsCodes.filter(
          (record) => record.phone === phone && record.createdAt >= since,
        ).length,
      incrementAttempts: async (phone, purpose) => {
        const latest = smsCodes
          .filter((record) => record.phone === phone && record.purpose === purpose)
          .sort((left, right) => right.createdAt - left.createdAt)[0]
        if (latest) {
          latest.attempts += 1
        }
      },
      deleteAll: async (phone, purpose) => {
        for (let index = smsCodes.length - 1; index >= 0; index -= 1) {
          if (
            smsCodes[index].phone === phone
            && smsCodes[index].purpose === purpose
          ) {
            smsCodes.splice(index, 1)
          }
        }
      },
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
    generationJobs: {
      create: async (job) => {
        generationJobs.set(job.id, cloneJob(job))
      },
      findById: async (id) => {
        const job = generationJobs.get(id)
        return job ? cloneJob(job) : undefined
      },
      findByIdempotencyKey: async (userId, idempotencyKey) => {
        for (const job of generationJobs.values()) {
          if (job.userId === userId && job.idempotencyKey === idempotencyKey) {
            return cloneJob(job)
          }
        }
        return undefined
      },
      update: async (job) => {
        generationJobs.set(job.id, cloneJob(job))
      },
    },
    userPortraits: {
      insert: async (portrait) => {
        userPortraits.set(portrait.id, structuredClone(portrait))
      },
      findByJobId: async (jobId) => {
        for (const portrait of userPortraits.values()) {
          if (portrait.jobId === jobId) {
            return structuredClone(portrait)
          }
        }
        return undefined
      },
      listByUser: async (userId) =>
        [...userPortraits.values()]
          .filter((portrait) => portrait.userId === userId)
          .sort((left, right) => left.createdAt - right.createdAt)
          .map((portrait) => structuredClone(portrait)),
    },
  }
}
