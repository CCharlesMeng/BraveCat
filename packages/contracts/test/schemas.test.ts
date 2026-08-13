import { describe, expect, it } from 'vitest'
import {
  ErrorCode,
  SAVE_SCHEMA_VERSION,
  apiErrorResponseSchema,
  authTokenResponseSchema,
  metaResponseSchema,
  saveDocumentSchema,
  submitTransactionsRequestSchema,
} from '../src/index.js'

describe('save-document schema', () => {
  it('与客户端当前存档版本对齐', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(4)
  })

  it('接受结构完整的存档文档，state 为黑盒', () => {
    const result = saveDocumentSchema.safeParse({
      schemaVersion: 4,
      exportedAt: 1_700_000_000_000,
      state: { anything: ['goes', 'here'] },
    })
    expect(result.success).toBe(true)
  })

  it('拒绝缺失 exportedAt 或 state 的文档', () => {
    expect(
      saveDocumentSchema.safeParse({ schemaVersion: 4, state: {} }).success,
    ).toBe(false)
    expect(
      saveDocumentSchema.safeParse({ schemaVersion: 4, exportedAt: 1 }).success,
    ).toBe(false)
  })
})

describe('auth schemas', () => {
  it('游客注册响应包含不透明 Bearer token', () => {
    const result = authTokenResponseSchema.safeParse({
      userId: '4f9c46f8-7a4d-4dc7-8f3f-1f1df1f5a111',
      token: 'opaque-token',
      tokenType: 'Bearer',
    })
    expect(result.success).toBe(true)
  })
})

describe('ledger schemas', () => {
  it('拒绝非正数金额与空批次', () => {
    expect(
      submitTransactionsRequestSchema.safeParse({
        transactions: [
          { idempotencyKey: 'k1', type: 'earn', amount: 0, occurredAt: 1 },
        ],
      }).success,
    ).toBe(false)
    expect(
      submitTransactionsRequestSchema.safeParse({ transactions: [] }).success,
    ).toBe(false)
  })
})

describe('meta schema', () => {
  const platformMeta = {
    minClientVersion: '0.0.0',
    featureFlags: { cloudSave: true },
  }

  it('要求四个平台键穷举下发', () => {
    expect(
      metaResponseSchema.safeParse({
        platforms: {
          web: platformMeta,
          ios: platformMeta,
          android: platformMeta,
          miniprogram: platformMeta,
        },
        serverTime: 1,
      }).success,
    ).toBe(true)
    expect(
      metaResponseSchema.safeParse({
        platforms: { web: platformMeta },
        serverTime: 1,
      }).success,
    ).toBe(false)
  })
})

describe('error schema', () => {
  it('只接受统一错误码', () => {
    expect(
      apiErrorResponseSchema.safeParse({
        error: { code: ErrorCode.SaveSchemaTooNew, message: '请升级客户端' },
      }).success,
    ).toBe(true)
    expect(
      apiErrorResponseSchema.safeParse({
        error: { code: 'MADE_UP_CODE', message: 'nope' },
      }).success,
    ).toBe(false)
  })
})
