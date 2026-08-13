import { z } from 'zod'

/** 客户端可提交的交易类型；amount 恒为正，方向由 type 决定。 */
export const ledgerTransactionTypeSchema = z.enum(['earn', 'spend'])

export type LedgerTransactionType = z.infer<typeof ledgerTransactionTypeSchema>

/** 单笔交易；idempotencyKey 由客户端生成，服务端按 (user, key) 去重。 */
export const ledgerTransactionInputSchema = z.object({
  idempotencyKey: z.string().min(1).max(128),
  type: ledgerTransactionTypeSchema,
  amount: z.number().int().positive(),
  /** 客户端记账时间（epoch 毫秒），仅供审计；校验以服务端时钟为准。 */
  occurredAt: z.number(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type LedgerTransactionInput = z.infer<typeof ledgerTransactionInputSchema>

/** POST /v1/ledger/transactions 请求：批量提交（离线补账场景）。 */
export const submitTransactionsRequestSchema = z.object({
  transactions: z.array(ledgerTransactionInputSchema).min(1).max(100),
})

export type SubmitTransactionsRequest = z.infer<
  typeof submitTransactionsRequestSchema
>

export const transactionResultSchema = z.object({
  idempotencyKey: z.string(),
  status: z.enum(['applied', 'duplicate']),
})

export type TransactionResult = z.infer<typeof transactionResultSchema>

/** POST /v1/ledger/transactions 响应：逐笔结果 + 提交后余额。 */
export const submitTransactionsResponseSchema = z.object({
  results: z.array(transactionResultSchema),
  balance: z.number().int(),
})

export type SubmitTransactionsResponse = z.infer<
  typeof submitTransactionsResponseSchema
>

/** GET /v1/ledger/balance 响应。 */
export const balanceResponseSchema = z.object({
  balance: z.number().int(),
})

export type BalanceResponse = z.infer<typeof balanceResponseSchema>

/** POST /v1/ledger/iap/redeem 请求（Phase 1a 为 501 骨架）。 */
export const iapRedeemRequestSchema = z.object({
  platform: z.enum(['apple', 'wechat', 'alipay']),
  receipt: z.string().min(1),
})

export type IapRedeemRequest = z.infer<typeof iapRedeemRequestSchema>
