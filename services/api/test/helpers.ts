import type { AuthTokenResponse } from '@bravecat/contracts'
import { createGenerationJobExecutor } from '../src/aigc/executor.js'
import {
  createFakeGenerationProvider,
  createFakeModerationProvider,
  createMemoryAssetStorage,
  createStubPurchaseVerifier,
} from '../src/aigc/fakes.js'
import type {
  GenerationProvider,
  ModerationProvider,
  PurchaseVerifier,
} from '../src/aigc/ports.js'
import { createBaselinePortraitQa, type PortraitQa } from '../src/aigc/qa.js'
import { createInProcessJobQueue } from '../src/aigc/queue.js'
import { buildApp } from '../src/app.js'
import { createRecordingSmsProvider } from '../src/auth/fakes.js'
import type { SmsProvider } from '../src/auth/ports.js'
import { defaultPlatformMeta } from '../src/config.js'
import { createRateCapValidator } from '../src/economy/validator.js'
import { createMemoryRepositories } from '../src/repositories/memory.js'

export const TEST_ECONOMY = {
  maxEarnPerHour: 600,
  initialAllowance: 100,
} as const

export interface TestClock {
  now: () => number
  advance: (ms: number) => void
}

export const createTestClock = (start = 1_755_000_000_000): TestClock => {
  let current = start
  return {
    now: () => current,
    advance: (ms) => {
      current += ms
    },
  }
}

export interface TestAppOverrides {
  purchaseVerifier?: PurchaseVerifier
  moderation?: ModerationProvider
  generation?: GenerationProvider
  qa?: PortraitQa
  sms?: SmsProvider
  /**
   * 生成前置的手机号绑定校验；测试默认关闭以聚焦各自被测行为，
   * 校验本身在 phone-auth.test.ts 显式开启覆盖（生产入口恒开）。
   */
  requirePhoneForGeneration?: boolean
}

export const createTestApp = (overrides: TestAppOverrides = {}) => {
  const clock = createTestClock()
  const repositories = createMemoryRepositories()
  const storage = createMemoryAssetStorage()
  const sms = createRecordingSmsProvider()
  const executor = createGenerationJobExecutor({
    repositories,
    storage,
    moderation: overrides.moderation ?? createFakeModerationProvider(),
    generation: overrides.generation ?? createFakeGenerationProvider(),
    qa: overrides.qa ?? createBaselinePortraitQa(),
    now: clock.now,
  })
  const queue = createInProcessJobQueue(executor.execute)
  const app = buildApp({
    repositories,
    economyValidator: createRateCapValidator(TEST_ECONOMY),
    platformMeta: defaultPlatformMeta,
    aigc: {
      storage,
      queue,
      purchaseVerifier:
        overrides.purchaseVerifier ?? createStubPurchaseVerifier(),
    },
    auth: {
      sms: overrides.sms ?? sms,
      requirePhoneForGeneration: overrides.requirePhoneForGeneration ?? false,
    },
    now: clock.now,
  })
  return { app, clock, repositories, storage, queue, sms }
}

export type TestApp = ReturnType<typeof createTestApp>['app']

export const registerGuest = async (app: TestApp): Promise<AuthTokenResponse> => {
  const response = await app.inject({ method: 'POST', url: '/v1/auth/guest' })
  if (response.statusCode !== 201) {
    throw new Error(`游客注册失败：${response.statusCode} ${response.body}`)
  }
  return response.json() as AuthTokenResponse
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

/** 走完整发码 + 绑定流程给账号绑上手机号（读取 recording 假短信的真实码）。 */
export const bindTestPhone = async (
  test: ReturnType<typeof createTestApp>,
  token: string,
  phoneNumber = '13800138000',
) => {
  const send = await test.app.inject({
    method: 'POST',
    url: '/v1/auth/sms-code',
    payload: { phoneNumber, purpose: 'bind' },
  })
  if (send.statusCode !== 204) {
    throw new Error(`发码失败：${send.statusCode} ${send.body}`)
  }
  const code = test.sms.lastCodeFor(`+86${phoneNumber}`)
  if (!code) {
    throw new Error(`recording 假短信里找不到 ${phoneNumber} 的验证码`)
  }
  const bind = await test.app.inject({
    method: 'POST',
    url: '/v1/auth/bind/phone',
    headers: bearer(token),
    payload: { phoneNumber, verificationCode: code },
  })
  if (bind.statusCode !== 200) {
    throw new Error(`绑定失败：${bind.statusCode} ${bind.body}`)
  }
  return bind.json() as { userId: string; maskedPhone: string }
}

/** 用测试核销器的魔法凭证给账号充生成次数。 */
export const redeemTestCredits = async (
  app: TestApp,
  token: string,
  credits: number,
  orderId = 'order-1',
) => {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/credits/purchases',
    headers: bearer(token),
    payload: { platform: 'wechat', receipt: `test:${orderId}:${credits}` },
  })
  if (response.statusCode !== 200) {
    throw new Error(`充值失败：${response.statusCode} ${response.body}`)
  }
  return response.json() as { status: string; balance: number }
}
