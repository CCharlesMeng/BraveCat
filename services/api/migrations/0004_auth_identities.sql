-- 外部身份绑定与短信验证码（手机号注册/绑定/登录）。
-- 手机号统一规范化为 E.164（中国号 +86）后作为 external_id / phone 存储。

create table if not exists auth_identities (
  id bigserial primary key,
  user_id uuid not null references users (id) on delete cascade,
  provider text not null,
  external_id text not null,
  created_at bigint not null,
  unique (provider, external_id)
);

create index if not exists auth_identities_user_idx on auth_identities (user_id);

-- 每次发码插入一行：同 (phone, purpose) 里 created_at 最新的一行是当前有效码，
-- 历史行留作冷却与每日限额统计（无需后台清理任务，量级极小）。
create table if not exists sms_verification_codes (
  id bigserial primary key,
  phone text not null,
  purpose text not null,
  code_hash text not null,
  expires_at bigint not null,
  attempts integer not null default 0,
  created_at bigint not null
);

create index if not exists sms_verification_codes_phone_idx
  on sms_verification_codes (phone, created_at desc);
