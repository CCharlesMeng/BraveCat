# 部署

三个可独立发布的产物：

| 产物 | 形态 | 发布通道 |
| --- | --- | --- |
| `services/api` | Docker 镜像（Fastify + Postgres） | 阿里云轻量服务器 / 容器服务，docker compose |
| `apps/web` 静态产物 | `vite build` 输出 | 任意静态托管 / CDN |
| 运行时美术资产 | `apps/web/public` 下 scenes / portraits / assets | 阿里云 OSS + CDN（`npm run assets:publish`） |

CI（`.github/workflows/ci.yml`）在 push / PR 上跑类型检查、全 workspace 测试、
web 生产构建（含资产门禁）与小程序构建；端到端测试在 `e2e.yml` 中维护。

## api：镜像构建

`services/api/Dockerfile` 是 npm workspaces 感知的多阶段构建：以仓库根为上下文
（根 lockfile + `packages/contracts` 拓扑），build 阶段先构建 contracts 再 `tsc` 出
`dist/`，生产镜像只带 `--omit=dev` 的运行时依赖、编译产物与 `migrations/`。
根 `.dockerignore` 用白名单把上下文压到最小（不含 docs/art、apps 源码）。

```bash
# 在仓库根目录
docker build -f services/api/Dockerfile -t bravecat-api:$(git rev-parse --short HEAD) .
```

镜像内置 `HEALTHCHECK`，探活走无鉴权的 `GET /healthz`。

## api：阿里云轻量服务器（docker compose）

前置：服务器已装 Docker（含 compose 插件），安全组放行 80/443（**不**放行 3000/5432）。

1. 把代码同步到服务器（`git clone` 或 CI 打包镜像后 `docker save`/推送镜像仓库均可；
   compose 文件默认在服务器上本地构建镜像）。
2. 配置环境变量（compose 读取 `services/api/.env`，模板见 `.env.example`）：

```bash
cd services/api
cp .env.example .env
# 必填：POSTGRES_PASSWORD、CORS_ALLOWED_ORIGINS（如 https://app.example.com）
# AIGC 云服务凭证（OSS / 内容安全 / 百炼，均可选）见 services/api/README.md「环境变量」
```

3. 启动并执行迁移（迁移记录在 `schema_migrations` 表，重复执行安全）：

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm api node dist/migrate.js
curl -fsS http://127.0.0.1:3000/healthz   # {"status":"ok"}
```

4. 升级：拉新代码后重复第 3 步（先 `up -d --build` 再跑迁移；迁移只加不改，
   旧进程在新迁移下可继续工作，见 README「迁移」的 expand-contract 约定）。

若用阿里云容器服务（ACK / SAE），把镜像推到 ACR 后以同样的环境变量清单部署，
探活配置指向 `GET /healthz` 即可，Postgres 建议换用 RDS 并只改 `DATABASE_URL`。

### 反向代理与 HTTPS

api 容器只绑 `127.0.0.1:3000`，公网流量由宿主机反向代理做 HTTPS 终结。
以 Caddy 为例（自动签发 Let's Encrypt 证书）：

```
api.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Nginx 则常规 `proxy_pass http://127.0.0.1:3000` + certbot。注意：

- CORS 由 api 自己处理（`CORS_ALLOWED_ORIGINS`），反向代理**不要**再加 CORS 头，
  否则会出现重复头。web 端部署在哪个 origin，就把哪个 origin 写进列表。
- 存档上传请求体最大 5MB（Fastify `bodyLimit`），Nginx 需相应放宽
  `client_max_body_size`。

## web 与资产：CDN/OSS 发布衔接

发布顺序：**先发资产，再构建/发布 web**（web 构建期通过 `VITE_ASSET_BASE_URL`
把资产指向 CDN，构建时资产必须已可访问）。

1. 资产发布用根目录 `npm run assets:publish`（`scripts/publish-assets-oss.mjs`，
   走 OSS 的 S3 兼容 API）。凭证与 CDN 域名放根目录 `.env`（模板见根 `.env.example`：
   `ASSET_PUBLISH_ENDPOINT` / `ASSET_PUBLISH_BUCKET` / AK / SK / `ASSET_CDN_BASE_URL` 等）。
   默认 dry-run，完整走版权门禁 + 清单生成但不上传：

```bash
npm run assets:publish              # dry-run：门禁 + 清单 + 上传计划
npm run assets:publish -- --upload  # 真正上传（对象带内容哈希，重复发布自动跳过）
```

   发布脚本与 `npm run build` 共用同一套 shipping gate（未放行类目自动 exclude），
   所以放在 CI 构建绿了之后执行即可，不需要额外前置检查。

2. 构建 web 时注入 CDN 与 API 地址（留空则回退相对路径加载 / 云功能整体关闭）：

```bash
VITE_ASSET_BASE_URL=https://assets.example.com \
VITE_API_BASE_URL=https://api.example.com \
npm run build
```

3. 把 `apps/web/dist` 发布到静态托管（OSS 静态站点 / CDN 均可）。

接入 CI 时的最小发布流水线：`ci.yml` 全绿 → `npm run assets:publish -- --upload`
（凭证放 CI secrets）→ 带 `VITE_*` 变量的 `npm run build` → 上传 `apps/web/dist`
→ 服务器上按上文升级 api。

## 本地端到端演示：AIGC 形象生成闭环

不需要 Postgres 与任何云服务凭证。api 以演示模式启动（内存仓库 +
内存对象存储 + fake providers：审核恒通过、生成产出占位 PNG 但走完整
状态机与自动 QA），并放开 `aigcAvatar` 功能开关、给新游客自动赠送
5 次生成次数（可用 `DEV_INITIAL_CREDITS` 调整）。

1. 起 api（演示模式，监听 `:3000`，进程重启即清空数据）：

```bash
npm run dev:fake --workspace @bravecat/api
```

2. 另开终端，带 API 地址起 web dev server：

```bash
VITE_API_BASE_URL=http://localhost:3000 npm run dev
```

3. 浏览器里完整走一遍生成闭环：

   1. 打开 web 页面，领养并命名小猫；云同步会静默创建游客账号
      （「相册 → 云同步」小节可看到账号与生成次数余额 5）。
   2. 点小猫名字旁的「更换形象」→「用照片生成专属形象」。
   3. 选一张 PNG/JPEG 照片（3MB 以内），面板会显示剩余次数与
      「提交预扣、确认才正式消耗、失败自动退回」的说明，点「开始生成」。
   4. 状态进度依次推进：排队 → 照片审核 → 生成 10 姿势 → 自动质检
      →「画好了，等你确认」（fake provider 几秒内完成）。
   5. 预览 10 姿势套图后点「就是它，确认使用」：正式消耗 1 次
      （余额变 4），专属形象进入可选列表；点「先不用」则不消耗进列表，
      预扣次数以云端账本为准。
   6. 「更换形象」里选中「专属形象 1」：家里立即换上新形象；按
      ADR-0004 只向未来生效——已出发的旅行与已收藏的明信片保持原样。
   7. 刷新页面验证跨会话恢复：形象列表与当前形象都从云端还原。

失败态（审核拒绝 / 生成失败 / 质检不过）会显示友好文案并注明次数已
自动退回；fake 审核默认全部通过，要演示失败路径可在测试里注入拒绝的
provider（见 `services/api/test/portraits.test.ts`）。

默认构建（不设 `VITE_API_BASE_URL`）不出现任何云端入口，行为与纯本地
版完全一致。
