import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  ErrorCode,
  appleBindRequestSchema,
  phoneBindRequestSchema,
  phoneLoginRequestSchema,
  sendSmsCodeRequestSchema,
  wechatBindRequestSchema,
  type AuthMeResponse,
  type AuthTokenResponse,
  type PhoneBindConflictDetails,
  type PhoneBindResponse,
  type PhoneLoginResponse,
} from '@bravecat/contracts'
import { maskPhone, normalizePhoneNumber } from '../auth/phone.js'
import {
  SMS_CODE_TTL_MS,
  checkSmsSendAllowed,
  hashSmsCode,
  verifySmsCode,
} from '../auth/smsCodes.js'
import { generateToken, hashToken } from '../auth/tokens.js'
import { sendError, sendValidationError } from '../http/replies.js'
import type { RouteDeps } from './deps.js'

const PHONE_PROVIDER = 'phone'

export const registerAuthRoutes = (
  app: FastifyInstance,
  deps: RouteDeps,
): void => {
  const { users, tokens, identities, smsCodes, saves, generationCredits } =
    deps.repositories

  const invalidPhone = (reply: FastifyReply) =>
    sendError(
      reply,
      400,
      ErrorCode.ValidationFailed,
      '手机号格式不正确（中国大陆手机号或带 + 的 E.164）',
    )

  const invalidCode = (reply: FastifyReply) =>
    sendError(reply, 400, ErrorCode.SmsCodeInvalid, '验证码错误或已失效')

  /** 游客账号：无需凭证即建号，token 明文只出现在这一次响应里。 */
  app.post('/auth/guest', async (_request, reply) => {
    const userId = randomUUID()
    const token = generateToken()
    const createdAt = deps.now()
    await users.create({ id: userId, createdAt })
    await tokens.insert(hashToken(token), userId, createdAt)
    const body: AuthTokenResponse = { userId, token, tokenType: 'Bearer' }
    return reply.status(201).send(body)
  })

  /**
   * 发送短信验证码（无认证，绑定与登录共用）。
   * 限流按规范化后的手机号：60s 冷却 + 滚动 24h 上限；
   * 发送成功才落库计数，短信通道 503 不占用配额。
   */
  app.post('/auth/sms-code', async (request, reply) => {
    const parsed = sendSmsCodeRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error)
    }
    const phone = normalizePhoneNumber(parsed.data.phoneNumber)
    if (!phone) {
      return invalidPhone(reply)
    }

    const now = deps.now()
    const sendCheck = await checkSmsSendAllowed(smsCodes, phone, now)
    if (!sendCheck.allowed) {
      const message =
        sendCheck.reason === 'cooldown'
          ? `发送太频繁，请 ${Math.ceil(sendCheck.retryAfterMs / 1000)} 秒后再试`
          : '该手机号今天的验证码次数已用完，请明天再试'
      return sendError(reply, 429, ErrorCode.SmsRateLimited, message)
    }

    const code = deps.auth.generateSmsCode()
    const sent = await deps.auth.sms.sendCode(phone, code)
    if (!sent.ok) {
      return sendError(reply, 503, ErrorCode.SmsUnavailable, sent.message)
    }
    await smsCodes.insert({
      phone,
      purpose: parsed.data.purpose,
      codeHash: hashSmsCode(code),
      expiresAt: now + SMS_CODE_TTL_MS,
      attempts: 0,
      createdAt: now,
    })
    return reply.status(204).send()
  })

  /**
   * 手机号绑定当前账号。
   * - 验证码校验先于归属检查，避免绑定接口被用来探测手机号是否注册；
   * - 冲突（409）不消费验证码：客户端「切换到已有账号」可复用同一验证码
   *   走 /auth/login/phone 免二次发码；
   * - 绑定成功才消费验证码。
   */
  app.post(
    '/auth/bind/phone',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const parsed = phoneBindRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error)
      }
      const phone = normalizePhoneNumber(parsed.data.phoneNumber)
      if (!phone) {
        return invalidPhone(reply)
      }

      const now = deps.now()
      const verified = await verifySmsCode(smsCodes, {
        phone,
        code: parsed.data.verificationCode,
        purposes: ['bind'],
        now,
        consume: false,
      })
      if (!verified.ok) {
        return invalidCode(reply)
      }

      const boundResponse = (): PhoneBindResponse => ({
        userId: request.userId,
        provider: PHONE_PROVIDER,
        maskedPhone: maskPhone(phone),
      })

      const ownerId = await identities.findUserIdByIdentity(
        PHONE_PROVIDER,
        phone,
      )
      if (ownerId === request.userId) {
        // 幂等重绑同号：消费验证码后原样返回成功。
        await smsCodes.deleteAll(phone, 'bind')
        return reply.status(200).send(boundResponse())
      }
      if (ownerId) {
        const owner = await users.findById(ownerId)
        const details: PhoneBindConflictDetails = {
          existingAccount: {
            createdAt: owner?.createdAt ?? 0,
            hasSave: (await saves.get(ownerId)) !== undefined,
            creditBalance: await generationCredits.getBalance(ownerId),
          },
        }
        return sendError(
          reply,
          409,
          ErrorCode.PhoneAlreadyBound,
          '该手机号已绑定另一个账号',
          details,
        )
      }

      const existingPhone = (await identities.listByUser(request.userId)).find(
        (identity) => identity.provider === PHONE_PROVIDER,
      )
      if (existingPhone) {
        return sendError(
          reply,
          409,
          ErrorCode.AccountAlreadyHasPhone,
          `当前账号已绑定手机号 ${maskPhone(existingPhone.externalId)}，暂不支持换绑`,
        )
      }

      await identities.bind({
        userId: request.userId,
        provider: PHONE_PROVIDER,
        externalId: phone,
        createdAt: now,
      })
      await smsCodes.deleteAll(phone, 'bind')
      return reply.status(200).send(boundResponse())
    },
  )

  /**
   * 手机号验证码登录（无认证，登录注册合一）：
   * 查无账号自动建号并绑定手机号身份；已有账号签发新 token（旧 token
   * 不吊销，多设备并存）。验证码接受 login 与 bind 两种用途——后者服务
   * 绑定 409 冲突后的换绑登录（免二次发码），两者同为手机号占有证明。
   */
  app.post('/auth/login/phone', async (request, reply) => {
    const parsed = phoneLoginRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error)
    }
    const phone = normalizePhoneNumber(parsed.data.phoneNumber)
    if (!phone) {
      return invalidPhone(reply)
    }

    const now = deps.now()
    const verified = await verifySmsCode(smsCodes, {
      phone,
      code: parsed.data.verificationCode,
      purposes: ['login', 'bind'],
      now,
    })
    if (!verified.ok) {
      return invalidCode(reply)
    }

    let userId = await identities.findUserIdByIdentity(PHONE_PROVIDER, phone)
    const isNewUser = userId === undefined
    if (userId === undefined) {
      userId = randomUUID()
      await users.create({ id: userId, createdAt: now })
      await identities.bind({
        userId,
        provider: PHONE_PROVIDER,
        externalId: phone,
        createdAt: now,
      })
    }
    const token = generateToken()
    await tokens.insert(hashToken(token), userId, now)

    const body: PhoneLoginResponse = {
      userId,
      token,
      tokenType: 'Bearer',
      isNewUser,
    }
    return reply.status(200).send(body)
  })

  /** 当前账号与已绑定身份（外部 id 一律脱敏，手机号明文不出服务端）。 */
  app.get(
    '/auth/me',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const bound = await identities.listByUser(request.userId)
      const body: AuthMeResponse = {
        userId: request.userId,
        identities: bound.map((identity) => ({
          provider: identity.provider as AuthMeResponse['identities'][number]['provider'],
          maskedId:
            identity.provider === PHONE_PROVIDER
              ? maskPhone(identity.externalId)
              : `${identity.externalId.slice(0, 3)}****`,
        })),
      }
      return reply.send(body)
    },
  )

  // 绑定路由骨架：路由与请求类型已成型，OAuth 流程在 Phase 2 客户端接入时实现。
  const bindings = [
    { provider: '微信', path: '/auth/bind/wechat', schema: wechatBindRequestSchema },
    { provider: 'Apple', path: '/auth/bind/apple', schema: appleBindRequestSchema },
  ] as const

  for (const binding of bindings) {
    app.post(
      binding.path,
      { preHandler: [deps.authenticate] },
      async (request, reply) => {
        const parsed = binding.schema.safeParse(request.body)
        if (!parsed.success) {
          return sendValidationError(reply, parsed.error)
        }
        return sendError(
          reply,
          501,
          ErrorCode.NotImplemented,
          `${binding.provider}绑定将在 Phase 2 实现`,
        )
      },
    )
  }
}
