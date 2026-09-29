import { z } from 'zod'

/** POST /v1/auth/guest 响应：不透明 bearer token，服务端只存哈希。 */
export const authTokenResponseSchema = z.object({
  userId: z.uuid(),
  token: z.string().min(1),
  tokenType: z.literal('Bearer'),
})

export type AuthTokenResponse = z.infer<typeof authTokenResponseSchema>

export const bindProviderSchema = z.enum(['wechat', 'apple', 'phone'])

export type BindProvider = z.infer<typeof bindProviderSchema>

/** POST /v1/auth/bind/wechat 请求（微信 OAuth code 换 openid/unionid）。 */
export const wechatBindRequestSchema = z.object({
  code: z.string().min(1),
})

export type WechatBindRequest = z.infer<typeof wechatBindRequestSchema>

/** POST /v1/auth/bind/apple 请求（Sign in with Apple identityToken）。 */
export const appleBindRequestSchema = z.object({
  identityToken: z.string().min(1),
})

export type AppleBindRequest = z.infer<typeof appleBindRequestSchema>

/** POST /v1/auth/bind/phone 请求（手机号 + 短信验证码，实名合规）。 */
export const phoneBindRequestSchema = z.object({
  phoneNumber: z.string().min(1),
  verificationCode: z.string().min(1),
})

export type PhoneBindRequest = z.infer<typeof phoneBindRequestSchema>

/** 绑定成功的统一响应（Phase 1a 路由为 501 骨架，仅类型成型）。 */
export const bindResponseSchema = z.object({
  userId: z.uuid(),
  provider: bindProviderSchema,
  bound: z.literal(true),
})

export type BindResponse = z.infer<typeof bindResponseSchema>

/** 短信验证码用途：绑定当前账号 / 登录（查无账号自动建号）。 */
export const smsCodePurposeSchema = z.enum(['bind', 'login'])

export type SmsCodePurpose = z.infer<typeof smsCodePurposeSchema>

/**
 * POST /v1/auth/sms-code 请求（无认证）→ 204。
 * 服务端把手机号规范化为 E.164（中国号 +86）后限流：
 * 同号 60s 冷却、24 小时内至多 10 次（429 SMS_RATE_LIMITED）。
 */
export const sendSmsCodeRequestSchema = z.object({
  phoneNumber: z.string().min(1),
  purpose: smsCodePurposeSchema,
})

export type SendSmsCodeRequest = z.infer<typeof sendSmsCodeRequestSchema>

/** POST /v1/auth/bind/phone 成功响应（200）。 */
export const phoneBindResponseSchema = z.object({
  userId: z.uuid(),
  provider: z.literal('phone'),
  /** 脱敏手机号（如 138****8000），供「已绑定」展示。 */
  maskedPhone: z.string(),
})

export type PhoneBindResponse = z.infer<typeof phoneBindResponseSchema>

/**
 * 绑定冲突（409 PHONE_ALREADY_BOUND）的 details：目标账号的脱敏信息，
 * 供客户端冲突弹窗展示「切换到已有账号 / 保留当前进度」二选一。
 */
export const phoneBindConflictDetailsSchema = z.object({
  existingAccount: z.object({
    /** 目标账号创建时间（epoch 毫秒）。 */
    createdAt: z.number(),
    hasSave: z.boolean(),
    creditBalance: z.number(),
  }),
})

export type PhoneBindConflictDetails = z.infer<
  typeof phoneBindConflictDetailsSchema
>

/**
 * POST /v1/auth/login/phone 请求（无认证）：登录注册合一，
 * 验证码通过后查无账号自动建号并绑定手机号身份。
 */
export const phoneLoginRequestSchema = z.object({
  phoneNumber: z.string().min(1),
  verificationCode: z.string().min(1),
})

export type PhoneLoginRequest = z.infer<typeof phoneLoginRequestSchema>

/** POST /v1/auth/login/phone 响应（200）：新 token（旧 token 不吊销）。 */
export const phoneLoginResponseSchema = authTokenResponseSchema.extend({
  /** true = 查无账号自动建号（注册），false = 登录既有账号。 */
  isNewUser: z.boolean(),
})

export type PhoneLoginResponse = z.infer<typeof phoneLoginResponseSchema>

/** GET /v1/auth/me 响应：当前账号与已绑定身份（外部 id 一律脱敏）。 */
export const authMeResponseSchema = z.object({
  userId: z.uuid(),
  identities: z.array(
    z.object({
      provider: bindProviderSchema,
      /** 脱敏外部 id（手机号如 138****8000）。 */
      maskedId: z.string(),
    }),
  ),
})

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>
