import { describe, expect, it } from 'vitest'
import {
  ErrorCode,
  SAVE_SCHEMA_VERSION,
  apiErrorResponseSchema,
  authTokenResponseSchema,
  generationJobSchema,
  metaResponseSchema,
  portraitGenerationPoses,
  redeemPurchaseRequestSchema,
  saveDocumentSchema,
  submitGenerationRequestSchema,
  submitTransactionsRequestSchema,
  userPortraitSchema,
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

describe('credits schemas', () => {
  it('核销请求要求支付渠道与非空凭证', () => {
    expect(
      redeemPurchaseRequestSchema.safeParse({
        platform: 'wechat',
        receipt: 'receipt-blob',
      }).success,
    ).toBe(true)
    expect(
      redeemPurchaseRequestSchema.safeParse({ platform: 'steam', receipt: 'x' })
        .success,
    ).toBe(false)
    expect(
      redeemPurchaseRequestSchema.safeParse({ platform: 'apple', receipt: '' })
        .success,
    ).toBe(false)
  })
})

describe('portrait generation schemas', () => {
  it('生成套图覆盖完整的 10 姿势词汇', () => {
    expect(portraitGenerationPoses).toHaveLength(10)
  })

  it('提交请求要求幂等键与照片引用', () => {
    expect(
      submitGenerationRequestSchema.safeParse({
        idempotencyKey: 'gen-1',
        photoKey: 'uploads/u1/photo.png',
      }).success,
    ).toBe(true)
    expect(
      submitGenerationRequestSchema.safeParse({ photoKey: 'uploads/x.png' })
        .success,
    ).toBe(false)
  })

  it('job 状态机只接受既定状态', () => {
    const base = {
      id: '4f9c46f8-7a4d-4dc7-8f3f-1f1df1f5a111',
      photoKey: 'uploads/u1/photo.png',
      createdAt: 1,
      updatedAt: 1,
    }
    expect(
      generationJobSchema.safeParse({ ...base, status: 'awaiting_confirm' })
        .success,
    ).toBe(true)
    expect(
      generationJobSchema.safeParse({ ...base, status: 'rendering' }).success,
    ).toBe(false)
  })

  it('形象记录的姿势套图必须穷举全部姿势', () => {
    const poses = Object.fromEntries(
      portraitGenerationPoses.map((pose) => [
        pose,
        `portraits/generations/j1/${pose}.png`,
      ]),
    )
    const base = {
      id: '4f9c46f8-7a4d-4dc7-8f3f-1f1df1f5a111',
      jobId: '4f9c46f8-7a4d-4dc7-8f3f-1f1df1f5a222',
      createdAt: 1,
    }
    expect(userPortraitSchema.safeParse({ ...base, poses }).success).toBe(true)
    const { sit: _sit, ...missingSit } = poses
    expect(userPortraitSchema.safeParse({ ...base, poses: missingSit }).success).toBe(
      false,
    )
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
