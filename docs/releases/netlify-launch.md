# Netlify 公网首发

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

## 当前状态

部署配置已准备；尚未创建或发布公网站点，等待 Netlify 账号登录。此文件不构成公网验收证明。

官方配置依据：[配置文件](https://docs.netlify.com/build/configure-builds/file-based-configuration/)、[自定义响应头](https://docs.netlify.com/manage/routing/headers/)。
