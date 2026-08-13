import pg from 'pg'
import { createUnavailablePurchaseVerifier } from './aigc/unavailable.js'
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

const app = buildApp({
  repositories: createPostgresRepositories(pool),
  economyValidator: createRateCapValidator(config.economy),
  platformMeta: defaultPlatformMeta,
  aigc: {
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
