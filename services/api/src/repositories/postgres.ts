import pg from 'pg'
import type { Repositories } from './types.js'

/**
 * Postgres 实现（pg 驱动 + 手写 SQL，迁移见 migrations/）。
 * 时间一律存 epoch 毫秒 bigint，避免时区换算；state 存 jsonb 黑盒。
 */
export const createPostgresRepositories = (pool: pg.Pool): Repositories => ({
  users: {
    create: async (user) => {
      await pool.query(
        'insert into users (id, created_at) values ($1, $2)',
        [user.id, user.createdAt],
      )
    },
    findById: async (id) => {
      const { rows } = await pool.query(
        'select id, created_at from users where id = $1',
        [id],
      )
      const row = rows[0]
      return row ? { id: row.id, createdAt: Number(row.created_at) } : undefined
    },
  },
  tokens: {
    insert: async (tokenHash, userId, createdAt) => {
      await pool.query(
        'insert into auth_tokens (token_hash, user_id, created_at) values ($1, $2, $3)',
        [tokenHash, userId, createdAt],
      )
    },
    findUserIdByTokenHash: async (tokenHash) => {
      const { rows } = await pool.query(
        'select user_id from auth_tokens where token_hash = $1',
        [tokenHash],
      )
      return rows[0]?.user_id
    },
  },
  saves: {
    get: async (userId) => {
      const { rows } = await pool.query(
        `select schema_version, exported_at, state, saved_at
         from saves where user_id = $1`,
        [userId],
      )
      const row = rows[0]
      if (!row) {
        return undefined
      }
      return {
        document: {
          schemaVersion: row.schema_version,
          exportedAt: Number(row.exported_at),
          state: row.state,
        },
        savedAt: Number(row.saved_at),
      }
    },
    put: async (userId, save) => {
      await pool.query(
        `insert into saves (user_id, schema_version, exported_at, state, saved_at)
         values ($1, $2, $3, $4::jsonb, $5)
         on conflict (user_id) do update set
           schema_version = excluded.schema_version,
           exported_at = excluded.exported_at,
           state = excluded.state,
           saved_at = excluded.saved_at`,
        [
          userId,
          save.document.schemaVersion,
          save.document.exportedAt,
          JSON.stringify(save.document.state),
          save.savedAt,
        ],
      )
    },
  },
  ledger: {
    findExistingIdempotencyKeys: async (userId, keys) => {
      const { rows } = await pool.query(
        `select idempotency_key from ledger_transactions
         where user_id = $1 and idempotency_key = any($2::text[])`,
        [userId, [...keys]],
      )
      return new Set<string>(rows.map((row) => row.idempotency_key))
    },
    insertMany: async (entries) => {
      const client = await pool.connect()
      try {
        await client.query('begin')
        for (const entry of entries) {
          await client.query(
            `insert into ledger_transactions
               (user_id, idempotency_key, type, amount, occurred_at, recorded_at)
             values ($1, $2, $3, $4, $5, $6)
             on conflict (user_id, idempotency_key) do nothing`,
            [
              entry.userId,
              entry.idempotencyKey,
              entry.type,
              entry.amount,
              entry.occurredAt,
              entry.recordedAt,
            ],
          )
        }
        await client.query('commit')
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    getBalance: async (userId) => {
      const { rows } = await pool.query(
        'select coalesce(sum(amount), 0) as balance from ledger_transactions where user_id = $1',
        [userId],
      )
      return Number(rows[0].balance)
    },
    getTotalEarned: async (userId) => {
      const { rows } = await pool.query(
        `select coalesce(sum(amount), 0) as earned
         from ledger_transactions where user_id = $1 and amount > 0`,
        [userId],
      )
      return Number(rows[0].earned)
    },
  },
  generationCredits: {
    findExistingIdempotencyKeys: async (userId, keys) => {
      const { rows } = await pool.query(
        `select idempotency_key from generation_credit_entries
         where user_id = $1 and idempotency_key = any($2::text[])`,
        [userId, [...keys]],
      )
      return new Set<string>(rows.map((row) => row.idempotency_key))
    },
    insertMany: async (entries) => {
      const client = await pool.connect()
      try {
        await client.query('begin')
        for (const entry of entries) {
          await client.query(
            `insert into generation_credit_entries
               (user_id, idempotency_key, kind, amount, job_id, order_id, recorded_at)
             values ($1, $2, $3, $4, $5, $6, $7)
             on conflict (user_id, idempotency_key) do nothing`,
            [
              entry.userId,
              entry.idempotencyKey,
              entry.kind,
              entry.amount,
              entry.jobId ?? null,
              entry.orderId ?? null,
              entry.recordedAt,
            ],
          )
        }
        await client.query('commit')
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
    getBalance: async (userId) => {
      const { rows } = await pool.query(
        `select coalesce(sum(amount), 0) as balance
         from generation_credit_entries where user_id = $1`,
        [userId],
      )
      return Number(rows[0].balance)
    },
    listByUser: async (userId) => {
      const { rows } = await pool.query(
        `select user_id, idempotency_key, kind, amount, job_id, order_id, recorded_at
         from generation_credit_entries where user_id = $1 order by id`,
        [userId],
      )
      return rows.map((row) => ({
        userId: row.user_id,
        idempotencyKey: row.idempotency_key,
        kind: row.kind,
        amount: Number(row.amount),
        jobId: row.job_id ?? undefined,
        orderId: row.order_id ?? undefined,
        recordedAt: Number(row.recorded_at),
      }))
    },
  },
})
