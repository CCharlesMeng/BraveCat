import { beforeEach, describe, expect, it } from 'vitest'
import taro, { resetTaroMock, state } from './testing/taroMock'
import { taroCloudFetch } from './cloudFetch'

describe('taroCloudFetch', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('把 method / headers / body 映射到 Taro.request 并透出状态码', async () => {
    state.requestHandler = () => ({ statusCode: 201, data: { ok: true } })

    const response = await taroCloudFetch('https://api.test/v1/auth/guest', {
      method: 'POST',
      headers: { authorization: 'Bearer abc' },
      body: '{"hello":1}',
    })

    expect(response.status).toBe(201)
    expect(taro.request).toHaveBeenCalledTimes(1)
    expect(state.requests[0]).toEqual({
      url: 'https://api.test/v1/auth/guest',
      method: 'POST',
      header: { authorization: 'Bearer abc' },
      data: '{"hello":1}',
    })
  })

  it('缺省 method 时按 GET 发送', async () => {
    state.requestHandler = () => ({ statusCode: 200, data: {} })
    await taroCloudFetch('https://api.test/v1/meta')
    expect(state.requests[0].method).toBe('GET')
  })

  it('json() 透传 wx 已解析的对象响应', async () => {
    state.requestHandler = () => ({ statusCode: 200, data: { balance: 3 } })
    const response = await taroCloudFetch('https://api.test/v1/credits/balance')
    await expect(response.json()).resolves.toEqual({ balance: 3 })
  })

  it('json() 对字符串响应体再做 JSON.parse，不可解析时抛出', async () => {
    state.requestHandler = () => ({ statusCode: 200, data: '{"a":1}' })
    const parsed = await taroCloudFetch('https://api.test/v1/meta')
    await expect(parsed.json()).resolves.toEqual({ a: 1 })

    state.requestHandler = () => ({ statusCode: 502, data: 'Bad Gateway' })
    const broken = await taroCloudFetch('https://api.test/v1/meta')
    await expect(broken.json()).rejects.toThrow()
  })

  it('网络层失败时按 wx.request 语义 reject', async () => {
    await expect(taroCloudFetch('https://api.test/v1/meta'))
      .rejects.toMatchObject({ errMsg: expect.stringContaining('request:fail') })
  })
})
