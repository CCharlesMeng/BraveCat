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

## 项目约定

- 产品需求以 [GitHub issue #1](https://github.com/CCharlesMeng/BraveCat/issues/1) 为准。
- 领域语言见 [`CONTEXT.md`](./CONTEXT.md)。
- 架构决策见 [`docs/adr/`](./docs/adr/)。
- 画风方向稿见 [`docs/art/`](./docs/art/)。

当前脚手架使用 Vite、Svelte 5、TypeScript、Dexie、Vitest 与 `vite-plugin-pwa`，部署目标为 Netlify。
