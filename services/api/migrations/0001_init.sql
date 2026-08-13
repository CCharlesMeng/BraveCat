-- 初始表结构：账号 / token / 云存档 / 经济账本。
-- 时间一律为 epoch 毫秒 bigint（与客户端单时钟模型一致，避免时区换算）。

create table if not exists users (
  id uuid primary key,
  created_at bigint not null
);

create table if not exists auth_tokens (
  token_hash text primary key,
  user_id uuid not null references users (id) on delete cascade,
  created_at bigint not null
);

create index if not exists auth_tokens_user_idx on auth_tokens (user_id);

-- 每用户单存档 blob；state 为服务端不解释的黑盒。
create table if not exists saves (
  user_id uuid primary key references users (id) on delete cascade,
  schema_version integer not null,
  exported_at bigint not null,
  state jsonb not null,
  saved_at bigint not null
);

-- 全量交易日志：余额 = sum(amount)；(user_id, idempotency_key) 唯一约束兜底幂等。
create table if not exists ledger_transactions (
  id bigserial primary key,
  user_id uuid not null references users (id) on delete cascade,
  idempotency_key text not null,
  type text not null,
  amount integer not null,
  occurred_at bigint not null,
  recorded_at bigint not null,
  unique (user_id, idempotency_key)
);

create index if not exists ledger_transactions_user_idx on ledger_transactions (user_id);
