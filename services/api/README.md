# @bravecat/api

咪游记服务端单体骨架（Phase 1a）：账号 / 云存档 / 经济账本 / 版本元信息。
Fastify + TypeScript + Postgres，请求校验用 zod，类型与错误码来自
[`packages/contracts`](../../packages/contracts)。

## 目录

```
services/api
├── docker-compose.yml     # 本地 Postgres 18
├── migrations/            # 手写 SQL 迁移（按文件名顺序应用）
├── scripts/migrate.ts     # 迁移执行器（记录于 schema_migrations 表）
├── src/
│   ├── app.ts             # buildApp：依赖注入的 Fastify 工厂，路由挂 /v1
│   ├── index.ts           # 生产入口：Postgres 仓库 + 环境变量配置
│   ├── config.ts          # 环境变量解析 + 平台 meta 常量
│   ├── auth/tokens.ts     # 不透明 token 生成 / sha256 哈希
│   ├── plugins/authenticate.ts
│   ├── http/replies.ts    # 统一错误响应（contracts 错误码）
│   ├── economy/validator.ts  # 可注入 EconomyValidator + 速率上限占位实现
│   ├── repositories/      # 接口 + 内存实现（单测）+ Postgres 实现
│   └── routes/            # auth / save / ledger / meta
└── test/                  # vitest，全部跑内存实现，不依赖 Postgres
```

## 本地启动

前置：Node ≥ 20、Docker。`@bravecat/contracts` 以 `file:` 依赖引入，
需先构建（Phase 0 收口为 npm workspaces 后此步骤消失）：

```bash
cd packages/contracts && npm install && npm run build

cd ../../services/api
npm install
docker compose up -d            # 起本地 Postgres（bravecat/bravecat）
cp .env.example .env            # 按需修改
export DATABASE_URL=postgres://bravecat:bravecat@localhost:5432/bravecat
npm run migrate                 # 应用 migrations/*.sql
DATABASE_URL=$DATABASE_URL npm run dev   # tsx watch，监听 :3000
```

冒烟：

```bash
curl -s localhost:3000/v1/meta | jq
TOKEN=$(curl -s -X POST localhost:3000/v1/auth/guest | jq -r .token)
curl -s localhost:3000/v1/ledger/balance -H "Authorization: Bearer $TOKEN"
```

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `DATABASE_URL` | 无（必填） | Postgres 连接串 |
| `ECONOMY_MAX_EARN_PER_HOUR` | `600` | 占位速率校验：每现实小时可积累的小鱼干上限 |
| `ECONOMY_INITIAL_EARN_ALLOWANCE` | `100` | 新账号初始积累额度（避免 t=0 上限为零） |

## 路由（全部挂 `/v1`）

| 路由 | 行为 |
| --- | --- |
| `POST /v1/auth/guest` | 创建游客账号，返回不透明 bearer token（库中只存 sha256 哈希） |
| `POST /v1/auth/bind/{wechat,apple,phone}` | 绑定骨架，请求体已定型，返回 501（Phase 2 实现） |
| `PUT /v1/save` | 云存档上传：last-writer-wins，`savedAt` 取服务端时钟；`state` 为黑盒；旧 schema 版本不得覆盖新版本（409） |
| `GET /v1/save?maxSchemaVersion=N` | 云存档下载：云端 schemaVersion 高于 N 时返回 426 `SAVE_SCHEMA_TOO_NEW`（版本护栏） |
| `POST /v1/ledger/transactions` | 批量交易提交：幂等键去重（重复标记 `duplicate`）、经济校验整批拒绝、余额不得为负 |
| `GET /v1/ledger/balance` | 交易日志累计余额 |
| `POST /v1/ledger/iap/redeem` | IAP 核销骨架，返回 501（Phase 2 接 StoreKit / 微信支付） |
| `GET /v1/meta` | 按平台（web/ios/android/miniprogram）下发最低支持客户端版本与功能开关 |

错误响应统一为 `{ "error": { "code", "message", "details?" } }`，
错误码见 `@bravecat/contracts` 的 `ErrorCode`。

## 经济校验

账本路由只依赖 `EconomyValidator` 接口（`src/economy/validator.ts`）。
Phase 1a 注入的是「现实流逝时间 × 积累速率上限」的占位实现（常量可经环境变量配置）；
Phase 1b 将替换为复用 `packages/core` 游戏规则的确定性重放验算，接口不变。

## 迁移

`npm run migrate` 按文件名顺序应用 `migrations/*.sql`，已应用记录在
`schema_migrations` 表，重复执行安全。新增迁移按 `0002_xxx.sql` 递增命名，
只加不改（expand-contract）。

## 测试

```bash
npm test          # vitest，内存仓库 + 假时钟，不需要 Postgres
npm run typecheck
```
