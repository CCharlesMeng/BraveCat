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

本地最终检查：生产 E2E 11/11；主题测试 28/28；类型检查、生产构建和批准素材/预缓存门禁均通过。没有新位图素材，运行时 29 个家资产哈希未变。公网发布记录在部署后补充；本段不以本地通过替代 CI 或公网证据。
