# Netlify 发布记录

> 日常认证、关联、构建产物部署、验收与回滚使用 [Netlify 操作手册](netlify-operations.md)。后续优先 CLI/API。下文保留首次发布过程与后续发布历史，旧步骤不作为新会话的建站指令。

目标：用户指定 `*.netlify.app`。部署当前免费本机存档 Web/PWA，不需要 API、数据库、账号或 CDN 环境变量。

## 可重复构建

- 仓库根目录运行 `npm ci`、`npm run build`，发布目录为 `apps/web/dist`，Node.js 24。
- 根目录 `netlify.toml` 提供构建配置；`apps/web/public/_headers` 随 Vite 构建进入发布目录，因此直接上传发行包也包含缓存规则。
- 首页、SW、注册脚本、manifest 每次重新校验；带哈希的 JS/CSS 长缓存。其余素材使用平台默认重新校验与 SW 内容修订缓存。
- 不添加全站 HTML fallback，缺失的素材应返回 404；当前页面使用根路径。
- 使用已有 CI 验证通过的提交，手动发布完整产物，不把 main 的每次 push 都连接为生产部署。

## 发布与验收

1. 用户登录 Netlify，确认自己可用的团队/项目；不创建付费订阅或扩大 GitHub 仓库权限。
2. 新建或关联本游戏专用站点，优先尝试 `bravecat`，名称不可用时使用明确属于本项目的唯一名称。发布后固定主域名，避免本机存档因 origin 改变而看似丢失。
3. 上传完整 `dist`；记录 site ID、deploy ID、生产 URL、源码 commit 和发行包 SHA-256，不能只上传 index.html。
4. 实际 HTTPS 地址核验首页、SW、manifest、JS/CSS 和 98 个地标/故事/家素材的状态码、MIME、内容指纹与缓存头。验证不存在的素材返回 404。
5. 浏览器验收首次加载、领养、刷新保留存档；SW 安装后离线重开。iOS/Android 安装和系统分享仍需实际设备记录。
6. Netlify 保留旧部署用于回滚；不能回滚到不支持 v5 存档的旧应用。

## 2026-09-29 首发状态（历史快照）

2026-09-29 已公开发布：[bravecat.netlify.app](https://bravecat.netlify.app/)。仅静态免费本机存档版本，无账号服务；未创建付费订阅或连接 GitHub 自动部署。

- Site ID：`2a965a34-74ab-457c-89f6-de16a1286d87`。
- 当前生产部署：[6abb80acb64cd80d2acb4098](https://app.netlify.com/projects/bravecat/deploys/6abb80acb64cd80d2acb4098)，控制台确认 Public / published、148 文件、8 条响应头规则全部处理成功。
- 部署代码：`ce600e654045f2e6441e2814de15a046b3550790`。`npm run build`、[CI](https://github.com/CCharlesMeng/BraveCat/actions/runs/36547118719)、[E2E](https://github.com/CCharlesMeng/BraveCat/actions/runs/36547118720) 成功，包含正式构建离线故事测试。CI 不代替公网测试。
- 上传包：`.asset-publish/web-pwa-rc-ce600e654045/netlify-upload.zip`，43,076,032 bytes，SHA-256 `bfe531548d95dfcf60ab23770a639c6cc32ead853b3292547a9f009176dbc996`。
- 对应 tar.gz SHA-256：`4b69538383e373f154c2f6534d5c85848245334791a89f30a52bef1059371fc9`；逐文件 manifest 与 ZIP 同目录归档。
- 上一部署 `6abb7e83e833b356f0ac065a` 保留在 Netlify，代码 `bba26ffa1f7efb84218ef04b6c02bc00e4cce274`。两包仅 `_headers` 不同，新版明确 manifest MIME 为 `application/manifest+json`；业务代码、SW 和素材字节均相同。

### 公网证据与限制

- 首次部署时 HTTPS 首页返回 200；领养 Minho、五张首页图片正常加载、刷新后保留名字与 12 条小鱼干均通过。相册与备份入口可见；导出出现成功提示，但自动下载监听超时，未取得下载文件验证，不能计为完整备份验收。
- 首次部署成功获取 67/147 个公开文件，逐文件指纹匹配；首页仅在移除已识别的 Netlify 托管注释与平台徽章脚本后匹配。原始结果见 [HTTP 部分验收](../audits/netlify-first-deploy-http-2026-09-29.json)。站点显示 Powered by Netlify 标识。
- 原 manifest 为 `application/octet-stream`，已补配置并重新发布。新版部署专属链接的 **147/147 公开文件**已成功获取并校验指纹，首页仅扣除平台标识注入差异；全部 WebP MIME 正确，SW/注册脚本为 JavaScript，manifest 为 `application/manifest+json; charset=utf-8`，缺失素材返回 404。缓存头符合配置。详见 [新版 HTTP 验收](../audits/netlify-production-http-2026-09-29.json)。
- 校验期间发生间歇性 TLS 连接失败，重试后完成部署专属链接全量校验；主域名 manifest 后续复查也返回 200 和正确 MIME。浏览器一度出现连接关闭错误；该网络波动不能解释为持续健康，也不能据此断言故障原因。未绕过 TLS。
- 公网离线重开、完整旅行与备份文件往返、移动真机安装/系统分享仍待验证；本地与 CI 已通过的离线测试不替代这些项目。
- 首次公网首页截图：`.asset-publish/web-pwa-rc-bba26ffa1f7e/netlify-live-home.png`。发布已完成，全面公网验收尚未完成。

归档索引、原始产物清单与公网截图见 [2026-09-29 部署归档](archive/2026-09-29-netlify/README.md)。

截图复审发现猫悬空、图文矛盾及首屏构图等可见问题，见 [视觉问题记录](../audits/web-pwa-visible-issues-2026-09-29.md)。该截图不构成视觉验收通过证明；按用户要求仅记录，未修复。

### 后续发布

固定使用该生产域名；在通过 CI 的提交上构建、打包，上传现有 bravecat 项目，记录新的 deploy ID 与包指纹。每次发布后复核上述 HTTP 与实际浏览器行为。文档归档提交不触发生产更新。

官方配置依据：[配置文件](https://docs.netlify.com/build/configure-builds/file-based-configuration/)、[自定义响应头](https://docs.netlify.com/manage/routing/headers/)。

## 2026-09-30 视觉修复发布（历史快照）

本轮生产部署更新为 [6abc76805fd66da6add32d1b](https://app.netlify.com/projects/bravecat/deploys/6abc76805fd66da6add32d1b)，源码 `e7d998526650e07a59cdcdeefcc02d3c26473e61`，CI/E2E 成功后手动上传完整 ZIP。旧部署与上述首次发布记录保留，域名和 v5 本机存档不变。已通过 Netlify 项目设置关闭平台徽章。

[本轮归档](archive/2026-09-30-visual-fixes/README.md) 记录完整包指纹、147/147 文件校验、响应头、主域名及公网桌面/手机视口截图；[逐项修复报告](../audits/web-pwa-visual-fixes-2026-09-30.md) 对应 V01–V07。旧 PWA 可能先显示旧缓存，后台更新后再次刷新进入新版；无需清理存档。


## 2026-09-30 首页用品融合发布（历史快照）

当前生产为 [6abc7fc1e0ceac2b05b68b7b](https://app.netlify.com/projects/bravecat/deploys/6abc7fc1e0ceac2b05b68b7b)，源码 `ba2e6f2801fadfc0a0d276bee522558b1f5620a9`。CI/E2E 成功后通过 Netlify CLI 上传完整冻结产物，原站点、旧部署与批准素材保留。

I01–I04 的修复、截图与验证见 [修复报告](../audits/home-item-visual-integration-2026-09-30.md) 和 [本轮发布归档](archive/2026-09-30-item-integration/README.md)。同一隔离公网浏览器的旧 PWA 升级保留余额和待收鱼干，收取后余额从 12 增至 29。


## 2026-09-30 常驻双碗与进食位置修复（历史快照）

当前生产为 [6abc87e8d450ba6a139af601](https://app.netlify.com/projects/bravecat/deploys/6abc87e8d450ba6a139af601)，源码 `95451685ddbf3e72d1bb76588c00c9b6339d316f`。CI/E2E 成功后通过 Netlify CLI 上传完整冻结发行包，原站点、旧部署、已批准母版及此前归档均保留。

三个主题常驻饭碗与水碗，并调整进食位置、朝向及动画内置碗的合成。详见 [修复报告](../audits/home-feeding-place-2026-09-30.md) 和 [发布归档](archive/2026-09-30-feeding-place/README.md)。公网 150/150 文件校验与旧 PWA 存档升级验证通过；真机安装和系统分享未在本轮验证。


## 2026-09-30 用品与地毯摆放调整（当前生产）

当前生产为 [6abc8a3fe81507debcb94a93](https://app.netlify.com/projects/bravecat/deploys/6abc8a3fe81507debcb94a93)，源码 `d5749a6d6c91ddf778dbd4d550d9929f9d9b99c6`。CI/E2E 成功后通过 Netlify CLI 发布完整冻结产物。猫窝与毯边分开，隧道缩小并偏置，同步猫姿势与遮挡；常驻双碗保留。素材字节不变，旧部署、母版及归档保留。

[本轮归档](archive/2026-09-30-home-layout/README.md) 包含 A/B/F 前后比较、四活动与动画采样、包指纹、主域名截图及旧存档升级证据。设备截图为浏览器模拟。
