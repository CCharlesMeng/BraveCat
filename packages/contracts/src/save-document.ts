import { z } from 'zod'

/**
 * 存档文档信封，与 src/lib/save/index.ts 的 SaveDocument 结构对齐的最小副本。
 *
 * 刻意不 import 客户端代码：Phase 0 monorepo 收口时由 packages/core 统一导出，
 * 届时删除此副本。服务端只读信封元数据（schemaVersion/exportedAt），
 * state 是不解释内容的黑盒 blob。
 */
export const SAVE_SCHEMA_VERSION = 4 as const

export interface SaveDocument<TState = unknown> {
  schemaVersion: number
  exportedAt: number
  state: TState
}

export const saveDocumentSchema = z.object({
  schemaVersion: z.number().int().min(1),
  exportedAt: z.number(),
  // JSON 请求体中缺失的 key 会解析为 undefined，用 refine 保证 state 实际存在。
  // 显式 boolean 返回值注解阻止 TS 推断类型谓词，保持 state 推断为 unknown。
  state: z.unknown().refine((value): boolean => value !== undefined, {
    message: 'state 不能缺失',
  }),
})
