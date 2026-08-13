import pg from 'pg'
import { createGenerationJobExecutor } from './aigc/executor.js'
import { createMemoryAssetStorage } from './aigc/fakes.js'
import { createBaselinePortraitQa } from './aigc/qa.js'
import { createInProcessJobQueue } from './aigc/queue.js'
import {
  createUnavailableGenerationProvider,
  createUnavailableModerationProvider,
  createUnavailablePurchaseVerifier,
} from './aigc/unavailable.js'
import { buildApp } from './app.js'
import { defaultPlatformMeta, loadConfig } from './config.js'
import { createRateCapValidator } from './economy/validator.js'
import { createPostgresRepositories } from './repositories/postgres.js'

const config = loadConfig()

if (!config.databaseUrl) {
  console.error(
    '缺少 DATABASE_URL。本地开发：docker compose up -d 起 Postgres，' +
      '然后 npm run migrate，再重试（见 README.md）。',
  )
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: config.databaseUrl })
const repositories = createPostgresRepositories(pool)

// AIGC 管线接线：真实云 provider 未配置时注入占位实现
// （审核/生成调用即失败并自动退回次数），服务照常启动。
const storage = createMemoryAssetStorage()
const executor = createGenerationJobExecutor({
  repositories,
  storage,
  moderation: createUnavailableModerationProvider(),
  generation: createUnavailableGenerationProvider(),
  qa: createBaselinePortraitQa(),
  now: Date.now,
})
const queue = createInProcessJobQueue(executor.execute, (error, jobId) => {
  console.error(`AIGC job 执行异常（jobId=${jobId}）`, error)
})

const app = buildApp({
  repositories,
  economyValidator: createRateCapValidator(config.economy),
  platformMeta: defaultPlatformMeta,
  aigc: {
    storage,
    queue,
    // 生产核销 adapter（Apple StoreKit / 微信支付）在 Phase 2/4 接入前保持 503。
    purchaseVerifier: createUnavailablePurchaseVerifier(),
  },
  logger: true,
})

const shutdown = async () => {
  await app.close()
  await pool.end()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

app.listen({ port: config.port, host: config.host }).catch((error) => {
  app.log.error(error)
  process.exit(1)
})
