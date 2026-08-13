import type { ApiErrorCode, LedgerTransactionInput } from '@bravecat/contracts'
import { ErrorCode } from '@bravecat/contracts'

export interface EconomyValidationContext {
  userId: string
  /** 账号创建时间（epoch 毫秒），积累的起算点。 */
  accountCreatedAt: number
  /** 服务端当前时钟（epoch 毫秒）。 */
  now: number
  /** 本批次之前的余额。 */
  currentBalance: number
  /** 本批次之前的累计入账（earn）总额。 */
  totalEarned: number
  /** 待入账的新交易（已剔除幂等重复）。 */
  transactions: readonly LedgerTransactionInput[]
}

export type EconomyValidationResult =
  | { ok: true }
  | { ok: false; code: ApiErrorCode; message: string }

/**
 * 可注入的经济校验接口：账本路由不关心校验策略的具体实现。
 *
 * Phase 1a 占位实现只做「现实流逝时间 × 积累速率上限」的物理可能性检查；
 * Phase 1b 将注入复用 packages/core 游戏规则的确定性重放验算
 * （服务端 import core 重放客户端上报的交易，游戏规则只写一遍），
 * 届时本接口签名不变，替换注入实现即可。
 */
export interface EconomyValidator {
  validate(
    context: EconomyValidationContext,
  ): Promise<EconomyValidationResult>
}

export interface RateCapValidatorOptions {
  /** 每现实小时最多可积累的小鱼干数量（可经环境变量配置）。 */
  maxEarnPerHour: number
  /** 新账号的初始积累额度，避免 t=0 时上限为零。 */
  initialAllowance: number
}

const MS_PER_HOUR = 3_600_000

/** 占位校验：累计 earn 不得超过 初始额度 + 流逝时间 × 速率上限。 */
export const createRateCapValidator = (
  options: RateCapValidatorOptions,
): EconomyValidator => ({
  validate: async (context) => {
    const batchEarn = context.transactions
      .filter((transaction) => transaction.type === 'earn')
      .reduce((sum, transaction) => sum + transaction.amount, 0)
    if (batchEarn === 0) {
      return { ok: true }
    }

    const elapsedHours =
      Math.max(0, context.now - context.accountCreatedAt) / MS_PER_HOUR
    const earnCap =
      options.initialAllowance + elapsedHours * options.maxEarnPerHour
    if (context.totalEarned + batchEarn > earnCap) {
      return {
        ok: false,
        code: ErrorCode.LedgerRateExceeded,
        message:
          `积累速率超出物理上限：累计入账 ${context.totalEarned} + 本批 ${batchEarn} ` +
          `超过上限 ${Math.floor(earnCap)}（账号存续 ${elapsedHours.toFixed(2)} 小时 × ` +
          `${options.maxEarnPerHour}/小时 + 初始额度 ${options.initialAllowance}）`,
      }
    }
    return { ok: true }
  },
})
