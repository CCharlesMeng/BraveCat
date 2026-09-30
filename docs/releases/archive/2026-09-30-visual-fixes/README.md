# 2026-09-30 首页视觉修复证据

对应 [修复报告](../../../audits/web-pwa-visual-fixes-2026-09-30.md)。旧归档保持原样。

- `before-desktop.png` / `before-measurements.json`：修改前 11add4b 的本地生产构建隔离复现，1280×720；不含托管平台徽章。
- `home-visual-{theme}-{width}.png`：修复后生产构建，A/B/F，桌面 1280×720 与手机模拟 390×844；固定 gaze，使用 prefers-reduced-motion poster。独立存档，没有清除公网用户数据。
- `other-activities.png`：九张生产截图合页；列 A/B/F，行 sleep/play/eat。未修改这些活动的坐标或资产。
- `gaze-animation-bounds.json`：正式 WebP 的 64 帧 alpha>32 脚底范围，全部 y490/512。
- `netlify-badge-disabled.png`：现有项目徽章关闭后的管理界面证据。

本目录初次提交记录本地验证；生产代码 SHA、CI、部署 ID、完整包指纹与公网验证在发布后补充。保存原 manifest 的候选状态，不回写旧产物。
