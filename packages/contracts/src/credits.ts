import { z } from 'zod'

/**
 * 生成次数 entitlement（ADR-0006）：商业化 SKU 只有 AI 生成次数包与会员，
 * 次数严格服务端权威记账，客户端无离线乐观语义。
 */

/** 支付渠道：Apple IAP / 微信支付 / 支付宝（Web）。 */
export const purchasePlatformSchema = z.enum(['apple', 'wechat', 'alipay'])

export type PurchasePlatform = z.infer<typeof purchasePlatformSchema>

/** POST /v1/credits/purchases 请求：支付凭证服务端核销后才入账。 */
export const redeemPurchaseRequestSchema = z.object({
  platform: purchasePlatformSchema,
  receipt: z.string().min(1),
})

export type RedeemPurchaseRequest = z.infer<typeof redeemPurchaseRequestSchema>

/** POST /v1/credits/purchases 响应；duplicate 表示该订单已核销过，不重复入账。 */
export const redeemPurchaseResponseSchema = z.object({
  status: z.enum(['applied', 'duplicate']),
  orderId: z.string(),
  credits: z.number().int().positive(),
  balance: z.number().int(),
})

export type RedeemPurchaseResponse = z.infer<typeof redeemPurchaseResponseSchema>

/** GET /v1/credits/balance 响应。 */
export const creditBalanceResponseSchema = z.object({
  balance: z.number().int(),
})

export type CreditBalanceResponse = z.infer<typeof creditBalanceResponseSchema>
