# @bravecat/api

咪游记服务端单体：账号 / 云存档 / 经济账本 / AIGC 形象管线 / 版本元信息。
Fastify + TypeScript + Postgres，请求校验用 zod，类型与错误码来自
[`packages/contracts`](../../packages/contracts)。

## 目录

```
services/api
├── Dockerfile             # 多阶段生产镜像（从仓库根目录构建，见 docs/deployment.md）
├── docker-compose.yml     # 本地 Postgres 18
├── docker-compose.prod.yml  # 生产部署：api + Postgres（见 docs/deployment.md）
├── migrations/            # 手写 SQL 迁移（按文件名顺序应用）
├── src/
│   ├── migrate.ts         # 迁移执行器（记录于 schema_migrations 表；编译进 dist 供容器内执行）
│   ├── app.ts             # buildApp：依赖注入的 Fastify 工厂，路由挂 /v1
│   ├── index.ts           # 生产入口：Postgres 仓库 + 环境变量配置 + provider 接线
│   ├── config.ts          # 环境变量解析 + 平台 meta 常量
│   ├── auth/tokens.ts     # 不透明 token 生成 / sha256 哈希
│   ├── plugins/authenticate.ts
│   ├── http/replies.ts    # 统一错误响应（contracts 错误码）
│   ├── economy/validator.ts  # 可注入 EconomyValidator + 速率上限占位实现
│   ├── aigc/              # AIGC 形象管线（见下文「AIGC 形象管线」）
│   │   ├── ports.ts       # provider 端口：审核 / 生成 / 对象存储 / 购买核销
│   │   ├── executor.ts    # job 状态机执行器
│   │   ├── queue.ts       # 进程内 job 队列（可换独立 worker，接口不变）
│   │   ├── qa.ts          # 自动 QA：规格类实现 + 语义类检查位
│   │   ├── creditKeys.ts  # 生成次数账目的幂等键约定
│   │   ├── fakes.ts       # 测试/本地用假 provider 与内存对象存储
│   │   ├── unavailable.ts # 未配置真实云服务时的占位实现
│   │   └── adapters/      # 生产 adapter 骨架（未与真实服务联调）
│   ├── repositories/      # 接口 + 内存实现（单测）+ Postgres 实现
│   └── routes/            # auth / save / ledger / credits / portraits / meta
└── test/                  # vitest，全部跑内存实现，不依赖 Postgres 与云 API
```

## 部署

生产镜像（多阶段 `Dockerfile`）与 `docker-compose.prod.yml`（api + Postgres）
的完整部署步骤——镜像构建、迁移执行、反代 HTTPS、CORS 配置——见
[`docs/deployment.md`](../../docs/deployment.md)。探活走无鉴权的 `GET /healthz`。

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

## 与 apps/web 本地联调（云同步）

1. 按上文「本地启动」把 api 跑起来（默认监听 `:3000`）。
2. 回到仓库根目录，带上 API 地址起 web dev server：

```bash
VITE_API_BASE_URL=http://localhost:3000 npm run dev
```

web 端只有 `VITE_API_BASE_URL` 非空才启用云功能：首次进入静默创建
游客账号（token 存 localStorage），存档落盘后节流推送云端，启动时先
pull 比较；「相册 → 云同步」小节显示同步状态、账号与生成次数余额。
CORS 默认放行 localhost / 127.0.0.1 任意端口，无需额外配置。
不设 `VITE_API_BASE_URL` 构建出的 web 产物不发起任何云端请求，
行为与纯本地版完全一致（ADR-0009）。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `DATABASE_URL` | 无（必填） | Postgres 连接串 |
| `CORS_ALLOWED_ORIGINS` | 无 | 逗号分隔的完整 origin 列表（如 `https://app.example.com`）；未配置时仅放行 localhost / 127.0.0.1 任意端口（dev 默认），生产必须显式配置 |
| `ECONOMY_MAX_EARN_PER_HOUR` | `600` | 占位速率校验：每现实小时可积累的小鱼干上限 |
| `ECONOMY_INITIAL_EARN_ALLOWANCE` | `100` | 新账号初始积累额度（避免 t=0 上限为零） |

AIGC 管线的云服务配置（全部可选；缺失时对应 provider 注入占位实现，
生成 job 会失败并自动退回次数，服务照常启动）：

| 变量 | 说明 |
| --- | --- |
| `ASSET_STORAGE_ENDPOINT` / `ASSET_STORAGE_REGION` / `ASSET_STORAGE_BUCKET` / `ASSET_STORAGE_ACCESS_KEY_ID` / `ASSET_STORAGE_SECRET_ACCESS_KEY` | S3 兼容对象存储（阿里云 OSS S3 兼容模式）；五项齐全才启用 |
| `ASSET_STORAGE_FORCE_PATH_STYLE` | `true` 时用 path-style（MinIO 等自建）；OSS 保持默认 |
| `ASSET_PUBLIC_BASE_URL` | 把对象存储 key 拼成审核可访问 URL 的基址 |
| `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET` | 阿里云内容安全凭证（与 `ASSET_PUBLIC_BASE_URL` 齐全才启用审核 adapter） |
| `ALIYUN_GREEN_ENDPOINT` | 内容安全接入点，默认 `green-cip.cn-shanghai.aliyuncs.com` |
| `ALIYUN_GREEN_SERVICE` | 审核服务编码，默认 `baselineCheck` |
| `DASHSCOPE_API_KEY` | 百炼（DashScope）API key |
| `GENERATION_POSE_ANCHOR_BASE_URL` | 现役姿势锚图（画风参考）公网基址；与 API key 齐全才启用生成 adapter |
| `GENERATION_IMAGE_MODEL` | 出图模型，默认 `wan2.7-image-pro`（成本优先可换 `wan2.7-image`） |
| `GENERATION_VISION_MODEL` | 特征提取模型，默认 `qwen-vl-max` |

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
| `POST /v1/credits/purchases` | 生成次数包购买核销入账：凭证核销通过后按订单号幂等入账（重复订单标记 `duplicate`） |
| `GET /v1/credits/balance` | 生成次数余额（严格服务端权威，ADR-0006） |
| `POST /v1/portraits/generations` | 提交生成 job：校验照片上传引用与余额，预扣 1 次，返回 202；同幂等键重放返回同一 job（200） |
| `GET /v1/portraits/generations/:jobId` | 查询 job 状态（他人 job 与不存在统一 404） |
| `POST /v1/portraits/generations/:jobId/confirm` | 用户确认：落定消耗并产出形象记录；重复确认幂等；非 awaiting_confirm 返回 409 |
| `GET /v1/meta` | 按平台（web/ios/android/miniprogram）下发最低支持客户端版本与功能开关 |

错误响应统一为 `{ "error": { "code", "message", "details?" } }`，
错误码见 `@bravecat/contracts` 的 `ErrorCode`。

## AIGC 形象管线

上传照片 → 内容审核 → 风格化生成 10 姿势套图 → 抠图 → 自动 QA →
用户确认 → 产出形象记录。设计依据：spike 结论与生产管线建议
（`docs/art/candidates/aigc-portrait-spike-2026-08-13/feasibility.md`）。

### job 状态机（`src/aigc/executor.ts`）

```
pending → moderating → generating → qa → awaiting_confirm → confirmed
                └──────────┴───────┴──→ failed（自动退回预扣次数）
```

失败原因三分：`moderation_rejected`（审核明确拒绝）/ `generation_failed`
（任一环节 provider 故障）/ `qa_failed`（自动 QA 不过，failure 附完整报告）。

### 生成次数事务语义（ADR-0006）

全量事件账本 `generation_credit_entries`，余额 = sum(amount)，
幂等键约定见 `src/aigc/creditKeys.ts`：

| 时点 | 账目 | 金额 |
| --- | --- | --- |
| 购买核销通过 | `purchase` | +N（按订单号幂等） |
| 提交生成 job | `hold` | −1（预扣，防止并发超卖） |
| job 失败 | `release` | +1（自动退回） |
| 用户确认 | `release` +1 与 `consume` −1 成对入账 | 净额不变，消耗自此不可逆 |

次数严格服务端记账，无离线乐观语义；确认时才落定消耗并产出形象记录，
形象只向未来生效（ADR-0004），服务端只新增记录、不改写历史数据。
`awaiting_confirm` 长期未确认的预扣回收（超时自动 release）留待后续排期。

### provider 端口（`src/aigc/ports.ts`）

| 端口 | 生产 adapter | 测试实现 |
| --- | --- | --- |
| `ModerationProvider` | 阿里云内容安全 ImageModeration（`adapters/aliyunModeration.ts`） | `createFakeModerationProvider` |
| `GenerationProvider`（stylize → generatePose → removeBackground） | 百炼 qwen-vl 特征提取 + 万相多图参考出图 + VIAPI 分割抠图（`adapters/bailianGeneration.ts`） | `createFakeGenerationProvider`（产出真实可解码的占位 PNG） |
| `AssetStorage` | S3 兼容对象存储（`adapters/s3AssetStorage.ts`） | `createMemoryAssetStorage` |
| `PurchaseVerifier` | Phase 2/4 接 Apple StoreKit / 微信支付核销（未接入时 503） | `createStubPurchaseVerifier`（`test:<orderId>:<credits>` 魔法凭证） |

生产 adapter 均为骨架：env 配置与请求结构就位，**未与真实云 API 联调**；
上线前第一优先事项是按 feasibility 条件 A 用真实 API 打样验证姿势一致性。
job 执行用进程内串行队列（`src/aigc/queue.ts`），未来可换独立 worker
（Postgres `for update skip locked` 或消息队列），路由与执行器接口不变。

### 自动 QA（`src/aigc/qa.ts`）

已实现规格类机检：PNG 格式、1024×1024 尺寸、alpha 通道（透明度）。
语义类检查位（锚点 `support-contact-bottom-center`、单主体、姿势承重、
portrait-contained/scene-provided 目标物、花色一致性、alpha 质量）已按姿势
词汇登记为 `not_implemented`，记录在 QA 报告中但不拦截，待接入像素级
分析与视觉模型后启用。

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
npm test          # vitest，内存仓库 + 假时钟 + 假 provider，不需要 Postgres 与云 API
npm run typecheck
```
