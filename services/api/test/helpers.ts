import type { AuthTokenResponse } from '@bravecat/contracts'
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

export const createTestApp = () => {
  const clock = createTestClock()
  const repositories = createMemoryRepositories()
  const app = buildApp({
    repositories,
    economyValidator: createRateCapValidator(TEST_ECONOMY),
    platformMeta: defaultPlatformMeta,
    now: clock.now,
  })
  return { app, clock, repositories }
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
