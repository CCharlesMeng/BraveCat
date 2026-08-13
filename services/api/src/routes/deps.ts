import type { MetaResponse } from '@bravecat/contracts'
import type { EconomyValidator } from '../economy/validator.js'
import type { AuthenticateHandler } from '../plugins/authenticate.js'
import type { Repositories } from '../repositories/types.js'

/** 路由的全部依赖以显式注入传入，方便单测替换（内存仓库 + 假时钟）。 */
export interface RouteDeps {
  repositories: Repositories
  economyValidator: EconomyValidator
  platformMeta: MetaResponse['platforms']
  authenticate: AuthenticateHandler
  now: () => number
}
