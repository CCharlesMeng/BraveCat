import type { FastifyInstance } from 'fastify'
import {
  ErrorCode,
  redeemPurchaseRequestSchema,
  type CreditBalanceResponse,
  type RedeemPurchaseResponse,
} from '@bravecat/contracts'
import { purchaseCreditKey } from '../aigc/creditKeys.js'
import { sendError, sendValidationError } from '../http/replies.js'
import type { RouteDeps } from './deps.js'

/**
 * 生成次数 entitlement（ADR-0006）：SKU 只有生成次数包/会员，
 * 次数严格服务端记账；本文件只做购买入账与余额查询，
 * 预扣/退回/消耗随生成 job 生命周期记账（见 routes/portraits.ts 与 aigc/executor.ts）。
 */
export const registerCreditRoutes = (
  app: FastifyInstance,
  deps: RouteDeps,
): void => {
  const { generationCredits } = deps.repositories

  /**
   * 购买核销入账：凭证交给注入的 PurchaseVerifier（Apple StoreKit Server API /
   * 微信支付核销 adapter 在 Phase 2/4 实现同一端口），核销通过后按订单号幂等入账。
   */
  app.post(
    '/credits/purchases',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const parsed = redeemPurchaseRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error)
      }

      const verification = await deps.aigc.purchaseVerifier.verify(parsed.data)
      if (!verification.ok) {
        if (verification.code === 'unavailable') {
          return sendError(
            reply,
            503,
            ErrorCode.PurchaseUnavailable,
            verification.message,
          )
        }
        return sendError(
          reply,
          422,
          ErrorCode.PurchaseReceiptInvalid,
          verification.message,
        )
      }

      const key = purchaseCreditKey(parsed.data.platform, verification.orderId)
      const existing = await generationCredits.findExistingIdempotencyKeys(
        request.userId,
        [key],
      )
      const duplicate = existing.has(key)
      if (!duplicate) {
        await generationCredits.insertMany([
          {
            userId: request.userId,
            idempotencyKey: key,
            kind: 'purchase',
            amount: verification.credits,
            orderId: verification.orderId,
            recordedAt: deps.now(),
          },
        ])
      }

      const body: RedeemPurchaseResponse = {
        status: duplicate ? 'duplicate' : 'applied',
        orderId: verification.orderId,
        credits: verification.credits,
        balance: await generationCredits.getBalance(request.userId),
      }
      return reply.send(body)
    },
  )

  app.get(
    '/credits/balance',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const body: CreditBalanceResponse = {
        balance: await generationCredits.getBalance(request.userId),
      }
      return reply.send(body)
    },
  )
}
