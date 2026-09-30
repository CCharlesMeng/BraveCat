# 2026-09-30 用品与地毯摆放调整

用户复审认为猫抓板、玩具与地毯组合不自然。当前正式场景对应的是猫窝、软隧道与固定底图地毯，尚未注册 scratch 用品；本次调整已有物件构图，不新增猫抓板。

## 观察与调整

- A/B 猫窝与毯边过近，边缘形成切线；三套隧道占据地毯中心，缺少连续空位。
- A 猫窝向左 25、向后 45 个画布单位，B 向左 15、向后 35；F 维持上层平台猫窝。
- A/B 隧道缩为原尺寸 90%，F 为 85%，同时向地毯右侧偏置。左侧留下连续活动空间，隧道仍完整落在主毯带。
- base / occlusion 同框移动缩放，supportSurface / interactionRegion / catAnchor 同步变换；猫的 play 框按相同比例缩放，sleep 跟随猫窝锚点。feed 位置、双碗、窗台、背景和批准素材字节不变。
- 沿用 ADR-0010 / ADR-0011 的 rest/play 分区及现有适配结构，仅调整正式摆放数据，没有自由摆放、存档字段或架构变更。历史 geometry v02 和旧截图保留。

## 证据

- `floor-before-after.png`：左旧右新，从上到下 A/B/F；从真实浏览器截图裁出地板部分做比较。
- `{theme}-{activity}.png` / `-animated.png`：三主题四活动，reduced-motion poster 与默认动画。
- `{theme}-play-frame-samples.png`：真实 play 第 0/8/16/24/32/40/48/56 帧浏览器合成；8帧采样不等于完整64帧验收。
- `after-desktop.png` / `after-mobile.png`：1280×720 / 390×844；各时段及隔离层截图一并保留。
- 本地主题测试 29/29、check（Svelte 0 errors / 0 warnings）、完整生产构建、既有生产 E2E 11/11 通过。设备截图均为浏览器模拟。

发布与公网证据待部署后追加；本地验证不代替公网及真机验收。
