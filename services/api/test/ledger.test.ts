import { describe, expect, it } from 'vitest'
import { ErrorCode } from '@bravecat/contracts'
import { TEST_ECONOMY, bearer, createTestApp, registerGuest } from './helpers.js'

const HOUR = 3_600_000

const earn = (key: string, amount: number) => ({
  idempotencyKey: key,
  type: 'earn' as const,
  amount,
  occurredAt: 1_755_000_000_000,
})

const spend = (key: string, amount: number) => ({
  idempotencyKey: key,
  type: 'spend' as const,
  amount,
  occurredAt: 1_755_000_000_000,
})

const submit = async (
  app: ReturnType<typeof createTestApp>['app'],
  token: string,
  transactions: unknown[],
) =>
  app.inject({
    method: 'POST',
    url: '/v1/ledger/transactions',
    headers: bearer(token),
    payload: { transactions },
  })

describe('POST /v1/ledger/transactions', () => {
  it('批量入账并返回逐笔结果与余额', async () => {
    const { app, clock } = createTestApp()
    const guest = await registerGuest(app)
    clock.advance(HOUR)

    const response = await submit(app, guest.token, [
      earn('e1', 50),
      earn('e2', 30),
      spend('s1', 20),
    ])

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      results: [
        { idempotencyKey: 'e1', status: 'applied' },
        { idempotencyKey: 'e2', status: 'applied' },
        { idempotencyKey: 's1', status: 'applied' },
      ],
      balance: 60,
    })
  })

  it('幂等：重复提交同一幂等键不重复记账', async () => {
    const { app, clock } = createTestApp()
    const guest = await registerGuest(app)
    clock.advance(HOUR)

    await submit(app, guest.token, [earn('e1', 50)])
    const replay = await submit(app, guest.token, [earn('e1', 50), earn('e2', 10)])

    expect(replay.statusCode).toBe(200)
    expect(replay.json()).toEqual({
      results: [
        { idempotencyKey: 'e1', status: 'duplicate' },
        { idempotencyKey: 'e2', status: 'applied' },
      ],
      balance: 60,
    })
  })

  it('同一批次内幂等键重复直接 400', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)
    const response = await submit(app, guest.token, [earn('dup', 1), earn('dup', 2)])
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe(ErrorCode.ValidationFailed)
  })

  it('速率校验：拒绝物理上不可能的积累增量，余额不变', async () => {
    const { app, clock } = createTestApp()
    const guest = await registerGuest(app)
    clock.advance(HOUR) // 上限 = 100 初始额度 + 1 小时 × 600 = 700

    const response = await submit(app, guest.token, [earn('impossible', 10_000)])

    expect(response.statusCode).toBe(422)
    expect(response.json().error.code).toBe(ErrorCode.LedgerRateExceeded)

    const balance = await app.inject({
      method: 'GET',
      url: '/v1/ledger/balance',
      headers: bearer(guest.token),
    })
    expect(balance.json()).toEqual({ balance: 0 })
  })

  it('速率校验：同一笔增量在流逝足够时间后可入账', async () => {
    const { app, clock } = createTestApp()
    const guest = await registerGuest(app)
    const amount =
      TEST_ECONOMY.initialAllowance + TEST_ECONOMY.maxEarnPerHour * 2

    const early = await submit(app, guest.token, [earn('patient', amount)])
    expect(early.statusCode).toBe(422)

    clock.advance(2 * HOUR)
    const later = await submit(app, guest.token, [earn('patient', amount)])
    expect(later.statusCode).toBe(200)
    expect(later.json().balance).toBe(amount)
  })

  it('余额护栏：支出超过余额整批拒绝', async () => {
    const { app, clock } = createTestApp()
    const guest = await registerGuest(app)
    clock.advance(HOUR)
    await submit(app, guest.token, [earn('e1', 50)])

    const response = await submit(app, guest.token, [spend('s1', 80)])

    expect(response.statusCode).toBe(422)
    expect(response.json().error.code).toBe(ErrorCode.LedgerInsufficientBalance)
  })
})

describe('GET /v1/ledger/balance', () => {
  it('返回交易日志累计余额', async () => {
    const { app, clock } = createTestApp()
    const guest = await registerGuest(app)
    clock.advance(HOUR)
    await submit(app, guest.token, [earn('e1', 100), spend('s1', 30)])

    const response = await app.inject({
      method: 'GET',
      url: '/v1/ledger/balance',
      headers: bearer(guest.token),
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ balance: 70 })
  })
})

describe('POST /v1/ledger/iap/redeem', () => {
  it('IAP 核销骨架返回 501', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)
    const response = await app.inject({
      method: 'POST',
      url: '/v1/ledger/iap/redeem',
      headers: bearer(guest.token),
      payload: { platform: 'apple', receipt: 'receipt-blob' },
    })
    expect(response.statusCode).toBe(501)
    expect(response.json().error.code).toBe(ErrorCode.NotImplemented)
  })
})
