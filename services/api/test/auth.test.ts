import { describe, expect, it } from 'vitest'
import { ErrorCode, authTokenResponseSchema } from '@bravecat/contracts'
import { bearer, createTestApp, registerGuest } from './helpers.js'

describe('POST /v1/auth/guest', () => {
  it('创建游客账号并返回 Bearer token', async () => {
    const { app } = createTestApp()
    const response = await app.inject({ method: 'POST', url: '/v1/auth/guest' })

    expect(response.statusCode).toBe(201)
    const body = authTokenResponseSchema.parse(response.json())
    expect(body.tokenType).toBe('Bearer')
    expect(body.token.length).toBeGreaterThanOrEqual(32)
  })

  it('两次注册产生互不相同的账号与 token', async () => {
    const { app } = createTestApp()
    const first = await registerGuest(app)
    const second = await registerGuest(app)
    expect(first.userId).not.toBe(second.userId)
    expect(first.token).not.toBe(second.token)
  })
})

describe('bearer 鉴权', () => {
  it('有效 token 可访问受保护路由', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)
    const response = await app.inject({
      method: 'GET',
      url: '/v1/ledger/balance',
      headers: bearer(guest.token),
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ balance: 0 })
  })

  it('缺失或伪造的 token 返回 401 UNAUTHORIZED', async () => {
    const { app } = createTestApp()
    await registerGuest(app)

    const missing = await app.inject({ method: 'GET', url: '/v1/ledger/balance' })
    expect(missing.statusCode).toBe(401)
    expect(missing.json().error.code).toBe(ErrorCode.Unauthorized)

    const forged = await app.inject({
      method: 'GET',
      url: '/v1/ledger/balance',
      headers: bearer('forged-token'),
    })
    expect(forged.statusCode).toBe(401)
    expect(forged.json().error.code).toBe(ErrorCode.Unauthorized)
  })
})

describe('绑定路由骨架', () => {
  it.each([
    ['/v1/auth/bind/wechat', { code: 'wx-oauth-code' }],
    ['/v1/auth/bind/apple', { identityToken: 'apple-jwt' }],
    ['/v1/auth/bind/phone', { phoneNumber: '13800138000', verificationCode: '123456' }],
  ])('%s 返回 501 NOT_IMPLEMENTED', async (url, payload) => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)
    const response = await app.inject({
      method: 'POST',
      url,
      headers: bearer(guest.token),
      payload,
    })
    expect(response.statusCode).toBe(501)
    expect(response.json().error.code).toBe(ErrorCode.NotImplemented)
  })

  it('绑定请求体不合法时返回 400', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/bind/wechat',
      headers: bearer(guest.token),
      payload: {},
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe(ErrorCode.ValidationFailed)
  })
})
