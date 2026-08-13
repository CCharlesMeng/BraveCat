import fastify from 'fastify'
import type { MetaResponse } from '@bravecat/contracts'
import { ErrorCode } from '@bravecat/contracts'
import type { EconomyValidator } from './economy/validator.js'
import { sendError } from './http/replies.js'
import { createAuthenticate } from './plugins/authenticate.js'
import type { Repositories } from './repositories/types.js'
import type { AigcDeps, RouteDeps } from './routes/deps.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerCreditRoutes } from './routes/credits.js'
import { registerLedgerRoutes } from './routes/ledger.js'
import { registerMetaRoutes } from './routes/meta.js'
import { registerSaveRoutes } from './routes/save.js'

export interface BuildAppOptions {
  repositories: Repositories
  economyValidator: EconomyValidator
  platformMeta: MetaResponse['platforms']
  /** AIGC 形象管线依赖（生产接线见 index.ts，测试接线见 test/helpers.ts）。 */
  aigc: AigcDeps
  /** 可注入时钟，单测用；默认 Date.now。 */
  now?: () => number
  logger?: boolean
}

export const buildApp = (options: BuildAppOptions) => {
  const app = fastify({
    logger: options.logger ?? false,
    // 存档 blob 走 JSON 请求体，放宽默认 1MB 限制。
    bodyLimit: 5 * 1024 * 1024,
  })

  const deps: RouteDeps = {
    repositories: options.repositories,
    economyValidator: options.economyValidator,
    platformMeta: options.platformMeta,
    authenticate: createAuthenticate(options.repositories.tokens),
    now: options.now ?? Date.now,
    aigc: options.aigc,
  }

  app.setErrorHandler((error, request, reply) => {
    const statusCode =
      error instanceof Error &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500
    if (statusCode >= 400 && statusCode < 500) {
      // fastify 自身抛出的 4xx（JSON 解析失败、body 超限等）。
      const message = error instanceof Error ? error.message : '请求不合法'
      return sendError(reply, statusCode, ErrorCode.ValidationFailed, message)
    }
    request.log.error(error)
    return sendError(reply, 500, ErrorCode.Internal, '服务器内部错误')
  })

  app.setNotFoundHandler((request, reply) =>
    sendError(
      reply,
      404,
      ErrorCode.NotFound,
      `路由不存在：${request.method} ${request.url}`,
    ),
  )

  // API 版本化：全部路由挂 /v1 前缀，破坏性变更走 /v2（expand-contract）。
  app.register(
    async (v1) => {
      registerAuthRoutes(v1, deps)
      registerSaveRoutes(v1, deps)
      registerLedgerRoutes(v1, deps)
      registerCreditRoutes(v1, deps)
      registerMetaRoutes(v1, deps)
    },
    { prefix: '/v1' },
  )

  return app
}
