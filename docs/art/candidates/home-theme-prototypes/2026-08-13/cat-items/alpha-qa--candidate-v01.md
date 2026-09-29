# Intrinsic alpha QA · candidate v01

日期：2026-08-13。alpha bbox 格式为
`[left, top, right-exclusive, bottom-exclusive]`。

## 机器实测

| 物件 / 主题 | 尺寸 | hasAlpha | alpha bbox | 半透明像素 | 四角 alpha |
| --- | ---: | :---: | --- | ---: | --- |
| `rest-cloud-bed` / A | 994×640 | true | `[24,24,970,616]` | 8,127 | `[0,0,0,0]` |
| `rest-cloud-bed` / B | 860×486 | true | `[24,24,836,462]` | 6,537 | `[0,0,0,0]` |
| `rest-cloud-bed` / F | 854×524 | true | `[24,24,830,500]` | 6,605 | `[0,0,0,0]` |
| `play-soft-tunnel` / A | 860×504 | true | `[24,24,836,480]` | 6,832 | `[0,0,0,0]` |
| `play-soft-tunnel` / B | 832×482 | true | `[24,24,808,458]` | 6,658 | `[0,0,0,0]` |
| `play-soft-tunnel` / F | 788×435 | true | `[24,24,764,411]` | 6,070 | `[0,0,0,0]` |

完整像素计数和方法见
[`alpha-qa--candidate-v01.json`](alpha-qa--candidate-v01.json)。

## 双背景人工检查

- PASS：六张主稿均为 intrinsic crop，物件完整，四周有 24 px 透明余量。
- PASS：米白纸面矩形与接触影未出现在深灰或棋盘背景。
- PASS：深灰背景未显示明显白边；棋盘背景未显示绿色或洋红色污染边。
- PASS：A/B 猫窝的浅色床垫、F 猫窝的月白床垫和深蓝滚边均保留为实体。
- PASS：A/B/F 隧道入口、侧孔加固圈、悬挂绳球与源图可见内壁均保留；
  checkerboard 没有穿过内壁或内部实体。
- PASS：六张主稿不包含 checkerboard；全透明像素的 RGB 已清零。

## 纠错记录

语义 mask 首轮曾把 F 猫窝浅色床垫和 A 隧道部分内壁误判成背景。最终候选
没有沿用该结果，而是用高置信外轮廓封闭区回填批准源图实体像素，再重新生成
两张 contact sheet 验证。没有使用简单全局白色键控。

## 非本轮验收项

猫窝前沿 occlusion、隧道猫体遮挡、猫 Pose 注册、full-canvas 定位、socket
与共享活动区决策尚未完成；这些 intrinsic 候选不是 runtime-ready 资产。
