import type { MetaResponse } from '@bravecat/contracts'
import type { PurchaseVerifier } from '../aigc/ports.js'
import type { EconomyValidator } from '../economy/validator.js'
import type { AuthenticateHandler } from '../plugins/authenticate.js'
import type { Repositories } from '../repositories/types.js'

/** AIGC 形象管线的路由依赖（provider 端口定义见 src/aigc/ports.ts）。 */
export interface AigcDeps {
  /** 生成次数包购买核销。 */
  purchaseVerifier: PurchaseVerifier
}

/** 路由的全部依赖以显式注入传入，方便单测替换（内存仓库 + 假时钟）。 */
export interface RouteDeps {
  repositories: Repositories
  economyValidator: EconomyValidator
  platformMeta: MetaResponse['platforms']
  authenticate: AuthenticateHandler
  now: () => number
  aigc: AigcDeps
}
