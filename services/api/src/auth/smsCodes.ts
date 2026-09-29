import { createHash, randomInt } from 'node:crypto'
import type { SmsCodeRepository } from '../repositories/types.js'

/** 验证码有效期。 */
export const SMS_CODE_TTL_MS = 10 * 60_000
/** 同号两次发码的最短间隔。 */
export const SMS_SEND_COOLDOWN_MS = 60_000
/** 同号滚动 24 小时窗口内的发码上限。 */
export const SMS_DAILY_LIMIT = 10
export const SMS_DAILY_WINDOW_MS = 24 * 60 * 60_000
/** 单个验证码允许的错误尝试次数，达到即作废。 */
export const SMS_MAX_ATTEMPTS = 5

/** 6 位数字验证码（密码学随机源）。 */
export const generateSmsCode = (): string =>
  String(randomInt(0, 1_000_000)).padStart(6, '0')

/** 库中只存 sha256 哈希，泄库不泄码。 */
export const hashSmsCode = (code: string): string =>
  createHash('sha256').update(code).digest('hex')

export type SmsSendCheck =
  | { allowed: true }
  | { allowed: false; reason: 'cooldown'; retryAfterMs: number }
  | { allowed: false; reason: 'daily-limit' }

/** 发码限流检查：60s 冷却 + 滚动 24h 限额（都按手机号、跨 purpose）。 */
export const checkSmsSendAllowed = async (
  repo: SmsCodeRepository,
  phone: string,
  now: number,
): Promise<SmsSendCheck> => {
  const lastSentAt = await repo.findLastSentAt(phone)
  if (lastSentAt !== undefined && now - lastSentAt < SMS_SEND_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: 'cooldown',
      retryAfterMs: SMS_SEND_COOLDOWN_MS - (now - lastSentAt),
    }
  }
  const sentInWindow = await repo.countSentSince(
    phone,
    now - SMS_DAILY_WINDOW_MS,
  )
  if (sentInWindow >= SMS_DAILY_LIMIT) {
    return { allowed: false, reason: 'daily-limit' }
  }
  return { allowed: true }
}

export type SmsVerifyOutcome =
  | { ok: true; purpose: string }
  | { ok: false }

/**
 * 校验验证码：按给定 purpose 顺序找各自最新一条有效码（未过期、错误
 * 次数未满）比对哈希。
 * - 命中且 consume 非 false 时删除该 (phone, purpose) 全部记录（一次性）；
 * - 全部未命中时给检查过的有效码各记一次错误尝试。
 * 绑定冲突流程依赖 consume: false：409 后同一验证码仍可用于换绑登录。
 */
export const verifySmsCode = async (
  repo: SmsCodeRepository,
  input: {
    phone: string
    code: string
    purposes: readonly string[]
    now: number
    consume?: boolean
  },
): Promise<SmsVerifyOutcome> => {
  const codeHash = hashSmsCode(input.code)
  const missed: string[] = []
  for (const purpose of input.purposes) {
    const latest = await repo.findLatest(input.phone, purpose)
    if (
      !latest
      || latest.expiresAt <= input.now
      || latest.attempts >= SMS_MAX_ATTEMPTS
    ) {
      continue
    }
    if (latest.codeHash === codeHash) {
      if (input.consume !== false) {
        await repo.deleteAll(input.phone, purpose)
      }
      return { ok: true, purpose }
    }
    missed.push(purpose)
  }
  for (const purpose of missed) {
    await repo.incrementAttempts(input.phone, purpose)
  }
  return { ok: false }
}
