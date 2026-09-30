# 首页用品与小鱼干视觉融合交接

2026-09-30。用户要求将本次图片复审的问题交给新会话解决。本轮仅写交接，不修改实现、素材或重新部署。

## 开始执行

1. 在 `/Users/moon/Documents/Code/BraveCat` 检查 Git 状态；只在 main 推进，保留用户修改、旧归档与批准素材母版，按具体路径提交。
2. 阅读 `AGENTS.md`、`CONTEXT.md` 与 `docs/adr/0010-home-themes-fix-furniture-cat-items-vary.md`、`docs/adr/0011-cat-item-slots-occupy-disjoint-frozen-zones.md`。
3. **实际打开** [公网桌面截图](../releases/archive/2026-09-30-visual-fixes/live-desktop.png)，再看同目录 `live-mobile.png` 和 `other-activities.png`。以图片和实时复现为依据，不把以下观感直接当成已证实的代码根因。
4. 阅读 [上一轮修复报告](../audits/web-pwa-visual-fixes-2026-09-30.md) 与 [发布归档](../releases/archive/2026-09-30-visual-fixes/README.md)，保留已完成的猫落点、完整场景、信息卡与响应式修复。

## 基线与证据边界

- 主证据：用户贴出的 `live-desktop.png`，1280×720，A 主题 `a-clear-sage`，Minho 处于 gaze；顶栏余额 12，窗台待收小鱼干 17。
- 图中左下是 `rest-cloud-bed` 猫窝，中间是 `play-soft-tunnel` 隧道，下面是编织地毯。用户口头称“猫抓板、玩具、小鱼干”；截图与当前用品注册表不能支持将其中一件认定为猫抓板。此次不因此新增猫抓板功能。
- 上轮 V01–V07 已完成有限范围修复，但不等于用品画风与融合全面验收通过。本交接是进一步的美术融合复审，使用独立编号 I01–I04。
- 本轮 main 起点 `59d38083e324c47060e3aedba0488848d79139c7`，检查时工作区干净；本文件将另作提交。生产代码 `e7d998526650e07a59cdcdeefcc02d3c26473e61`，deploy `6abc76805fd66da6add32d1b`，域名 https://bravecat.netlify.app/。新会话需重新核验，文档提交不代表重新部署。

## 待解决问题

| ID / 顺序 | 截图观察 | 影响与边界 | 目标 |
| --- | --- | --- | --- |
| I01 / 优先 | 窗台小鱼干有明显白色圆底，悬在猫身前，跨过窗台边缘并遮住尾部与落脚处；数字 +17 贴在圆片下侧。 | 首先被读成浮动按钮，无法自然读成窗台上的物件，并削弱猫已坐稳的视觉证据。尚未确认白底来自 CSS、素材本身还是多层叠加。 | 鱼干与数量入口清楚可发现，同时不遮猫的支撑关系；物件贴合窗台，交互提示与场景内容各自清楚。 |
| I02 / 其次 | 左下猫窝轮廓完整、边缘干净，内部渐变较光滑，底部接触阴影弱。 | 相比墙面、柜子、地板的纸纹、颗粒和晕染，更像单独渲染的产品图，重量感不足。“像贴图”是观感，不能断言实际制作方式。 | 匹配背景笔触、纹理尺度、边缘软硬与光照；底部自然落地，保持猫窝可识别及睡姿/遮挡配合。 |
| I03 / 其次 | 隧道圆口、包边、侧孔规整，材质均匀；底部有暗边，但与地毯的接触压暗不够自然。 | 几何与渲染感强于背景，像缩小后叠入的模型。仅凭截图不能认定透视错误，也不意味着“加一圈阴影”就能解决。 | 统一材质与笔触，按实际承托面处理接触阴影，保持开口、玩耍姿势和前景遮挡一致。 |
| I04 / 较低 | 顶栏余额旁的鱼干图案小，细节挤在一起。 | 属于 UI 图标辨识问题；余额 12 可读，没有依据称功能故障。 | 在真实显示尺寸下更易识别；保留 UI 图标角色，不要求它伪装成房间内物件。 |

总体判断：颜色已接近，但单靠统一鼠尾草色不能消除拼贴感。重点是笔触、接触关系和小鱼干的场景/操作表达。背景及地毯相对协调，当前没有一起重画的依据。

上述目标和顺序来自本会话的评审建议，不是已冻结的新视觉方案。用户已授权新会话解决这些问题；普通实现选择自主推进，不重复产品 grill 或既有素材审批。若确实涉及新的产品承诺或架构变化，再明确说明决策点。

## 定位入口

- `apps/web/src/App.svelte`：窗台 button、`treat-pile`、`collect-label`、数量和 aria-label；顶栏余额图标及场景组合。
- `apps/web/src/app.css`：`.windowsill`、`.treat-pile`、`.treat-pile > strong`、`.collect-label` 和时段样式。逐层确认白底、阴影、点击区域与 z-index 来源。
- `apps/web/src/lib/homeArt.ts`：`drawerArt.treat` / `treatLarge`；正式素材位于 `apps/web/public/assets/treat/`。
- `packages/core/src/homeTheme/themes/{a-clear-sage,b-warm-walnut-gallery,f-moonwhite-bluegray}.ts`：各主题 `treatPlacement`、猫位置。
- `packages/core/src/homeTheme/catItems/index.ts`、`resolveHomeScene.ts`：用品 placement、supportSurface、catAnchor、interactionRegion 与 foregroundOcclusion。
- `apps/web/public/home-release/`：运行时主题底图、猫窝/隧道 base 与 occlusion。与批准来源及 `scripts/promote-home-release.mjs` 的生产素材门禁一同检查；使用 `rg` 确认实际映射。
- `docs/art/reviews/all-existing-assets-approval-2026-09-29.json`：既有素材审批依据；批准母版原样保留，必要派生另存并更新来源/哈希记录。新生成内容不继承旧字节的审批结论。

优先复用批准素材并检查能否通过合成、样式和派生处理改善；若确需生成或编辑位图，使用当时可用的相关图像技能，先明确目标和参照，保留来源。不要用统一降透明度、大面积模糊或泛化阴影掩盖问题。

## 复现与验收

1. 用独立本地存档复现 **A + gaze + 17 条待收鱼干**。上轮新生产几何测试的窗台为空，不能用它代替这次遮挡复现；生产不接受开发用 homeActivity URL 覆盖。
2. 分离观察：背景单独、用品/鱼干单独、实际合成。测量可见像素、接触面、光照、纹理尺度和遮挡，区分资产问题与 CSS/坐标问题后实施。
3. 先修 I01，再处理 I02/I03，最后 I04；为每项保存独立前后截图，说明实际改变与未解决之处。场景融合必须肉眼复审，不以资源正常加载或 CI 绿灯替代。
4. 至少覆盖 1280×720、390×844，必要时用 320×568 验证滚动与点击可达。鱼干覆盖 0、少量和 17/上限附近数量；验证可收取、余额增加、数量消失以及键盘焦点/可访问名称仍有效，不为改善外观缩小必要点击区域。
5. 检查 A/B/F、gaze/sleep/play/eat、默认动画和 reduced-motion poster，以及相关时段。改用品资产时同步检查 base/occlusion 与猫姿势，不只修改静态展示图。
6. 保留已修复的完整场景、猫与窗台承托、信息卡位置、导航和无横向溢出。运行与改动相称的定向测试、类型检查、生产构建和素材门禁；复用生产 E2E，不无差别增加镜像测试。
7. 在 main 提交/push 并核验对应 CI。若发布，固定原站点、保留旧部署，记录代码 SHA、deploy ID、完整产物指纹及公网前后截图；设备模拟不记为真机验收。

## Netlify：后续优先 CLI

用户明确要求“不要每次都操作页面”。本会话已安装 `netlify-cli/27.10.2`，完成用户授权，并将 **`apps/web`** 关联到原站点 `2a965a34-74ab-457c-89f6-de16a1286d87`。认证和关联已通过 `netlify status` 验证，MCP 未配置。

- 新会话先在 `apps/web` 工作目录运行 `netlify status`，确认关联及认证。根目录直接 status 会报告未关联；status 不支持 `--filter`，link 支持 `--filter @bravecat/web`。
- `.netlify` 关联文件已被 Git 忽略，凭据仅存本机。不要输出 token 或提交凭据；授权过期才重新引导登录。
- 发布与状态查询使用 CLI/API。部署前读当前 `netlify deploy --help`，确认 monorepo 的工作目录、仓库 `netlify.toml` 与完整构建产物路径，使用已验证产物更新现有站点，避免误建新站或重复构建不匹配版本。
- 浏览器保留用于真实视觉验收，CLI 部署成功不等于视觉通过。平台徽章已通过官方开关关闭。
- 旧 PWA 可能先显示旧缓存，后台更新后再次刷新才能看到新包；验证实际 CSS/JS 指纹，不清理公网用户存档来强行刷新。

首发仍为免费免注册、本机 v5 存档及导入导出，保持故事、迁移和离线能力。完整发布事实与真机/公网离线等未验边界继续以发布归档为准。
