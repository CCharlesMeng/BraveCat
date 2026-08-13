import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers.js'

describe('GET /healthz', () => {
  it('无需认证返回 200，供容器与负载均衡探活', async () => {
    const { app } = createTestApp()
    const response = await app.inject({ method: 'GET', url: '/healthz' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('不挂在 /v1 前缀下（/v1/healthz 仍是 404）', async () => {
    const { app } = createTestApp()
    const response = await app.inject({ method: 'GET', url: '/v1/healthz' })

    expect(response.statusCode).toBe(404)
  })
})
