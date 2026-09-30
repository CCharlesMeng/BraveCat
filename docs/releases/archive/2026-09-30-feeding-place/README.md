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

发布证据在部署后补充；本地结果不代替 CI、公网或真机验收。
