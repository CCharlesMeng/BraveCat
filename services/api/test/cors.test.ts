import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers.js'

describe('CORS', () => {
  it('默认放行 localhost 任意端口（web dev server 直连）', async () => {
    const { app } = createTestApp()

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/v1/save',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PUT',
      },
    })

    expect(preflight.statusCode).toBe(204)
    expect(preflight.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    )

    const response = await app.inject({
      method: 'GET',
      url: '/v1/meta',
      headers: { origin: 'http://127.0.0.1:4173' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://127.0.0.1:4173',
    )
  })

  it('默认不放行非本机 origin', async () => {
    const { app } = createTestApp()

    const response = await app.inject({
      method: 'GET',
      url: '/v1/meta',
      headers: { origin: 'https://evil.example.com' },
    })

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})
