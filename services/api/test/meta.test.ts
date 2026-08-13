import { describe, expect, it } from 'vitest'
import { metaResponseSchema, platformSchema } from '@bravecat/contracts'
import { createTestApp } from './helpers.js'

describe('GET /v1/meta', () => {
  it('无需认证，下发全部平台的最低版本与功能开关', async () => {
    const { app, clock } = createTestApp()
    const response = await app.inject({ method: 'GET', url: '/v1/meta' })

    expect(response.statusCode).toBe(200)
    const body = metaResponseSchema.parse(response.json())
    expect(Object.keys(body.platforms).sort()).toEqual(
      [...platformSchema.options].sort(),
    )
    expect(body.serverTime).toBe(clock.now())
    for (const platform of platformSchema.options) {
      expect(body.platforms[platform].minClientVersion).toMatch(/^\d+\.\d+\.\d+$/)
      expect(typeof body.platforms[platform].featureFlags).toBe('object')
    }
  })

  it('小程序平台带 iOS 虚拟支付禁用开关', async () => {
    const { app } = createTestApp()
    const response = await app.inject({ method: 'GET', url: '/v1/meta' })
    const body = metaResponseSchema.parse(response.json())
    expect(body.platforms.miniprogram.featureFlags.virtualPaymentIos).toBe(false)
  })
})
