# 2026-09-30 首页视觉修复证据

对应 [修复报告](../../../audits/web-pwa-visual-fixes-2026-09-30.md)。旧归档保持原样。

- `before-desktop.png` / `before-measurements.json`：修改前 11add4b 的本地生产构建隔离复现，1280×720；不含托管平台徽章。
- `home-visual-{theme}-{width}.png`：修复后生产构建，A/B/F，桌面 1280×720 与手机模拟 390×844；固定 gaze，使用 prefers-reduced-motion poster。独立存档，没有清除公网用户数据。
- `other-activities.png`：九张生产截图合页；列 A/B/F，行 sleep/play/eat。未修改这些活动的坐标或资产。
- `gaze-animation-bounds.json`：正式 WebP 的 64 帧 alpha>32 脚底范围，全部 y490/512。
- `netlify-badge-disabled.png`：现有项目徽章关闭后的管理界面证据。

本目录初次提交记录本地验证；生产代码 SHA、CI、部署 ID、完整包指纹与公网验证在发布后补充。保存原 manifest 的候选状态，不回写旧产物。

## 已发布

- 生产 URL：https://bravecat.netlify.app/；Site ID 仍为 `2a965a34-74ab-457c-89f6-de16a1286d87`。
- 源码：`e7d998526650e07a59cdcdeefcc02d3c26473e61`，已推送 main。
- [CI 36660663194](https://github.com/CCharlesMeng/BraveCat/actions/runs/36660663194) 与 [E2E 36660663193](https://github.com/CCharlesMeng/BraveCat/actions/runs/36660663193) 均 completed/success 后上传完整 ZIP。
- 新生产部署：[6abc76805fd66da6add32d1b](https://app.netlify.com/projects/bravecat/deploys/6abc76805fd66da6add32d1b)，2026-09-30 10:40 CST。控制台确认 Published、148 文件、8 条响应头规则成功；仅 6 个文件变化，不代表仅上传 6 个文件。
- ZIP：43,076,146 bytes，SHA-256 `07fb4399376991ad1a38a2adba595891f1583c93525a3aaefb1fdf36ecc07ad8`。
- tar.gz SHA-256：`175177843ec7ada4b1e1ea444d51d22bdec80f7924293fc2f522a154a847b29a`。
- 完整包仍在 `.asset-publish/web-pwa-rc-e7d998526650/`；本目录保留 `manifest.json`、`netlify-upload.json`。manifest 的候选状态为打包时原始值。
- 旧部署 `6abb80acb64cd80d2acb4098` 与 `6abb7e83e833b356f0ac065a` 均保留；未变更付费计划、自动发布配置或域名。

## 公网验收

- `production-http.json`：部署专属 URL 147/147 公开文件返回 200 且指纹匹配（`_headers` 是平台配置，不作为公开文件）；index 只剔除已识别的 Netlify 托管注释后匹配，不忽略其他差异。缺失素材返回 404。
- 逐项验证 WebP/JS/manifest MIME；HTML、manifest、SW、注册脚本为 `max-age=0,must-revalidate`；带哈希 JS/CSS 为 immutable。`main-domain-check.json` 另外确认主域名 index、manifest、SW 字节与新版匹配。
- `live-desktop.png`：主域名、1280×720、gaze 动画正常运行，完整卡片底部 y708；全部图片加载，无平台 iframe。
- `live-mobile.png`：主域名、390×844、同一 gaze 状态，完整场景/用品/信息/导航，无横向溢出或平台徽章。
- `live-short-mobile-scrolled.png`：320×568 向下滚动后信息、导航及状态可见。不是物理手机验收。
- 旧 PWA 第一次刷新仍从旧 SW 返回历史首页（包含历史徽章注入）；后台更新完成后再次刷新进入新版 `/assets/index-B-hl1S2e.css`，没有清理 IndexedDB、SW 或用户存档。原 Minho、12 条余额及 17 条待收鱼干保留。

本轮 V01–V07 在记录范围内完成修复与公网检查。真机安装/分享、公网完整离线和备份文件往返仍非本轮验收结论。
