import { beforeEach, describe, expect, it } from 'vitest'
import { CloudSyncError } from '@bravecat/core/cloud'
import taro, { resetTaroMock, state, storage } from './testing/taroMock'
import { bindWechatAccount } from './wechatAuth'

const withCredentials = () => {
  storage.set(
    'bravecat.cloud.credentials',
    JSON.stringify({ userId: 'user-1', token: 'tok-1' }),
  )
}

describe('bindWechatAccount', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('没有游客凭证时直接失败，不发起 wx.login', async () => {
    await expect(bindWechatAccount({ baseUrl: 'https://api.test' }))
      .rejects.toMatchObject({ code: 'TOKEN_MISSING' })
    expect(taro.login).not.toHaveBeenCalled()
  })

  it('wx.login 的 code 带 bearer token POST 到绑定端点', async () => {
    withCredentials()
    state.loginCode = 'code-from-wx'
    state.requestHandler = () => ({
      statusCode: 200,
      data: { userId: 'user-1', provider: 'wechat', bound: true },
    })

    const result = await bindWechatAccount({ baseUrl: 'https://api.test/' })

    expect(result).toEqual({ status: 'bound', userId: 'user-1' })
    expect(state.requests[0]).toEqual({
      url: 'https://api.test/v1/auth/bind/wechat',
      method: 'POST',
      header: {
        authorization: 'Bearer tok-1',
        'content-type': 'application/json',
      },
      data: JSON.stringify({ code: 'code-from-wx' }),
    })
  })

  it('服务端 501 骨架归一为 not-open（待开通，不算错误）', async () => {
    withCredentials()
    state.requestHandler = () => ({
      statusCode: 501,
      data: {
        error: { code: 'NOT_IMPLEMENTED', message: '微信绑定将在 Phase 2 实现' },
      },
    })

    await expect(bindWechatAccount({ baseUrl: 'https://api.test' }))
      .resolves.toEqual({ status: 'not-open' })
  })

  it('其他错误响应抛 CloudSyncError 并带上服务端文案', async () => {
    withCredentials()
    state.requestHandler = () => ({
      statusCode: 409,
      data: { error: { code: 'CONFLICT', message: '该微信已绑定其他账号' } },
    })

    await expect(bindWechatAccount({ baseUrl: 'https://api.test' }))
      .rejects.toThrow(CloudSyncError)
    await expect(bindWechatAccount({ baseUrl: 'https://api.test' }))
      .rejects.toThrow('该微信已绑定其他账号')
  })
})
