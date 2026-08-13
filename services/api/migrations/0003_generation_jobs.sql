-- AIGC 形象生成 job（状态机：pending → moderating → generating → qa →
-- awaiting_confirm → confirmed / failed，见 src/aigc/executor.ts）
-- 与确认后产出的形象记录（ADR-0004：只向未来生效）。

create table if not exists generation_jobs (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  idempotency_key text not null,
  photo_key text not null,
  status text not null,
  failure jsonb,
  result jsonb,
  portrait_id uuid,
  created_at bigint not null,
  updated_at bigint not null,
  unique (user_id, idempotency_key)
);

create index if not exists generation_jobs_user_idx on generation_jobs (user_id);

create table if not exists user_portraits (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  job_id uuid not null unique references generation_jobs (id) on delete cascade,
  poses jsonb not null,
  created_at bigint not null
);

create index if not exists user_portraits_user_idx on user_portraits (user_id);
