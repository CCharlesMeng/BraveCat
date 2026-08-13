import { describe, expect, it } from 'vitest'
import { ErrorCode, SAVE_SCHEMA_VERSION } from '@bravecat/contracts'
import { bearer, createTestApp, registerGuest } from './helpers.js'

const sampleDocument = (schemaVersion: number, marker = 'a') => ({
  schemaVersion,
  exportedAt: 1_755_000_000_000,
  state: { marker, coins: 42 },
})

describe('PUT /v1/save', () => {
  it('写入存档并返回服务端时间戳', async () => {
    const { app, clock } = createTestApp()
    const guest = await registerGuest(app)
    clock.advance(1_000)

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/save',
      headers: bearer(guest.token),
      payload: { document: sampleDocument(SAVE_SCHEMA_VERSION) },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      savedAt: clock.now(),
      schemaVersion: SAVE_SCHEMA_VERSION,
    })
  })

  it('last-writer-wins：后写覆盖先写，savedAt 用服务端时钟', async () => {
    const { app, clock } = createTestApp()
    const guest = await registerGuest(app)

    await app.inject({
      method: 'PUT',
      url: '/v1/save',
      headers: bearer(guest.token),
      payload: { document: sampleDocument(4, 'first') },
    })
    const firstSavedAt = clock.now()
    clock.advance(5_000)
    await app.inject({
      method: 'PUT',
      url: '/v1/save',
      headers: bearer(guest.token),
      payload: { document: sampleDocument(4, 'second') },
    })

    const read = await app.inject({
      method: 'GET',
      url: '/v1/save?maxSchemaVersion=4',
      headers: bearer(guest.token),
    })
    const body = read.json()
    expect(body.document.state.marker).toBe('second')
    expect(body.savedAt).toBe(firstSavedAt + 5_000)
  })

  it('单调性护栏：旧 schema 版本不得覆盖更新版本的云端存档', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)

    await app.inject({
      method: 'PUT',
      url: '/v1/save',
      headers: bearer(guest.token),
      payload: { document: sampleDocument(5, 'newer-client') },
    })
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/save',
      headers: bearer(guest.token),
      payload: { document: sampleDocument(4, 'older-client') },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().error.code).toBe(ErrorCode.SaveSchemaTooNew)
  })

  it('结构不完整的存档文档返回 400', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/save',
      headers: bearer(guest.token),
      payload: { document: { schemaVersion: 4 } },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe(ErrorCode.ValidationFailed)
  })
})

describe('GET /v1/save', () => {
  it('无存档时返回 404 SAVE_NOT_FOUND', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)
    const response = await app.inject({
      method: 'GET',
      url: '/v1/save?maxSchemaVersion=4',
      headers: bearer(guest.token),
    })
    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe(ErrorCode.SaveNotFound)
  })

  it('黑盒 state 原样往返', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)
    const document = sampleDocument(4, 'roundtrip')

    await app.inject({
      method: 'PUT',
      url: '/v1/save',
      headers: bearer(guest.token),
      payload: { document },
    })
    const response = await app.inject({
      method: 'GET',
      url: '/v1/save?maxSchemaVersion=4',
      headers: bearer(guest.token),
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().document).toEqual(document)
  })

  it('版本护栏：云端版本高于客户端支持时返回 426 SAVE_SCHEMA_TOO_NEW', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)

    await app.inject({
      method: 'PUT',
      url: '/v1/save',
      headers: bearer(guest.token),
      payload: { document: sampleDocument(5, 'from-newer-client') },
    })
    const response = await app.inject({
      method: 'GET',
      url: '/v1/save?maxSchemaVersion=4',
      headers: bearer(guest.token),
    })

    expect(response.statusCode).toBe(426)
    const error = response.json().error
    expect(error.code).toBe(ErrorCode.SaveSchemaTooNew)
    expect(error.details).toEqual({
      cloudSchemaVersion: 5,
      maxSupportedSchemaVersion: 4,
    })
  })

  it('客户端未声明 maxSchemaVersion 时返回 400', async () => {
    const { app } = createTestApp()
    const guest = await registerGuest(app)
    const response = await app.inject({
      method: 'GET',
      url: '/v1/save',
      headers: bearer(guest.token),
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe(ErrorCode.ValidationFailed)
  })
})
