import { z } from 'zod'

/** 服务端接收存档信封时的结构校验；state 是不解释内容的黑盒 blob。 */
export const saveDocumentSchema = z.object({
  schemaVersion: z.number().int().min(1),
  exportedAt: z.number(),
  // JSON 请求体中缺失的 key 会解析为 undefined，用 refine 保证 state 实际存在。
  // 显式 boolean 返回值注解阻止 TS 推断类型谓词，保持 state 推断为 unknown。
  state: z.unknown().refine((value): boolean => value !== undefined, {
    message: 'state 不能缺失',
  }),
})
