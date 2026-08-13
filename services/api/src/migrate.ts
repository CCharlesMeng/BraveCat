// 迁移执行器：按文件名顺序应用 migrations/*.sql，已应用记录在 schema_migrations 表。
// 开发环境跑 `npm run migrate`（tsx）；生产容器内跑编译产物 `node dist/migrate.js`。
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
)

const run = async () => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('缺少 DATABASE_URL 环境变量')
  }

  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    await client.query(
      'create table if not exists schema_migrations (name text primary key, applied_at bigint not null)',
    )
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const { rowCount } = await client.query(
        'select 1 from schema_migrations where name = $1',
        [file],
      )
      if (rowCount) {
        console.log(`跳过 ${file}（已应用）`)
        continue
      }
      const sql = await readFile(join(migrationsDir, file), 'utf8')
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query(
          'insert into schema_migrations (name, applied_at) values ($1, $2)',
          [file, Date.now()],
        )
        await client.query('commit')
      } catch (error) {
        await client.query('rollback')
        throw error
      }
      console.log(`已应用 ${file}`)
    }
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
