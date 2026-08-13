# Home Theme A / B / F 视觉方向批准归档

日期：2026-08-13  
审批：`visual-direction-approved`  
运行时资格：`false`

本目录保存用户已批准的 A / B / F Home Theme 视觉方向。批准范围是色板、
物件造型、整体空间意图和拆分审阅方向；不等于批准 production alpha、
运行时坐标或 shipping 资产。

## 归档范围

- `concepts/`：A / B / F 三张完整概念图。
- `review-boards/`：A / B / F 三张当前 `1920 × 1080` Home Part 审阅板。
- `ui/`：会话候选中实际存在的 Home Theme UI directions 图。

共归档 7 张 PNG。所有图片保留 Cursor 会话候选的原始文件名和原始字节；
`manifest.json` 记录稳定 ID、尺寸、alpha、SHA-256、审批级别与阻断项。

## 仍然有效的技术阻断项

1. 完整概念图烘焙了 exterior、HomeFinish、家具和动态陈列，不能直接分层。
2. 审阅板带纸面背景与组合排版，不是可切割的 production alpha。
3. A / B 缺独立高分辨率 16:9 HomeForm 控制图；F 仍需统一最终 16:9
   几何标注。
4. 窗洞、平台/台阶、support surface、socket、slot quad、热区、排除区、
   锚点、z-band 与 foreground occlusion 均未冻结或未生产。
5. UI directions 只批准界面视觉方向，不授权 UI 实现，也不是运行时素材。

因此，本目录不得被描述为 production-ready、runtime eligible 或
shipping eligible，也不得复制到 `public/`。
