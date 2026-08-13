import { z } from 'zod'
import { saveDocumentSchema } from './save-document.js'

/**
 * GET /v1/save 查询参数：客户端必须声明自己支持的最高存档 schemaVersion，
 * 云端存档版本更高时服务端返回 SAVE_SCHEMA_TOO_NEW（版本护栏）。
 */
export const getSaveQuerySchema = z.object({
  maxSchemaVersion: z.coerce.number().int().min(1),
})

export type GetSaveQuery = z.infer<typeof getSaveQuerySchema>

/** GET /v1/save 响应：savedAt 为服务端写入时间戳（epoch 毫秒）。 */
export const getSaveResponseSchema = z.object({
  document: saveDocumentSchema,
  savedAt: z.number(),
})

export type GetSaveResponse = z.infer<typeof getSaveResponseSchema>

/** PUT /v1/save 请求：整份存档文档作为黑盒上传。 */
export const putSaveRequestSchema = z.object({
  document: saveDocumentSchema,
})

export type PutSaveRequest = z.infer<typeof putSaveRequestSchema>

/** PUT /v1/save 响应：last-writer-wins，savedAt 以服务端时钟为准。 */
export const putSaveResponseSchema = z.object({
  savedAt: z.number(),
  schemaVersion: z.number().int(),
})

export type PutSaveResponse = z.infer<typeof putSaveResponseSchema>
