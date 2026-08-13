import type { FastifyInstance } from 'fastify'
import type { MetaResponse } from '@bravecat/contracts'
import type { RouteDeps } from './deps.js'

export const registerMetaRoutes = (
  app: FastifyInstance,
  deps: RouteDeps,
): void => {
  /** 无需认证：客户端启动时拉取最低支持版本与功能开关。 */
  app.get('/meta', async (_request, reply) => {
    const body: MetaResponse = {
      platforms: deps.platformMeta,
      serverTime: deps.now(),
    }
    return reply.send(body)
  })
}
