import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import {
  ErrorCode,
  appleBindRequestSchema,
  phoneBindRequestSchema,
  wechatBindRequestSchema,
  type AuthTokenResponse,
} from '@bravecat/contracts'
import { generateToken, hashToken } from '../auth/tokens.js'
import { sendError, sendValidationError } from '../http/replies.js'
import type { RouteDeps } from './deps.js'

export const registerAuthRoutes = (
  app: FastifyInstance,
  deps: RouteDeps,
): void => {
  /** 游客账号：无需凭证即建号，token 明文只出现在这一次响应里。 */
  app.post('/auth/guest', async (_request, reply) => {
    const userId = randomUUID()
    const token = generateToken()
    const createdAt = deps.now()
    await deps.repositories.users.create({ id: userId, createdAt })
    await deps.repositories.tokens.insert(hashToken(token), userId, createdAt)
    const body: AuthTokenResponse = { userId, token, tokenType: 'Bearer' }
    return reply.status(201).send(body)
  })

  // 绑定路由骨架：路由与请求类型已成型，OAuth/短信流程在 Phase 2 客户端接入时实现。
  const bindings = [
    { provider: '微信', path: '/auth/bind/wechat', schema: wechatBindRequestSchema },
    { provider: 'Apple', path: '/auth/bind/apple', schema: appleBindRequestSchema },
    { provider: '手机号', path: '/auth/bind/phone', schema: phoneBindRequestSchema },
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
