import type {
  LedgerTransactionType,
  SaveDocument,
} from '@bravecat/contracts'

export interface UserRecord {
  id: string
  /** epoch 毫秒，经济速率校验以此为积累起点。 */
  createdAt: number
}

export interface StoredSave {
  document: SaveDocument
  /** 服务端写入时间戳（epoch 毫秒），last-writer-wins 的裁决时钟。 */
  savedAt: number
}

export interface LedgerEntry {
  userId: string
  idempotencyKey: string
  type: LedgerTransactionType
  /** 带符号金额：earn 为正、spend 为负；余额 = sum(amount)。 */
  amount: number
  /** 客户端声明的记账时间（epoch 毫秒），仅供审计。 */
  occurredAt: number
  /** 服务端入账时间（epoch 毫秒）。 */
  recordedAt: number
}

export interface UserRepository {
  create(user: UserRecord): Promise<void>
  findById(id: string): Promise<UserRecord | undefined>
}

export interface TokenRepository {
  /** 只存 token 哈希，明文 token 不落库。 */
  insert(tokenHash: string, userId: string, createdAt: number): Promise<void>
  findUserIdByTokenHash(tokenHash: string): Promise<string | undefined>
}

export interface SaveRepository {
  get(userId: string): Promise<StoredSave | undefined>
  /** 无条件覆盖（last-writer-wins），版本护栏在路由层处理。 */
  put(userId: string, save: StoredSave): Promise<void>
}

export interface LedgerRepository {
  /** 返回给定幂等键中已入账的子集。 */
  findExistingIdempotencyKeys(
    userId: string,
    keys: readonly string[],
  ): Promise<Set<string>>
  /** 原子批量入账；(userId, idempotencyKey) 冲突时静默跳过（幂等兜底）。 */
  insertMany(entries: readonly LedgerEntry[]): Promise<void>
  getBalance(userId: string): Promise<number>
  /** 累计入账正数金额之和，供速率上限校验。 */
  getTotalEarned(userId: string): Promise<number>
}

export interface Repositories {
  users: UserRepository
  tokens: TokenRepository
  saves: SaveRepository
  ledger: LedgerRepository
}
