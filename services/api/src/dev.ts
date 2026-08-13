/**
 * 本地演示入口：内存仓库 + 内存对象存储 + fake AIGC providers。
 *
 * 与生产入口（index.ts）的区别：
 * - 不需要 Postgres 与任何云服务凭证，进程重启即清空全部数据；
 * - 审核恒通过、生成产出确定性的占位 PNG（与生产管线同构，走完整
 *   状态机与自动 QA）；购买核销用测试 stub（凭证格式 test:<orderId>:<credits>）；
 * - 平台元信息放开 aigcAvatar 开关（生产在真实 provider 就绪前保持关闭）；
 * - 新建游客自动赠送生成次数（web 端暂无购买 UI，演示闭环用）。
 *
 * 启动：npm run dev:fake --workspace @bravecat/api
 * 完整的 web 端到端演示步骤见 docs/deployment.md。
 */
import { createGenerationJobExecutor } from './aigc/executor.js'
import {
  createFakeGenerationProvider,
  createFakeModerationProvider,
  createMemoryAssetStorage,
  createStubPurchaseVerifier,
} from './aigc/fakes.js'
import { createBaselinePortraitQa } from './aigc/qa.js'
import { createInProcessJobQueue } from './aigc/queue.js'
import { buildApp } from './app.js'
import { defaultPlatformMeta, loadConfig } from './config.js'
import { createRateCapValidator } from './economy/validator.js'
import { createMemoryRepositories } from './repositories/memory.js'

const config = loadConfig()

const initialCredits = Number(process.env.DEV_INITIAL_CREDITS ?? 5)
if (!Number.isInteger(initialCredits) || initialCredits < 0) {
  console.error(`DEV_INITIAL_CREDITS 需要是非负整数：${process.env.DEV_INITIAL_CREDITS}`)
  process.exit(1)
}

const repositories = createMemoryRepositories()

// 新游客自动入账欢迎次数：演示无需先走购买核销即可提交生成。
const users = repositories.users
repositories.users = {
  ...users,
  create: async (user) => {
    await users.create(user)
    if (initialCredits > 0) {
      await repositories.generationCredits.insertMany([
        {
          userId: user.id,
          idempotencyKey: `dev-welcome:${user.id}`,
          kind: 'purchase',
          amount: initialCredits,
          orderId: `dev-welcome:${user.id}`,
          recordedAt: Date.now(),
        },
      ])
    }
  },
}

const storage = createMemoryAssetStorage()
const executor = createGenerationJobExecutor({
  repositories,
  storage,
  moderation: createFakeModerationProvider(),
  generation: createFakeGenerationProvider(),
  qa: createBaselinePortraitQa(),
  now: Date.now,
})
const queue = createInProcessJobQueue(executor.execute, (error, jobId) => {
  console.error(`AIGC job 执行异常（jobId=${jobId}）`, error)
})

// 演示环境放开 aigcAvatar：fake 管线可以真实走通闭环。
const enableAigcAvatar = (
  meta: (typeof defaultPlatformMeta)[keyof typeof defaultPlatformMeta],
) => ({
  ...meta,
  featureFlags: { ...meta.featureFlags, aigcAvatar: true },
})
const platformMeta: typeof defaultPlatformMeta = {
  web: enableAigcAvatar(defaultPlatformMeta.web),
  ios: enableAigcAvatar(defaultPlatformMeta.ios),
  android: enableAigcAvatar(defaultPlatformMeta.android),
  miniprogram: enableAigcAvatar(defaultPlatformMeta.miniprogram),
}

const app = buildApp({
  repositories,
  economyValidator: createRateCapValidator(config.economy),
  platformMeta,
  corsOrigins: config.corsOrigins,
  aigc: {
    storage,
    queue,
    purchaseVerifier: createStubPurchaseVerifier(),
  },
  logger: true,
})

app
  .listen({ port: config.port, host: config.host })
  .then(() => {
    console.log(
      `bravecat api（演示模式：内存存储 + fake providers）监听 :${config.port}；` +
        `新游客自动赠送 ${initialCredits} 次生成次数`,
    )
  })
  .catch((error) => {
    app.log.error(error)
    process.exit(1)
  })
