-- 生成次数 entitlement 账本（ADR-0006：严格服务端权威）。
-- 全量事件日志：purchase/release 记正、hold/consume 记负，余额 = sum(amount)；
-- (user_id, idempotency_key) 唯一约束兜底幂等（键命名见 src/aigc/creditKeys.ts）。

create table if not exists generation_credit_entries (
  id bigserial primary key,
  user_id uuid not null references users (id) on delete cascade,
  idempotency_key text not null,
  kind text not null,
  amount integer not null,
  job_id uuid,
  order_id text,
  recorded_at bigint not null,
  unique (user_id, idempotency_key)
);

create index if not exists generation_credit_entries_user_idx
  on generation_credit_entries (user_id);
