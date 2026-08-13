import type { FastifyInstance } from 'fastify'
import {
  ErrorCode,
  getSaveQuerySchema,
  putSaveRequestSchema,
  type GetSaveResponse,
  type PutSaveResponse,
} from '@bravecat/contracts'
import { sendError, sendValidationError } from '../http/replies.js'
import type { RouteDeps } from './deps.js'

export const registerSaveRoutes = (
  app: FastifyInstance,
  deps: RouteDeps,
): void => {
  const { saves } = deps.repositories

  /**
   * 下载云存档。客户端必须用 maxSchemaVersion 声明自己支持的最高存档版本；
   * 云端版本更高时返回 426 SAVE_SCHEMA_TOO_NEW（版本护栏，提示升级客户端）。
   */
  app.get(
    '/save',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const query = getSaveQuerySchema.safeParse(request.query)
      if (!query.success) {
        return sendValidationError(reply, query.error)
      }
      const stored = await saves.get(request.userId)
      if (!stored) {
        return sendError(reply, 404, ErrorCode.SaveNotFound, '云端暂无存档')
      }
      if (stored.document.schemaVersion > query.data.maxSchemaVersion) {
        return sendError(
          reply,
          426,
          ErrorCode.SaveSchemaTooNew,
          `云端存档 schemaVersion=${stored.document.schemaVersion} 高于客户端支持的 ` +
            `${query.data.maxSchemaVersion}，请升级客户端后再同步`,
          {
            cloudSchemaVersion: stored.document.schemaVersion,
            maxSupportedSchemaVersion: query.data.maxSchemaVersion,
          },
        )
      }
      const body: GetSaveResponse = {
        document: stored.document,
        savedAt: stored.savedAt,
      }
      return reply.send(body)
    },
  )

  /**
   * 上传云存档：last-writer-wins，savedAt 取服务端时钟；state 为黑盒不解释。
   * 单调性护栏：旧 schema 版本的客户端不得覆盖更新版本的云端存档。
   */
  app.put(
    '/save',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const parsed = putSaveRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error)
      }
      const document = parsed.data.document
      const stored = await saves.get(request.userId)
      if (stored && document.schemaVersion < stored.document.schemaVersion) {
        return sendError(
          reply,
          409,
          ErrorCode.SaveSchemaTooNew,
          `云端已有 schemaVersion=${stored.document.schemaVersion} 的存档，` +
            `拒绝被 schemaVersion=${document.schemaVersion} 的旧版客户端覆盖`,
          {
            cloudSchemaVersion: stored.document.schemaVersion,
            uploadedSchemaVersion: document.schemaVersion,
          },
        )
      }
      const savedAt = deps.now()
      await saves.put(request.userId, { document, savedAt })
      const body: PutSaveResponse = {
        savedAt,
        schemaVersion: document.schemaVersion,
      }
      return reply.send(body)
    },
  )
}
