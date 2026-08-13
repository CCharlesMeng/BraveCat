import type { FastifyInstance } from 'fastify'
import {
  ErrorCode,
  iapRedeemRequestSchema,
  submitTransactionsRequestSchema,
  type BalanceResponse,
  type LedgerTransactionInput,
  type SubmitTransactionsResponse,
} from '@bravecat/contracts'
import { sendError, sendValidationError } from '../http/replies.js'
import type { RouteDeps } from './deps.js'

/** 存储采用带符号金额：earn 记正、spend 记负，余额 = sum(amount)。 */
const signedAmount = (transaction: LedgerTransactionInput): number =>
  transaction.type === 'earn' ? transaction.amount : -transaction.amount

export const registerLedgerRoutes = (
  app: FastifyInstance,
  deps: RouteDeps,
): void => {
  const { ledger, users } = deps.repositories

  /**
   * 批量提交交易（客户端离线乐观记账、联网对账的入口）。
   * 幂等：已入账的 idempotencyKey 标记 duplicate 且不重复记账；
   * 新交易整批过经济校验，任一不通过则整批拒绝（不部分入账）。
   */
  app.post(
    '/ledger/transactions',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const parsed = submitTransactionsRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error)
      }
      const transactions = parsed.data.transactions
      const keys = transactions.map((transaction) => transaction.idempotencyKey)
      if (new Set(keys).size !== keys.length) {
        return sendError(
          reply,
          400,
          ErrorCode.ValidationFailed,
          '同一批次内 idempotencyKey 重复',
        )
      }

      const existing = await ledger.findExistingIdempotencyKeys(
        request.userId,
        keys,
      )
      const fresh = transactions.filter(
        (transaction) => !existing.has(transaction.idempotencyKey),
      )

      if (fresh.length > 0) {
        const user = await users.findById(request.userId)
        if (!user) {
          return sendError(reply, 401, ErrorCode.Unauthorized, '账号不存在')
        }
        const now = deps.now()
        const [currentBalance, totalEarned] = await Promise.all([
          ledger.getBalance(request.userId),
          ledger.getTotalEarned(request.userId),
        ])

        const verdict = await deps.economyValidator.validate({
          userId: request.userId,
          accountCreatedAt: user.createdAt,
          now,
          currentBalance,
          totalEarned,
          transactions: fresh,
        })
        if (!verdict.ok) {
          return sendError(reply, 422, verdict.code, verdict.message)
        }

        const netChange = fresh.reduce(
          (sum, transaction) => sum + signedAmount(transaction),
          0,
        )
        if (currentBalance + netChange < 0) {
          return sendError(
            reply,
            422,
            ErrorCode.LedgerInsufficientBalance,
            `余额不足：当前 ${currentBalance}，本批净变动 ${netChange}`,
          )
        }

        await ledger.insertMany(
          fresh.map((transaction) => ({
            userId: request.userId,
            idempotencyKey: transaction.idempotencyKey,
            type: transaction.type,
            amount: signedAmount(transaction),
            occurredAt: transaction.occurredAt,
            recordedAt: now,
          })),
        )
      }

      const body: SubmitTransactionsResponse = {
        results: transactions.map((transaction) => ({
          idempotencyKey: transaction.idempotencyKey,
          status: existing.has(transaction.idempotencyKey)
            ? 'duplicate'
            : 'applied',
        })),
        balance: await ledger.getBalance(request.userId),
      }
      return reply.send(body)
    },
  )

  app.get(
    '/ledger/balance',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const body: BalanceResponse = {
        balance: await ledger.getBalance(request.userId),
      }
      return reply.send(body)
    },
  )

  // IAP 核销骨架：Phase 2 接 Apple StoreKit Server API / 微信支付回调，
  // 核销通过后以服务端生成的交易入账（不走客户端提交通道）。
  app.post(
    '/ledger/iap/redeem',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const parsed = iapRedeemRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error)
      }
      return sendError(
        reply,
        501,
        ErrorCode.NotImplemented,
        'IAP 凭证核销将在 Phase 2 实现',
      )
    },
  )
}
