import type { MetaResponse } from '@bravecat/contracts'
import type { AssetStorage, PurchaseVerifier } from '../aigc/ports.js'
import type { GenerationJobQueue } from '../aigc/queue.js'
import type { SmsProvider } from '../auth/ports.js'
import type { EconomyValidator } from '../economy/validator.js'
import type { AuthenticateHandler } from '../plugins/authenticate.js'
import type { Repositories } from '../repositories/types.js'

/** AIGC 形象管线的路由依赖（provider 端口定义见 src/aigc/ports.ts）。 */
export interface AigcDeps {
  /** 用户上传照片与生成产出图的对象存储。 */
  storage: AssetStorage
  /** 生成 job 执行队列（审核/生成/QA provider 由 executor 持有，不进路由）。 */
  queue: GenerationJobQueue
  /** 生成次数包购买核销。 */
  purchaseVerifier: PurchaseVerifier
}

/** 手机号认证链路的路由依赖（SmsProvider 端口定义见 src/auth/ports.ts）。 */
export interface AuthDeps {
  /** 短信验证码下发；unavailable 占位使发码接口回 503。 */
  sms: SmsProvider
  /** 验证码生成；生产用密码学随机 6 位，dev 入口可注入固定码便于演示。 */
  generateSmsCode: () => string
  /** 提交形象生成前是否硬性要求已绑定手机号（产品决策，生产恒开）。 */
  requirePhoneForGeneration: boolean
}

/** 路由的全部依赖以显式注入传入，方便单测替换（内存仓库 + 假时钟）。 */
export interface RouteDeps {
  repositories: Repositories
  economyValidator: EconomyValidator
  platformMeta: MetaResponse['platforms']
  authenticate: AuthenticateHandler
  now: () => number
  aigc: AigcDeps
  auth: AuthDeps
}
