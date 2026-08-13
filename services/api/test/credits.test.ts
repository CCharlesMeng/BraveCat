import { describe, expect, it } from 'vitest'
import { ErrorCode } from '@bravecat/contracts'
import {
  bearer,
  createTestApp,
  redeemTestCredits,
  registerGuest,
} from './helpers.js'

const getBalance = async (
  app: ReturnType<typeof createTestApp>['app'],
  token: string,
) => {
  const response = await app.inject({
    method: 'GET',
    url: '/v1/credits/balance',
    headers: bearer(token),
  })
  expect(response.statusCode).toBe(200)
  return (response.json() as { balance: number }).balance
}

describe('POST /v1/credits/purchases', () => {
  it('核销通过后按次数入账并返回余额', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)

    const response = await app.inject({
      method: 'POST',
      url: '/v1/credits/purchases',
      headers: bearer(guest.token),
      payload: { platform: 'apple', receipt: 'test:order-100:5' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: 'applied',
      orderId: 'order-100',
      credits: 5,
      balance: 5,
    })
    expect(await getBalance(app, guest.token)).toBe(5)
  })

  it('幂等：同一订单重复核销标记 duplicate 且不重复入账', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)
    await redeemTestCredits(app, guest.token, 5, 'order-dup')

    const replay = await app.inject({
      method: 'POST',
      url: '/v1/credits/purchases',
      headers: bearer(guest.token),
      payload: { platform: 'wechat', receipt: 'test:order-dup:5' },
    })

    expect(replay.statusCode).toBe(200)
    expect(replay.json()).toMatchObject({ status: 'duplicate', balance: 5 })
    expect(await getBalance(app, guest.token)).toBe(5)
  })

  it('凭证无法识别 → 422 且不入账', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)

    const response = await app.inject({
      method: 'POST',
      url: '/v1/credits/purchases',
      headers: bearer(guest.token),
      payload: { platform: 'alipay', receipt: 'garbage-receipt' },
    })

    expect(response.statusCode).toBe(422)
    expect(response.json().error.code).toBe(ErrorCode.PurchaseReceiptInvalid)
    expect(await getBalance(app, guest.token)).toBe(0)
  })

  it('核销通道未接入 → 503', async () => {
    const { app } = createTestApp({
      purchaseVerifier: {
        verify: async () => ({
          ok: false,
          code: 'unavailable',
          message: '核销通道未接入',
        }),
      },
    })
    const guest = await registerGuest(app)

    const response = await app.inject({
      method: 'POST',
      url: '/v1/credits/purchases',
      headers: bearer(guest.token),
      payload: { platform: 'apple', receipt: 'anything' },
    })

    expect(response.statusCode).toBe(503)
    expect(response.json().error.code).toBe(ErrorCode.PurchaseUnavailable)
  })
})

describe('GET /v1/credits/balance', () => {
  it('新账号余额为 0，未认证请求 401', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)
    expect(await getBalance(app, guest.token)).toBe(0)

    const anonymous = await app.inject({
      method: 'GET',
      url: '/v1/credits/balance',
    })
    expect(anonymous.statusCode).toBe(401)
  })
})
