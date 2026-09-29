import { beforeEach, describe, expect, it } from 'vitest'
import { CloudSyncError } from '@bravecat/core/cloud'
import { resetTaroMock, state, storage } from './testing/taroMock'
import {
  bindPhoneNumber,
  getBoundMaskedPhone,
  loginWithPhoneNumber,
  requestPhoneCode,
} from './phoneAuth'

const CREDENTIALS_KEY = 'bravecat.cloud.credentials'

const withCredentials = () => {
  storage.set(
    CREDENTIALS_KEY,
    JSON.stringify({ userId: 'user-1', token: 'tok-1' }),
  )
}

describe('requestPhoneCode', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('无认证 POST 到发码端点，204 视为成功', async () => {
    state.requestHandler = () => ({ statusCode: 204, data: '' })

    await expect(
      requestPhoneCode('https://api.test/', '13800138000', 'bind'),
    ).resolves.toBeUndefined()
    expect(state.requests[0]).toEqual({
      url: 'https://api.test/v1/auth/sms-code',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: JSON.stringify({ phoneNumber: '13800138000', purpose: 'bind' }),
    })
  })

  it('限流响应抛 CloudSyncError 并带上服务端文案', async () => {
    state.requestHandler = () => ({
      statusCode: 429,
      data: {
        error: { code: 'SMS_RATE_LIMITED', message: '发送太频繁，请稍后再试' },
      },
    })

    await expect(requestPhoneCode('https://api.test', '13800138000', 'bind'))
      .rejects.toMatchObject({
        code: 'SMS_RATE_LIMITED',
        message: '发送太频繁，请稍后再试',
      })
  })
})

describe('bindPhoneNumber', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('带 bearer token 提交，200 归一为 bound', async () => {
    withCredentials()
    state.requestHandler = () => ({
      statusCode: 200,
      data: { userId: 'user-1', provider: 'phone', maskedPhone: '138****8000' },
    })

    const result = await bindPhoneNumber('https://api.test', {
      phoneNumber: '13800138000',
      verificationCode: '000000',
    })

    expect(result).toEqual({ status: 'bound', maskedPhone: '138****8000' })
    expect(state.requests[0]).toEqual({
      url: 'https://api.test/v1/auth/bind/phone',
      method: 'POST',
      header: {
        authorization: 'Bearer tok-1',
        'content-type': 'application/json',
      },
      data: JSON.stringify({
        phoneNumber: '13800138000',
        verificationCode: '000000',
      }),
    })
  })

  it('409 PHONE_ALREADY_BOUND 归一为 conflict（不抛错）', async () => {
    withCredentials()
    state.requestHandler = () => ({
      statusCode: 409,
      data: {
        error: {
          code: 'PHONE_ALREADY_BOUND',
          message: '该手机号已绑定其他账号',
          details: {
            existingAccount: {
              createdAt: 1_700_000_000_000,
              hasSave: true,
              creditBalance: 3,
            },
          },
        },
      },
    })

    await expect(bindPhoneNumber('https://api.test', {
      phoneNumber: '13800138000',
      verificationCode: '000000',
    })).resolves.toEqual({
      status: 'conflict',
      existingAccount: {
        createdAt: 1_700_000_000_000,
        hasSave: true,
        creditBalance: 3,
      },
    })
  })

  it('验证码错误照常抛 CloudSyncError', async () => {
    withCredentials()
    state.requestHandler = () => ({
      statusCode: 401,
      data: {
        error: { code: 'SMS_CODE_INVALID', message: '验证码不正确或已过期' },
      },
    })

    await expect(bindPhoneNumber('https://api.test', {
      phoneNumber: '13800138000',
      verificationCode: '999999',
    })).rejects.toThrow(CloudSyncError)
  })
})

describe('loginWithPhoneNumber', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('登录成功后覆盖 wx storage 里的云端凭证', async () => {
    withCredentials()
    state.requestHandler = () => ({
      statusCode: 200,
      data: {
        userId: 'user-2',
        token: 'tok-2',
        tokenType: 'Bearer',
        isNewUser: false,
      },
    })

    const result = await loginWithPhoneNumber('https://api.test', {
      phoneNumber: '13800138000',
      verificationCode: '000000',
    })

    expect(result).toEqual({
      credentials: { userId: 'user-2', token: 'tok-2' },
      isNewUser: false,
    })
    expect(JSON.parse(storage.get(CREDENTIALS_KEY) as string)).toEqual({
      userId: 'user-2',
      token: 'tok-2',
    })
  })
})

describe('getBoundMaskedPhone', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('从身份列表里找出 phone 身份的脱敏号', async () => {
    withCredentials()
    state.requestHandler = () => ({
      statusCode: 200,
      data: {
        userId: 'user-1',
        identities: [
          { provider: 'wechat', maskedId: 'o****abc' },
          { provider: 'phone', maskedId: '138****8000' },
        ],
      },
    })

    await expect(getBoundMaskedPhone('https://api.test'))
      .resolves.toBe('138****8000')
  })

  it('没有 phone 身份时回 null', async () => {
    withCredentials()
    state.requestHandler = () => ({
      statusCode: 200,
      data: { userId: 'user-1', identities: [] },
    })

    await expect(getBoundMaskedPhone('https://api.test')).resolves.toBeNull()
  })

  it('无凭证或请求失败都容忍为 null', async () => {
    // 无凭证：requireCredentials 抛 TOKEN_MISSING，被吞掉。
    await expect(getBoundMaskedPhone('https://api.test')).resolves.toBeNull()

    // 有凭证但服务端 500：同样按「未绑定」处理。
    withCredentials()
    state.requestHandler = () => ({
      statusCode: 500,
      data: { error: { code: 'INTERNAL_ERROR', message: '服务器开小差了' } },
    })
    await expect(getBoundMaskedPhone('https://api.test')).resolves.toBeNull()
  })
})
