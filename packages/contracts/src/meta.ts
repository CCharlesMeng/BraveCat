import { z } from 'zod'

export const platformSchema = z.enum(['web', 'ios', 'android', 'miniprogram'])

export type Platform = z.infer<typeof platformSchema>

/** 单个平台的元信息：最低支持客户端版本（semver）与功能开关。 */
export const platformMetaSchema = z.object({
  minClientVersion: z.string(),
  featureFlags: z.record(z.string(), z.boolean()),
})

export type PlatformMeta = z.infer<typeof platformMetaSchema>

/**
 * GET /v1/meta 响应：始终下发全部四个平台（枚举键 record 要求穷举），
 * 客户端按自身平台取值。serverTime 为服务端时钟（epoch 毫秒）。
 */
export const metaResponseSchema = z.object({
  platforms: z.record(platformSchema, platformMetaSchema),
  serverTime: z.number(),
})

export type MetaResponse = z.infer<typeof metaResponseSchema>
