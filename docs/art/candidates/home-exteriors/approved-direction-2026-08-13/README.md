# Home Exterior 视觉方向批准归档

日期：2026-08-13  
审批：`visual-direction-approved`  
运行时资格：`false`

本目录保存用户已批准的 Home Exterior **视觉方向**。这不是 production
晋升，也不授权把任何文件复制到 `public/`、用于 shipping，或在运行时
manifest 中引用。

## 归档范围

- `masters/`：README 当前列出的 10 个活动母版；江湾与海湾使用 v02。
- `valley-variants/`：山谷草地已有的 3 张时间与 4 张天气 v02。
- `atmosphere/riverbend/`：江湾本轮 7 张气氛候选。
- `atmosphere/quiet-sea-bay/`：海湾本轮 7 张气氛候选。
- `validation/metropolitan/`：大都会夜景与雨景 2 张验证图。

共归档 33 张 PNG。所有图片保留 Cursor 会话候选的原始文件名和原始字节；
`manifest.json` 记录稳定 ID、尺寸、alpha、SHA-256、审批级别与阻断项。

## 仍然有效的技术阻断项

1. 所有归档 Exterior 都是 2:3，不符合正式 `1200 × 1600`（3:4）合同；
   山谷母版另为较低分辨率 `546 × 819`。
2. 时间与天气派生采用生成式 reference conditioning，已有纹理、枝叶、
   建筑窗格、岩石和水纹重采样证据，尚未通过像素注册或交叉淡入门。
3. A/B/F 真实窗洞 mask 与窗洞合成 QA 缺失，不能证明安全裁切。
4. production RGBA surface mask、确定性调色/气氛/场景响应流程及阈值报告
   尚未完成。
5. 海湾 `morning-fog v01` 与大都会 `light-rain v01` 仍建议重做；江湾
   `first-snow v01` 仍建议减雪。保留它们只表示保存已审阅方向与证据。

因此，本目录不得被描述为 production-ready、runtime eligible 或
shipping eligible。
