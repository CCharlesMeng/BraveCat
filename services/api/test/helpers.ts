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
}

export const createTestApp = (overrides: TestAppOverrides = {}) => {
  const clock = createTestClock()
  const repositories = createMemoryRepositories()
  const storage = createMemoryAssetStorage()
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
    now: clock.now,
  })
  return { app, clock, repositories, storage, queue }
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
