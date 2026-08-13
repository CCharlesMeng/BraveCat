import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErrorCode } from '@bravecat/contracts'
import { hashToken } from '../auth/tokens.js'
import { sendError } from '../http/replies.js'
import type { TokenRepository } from '../repositories/types.js'

declare module 'fastify' {
  interface FastifyRequest {
    /** 由 authenticate preHandler 写入；仅认证路由可读。 */
    userId: string
  }
}

export type AuthenticateHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>

/** Bearer token 认证 preHandler：查哈希、把 userId 挂到 request 上。 */
export const createAuthenticate = (
  tokens: TokenRepository,
): AuthenticateHandler => {
  return async (request, reply) => {
    const header = request.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      await sendError(
        reply,
        401,
        ErrorCode.Unauthorized,
        '缺少 Authorization: Bearer <token>',
      )
      return
    }
    const token = header.slice('Bearer '.length)
    const userId = await tokens.findUserIdByTokenHash(hashToken(token))
    if (!userId) {
      await sendError(reply, 401, ErrorCode.Unauthorized, 'token 无效或已失效')
      return
    }
    request.userId = userId
  }
}
