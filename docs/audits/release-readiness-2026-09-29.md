# BraveCat 本地代码与发布准备审计

日期：2026-09-29。范围：当前工作区、全部本地分支/工作树、最新 origin/main、GitHub Issues/PR/Actions 和仓库计划文档。已执行 git fetch origin。本次只审计与生成报告，没有修改业务代码、提交、合并、推送或发布。

## 结论

项目处于“已有可试玩核心和多端工程基础，但功能分支尚未收敛、商业化适配和正式素材未放行”的阶段。不能从代码量或历史 CI 推导正式发布完成率。

旧 PRD #1 以本地优先 PWA 为目标，当前代码已扩展为 Web + Capacitor iOS/Android + Taro 小程序 + API + 可选账号/云同步 + AI 形象生成。必须先明确本次发布是基础 PWA 还是四端商业版；后者的缺口明显更多。

## Git 状态

| 项目 | 当前结果 |
|---|---|
| 当前分支 | feat/v3-landmark-review，HEAD 8ce4b2c |
| 远端主干 | origin/main = 2777788 |
| 本地 main | 8b2d00e，落后 origin/main 8 个提交 |
| 分叉 | origin/main 独有 6 个提交，当前分支独有 77 个提交（包含 merge） |
| 当前分支推送状态 | HEAD 与 origin/feat/v3-landmark-review 一致；未提交内容未在远端 |
| 已提交树差异 | origin/main → HEAD：1165 文件，+131275 / -7491 行，含迁移、美术清单与资产 |
| 当前未提交 | 49 个已跟踪文件修改，205 个未跟踪文件；暂存区为空（生成本报告前） |
| 已跟踪未提交 diff | +3499 / -300 行，不含未跟踪文件内容 |

77 个提交不是 77 个未完成功能。主干独有提交含 #21 纪念品闭环与相关 merge；当前分支又有自己的 aa5035b 旅行结算实现，不能把提交未包含直接等同于能力缺失。合并时要以加速返程、幂等发奖、行囊返还和下一轮旅行行为核对，不能盲目整块覆盖。

其他分支：#17 开发小鱼干、#18 购买后装包确认、#9 纪念品相关分支均已被 origin/main 包含。docs/minho-approval-provenance 的 PR #16 仍 OPEN，当前分支已有同主题 c3156e5 提交，需核对差异后处理 PR，不能默认它仍是一项产品开发任务。当前大分支未查到对应 OPEN PR。

## 已提交分支相比主干增加的内容

| 工作线 | 当前分支中的变化 |
|---|---|
| 工程结构 | 从根 src 单体迁为 apps/web、packages/core、packages/contracts、services/api 和其他端工作区；npm workspaces |
| 游戏编排 | GameController/平台端口抽取；独立旅行结算收敛、开发态美术目录 |
| 家的表现 | HomeForm/主题/表面/部件/陈列解析，Theme Lab、装修界面、A/B/F 房间候选及 furnished base plate 迭代 |
| 旅行美术 | v3 地标集接入、明信片 recipe 冻结、候选/审核/生产门禁与归档 |
| 云服务 | Fastify + Postgres、contracts、游客账号、存档同步、生成次数账本、形象任务管线和 fake 演示 |
| 客户端接线 | Web 云同步与照片生成界面；Capacitor 原生分享/存档导入导出；Taro 小程序核心页面与云同步 |
| 工程交付 | CI/E2E、Docker/compose、迁移 runner、healthz、OSS/CDN 发布脚本、部署说明 |
| 产品记录 | 可选云账号 ADR、仅卖生成服务 ADR、隐私/协议草稿、合规行动清单 |

## 当前尚未提交的内容

1. **手机号账号链路**：contracts、短信发送/验证码登录/绑定/冲突切换、身份与验证码仓库、0004 SQL 迁移、阿里云短信 adapter、Web PhoneAuth、小程序 phoneAuth、生成前手机号检查及对应测试。它是横跨多包的一组功能，不能只提交 UI 或只提交迁移。
2. **固定家主题 + 可变小猫用品**：ADR-0010/0011、领域定义、A/B/F 主题注册、猫窝/隧道 CatItem、选择归一化、resolver、投影与 UI、槽位冻结和遮挡脚本、测试与素材。
3. **开发态动画和美术材料**：Minho eat/gaze/play/sleep v03 WebP 与 poster、动画构建脚本、主题审核图与 QA、sunwake-crossing 候选等。候选存在不等于发布批准。
4. **本地工具规则**：.agents/skills 与 .cursor/rules 也在未跟踪列表，需要明确哪些是仓库规范、哪些是个人环境文件。

文档漂移：cat-item-production-status.md 仍写“尚未接入 resolver”，但 packages/core/src/homeTheme/catItems/index.ts、themes/*、resolveHomeScene.ts 与测试已接入猫窝/隧道开发态路径。因此准确状态是“已有开发态接线，正式素材/运行效果验收仍未收口”，不是从零待开发。

## 其他工作树中的未提交资产

| 工作树 | 未提交状态 |
|---|---|
| BraveCat-home-screen-v1 | 10 个已跟踪修改 + 981 个未跟踪文件，共 991；928 个位于 docs/art/candidates，另有 UI 美术、图标、homeArt 模块/测试与 promote 脚本 |
| BraveCat-issue-9 | 干净 |
| BraveCat-issues-17-18 | 干净 |
| BraveCat-rc | 干净，detached HEAD 2777788 |

旧工作树的提交基线已合入主干，不代表其工作区改动已合入。此次没有逐图片哈希去重，也没有证明 991 个文件都是独有价值；必须先保全并与新目录映射比较，再决定归档/取回，不能直接清理。

## 未完成与有意挂起应分开

### 已有实现，但尚欠验收/关闭记录

GitHub 仍有 18 个 OPEN Issues。#3–#6、#8、#10–#14、#24 中不少内容已有代码：领养、货币、商店/行囊、自主旅行、相册、多猫时钟、更换形象、分享、存档与返程收敛。Issue 的未勾选状态不能作为“完全没开发”的依据，也不能在本次代码审计后直接标为验收完成。

#19 家美术、#20 确定性明信片、#7 首发素材包、#15 安装部署仍有实际验收/发布缺口。#20 有 compositor/recipe 实现，但最终合成审核尚未收口。

### 实际发布缺口

- **正式资产**：地标 manifest.v2 顶层 shippingEligible=false；归档为 25 地点/61 active scenes，合成批准仅 13 个 v3 新增场景，之前 48 个待重审，权利状态 review-complete-not-cleared。新开发候选集与此正式清单不是同一版本，不得混算。A/B/F 主题及小猫用品走 dev-art，仍需正式批准与发布门禁。
- **真实 AIGC**：bailianGeneration.ts 明确未与真实服务联调；env 工厂未接 segmentation/OSS 中转配置。十姿势一致性、透明边缘、落地点和与已有画风匹配尚无本次真实服务证据。aliyunModeration.ts 也注明待真实联调和审核用签名 URL。
- **任务可靠性**：queue.ts 明确进程重启会丢队列，任务停 pending；收费服务上线前需补重启恢复、超时/退款闭环。
- **支付**：原生与小程序 PurchasePort 仍为 stub；生产 index.ts 注入 unavailable purchase verifier。真实下单、凭证验证、订阅权益、恢复购买和支付失败链路未形成可收费闭环。
- **账号**：手机号实现仍在工作区；微信/Apple 绑定仍为 501 骨架。短信生产联调、身份迁移和账号切换的真实存档恢复需验收。
- **小程序**：动画、更换形象、布置家、多猫切换未齐；CDN 正式美术与 Canvas/分享/权限/导入导出/云同步需开发者工具及真机验证。
- **原生 App**：占位 appId、签名、正式图标/启动屏、状态栏/安全区、商店材料与真机验收待收口。
- **部署运营**：有部署手册和构建能力，未见足以确认线上健康、备份恢复、监控告警、回滚演练及正式发布的证据；GitHub 无 release 记录不等于证明外部从未部署。

### 明确暂缓或候选等待

| 内容 | 状态与发布关系 |
|---|---|
| cinematic 小辑创意 | cinematic-gameplay-concept-v1.md 标为 dormant concept，不承诺实现；四幕候选不应自动纳入首发 |
| 墙面 matrix3d 真透视 | ADR-0008 明确保留 clip-path + skew，等强透视或动态内容需求再复审，不是当前欠账 |
| 原生推送 | apps/mobile/README.md 明确本阶段不接；原 PWA v1 也排除推送 |
| 猫塔/球轨/逗猫杆 | 扩展造型候选待用户审核，runtimeEligible=false；未注册到当前 CatItem 集 |
| 窗外景观部分变体 | home-exteriors/README.md 有暂停/暂缓派生记录，等待尺寸、色彩及真实窗洞裁切验证 |
| 云朵猫窝/软布隧道 | 方向及 alpha 候选获批，已有开发接线；剩余是 runtime/遮挡/正式发布验收，不能与上面纯候选混为一谈 |

以上“挂起”依据仓库的明确记录；未把所有 TODO 推断为用户已经批准延期。

## 到正式发布的收口顺序

1. **冻结首发范围**：确认 Web PWA 优先还是四端商业同时发布；确认首发猫、主题、目的地数量和是否开启云服务/收费。原 PRD、后续 ADR 与实际四端实现必须统一。
2. **保全并收敛 Git**：保全两个脏工作区；按手机号、家主题/用品、动画素材、工具规则拆分审核与提交；对齐 origin/main，验证纪念品返程行为。对已被新方案取代的稿件留来源记录。
3. **冻结正式素材包**：家在家/外出/可收取等状态、Minho、目的地、明信片合成与纪念品；按准确文件哈希完成视觉/合成/权利与 shipping 批准。不能通过取消门禁来让开发素材进入正式版。
4. **基础版验收**：收取→购买→装包→自主出发→来信→返程→纪念品→再次出发；刷新/跨日/旧存档/损坏导入、多猫并发、分享下载、PWA 安装/离线/SW 更新与窄屏安全区。用正式构建及实际发出的资产验收。
5. **若首发含云/AIGC/收费**：真实 Postgres 迁移与备份恢复、SMS、对象存储私密访问、审核、十姿势生成、任务恢复、支付/权益/退款/恢复购买均需联调与故障验收。默认关闭云功能只能缩小首发范围，不能算商业闭环完成。
6. **若首发含小程序/原生**：补所承诺的端间能力，完成真机与商店签名/标识/图标/提审材料。不要以 web 测试替代平台验证。
7. **发布材料与运营**：版本/tag、正式发布记录、部署/回滚说明、线上监控、用户支持与数据删除路径。隐私/服务协议仍为 draft；2026-08 合规行动清单不是办结证明，主体/产品类目/备案等适用项需以实际发行方案重新核实。ADR 中“按非游戏对外定性”是项目决策，不是监管或平台认定；本次没有重新做法律审查。
8. **更新 Issue**：对照验收证据关闭已有功能，给真实缺口建立清单；#16 单独比对后收口。删除旧状态描述中的过时断言。

建议基础 PWA 与商业多端分别建立发布门槛，先形成一个使用正式资产、可复现、可回滚的发布候选。电影故事、更多用品、更多窗景和推送可以继续保留在后续计划，不必都阻塞首次发布。

## 本次验证

- npm run check：通过，Svelte 0 errors / 0 warnings。
- npm test：通过，47 个 Vitest 文件、331 个用例，另有 24 个脚本测试，共 355 个用例。
- npm run build：通过；home display / production 资产检查通过；输出明确 landmarks excluded、6 portrait poses included。
- npm run build:weapp --workspace @bravecat/miniprogram：通过。
- 最近远端 HEAD 的 CI/E2E：2026-08-13 成功，run 31707970378 / 31707970387；不覆盖当前未提交修改。
- 本次未执行：E2E/浏览器视觉复核、移动真机、iOS/Android release 构建、真实 Postgres/短信/云模型/审核/支付联调、部署、法律与权利重新审查。

## 关键来源

- GitHub：https://github.com/CCharlesMeng/BraveCat/issues ，https://github.com/CCharlesMeng/BraveCat/pull/16
- 工程：README.md、CONTEXT.md、.github/workflows/ci.yml、docs/deployment.md。
- 多端：apps/mobile/README.md、apps/miniprogram/README.md、services/api/README.md。
- 生产断点：services/api/src/index.ts、services/api/src/routes/auth.ts、services/api/src/aigc/queue.ts、services/api/src/aigc/adapters/{bailianGeneration,aliyunModeration}.ts。
- 美术：docs/art/production/landmarks/manifest.v2.json、docs/art/archive/README.v2.md、docs/art/candidates/home-theme-prototypes/2026-08-13/*status.md。
- 计划：docs/adr/0008-wall-projection-keeps-clip-path-approximation.md、docs/art/cinematic-gameplay-concept-v1.md、docs/compliance/*。

## 附录 A：当前工作区未提交文件（报告生成前）

```text
M CONTEXT.md
 M apps/miniprogram/src/pages/album/CloudSyncSection.tsx
 M apps/miniprogram/src/pages/album/index.scss
 M apps/web/e2e/smoke.e2e.ts
 M apps/web/src/App.svelte
 M apps/web/src/app.css
 M apps/web/src/lib/HomeThemePicker.svelte
 M apps/web/src/lib/PortraitStudio.svelte
 M apps/web/src/lib/ThemeLab.svelte
 M apps/web/src/lib/cloudSync.svelte.ts
 M docs/adr/0006-home-scene-resolves-from-selection-ids.md
 M docs/adr/0007-home-art-ships-as-form-finish-piece-layers.md
 M docs/art/candidates/home-theme-prototypes/2026-08-13/README.md
 M docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/README.md
 M docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/manifest.json
 M docs/art/candidates/home-theme-prototypes/2026-08-13/architecture-change-plan.md
 M docs/art/candidates/home-theme-prototypes/2026-08-13/art-production-status.md
 M docs/art/candidates/home-theme-prototypes/2026-08-13/form-controls/README.md
 M docs/art/candidates/home-theme-prototypes/2026-08-13/home-theme-ui-spec.md
 M docs/art/candidates/home-theme-prototypes/2026-08-13/modular-composition-contract.md
 M docs/art/candidates/home-theme-prototypes/2026-08-13/production/README.md
 M package-lock.json
 M package.json
 M packages/contracts/src/auth.ts
 M packages/contracts/src/errors.ts
 M packages/core/src/cloud/index.ts
 M packages/core/src/game/game.test.ts
 M packages/core/src/homeTheme/customization.ts
 M packages/core/src/homeTheme/forms/classic-v4.ts
 M packages/core/src/homeTheme/forms/split-level-den.ts
 M packages/core/src/homeTheme/homeTheme.test.ts
 M packages/core/src/homeTheme/index.ts
 M packages/core/src/homeTheme/projection.ts
 M packages/core/src/homeTheme/resolveHomeScene.ts
 M packages/core/src/homeTheme/types.ts
 M scripts/capture-home-scene-regression.mjs
 M scripts/check-development-home-art.mjs
 M services/api/README.md
 M services/api/src/app.ts
 M services/api/src/dev.ts
 M services/api/src/index.ts
 M services/api/src/repositories/memory.ts
 M services/api/src/repositories/postgres.ts
 M services/api/src/repositories/types.ts
 M services/api/src/routes/auth.ts
 M services/api/src/routes/deps.ts
 M services/api/src/routes/portraits.ts
 M services/api/test/auth.test.ts
 M services/api/test/helpers.ts
?? .agents/skills/sdd-dev-frontend/CONTEXT.md
?? .agents/skills/sdd-dev-frontend/README.html
?? .agents/skills/sdd-dev-frontend/README.md
?? .agents/skills/sdd-dev-frontend/SKILL.md
?? .agents/skills/sdd-dev-frontend/agents/extract-block-spec.md
?? .agents/skills/sdd-dev-frontend/agents/extract-prototype.md
?? .agents/skills/sdd-dev-frontend/agents/recon-codebase.md
?? .agents/skills/sdd-dev-frontend/agents/recon-spec.md
?? .agents/skills/sdd-dev-frontend/agents/review-convention.md
?? .agents/skills/sdd-dev-frontend/agents/review-layout.md
?? .agents/skills/sdd-dev-frontend/agents/review-quality.md
?? .agents/skills/sdd-dev-frontend/agents/self-test.md
?? .agents/skills/sdd-dev-frontend/docs/adr/0001-restore-uses-diff-list-as-red-evidence.md
?? .agents/skills/sdd-dev-frontend/docs/adr/0002-implementation-stays-with-main-agent.md
?? .agents/skills/sdd-dev-frontend/docs/adr/0003-design-spec-extraction-goes-to-subagent.md
?? .agents/skills/sdd-dev-frontend/docs/adr/0004-locate-blocks-by-class-structure.md
?? .agents/skills/sdd-dev-frontend/docs/adr/0005-external-contract-is-primary-restore-evidence.md
?? .agents/skills/sdd-dev-frontend/evals/evals.json
?? .agents/skills/sdd-dev-frontend/evals/test_extract_design_spec.py
?? .agents/skills/sdd-dev-frontend/evals/设计稿原型-标准版.html
?? .agents/skills/sdd-dev-frontend/evals/设计稿导出件.html
?? .agents/skills/sdd-dev-frontend/references/alpha-tests-restore.md
?? .agents/skills/sdd-dev-frontend/references/block-spec-template.md
?? .agents/skills/sdd-dev-frontend/references/diff-list-template.md
?? .agents/skills/sdd-dev-frontend/references/qa-baseline-template.md
?? .agents/skills/sdd-dev-frontend/references/restore-contract.md
?? .agents/skills/sdd-dev-frontend/references/review-dimensions.md
?? .agents/skills/sdd-dev-frontend/references/sdd-task-amendments.md
?? .agents/skills/sdd-dev-frontend/references/sdd-task-frontend-split.md
?? .agents/skills/sdd-dev-frontend/scripts/collect_restore_facts.js
?? .agents/skills/sdd-dev-frontend/scripts/extract_design_spec.py
?? .agents/skills/sdd-dev-frontend/scripts/verify_restore_contract.py
?? .agents/skills/sdd-dev-frontend/方案设计.md
?? .agents/skills/sdd-dev-frontend/样式还原验证改造计划.md
?? .agents/skills/sdd-dev-frontend/背景介绍.md
?? .agents/skills/sdd-init-frontend/SKILL.md
?? .agents/skills/sdd-init-frontend/agents/openai.yaml
?? .agents/skills/sdd-init-frontend/evals/evals.json
?? .agents/skills/sdd-init-frontend/evals/test_manage_repo_baseline.py
?? .agents/skills/sdd-init-frontend/references/baseline-contract.md
?? .agents/skills/sdd-init-frontend/references/onboarding-report-template.md
?? .agents/skills/sdd-init-frontend/scripts/manage_repo_baseline.py
?? .cursor/rules/visual-assets.mdc
?? apps/miniprogram/src/platform/phoneAuth.test.ts
?? apps/miniprogram/src/platform/phoneAuth.ts
?? apps/web/public/dev-art/home-theme/a-clear-sage/aperture-mask.png
?? apps/web/public/dev-art/home-theme/a-clear-sage/base-plate--aperture-alpha.png
?? apps/web/public/dev-art/home-theme/a-clear-sage/cat-item--play-soft-tunnel--base.png
?? apps/web/public/dev-art/home-theme/a-clear-sage/cat-item--play-soft-tunnel--occlusion.png
?? apps/web/public/dev-art/home-theme/a-clear-sage/cat-item--rest-cloud-bed--base.png
?? apps/web/public/dev-art/home-theme/a-clear-sage/cat-item--rest-cloud-bed--occlusion.png
?? apps/web/public/dev-art/home-theme/a-clear-sage/exterior-noon.png
?? apps/web/public/dev-art/home-theme/a-clear-sage/lighting.png
?? apps/web/public/dev-art/home-theme/b-warm-walnut-gallery/aperture-mask.png
?? apps/web/public/dev-art/home-theme/b-warm-walnut-gallery/base-plate--aperture-alpha.png
?? apps/web/public/dev-art/home-theme/b-warm-walnut-gallery/cat-item--play-soft-tunnel--base.png
?? apps/web/public/dev-art/home-theme/b-warm-walnut-gallery/cat-item--play-soft-tunnel--occlusion.png
?? apps/web/public/dev-art/home-theme/b-warm-walnut-gallery/cat-item--rest-cloud-bed--base.png
?? apps/web/public/dev-art/home-theme/b-warm-walnut-gallery/cat-item--rest-cloud-bed--occlusion.png
?? apps/web/public/dev-art/home-theme/b-warm-walnut-gallery/exterior-noon.png
?? apps/web/public/dev-art/home-theme/b-warm-walnut-gallery/lighting.png
?? apps/web/public/dev-art/home-theme/f-moonwhite-bluegray/aperture-mask.png
?? apps/web/public/dev-art/home-theme/f-moonwhite-bluegray/base-plate--aperture-alpha.png
?? apps/web/public/dev-art/home-theme/f-moonwhite-bluegray/cat-item--play-soft-tunnel--base.png
?? apps/web/public/dev-art/home-theme/f-moonwhite-bluegray/cat-item--play-soft-tunnel--occlusion.png
?? apps/web/public/dev-art/home-theme/f-moonwhite-bluegray/cat-item--rest-cloud-bed--base.png
?? apps/web/public/dev-art/home-theme/f-moonwhite-bluegray/cat-item--rest-cloud-bed--occlusion.png
?? apps/web/public/dev-art/home-theme/f-moonwhite-bluegray/exterior-noon.png
?? apps/web/public/dev-art/home-theme/f-moonwhite-bluegray/lighting.png
?? apps/web/public/dev-art/home-v4/cat-animations/cat--minho--eat--ambient--poster--v03.webp
?? apps/web/public/dev-art/home-v4/cat-animations/cat--minho--eat--ambient--v03.webp
?? apps/web/public/dev-art/home-v4/cat-animations/cat--minho--gaze--ambient--poster--v03.webp
?? apps/web/public/dev-art/home-v4/cat-animations/cat--minho--gaze--ambient--v03.webp
?? apps/web/public/dev-art/home-v4/cat-animations/cat--minho--play--ambient--poster--v03.webp
?? apps/web/public/dev-art/home-v4/cat-animations/cat--minho--play--ambient--v03.webp
?? apps/web/public/dev-art/home-v4/cat-animations/cat--minho--sleep--ambient--poster--v03.webp
?? apps/web/public/dev-art/home-v4/cat-animations/cat--minho--sleep--ambient--v03.webp
?? apps/web/src/lib/PhoneAuth.svelte
?? apps/web/src/lib/homeThemePicker.test.ts
?? docs/adr/0010-home-themes-fix-furniture-cat-items-vary.md
?? docs/adr/0011-cat-item-slots-occupy-disjoint-frozen-zones.md
?? docs/art/candidates/cinematic-v6/sunwake-crossing/batch-01-continuity-storyboard/README.md
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/play-soft-tunnel/shape-reviews/bravecat-cat-item-play-soft-tunnel--theme-a-clear-sage--shape-review--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/play-soft-tunnel/shape-reviews/bravecat-cat-item-play-soft-tunnel--theme-b-warm-walnut--shape-review--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/play-soft-tunnel/shape-reviews/bravecat-cat-item-play-soft-tunnel--theme-f-moonwhite-bluegray--shape-review--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/play-soft-tunnel/usage-reviews/bravecat-cat-item-play-soft-tunnel--abf-minho-usage-review-board--candidate-v02.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/evidence/alpha-qa--candidate-v01.json
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/evidence/pose-qa--candidate-v01.json
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/evidence/qa--minho-pose--rest-play-abf-contact-sheet--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/evidence/qa--play-soft-tunnel--abf-alpha-contact-sheet--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/evidence/qa--pose--a-clear-sage--play--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/evidence/qa--pose--a-clear-sage--rest--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/evidence/qa--pose--b-warm-walnut-gallery--play--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/evidence/qa--pose--b-warm-walnut-gallery--rest--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/evidence/qa--pose--f-moonwhite-bluegray--play--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/evidence/qa--pose--f-moonwhite-bluegray--rest--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/evidence/qa--rest-cloud-bed--abf-alpha-contact-sheet--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/play-soft-tunnel/a-clear-sage/cat-item--play-soft-tunnel--a-clear-sage--base--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/play-soft-tunnel/a-clear-sage/cat-item--play-soft-tunnel--a-clear-sage--foreground-occlusion--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/play-soft-tunnel/b-warm-walnut/cat-item--play-soft-tunnel--b-warm-walnut--base--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/play-soft-tunnel/b-warm-walnut/cat-item--play-soft-tunnel--b-warm-walnut--foreground-occlusion--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/play-soft-tunnel/f-moonwhite-bluegray/cat-item--play-soft-tunnel--f-moonwhite-bluegray--base--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/play-soft-tunnel/f-moonwhite-bluegray/cat-item--play-soft-tunnel--f-moonwhite-bluegray--foreground-occlusion--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/rest-cloud-bed/a-clear-sage/cat-item--rest-cloud-bed--a-clear-sage--base--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/rest-cloud-bed/a-clear-sage/cat-item--rest-cloud-bed--a-clear-sage--foreground-occlusion--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/rest-cloud-bed/b-warm-walnut/cat-item--rest-cloud-bed--b-warm-walnut--base--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/rest-cloud-bed/b-warm-walnut/cat-item--rest-cloud-bed--b-warm-walnut--foreground-occlusion--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/rest-cloud-bed/f-moonwhite-bluegray/cat-item--rest-cloud-bed--f-moonwhite-bluegray--base--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources/rest-cloud-bed/f-moonwhite-bluegray/cat-item--rest-cloud-bed--f-moonwhite-bluegray--foreground-occlusion--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/rest-cloud-bed/shape-reviews/bravecat-cat-item-rest-cloud-bed--theme-a-clear-sage--shape-review--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/rest-cloud-bed/shape-reviews/bravecat-cat-item-rest-cloud-bed--theme-b-warm-walnut--shape-review--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/rest-cloud-bed/shape-reviews/bravecat-cat-item-rest-cloud-bed--theme-f-moonwhite-bluegray--shape-review--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/rest-cloud-bed/usage-reviews/bravecat-cat-item-rest-cloud-bed--abf-minho-usage-review-board--candidate-v02.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/composites/b/bravecat-home-theme-b-warm-walnut-travel-gallery--assembled-room-review--candidate-v03-unified-grade.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/composites/bravecat-home-theme-a-clear-sage--assembled-room-review--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/composites/bravecat-home-theme-f-moonwhite-bluegray--assembled-room-review--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/a/bravecat-home-theme-a-clear-sage--cabinet-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/a/bravecat-home-theme-a-clear-sage--feeding-set-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/a/bravecat-home-theme-a-clear-sage--plant-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/a/bravecat-home-theme-a-clear-sage--rug-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/a/bravecat-home-theme-a-clear-sage--window-frame-shape-review-source--candidate-v01-not-alpha--retry-v02-blackmask-normalized-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/b/bravecat-home-theme-b-warm-walnut-travel-gallery--cabinet-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/b/bravecat-home-theme-b-warm-walnut-travel-gallery--feeding-set-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/b/bravecat-home-theme-b-warm-walnut-travel-gallery--finish-swatch-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/b/bravecat-home-theme-b-warm-walnut-travel-gallery--plant-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/b/bravecat-home-theme-b-warm-walnut-travel-gallery--postcard-display-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/b/bravecat-home-theme-b-warm-walnut-travel-gallery--rug-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/b/bravecat-home-theme-b-warm-walnut-travel-gallery--scratcher-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/b/bravecat-home-theme-b-warm-walnut-travel-gallery--window-frame-shape-review-source--candidate-v01-not-alpha--retry-v02-blackmask-normalized-v03.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/f/bravecat-home-theme-f-moonwhite-bluegray--cabinet-shape-review-source--candidate-v02-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/f/bravecat-home-theme-f-moonwhite-bluegray--feeding-set-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/f/bravecat-home-theme-f-moonwhite-bluegray--plant-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/f/bravecat-home-theme-f-moonwhite-bluegray--rug-shape-review-source--candidate-v01-not-alpha.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shape-reviews/f/bravecat-home-theme-f-moonwhite-bluegray--window-frame-shape-review-source--candidate-v01-not-alpha--retry-v02-blackmask-normalized-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shells/b/bravecat-home-theme-b-warm-walnut-travel-gallery--clean-shell-source--candidate-v01--retry-v02-blackmask-normalized-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shells/bravecat-home-theme-a-clear-sage--clean-shell-source--candidate-v02.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/shells/bravecat-home-theme-f-moonwhite-bluegray--clean-shell-source--candidate-v05.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/ui/bravecat-home-theme-ui--real-art-review-board--candidate-v02.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-item-architecture-change-plan.md
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-item-art-direction.md
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-item-composition-contract.md
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-item-expansion-status.md
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-item-production-status.md
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-items/README.md
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-items/alpha-qa--candidate-v01.json
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-items/alpha-qa--candidate-v01.md
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-items/play-soft-tunnel/a-clear-sage/cat-item--play-soft-tunnel--a-clear-sage--base--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-items/play-soft-tunnel/b-warm-walnut/cat-item--play-soft-tunnel--b-warm-walnut--base--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-items/play-soft-tunnel/f-moonwhite-bluegray/cat-item--play-soft-tunnel--f-moonwhite-bluegray--base--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-items/play-soft-tunnel/qa--play-soft-tunnel--abf-alpha-contact-sheet--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-items/rest-cloud-bed/a-clear-sage/cat-item--rest-cloud-bed--a-clear-sage--base--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-items/rest-cloud-bed/b-warm-walnut/cat-item--rest-cloud-bed--b-warm-walnut--base--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-items/rest-cloud-bed/f-moonwhite-bluegray/cat-item--rest-cloud-bed--f-moonwhite-bluegray--base--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/cat-items/rest-cloud-bed/qa--rest-cloud-bed--abf-alpha-contact-sheet--candidate-v01.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/production/a-clear-sage/geometry--furnished-base-plate--measured-freeze-v02.json
?? docs/art/candidates/home-theme-prototypes/2026-08-13/production/a-clear-sage/qa--cat-item-slots-overlay--measured-freeze-v02.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/production/b-warm-walnut-gallery/geometry--furnished-base-plate--measured-freeze-v02.json
?? docs/art/candidates/home-theme-prototypes/2026-08-13/production/b-warm-walnut-gallery/qa--cat-item-slots-overlay--measured-freeze-v02.png
?? docs/art/candidates/home-theme-prototypes/2026-08-13/production/f-moonwhite-bluegray/geometry--furnished-base-plate--measured-freeze-v02.json
?? docs/art/candidates/home-theme-prototypes/2026-08-13/production/f-moonwhite-bluegray/qa--cat-item-slots-overlay--measured-freeze-v02.png
?? docs/art/candidates/home-v4/cat-animations-v03/README.md
?? docs/art/candidates/home-v4/cat-animations-v03/cat--minho--eat--ambient--poster--v03.webp
?? docs/art/candidates/home-v4/cat-animations-v03/cat--minho--eat--ambient--v03.webp
?? docs/art/candidates/home-v4/cat-animations-v03/cat--minho--gaze--ambient--poster--v03.webp
?? docs/art/candidates/home-v4/cat-animations-v03/cat--minho--gaze--ambient--v03.webp
?? docs/art/candidates/home-v4/cat-animations-v03/cat--minho--play--ambient--poster--v03.webp
?? docs/art/candidates/home-v4/cat-animations-v03/cat--minho--play--ambient--v03.webp
?? docs/art/candidates/home-v4/cat-animations-v03/cat--minho--sleep--ambient--poster--v03.webp
?? docs/art/candidates/home-v4/cat-animations-v03/cat--minho--sleep--ambient--v03.webp
?? docs/art/candidates/home-v4/cat-animations-v03/contact-sheet.png
?? docs/art/candidates/home-v4/cat-animations-v03/manifest.candidate.json
?? docs/art/candidates/home-v4/cat-animations-v03/motion-contact-sheet.png
?? docs/art/reviews/home-theme/base-plate-runtime-qa/away.png
?? docs/art/reviews/home-theme/base-plate-runtime-qa/base-plate/a-clear-sage--play.png
?? docs/art/reviews/home-theme/base-plate-runtime-qa/base-plate/a-clear-sage--sleep.png
?? docs/art/reviews/home-theme/base-plate-runtime-qa/base-plate/b-warm-walnut-gallery--play.png
?? docs/art/reviews/home-theme/base-plate-runtime-qa/base-plate/b-warm-walnut-gallery--sleep.png
?? docs/art/reviews/home-theme/base-plate-runtime-qa/base-plate/f-moonwhite-bluegray--play.png
?? docs/art/reviews/home-theme/base-plate-runtime-qa/base-plate/f-moonwhite-bluegray--sleep.png
?? docs/art/reviews/home-theme/base-plate-runtime-qa/empty-sleep.png
?? docs/art/reviews/home-theme/base-plate-runtime-qa/full-eat.png
?? docs/art/reviews/home-theme/base-plate-runtime-qa/full-gaze.png
?? docs/art/reviews/home-theme/base-plate-runtime-qa/full-play.png
?? docs/art/reviews/home-theme/base-plate-runtime-qa/full-sleep.png
?? packages/core/src/homeTheme/catItems/index.ts
?? packages/core/src/homeTheme/themes/a-clear-sage.ts
?? packages/core/src/homeTheme/themes/b-warm-walnut-gallery.ts
?? packages/core/src/homeTheme/themes/f-moonwhite-bluegray.ts
?? packages/core/src/homeTheme/themes/index.ts
?? packages/core/src/homeTheme/themes/shared.ts
?? scripts/build-approved-home-form-controls.mjs
?? scripts/build-cat-item-occlusion.mjs
?? scripts/build-cat-item-pose-qa.mjs
?? scripts/build-home-cat-animations.mjs
?? scripts/check-base-plate-home-art.mjs
?? scripts/freeze-cat-item-slots.mjs
?? scripts/ship-cat-item-dev-art.mjs
?? services/api/migrations/0004_auth_identities.sql
?? services/api/src/auth/adapters/aliyunSms.ts
?? services/api/src/auth/fakes.ts
?? services/api/src/auth/phone.ts
?? services/api/src/auth/ports.ts
?? services/api/src/auth/smsCodes.ts
?? services/api/src/auth/unavailable.ts
?? services/api/test/phone-auth.test.ts
```

## 附录 B：当前分支独有提交

```text
8ce4b2c Replace piece-built rooms with furnished base plates
d3a67d0 Rework dressed rooms to match approved concepts: F upright window, framed B gallery, per-form dressing
3141284 Converge dressed-room layouts on the approved concept composites
2346fd7 Fill dressed rooms: cabinet/rug/plant pieces, contact shadows, lighting, dynamic-content QA
cad76df Move local dev ports to 19080/19173 to avoid common-port clashes
bc4d30f Add feeding-set and window-frame pieces for A/B/F, B scratcher, two more exterior masters
1c95fee Complete postcard-display for A/B/F, add scratcher bases, remaster sea bay exterior
70ed3a9 Document the local end-to-end AIGC generation demo
4f15f50 Wire the AI portrait generation flow into the web app behind the cloud flag
6ac7fe0 Add portrait generation methods to the cloud sync client
24dd1b7 Add in-memory dev API entry wiring fake AIGC providers
38b3eea Add authed photo upload, pose image, and portrait list endpoints
b335e48 Add photo upload, pose image, and portrait list contracts
5426c01 Produce B clean shell, freeze A/B/F measured geometry, pilot rails and exterior remaster
7550971 Pin exterior master spec to measured apertures with parallax QA
40e1c0e Draft privacy policy and terms of service for review
adf0e11 Run the E2E workflow on feature branch pushes
7cb86f9 Deduplicate decideStartupSync by consuming the core export in web
9e82249 Document how to run the web E2E smoke tests
abfd5fc Add E2E workflow building the app and running Playwright smoke tests
a8d806b Add Playwright E2E smoke suite covering the web core loop
f4661a5 Produce A/F clean shell candidates with aperture alpha and QA
27a28da Document miniprogram cloud sync setup and wx domain whitelist requirements
c80ead4 Wire optional cloud save sync behind TARO_APP_API_BASE_URL into the miniprogram
6b43b2d Add wx cloud adapters for fetch, credentials, backup slots, and wechat binding
5c5254c Export the decideStartupSync startup decision from the core cloud module
4cf5596 Record exterior parallax headroom ruling
3a15674 Document Aliyun docker compose deployment and the OSS asset publish flow
00262d7 Add CI workflow running checks, tests, web and weapp builds on push and PR
4c5ba22 Containerize the api with a workspaces-aware multi-stage Dockerfile and production compose file
0c2ae24 Move the api migration runner into src so builds ship it in dist
79e09ba Add unauthenticated GET /healthz to the api for container probes
c774248 Add @playwright/test dev dependency to the web app
229857d Freeze A/B/F HomeForm control geometry at the 3:4 canvas contract
459e8d6 Record home exterior and theme prototype candidates with art production status notes
4e8ce75 Record ADR-0009 keeping local-first play while making cloud accounts optional
c5a0ddd Wire optional cloud save sync behind VITE_API_BASE_URL into the web app
c565455 Verify guest register, push, pull round-trip through CloudSync against the api
f5ca627 Add configurable CORS to the api and document local web integration
738fc85 Add CloudSync client module to core for guest auth, save sync, credits, and meta
a4bc0c1 Document miniprogram setup, adapter tradeoffs, and known gaps
318442f Add miniprogram pages driving the core game loop through GameController
5979cee Add weapp adapters for save, postcard canvas, share, random, and purchase ports with unit tests
3e85794 Scaffold Taro React miniprogram workspace targeting weapp with the vite compiler
efbd60f Add native save export/import via share sheet and system file picker
70cb3ee Add production adapter skeletons for AIGC providers and document the pipeline
672385e Add async portrait generation job pipeline with hold/refund/consume semantics
20eb4ab Add server-authoritative generation credit entitlement with purchase redemption
207d227 Add AIGC provider ports, fake implementations, and baseline portrait QA
fa1d6f2 Add generation credit and portrait pipeline contracts
a73e06d Wire VITE_ASSET_BASE_URL into the web asset resolver
2efca60 Add shipping-gated asset publishing to OSS with a content-hash manifest
df3d6fc Apply safe-area insets only inside the Capacitor native shell
f2585e7 Add PurchasePort skeleton for AI generation credit and membership IAP
f6f3538 Wire postcard share and save to native Capacitor implementations
62585c8 Add Capacitor mobile shell packaging the web build for iOS and Android
f4d4062 Fix public asset paths in prototype scripts after monorepo move
b59aa27 Annotate homeTheme style-string output as a future port split
a63b875 Unify SaveDocument in contracts as the single source
e2b17a3 Extract GameController and platform ports from App.svelte
f02093c Record home theme architecture decisions as ADRs
ad45e38 Extract pure TS domain modules into packages/core
96b2932 Adopt npm workspaces and move the web app into apps/web
e216596 Add surface finishes and the player-facing home decorator
d4c7900 Add AIGC portrait generation spike candidates
fff9f72 Add compliance action plan and monetization ADR
56981d6 Add contracts package and API service skeleton
c833663 Split home pieces into typed sockets with swappable art
f52a57a Add split-level den form and dev-only Theme Lab
41394a9 Land home theme architecture slices 0-1
aa5035b Complete playable trip return loop
b1104ff Add development preview art catalog
4ff9583 Merge branch 'feat/issue-18-shop-confirmation' into feat/v3-landmark-review
a9eb0e1 Merge development treat tools into landmark review
c3156e5 Clarify Minho approval provenance
3c60d94 Freeze postcard rendering recipes
17fe1bd Integrate the approved v3 landmark set
```

## 附录 C：远端主干独有提交

```text
2777788 Merge pull request #21 from CCharlesMeng/feat/issue-9-souvenirs
2365ca1 Fix repeated travel after accelerated returns
d2b7867 Merge shop testing improvements into souvenir loop
8d8f26e Merge pull request #23 from CCharlesMeng/feat/issue-18-shop-confirmation
e463990 Merge pull request #22 from CCharlesMeng/feat/issue-17-dev-treats
8477d61 Complete the souvenir return loop
```
