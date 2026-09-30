# 2026-09-30 常驻饭碗与水碗

对应 [修复报告](../../../audits/home-feeding-place-2026-09-30.md)。此前所有发布归档和批准母版保留。

- `before-{theme}-eat.png`：复制上一轮 `2026-09-30-item-integration` 的原截图作为比较，不修改旧文件。
- `{theme}-{gaze,eat,sleep,play}.png` 与对应 `-animated.png`：本地生产构建、独立存档，三主题四活动的 poster / 默认动画。
- `activities-overview.png`：列 A/B/F，行 gaze/eat/sleep/play。
- `{theme}-eat-frame-samples.png`：八张真实 eat 关键帧的浏览器合成，左到右、上到下为帧 0/8/16/24/32/40/48/56；验证素材使用关系，不是重画动画。
- `after-desktop.png` / `after-mobile.png`：A + gaze + 17，1280×720 / 390×844。
- `background-only.png` / `items-only.png` / `composite.png` 与各时段截图：复用隔离合成脚本；QA 隐藏层不进入实现。
- `capture.json`：实际活动时段和设备模拟声明。

本地通过：核心 176/176、主题 29/29、生产 E2E 11/11、类型检查、素材门禁和生产构建（152 条预缓存）。旧 v5 存档默认补齐 feed，双碗不依赖 eat 动画才出现。未引入喂养数值或账号服务。

## 发布与公网验证

- 发布源码：`95451685ddbf3e72d1bb76588c00c9b6339d316f`，仅 main。实现提交 `9ac4511` 的首次 CI 暴露两处旧主题选择器断言（仍期望 feed 为空），更新契约后全套 `npm test` 通过：353 个 workspace 测试与 29 个脚本测试。
- 发布提交 [CI](https://github.com/CCharlesMeng/BraveCat/actions/runs/36666270251) / [E2E](https://github.com/CCharlesMeng/BraveCat/actions/runs/36666270248) 均 success；通过后才执行 Netlify CLI 正式发布。
- 原站点 `2a965a34-74ab-457c-89f6-de16a1286d87`，部署 [6abc87e8d450ba6a139af601](https://app.netlify.com/projects/bravecat/deploys/6abc87e8d450ba6a139af601)，API 确认 published / ready。域名 [bravecat.netlify.app](https://bravecat.netlify.app/) 不变；旧部署 `6abc7fc1e0ceac2b05b68b7b` 等仍 ready、可回滚。
- 完整 tar：`.asset-publish/web-pwa-rc-95451685ddbf/web-pwa.tar.gz`，SHA-256 `32e1f09597e6727daf21e979b6f9f1b454c8735fcdc97f01a2e1f4a1c21de363`。原生 tar 解包后 151 文件逐一核验再上传；原29个家素材字节不变。
- `manifest.json` 为打包时原始清单，保留其 candidate 状态和历史 pending 字段；实际发布状态以本节、CLI 回执及公网验证为准。`netlify-deploy.json` 为 CLI 回执。
- `production-http.json`：部署专属域名 **150/150** 公开文件指纹匹配（`_headers` 为平台配置，非公开文件）。HTML 仅扣除已识别的 Netlify 托管注释。素材 MIME、缓存头和缺失素材 404 均通过；`main-domain-check.json` 确认主域名 HTML/SW/manifest 3/3。
- `public-upgrade.json`：同一独立浏览器从无双碗旧 PWA 更新，保留 12 余额及 17 待收鱼干，更新后出现双碗，收取后 29。图片加载完成，无水平溢出。
- `live-before-*` / `live-desktop.png` / `live-mobile.png` / `live-short-scrolled.png`：真实公网升级前后截图；`live-eat-mobile.png`：独立新存档的真实公网进食画面。

手机为浏览器模拟；本轮不宣称真机安装、系统分享或全部64个动画插值帧验收通过。
