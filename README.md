# 咪游记

一个移动优先、本地优先的轻陪伴 PWA：玩家为小猫准备行囊，小猫自主旅行，并从真实世界地标寄回明信片。

## 本地开发

要求 Node.js 20.19+ 或 22.12+。

```sh
npm install
npm run dev
```

质量检查：

```sh
npm run check
npm test
npm run build
```

E2E 冒烟测试（Playwright，首次先 `npx playwright install chromium`；
会自动拉起 vite dev server，用例见 `apps/web/e2e/`）：

```sh
npm run test:e2e
```

素材流水线：

```sh
npm run assets:check-landmark-candidates
npm run assets:check
npm run assets:composite-check
npm run assets:check-landmarks
```

地标 WebP 只在开发环境中用于合成验收；权利决定和明确的 shipping approval
全部通过前，生产构建会自动排除 `dist/scenes`。

## 资源发布（OSS + CDN）

```sh
npm run assets:publish              # 无凭证默认 dry-run：门禁 + 清单 + 上传计划
npm run assets:publish -- --upload  # 真正上传（环境变量见 .env.example）
```

发布脚本 `scripts/publish-assets-oss.mjs` 走阿里云 OSS 的 S3 兼容
API（`@aws-sdk/client-s3`），换云只是配置级变更。上传前必须通过与
生产构建同一套版权门禁：地标 shipping gate（`shippingEligible` +
rights decision SHA-256 指纹）、形象与家居资产逐文件哈希比对、
`scripts/check-home-display-assets.mjs` 深度检查；不合格资产直接拒绝
上传并列出原因。远程清单带内容哈希，写到 `manifests/assets.<hash>.json`。

web 端通过 `VITE_ASSET_BASE_URL` 把 CDN base 注入 `AssetResolver`
（注入点 `apps/web/src/lib/platform/assetBase.ts`）；留空时保持
相对根路径加载，行为与 CDN 引入前完全一致。

## 项目约定

- 产品需求以 [GitHub issue #1](https://github.com/CCharlesMeng/BraveCat/issues/1) 为准。
- 领域语言见 [`CONTEXT.md`](./CONTEXT.md)。
- 架构决策见 [`docs/adr/`](./docs/adr/)。
- 画风方向稿见 [`docs/art/`](./docs/art/)。

当前脚手架使用 Vite、Svelte 5、TypeScript、Dexie、Vitest 与 `vite-plugin-pwa`，部署目标为 Netlify。
