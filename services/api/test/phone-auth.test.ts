import { describe, expect, it } from 'vitest'
import { ErrorCode } from '@bravecat/contracts'
import { encodeSolidPng } from '../src/aigc/fakes.js'
import {
  bearer,
  bindTestPhone,
  createTestApp,
  redeemTestCredits,
  registerGuest,
} from './helpers.js'

const PHONE = '13800138000'
const PHONE_E164 = `+86${PHONE}`

type TestApp = ReturnType<typeof createTestApp>

const sendCode = (
  test: TestApp,
  phoneNumber = PHONE,
  purpose: 'bind' | 'login' = 'bind',
) =>
  test.app.inject({
    method: 'POST',
    url: '/v1/auth/sms-code',
    payload: { phoneNumber, purpose },
  })

const bind = (
  test: TestApp,
  token: string,
  verificationCode: string,
  phoneNumber = PHONE,
) =>
  test.app.inject({
    method: 'POST',
    url: '/v1/auth/bind/phone',
    headers: bearer(token),
    payload: { phoneNumber, verificationCode },
  })

const login = (test: TestApp, verificationCode: string, phoneNumber = PHONE) =>
  test.app.inject({
    method: 'POST',
    url: '/v1/auth/login/phone',
    payload: { phoneNumber, verificationCode },
  })

const me = (test: TestApp, token: string) =>
  test.app.inject({ method: 'GET', url: '/v1/auth/me', headers: bearer(token) })

describe('POST /v1/auth/sms-code', () => {
  it('发码成功回 204，验证码经 SmsProvider 发到规范化后的 E.164 号码', async () => {
    const test = createTestApp()
    const response = await sendCode(test)
    expect(response.statusCode).toBe(204)
    expect(test.sms.sent).toHaveLength(1)
    expect(test.sms.sent[0].phone).toBe(PHONE_E164)
    expect(test.sms.sent[0].code).toMatch(/^\d{6}$/)
  })

  it('手机号格式不合法回 400', async () => {
    const test = createTestApp()
    const response = await sendCode(test, '12345')
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe(ErrorCode.ValidationFailed)
  })

  it('同号 60s 冷却：立即重发回 429，冷却结束后放行', async () => {
    const test = createTestApp()
    expect((await sendCode(test)).statusCode).toBe(204)

    const tooSoon = await sendCode(test)
    expect(tooSoon.statusCode).toBe(429)
    expect(tooSoon.json().error.code).toBe(ErrorCode.SmsRateLimited)

    // +86 形式与 11 位裸号视为同一手机号，共享冷却。
    const alias = await sendCode(test, PHONE_E164)
    expect(alias.statusCode).toBe(429)

    test.clock.advance(60_000)
    expect((await sendCode(test)).statusCode).toBe(204)
  })

  it('滚动 24 小时窗口内至多 10 次', async () => {
    const test = createTestApp()
    for (let i = 0; i < 10; i += 1) {
      expect((await sendCode(test)).statusCode).toBe(204)
      test.clock.advance(60_000)
    }
    const exceeded = await sendCode(test)
    expect(exceeded.statusCode).toBe(429)
    expect(exceeded.json().error.code).toBe(ErrorCode.SmsRateLimited)

    // 窗口滑出后恢复（距第一条发码超过 24h）。
    test.clock.advance(24 * 60 * 60_000 - 10 * 60_000 + 1)
    expect((await sendCode(test)).statusCode).toBe(204)
  })

  it('短信通道未接入回 503，且不占用发送配额', async () => {
    const test = createTestApp({
      sms: {
        sendCode: async () => ({
          ok: false,
          code: 'unavailable',
          message: '短信服务未配置',
        }),
      },
    })
    const first = await sendCode(test)
    expect(first.statusCode).toBe(503)
    expect(first.json().error.code).toBe(ErrorCode.SmsUnavailable)

    // 503 不落库：立即重试仍是 503 而不是 429 冷却。
    const retry = await sendCode(test)
    expect(retry.statusCode).toBe(503)
  })
})

describe('POST /v1/auth/bind/phone', () => {
  it('验证码通过后绑定成功，/auth/me 返回脱敏身份', async () => {
    const test = createTestApp()
    const guest = await registerGuest(test.app)
    const bound = await bindTestPhone(test, guest.token)
    expect(bound.userId).toBe(guest.userId)
    expect(bound.maskedPhone).toBe('138****8000')

    const profile = await me(test, guest.token)
    expect(profile.statusCode).toBe(200)
    expect(profile.json()).toEqual({
      userId: guest.userId,
      identities: [{ provider: 'phone', maskedId: '138****8000' }],
    })
  })

  it('同账号重绑同号幂等返回 200', async () => {
    const test = createTestApp()
    const guest = await registerGuest(test.app)
    await bindTestPhone(test, guest.token)

    test.clock.advance(60_000)
    const again = await bindTestPhone(test, guest.token)
    expect(again.maskedPhone).toBe('138****8000')
  })

  it('验证码错误回 400，错 5 次后正确码也作废', async () => {
    const test = createTestApp()
    const guest = await registerGuest(test.app)
    expect((await sendCode(test)).statusCode).toBe(204)
    const code = test.sms.lastCodeFor(PHONE_E164)!

    for (let i = 0; i < 5; i += 1) {
      const wrong = await bind(test, guest.token, '999999')
      expect(wrong.statusCode).toBe(400)
      expect(wrong.json().error.code).toBe(ErrorCode.SmsCodeInvalid)
    }
    const exhausted = await bind(test, guest.token, code)
    expect(exhausted.statusCode).toBe(400)
    expect(exhausted.json().error.code).toBe(ErrorCode.SmsCodeInvalid)
  })

  it('验证码 10 分钟过期', async () => {
    const test = createTestApp()
    const guest = await registerGuest(test.app)
    expect((await sendCode(test)).statusCode).toBe(204)
    const code = test.sms.lastCodeFor(PHONE_E164)!

    test.clock.advance(10 * 60_000)
    const expired = await bind(test, guest.token, code)
    expect(expired.statusCode).toBe(400)
    expect(expired.json().error.code).toBe(ErrorCode.SmsCodeInvalid)
  })

  it('login 用途的验证码不能用于绑定（purpose 隔离）', async () => {
    const test = createTestApp()
    const guest = await registerGuest(test.app)
    expect((await sendCode(test, PHONE, 'login')).statusCode).toBe(204)
    const code = test.sms.lastCodeFor(PHONE_E164)!

    const response = await bind(test, guest.token, code)
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe(ErrorCode.SmsCodeInvalid)
  })

  it('手机号已属其他账号回 409 + 脱敏信息；同一验证码仍可换绑登录', async () => {
    const test = createTestApp()
    // 账号 B：绑定手机号 + 有存档 + 有生成次数。
    const ownerB = await registerGuest(test.app)
    await bindTestPhone(test, ownerB.token)
    await redeemTestCredits(test.app, ownerB.token, 3)
    const save = await test.app.inject({
      method: 'PUT',
      url: '/v1/save',
      headers: bearer(ownerB.token),
      payload: {
        document: {
          schemaVersion: 1,
          exportedAt: test.clock.now(),
          state: { hello: 'world' },
        },
      },
    })
    expect(save.statusCode).toBe(200)

    // 游客 A 试图绑定同一手机号。
    const guestA = await registerGuest(test.app)
    test.clock.advance(60_000)
    expect((await sendCode(test)).statusCode).toBe(204)
    const code = test.sms.lastCodeFor(PHONE_E164)!

    const conflict = await bind(test, guestA.token, code)
    expect(conflict.statusCode).toBe(409)
    const error = conflict.json().error
    expect(error.code).toBe(ErrorCode.PhoneAlreadyBound)
    expect(error.details).toEqual({
      existingAccount: {
        createdAt: expect.any(Number),
        hasSave: true,
        creditBalance: 3,
      },
    })

    // 409 不消费验证码：同一验证码直接换绑登录到账号 B。
    const switched = await login(test, code)
    expect(switched.statusCode).toBe(200)
    const body = switched.json()
    expect(body.userId).toBe(ownerB.userId)
    expect(body.isNewUser).toBe(false)

    // 换绑登录消费验证码：重放失败。
    const replay = await login(test, code)
    expect(replay.statusCode).toBe(400)
  })

  it('当前账号已绑其他手机号回 409 ACCOUNT_ALREADY_HAS_PHONE', async () => {
    const test = createTestApp()
    const guest = await registerGuest(test.app)
    await bindTestPhone(test, guest.token)

    const otherPhone = '13900139000'
    test.clock.advance(60_000)
    expect((await sendCode(test, otherPhone)).statusCode).toBe(204)
    const code = test.sms.lastCodeFor(`+86${otherPhone}`)!

    const response = await bind(test, guest.token, code, otherPhone)
    expect(response.statusCode).toBe(409)
    expect(response.json().error.code).toBe(ErrorCode.AccountAlreadyHasPhone)
  })
})

describe('POST /v1/auth/login/phone', () => {
  it('查无账号自动建号并绑定身份（isNewUser: true）', async () => {
    const test = createTestApp()
    expect((await sendCode(test, PHONE, 'login')).statusCode).toBe(204)
    const code = test.sms.lastCodeFor(PHONE_E164)!

    const response = await login(test, code)
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.isNewUser).toBe(true)
    expect(body.tokenType).toBe('Bearer')

    const profile = await me(test, body.token)
    expect(profile.json().identities).toEqual([
      { provider: 'phone', maskedId: '138****8000' },
    ])
  })

  it('已有账号签发新 token，旧 token 不吊销', async () => {
    const test = createTestApp()
    const guest = await registerGuest(test.app)
    await bindTestPhone(test, guest.token)

    test.clock.advance(60_000)
    expect((await sendCode(test, PHONE, 'login')).statusCode).toBe(204)
    const code = test.sms.lastCodeFor(PHONE_E164)!

    const response = await login(test, code)
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.userId).toBe(guest.userId)
    expect(body.isNewUser).toBe(false)
    expect(body.token).not.toBe(guest.token)

    // 新旧 token 都指向同一账号（多设备并存）。
    for (const token of [guest.token, body.token]) {
      const profile = await me(test, token)
      expect(profile.statusCode).toBe(200)
      expect(profile.json().userId).toBe(guest.userId)
    }
  })

  it('验证码错误回 400', async () => {
    const test = createTestApp()
    expect((await sendCode(test, PHONE, 'login')).statusCode).toBe(204)
    const response = await login(test, '999999')
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe(ErrorCode.SmsCodeInvalid)
  })
})

describe('生成前置的手机号绑定校验', () => {
  const PHOTO_KEY = 'uploads/u1/photo.png'

  const submitGeneration = (test: TestApp, token: string) =>
    test.app.inject({
      method: 'POST',
      url: '/v1/portraits/generations',
      headers: bearer(token),
      payload: { idempotencyKey: 'gen-1', photoKey: PHOTO_KEY },
    })

  it('开启校验时未绑定手机号回 403 PHONE_BINDING_REQUIRED，绑定后放行', async () => {
    const test = createTestApp({ requirePhoneForGeneration: true })
    const guest = await registerGuest(test.app)
    await redeemTestCredits(test.app, guest.token, 1)
    await test.storage.put(
      PHOTO_KEY,
      encodeSolidPng(1024, 1024, { alpha: false }),
      'image/png',
    )

    const rejected = await submitGeneration(test, guest.token)
    expect(rejected.statusCode).toBe(403)
    expect(rejected.json().error.code).toBe(ErrorCode.PhoneBindingRequired)

    await bindTestPhone(test, guest.token)
    const accepted = await submitGeneration(test, guest.token)
    expect(accepted.statusCode).toBe(202)
  })

  it('关闭校验（演示/测试缺省）时未绑定也可提交', async () => {
    const test = createTestApp()
    const guest = await registerGuest(test.app)
    await redeemTestCredits(test.app, guest.token, 1)
    await test.storage.put(
      PHOTO_KEY,
      encodeSolidPng(1024, 1024, { alpha: false }),
      'image/png',
    )
    const accepted = await submitGeneration(test, guest.token)
    expect(accepted.statusCode).toBe(202)
  })
})
