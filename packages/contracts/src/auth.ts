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
