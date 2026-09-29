import type {
  GenerationJob,
  LedgerTransactionType,
  SaveDocument,
  UserPortrait,
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

/** 外部身份绑定记录；external_id 为规范化后的外部标识（手机号 E.164 等）。 */
export interface AuthIdentityRecord {
  userId: string
  provider: string
  externalId: string
  createdAt: number
}

export interface IdentityRepository {
  /** (provider, externalId) 全局唯一；调用方先查后插，冲突时抛错兜底。 */
  bind(identity: AuthIdentityRecord): Promise<void>
  findUserIdByIdentity(
    provider: string,
    externalId: string,
  ): Promise<string | undefined>
  listByUser(userId: string): Promise<AuthIdentityRecord[]>
}

/** 单次发码记录；同 (phone, purpose) 中 createdAt 最新的一行是当前有效码。 */
export interface SmsCodeRecord {
  /** E.164 规范化手机号。 */
  phone: string
  purpose: string
  /** 只存验证码哈希，明文不落库。 */
  codeHash: string
  expiresAt: number
  /** 错误尝试次数；达到上限即作废。 */
  attempts: number
  createdAt: number
}

export interface SmsCodeRepository {
  insert(record: SmsCodeRecord): Promise<void>
  /** 该 (phone, purpose) 最近一次发码记录。 */
  findLatest(phone: string, purpose: string): Promise<SmsCodeRecord | undefined>
  /** 该手机号最近一次发码时间（跨 purpose，冷却判断用）。 */
  findLastSentAt(phone: string): Promise<number | undefined>
  /** 该手机号自 since 起的发码条数（跨 purpose，每日限额用）。 */
  countSentSince(phone: string, since: number): Promise<number>
  /** 给最近一次发码记录的错误尝试 +1；无记录时为空操作。 */
  incrementAttempts(phone: string, purpose: string): Promise<void>
  /** 验证通过后消费：删除该 (phone, purpose) 的全部验证码记录。 */
  deleteAll(phone: string, purpose: string): Promise<void>
}

export interface SaveRepository {
  get(userId: string): Promise<StoredSave | undefined>
  /** 无条件覆盖（last-writer-wins），版本护栏在路由层处理。 */
  put(userId: string, save: StoredSave): Promise<void>
}

/** 生成次数账目类型：purchase/release 记正、hold/consume 记负；余额 = sum(amount)。 */
export type CreditEntryKind = 'purchase' | 'hold' | 'release' | 'consume'

export interface CreditEntry {
  userId: string
  /** 幂等键命名约定见 src/aigc/creditKeys.ts。 */
  idempotencyKey: string
  kind: CreditEntryKind
  /** 带符号次数。 */
  amount: number
  /** 关联的生成 job（hold/release/consume）。 */
  jobId?: string
  /** 购买订单号（purchase）。 */
  orderId?: string
  /** 服务端入账时间（epoch 毫秒）。 */
  recordedAt: number
}

/**
 * 生成次数 entitlement 账本（ADR-0006：严格服务端权威，客户端无离线乐观记账）。
 * 事务语义：提交生成即预扣（hold -1）；失败自动退回（release +1）；
 * 确认时落定消耗（release +1 与 consume -1 成对入账，净额不变但消耗自此不可逆）。
 */
export interface GenerationCreditRepository {
  /** 返回给定幂等键中已入账的子集。 */
  findExistingIdempotencyKeys(
    userId: string,
    keys: readonly string[],
  ): Promise<Set<string>>
  /** 原子批量入账；(userId, idempotencyKey) 冲突时静默跳过（幂等兜底）。 */
  insertMany(entries: readonly CreditEntry[]): Promise<void>
  getBalance(userId: string): Promise<number>
  /** 全量账目（审计与测试用）。 */
  listByUser(userId: string): Promise<CreditEntry[]>
}

/** 存储侧生成 job 记录 = API 形状（contracts GenerationJob）+ 归属与提交幂等键。 */
export interface GenerationJobRecord extends GenerationJob {
  userId: string
  /** 客户端提交幂等键；同键重复提交返回同一 job。 */
  idempotencyKey: string
}

export interface GenerationJobRepository {
  create(job: GenerationJobRecord): Promise<void>
  findById(id: string): Promise<GenerationJobRecord | undefined>
  findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<GenerationJobRecord | undefined>
  /** 按 id 全量覆盖；状态机推进由执行器串行驱动，无并发写。 */
  update(job: GenerationJobRecord): Promise<void>
}

/** 确认后产出的形象记录（ADR-0004：只向未来生效，不重写历史内容）。 */
export interface UserPortraitRecord extends UserPortrait {
  userId: string
}

export interface UserPortraitRepository {
  insert(portrait: UserPortraitRecord): Promise<void>
  /** 每个 job 至多产出一条形象记录（确认幂等的依据）。 */
  findByJobId(jobId: string): Promise<UserPortraitRecord | undefined>
  /** 当前账号全部已确认形象，按创建时间升序（客户端可选列表）。 */
  listByUser(userId: string): Promise<UserPortraitRecord[]>
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
  identities: IdentityRepository
  smsCodes: SmsCodeRepository
  saves: SaveRepository
  ledger: LedgerRepository
  generationCredits: GenerationCreditRepository
  generationJobs: GenerationJobRepository
  userPortraits: UserPortraitRepository
}
