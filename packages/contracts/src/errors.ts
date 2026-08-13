import { z } from 'zod'

/** API v1 统一错误码。 */
export const ErrorCode = {
  ValidationFailed: 'VALIDATION_FAILED',
  Unauthorized: 'UNAUTHORIZED',
  NotFound: 'NOT_FOUND',
  NotImplemented: 'NOT_IMPLEMENTED',
  SaveNotFound: 'SAVE_NOT_FOUND',
  SaveSchemaTooNew: 'SAVE_SCHEMA_TOO_NEW',
  LedgerRateExceeded: 'LEDGER_RATE_EXCEEDED',
  LedgerInsufficientBalance: 'LEDGER_INSUFFICIENT_BALANCE',
  CreditInsufficientBalance: 'CREDIT_INSUFFICIENT_BALANCE',
  PurchaseReceiptInvalid: 'PURCHASE_RECEIPT_INVALID',
  PurchaseUnavailable: 'PURCHASE_UNAVAILABLE',
  UploadNotFound: 'UPLOAD_NOT_FOUND',
  GenerationJobNotConfirmable: 'GENERATION_JOB_NOT_CONFIRMABLE',
  Internal: 'INTERNAL_ERROR',
} as const

export type ApiErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export const apiErrorCodeSchema = z.enum(ErrorCode)

/** 所有非 2xx 响应统一使用的错误结构。 */
export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>
