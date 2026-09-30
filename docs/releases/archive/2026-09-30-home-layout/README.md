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

## 发布

- main 发布源码 `d5749a6d6c91ddf778dbd4d550d9929f9d9b99c6`；[CI](https://github.com/CCharlesMeng/BraveCat/actions/runs/36666992601) 与 [E2E](https://github.com/CCharlesMeng/BraveCat/actions/runs/36666992623) 均 completed/success 后发布。
- Netlify CLI 部署 [6abc8a3fe81507debcb94a93](https://app.netlify.com/projects/bravecat/deploys/6abc8a3fe81507debcb94a93)，原站点 `2a965a34-74ab-457c-89f6-de16a1286d87`；API 确认 published / ready。旧部署 `6abc87e8d450ba6a139af601` 和此前版本仍 ready，均保留。
- 完整包 `.asset-publish/web-pwa-rc-d5749a6d6c91/web-pwa.tar.gz`，SHA-256 `75553706997f7e3952a097f1df0a055e29003297e4a67a6a585b183a0526b40d`。原生 tar 解包后 151 文件集合、大小和指纹核验；家素材与上版全部相同。
- `manifest.json` 保留打包时原始 candidate/pending 字段，实际发布状态以本节和 `netlify-deploy.json` 回执为准。
- `public-upgrade.json`：同一独立公网浏览器升级，A 隧道位置从 left 40% / width 35% 更新为 left 50.8333% / width 31.5%，旧存档与双碗保留；12 余额 + 17 待收鱼干 = 29，图片全部加载且无水平溢出。
- `live-before-*` 与 `live-{desktop,mobile,short-scrolled}.png` 为公网更新前后图。`main-domain-check.json`：主域名 HTML / SW / manifest 3/3 指纹与响应头通过。

- `production-http.json`：部署专属域名 150/150 公开文件指纹通过；HTML 仅扣除已识别的 Netlify 托管注释，MIME/缓存头与缺失素材 404 均通过。`_headers` 为平台配置，未作为公开文件请求。

真机安装、系统分享未在本轮验证。
