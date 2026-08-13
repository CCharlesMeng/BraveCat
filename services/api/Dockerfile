# syntax=docker/dockerfile:1
# @bravecat/api 生产镜像（npm workspaces 感知的多阶段构建）。
#
# 必须从仓库根目录构建（依赖根 lockfile 与 packages/contracts 的 workspace 拓扑）：
#   docker build -f services/api/Dockerfile -t bravecat-api .
#
# 阶段划分：
#   base      仅拷贝各 workspace 的 package.json，让依赖安装层可被缓存复用
#   build     安装含 dev 的依赖，先构建 @bravecat/contracts 再构建 api（tsc → dist）
#   prod-deps 重新只装运行时依赖（--omit=dev），生产镜像不带 typescript/tsx/vitest
#   runtime   node_modules（含指向 packages/contracts 的 workspace 软链）+ dist + migrations

FROM node:24-slim AS base
WORKDIR /repo
# 根 lockfile 校验所有 workspace 的 manifest，因此全部拷入（源码稍后按需拷贝）。
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/core/package.json packages/core/
COPY services/api/package.json services/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY apps/miniprogram/package.json apps/miniprogram/

FROM base AS build
# --ignore-scripts：contracts 的 prepare 钩子在源码拷入前无法执行，改为下面显式构建。
RUN npm ci --workspace @bravecat/contracts --workspace @bravecat/api \
    --include-workspace-root=false --ignore-scripts
COPY packages/contracts packages/contracts
COPY services/api services/api
RUN npm run build --workspace @bravecat/contracts \
 && npm run build --workspace @bravecat/api

FROM base AS prod-deps
RUN npm ci --workspace @bravecat/api --include-workspace-root=false \
    --omit=dev --ignore-scripts \
 && mkdir -p services/api/node_modules packages/contracts/node_modules

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules node_modules
COPY --from=prod-deps /repo/services/api/node_modules services/api/node_modules
COPY --from=prod-deps /repo/packages/contracts/node_modules packages/contracts/node_modules
COPY packages/contracts/package.json packages/contracts/
COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY services/api/package.json services/api/
COPY --from=build /repo/services/api/dist services/api/dist
COPY services/api/migrations services/api/migrations

WORKDIR /repo/services/api
USER node
EXPOSE 3000
# 探活走 GET /healthz（无鉴权、不触库）；Node 24 自带全局 fetch。
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# 迁移在容器内执行：node dist/migrate.js（见 docker-compose.prod.yml 与 docs/deployment.md）。
CMD ["node", "dist/index.js"]
