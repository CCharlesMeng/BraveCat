# 2026-09-30 首页用品融合证据

对应 [修复报告](../../../audits/home-item-visual-integration-2026-09-30.md)。旧 `2026-09-30-visual-fixes` 与所有批准母版原样保留。

- `before-desktop.png`：main `c4ced87` 的本地生产构建，隔离存档复现 A + gaze + 17，1280×720。
- `after-desktop.png` / `after-mobile.png`：最终实现的 A + gaze + 17，1280×720 / 390×844。I01–I04 的 `before` / `after` 是对应桌面原图的原尺寸局部裁切，无重绘。
- `background-only.png` / `items-only.png` / `composite.png`：临时隐藏对应图层后的隔离观察和实际合成。隐藏只发生于 QA 浏览器，不进入实现。
- `{theme}-{activity}.png`：A/B/F × sleep/play/eat/gaze，reduced-motion poster，正午。`activities-overview.png` 列 A/B/F，行 gaze/sleep/play/eat。
- `{theme}-{activity}-animated.png`：相同组合使用默认动画；截图仅是采样画面，不代表逐帧验收。
- `{theme}-{morning,dusk,late-night}-animated.png`：默认 gaze 动画的其他时段；脚本核验实际 `data-home-time`。时间前进会自然将待收量累积到 24。`lighting-overview.png` 为三时段合页。
- `treat-focus-{1280,390,320}.png` / `treat-collected-{1280,390,320}.png`：焦点和收取后的 0 条状态、余额 29。
- `short-mobile-scrolled.png`：320×568 下滚动到导航，浏览器模拟。
- `capture.json`：隔离截图 URL、实际主题活动时段和设备模拟声明。

本地最终检查：生产 E2E 11/11；主题测试 28/28；类型检查、生产构建和批准素材/预缓存门禁均通过。没有新位图素材，运行时 29 个家资产哈希未变。CI 与公网结果单列如下，不以本地通过代替。

## 已发布

- 原站点 https://bravecat.netlify.app/，site ID `2a965a34-74ab-457c-89f6-de16a1286d87`。
- 生产代码 `ba2e6f2801fadfc0a0d276bee522558b1f5620a9`，已 push main。
- [CI 36663665390](https://github.com/CCharlesMeng/BraveCat/actions/runs/36663665390) 与 [E2E 36663665410](https://github.com/CCharlesMeng/BraveCat/actions/runs/36663665410) 均 completed/success 后发布。
- CLI 部署 [6abc7fc1e0ceac2b05b68b7b](https://app.netlify.com/projects/bravecat/deploys/6abc7fc1e0ceac2b05b68b7b)，API 再次确认生产引用及 ready 状态。
- 完整 tar.gz SHA-256：`53abfcb4611b1f7096a5e21a17eaa9cbaaca87f7e864e1107fbf1493aa8954a8`。完整包、CLI 回执和实际上传目录保留在 `.asset-publish/web-pwa-rc-ba2e6f2801fa/`；上传目录 `deploy-dist-native` 的 148 个文件逐一匹配 manifest，包括 `_headers`。manifest 保留打包时的原始 candidate 字段，当前发布状态以本记录为准。
- macOS 原生 tar 正确处理归档的 AppleDouble 元数据；Python 直接解包会额外产生 `._*` 文件，因此未使用该临时目录上传。
- 首次 CLI 参数校验拒绝 `--context` + `--no-build`，查询确认未新建部署后，移除 `--context` 重试成功；操作手册已修正。使用 `--prod --no-build` 直接上传冻结目录，没有重新构建或创建站点。
- 前部署 `6abc76805fd66da6add32d1b` 和更早部署保留；未改域名、免费计划、自动部署设置或 v5 存档。

## 公网证据

- `live-before-desktop.png` / `live-before-mobile.png` 与 `live-desktop.png` / `live-mobile.png`：同一个隔离 Chromium、A + gaze，真实主域名默认动画。新旧版本之间未清除存档或 SW。
- `public-upgrade.json`：后台更新和刷新后，CSS 从 `index-B-hl1S2e.css` 进入 `index-C4b-l0yb.css`；余额 12、待收 17 均保留，点击后余额 29、待收入口隐藏；全部房间图片加载，无横向溢出或平台 iframe。
- `live-short-scrolled.png`：320×568 滚动后信息卡和导航可达。
- `production-http.json`：部署专属地址 147/147 公开文件指纹匹配；index 仅扣除已识别的 Netlify 托管注释。WebP/JS/CSS/manifest MIME、哈希资源 immutable、HTML/SW/manifest 重新校验均通过；缺失素材 404。
- `main-domain-check.json`：主域名 index、manifest、SW 指纹匹配新包，MIME/重新校验规则通过；不存在素材返回 404。

手机仍是浏览器模拟；真机安装/分享、完整公网离线与备份往返未新增验收结论。旧归档保留，不将这些待验项记作通过。
