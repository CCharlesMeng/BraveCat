# 咪游记 Web/PWA 首发交接

交接日期：2026-09-29。此文保留交接时快照；不是发布完成报告。

后续实现已推进：见 [本轮实现与验收](../audits/web-pwa-implementation-2026-09-29.md)。下文“故事尚未实现”等描述仅代表交接基线，不再代表当前代码。

## 任务与用户授权

继续推进 BraveCat 的免费 Web/PWA 首发，先实现两组小故事并完成相册、存档、正式素材与离线体验。用户已完成产品 grill，并确认“都按照推荐进行”；之后接受规格并要求 handoff 到新会话。

不要重新询问已确认的产品范围或同一批素材审批。一般实现选择自行处理；只有发现改变产品承诺的真实冲突、缺少必要外部资料或操作权限时才提出具体问题。不要只重新输出一份计划而不推进实施。

## 仓库与 Git

- 工作目录：`/Users/moon/Documents/Code/BraveCat`。
- GitHub：`CCharlesMeng/BraveCat`。
- 唯一开发分支：本地/远端 `main`。用户明确要求只保留这一分支，不要例行再建功能分支。
- 交接前实现/规格基线：`feef7e678d7d590ccbe4dd9b52ec6734cb457d3c`，本地与 origin/main 一致，工作区干净；本交接文档随后单独提交。
- 当前所有其他分支已归档成 `archive/2026-09-29/*` 标签并推送，旧 PR #16 的内容已等价合入并关闭。
- 原 `BraveCat-home-screen-v1` 脏工作树的 991 个改动文件已完整归档到 `archive/2026-09-29/working-tree/home-screen-v1`。旧目录保留、detached，不能当成尚需整套合入的新实现，也不要删除。
- 本机另有 `.git/archives/2026-09-29/pre-convergence.bundle`；恢复索引在 `docs/audits/branch-archives-2026-09-29.json`。
- 不使用 `git add -A`，只提交核对过的具体路径。开工先检查当前状态，保留可能新增的用户修改。

## 先读这些文件

1. `AGENTS.md`、`CONTEXT.md`、相关 `docs/adr/`。
2. **`docs/plans/web-pwa-first-release-spec.md`**：当前首发执行规格，产品决定与可调默认值分开记录，以它为实施依据。
3. `docs/plans/next-step-plan-2026-09-29.md`：完整任务与后置事项。
4. `docs/audits/main-convergence-2026-09-29.md`：代码归并、测试与归档说明。
5. `docs/art/reviews/all-existing-assets-approval-2026-09-29.json` 及同名 `.md`：素材用户批准的权威记录。
6. 涉及故事内容、图片或审阅时，先读 `docs/agents/cinematic-four-act-stories.md` 及它要求的基线文件。

`docs/audits/release-readiness-2026-09-29.md` 是收敛前快照，不是当前 Git/审批状态。旧故事和素材 README 的“dormant / 等待用户审批 / 非发布”需要区分历史意见、已被新决定替代的审批状态和仍然存在的技术限制。

## 已确认的首发范围

- 中国大陆 Web/PWA，免费完整体验；其他端分批跟进。
- 当前可玩主线：内置 Minho、A/B/F 家主题、猫窝/隧道，完整的收取→购买→装包→自主出发→来信→归家/纪念品→再次出发循环。
- **两组四幕小故事必须同批发布：《值夜观星》《雾港看归船》。** 不是另一个十章五幕长篇《最后一束光》。
- 小故事为自然奇遇，普通旅行也能遇到；相关行囊物品提高倾向，没有专属门票门槛。
- 普通旅行为主、故事偶发；优先未经历、避免连续重复，不做首日强制保底。
- 复用已有物品；四幕随同次旅行依次寄回、离线推进、回来补齐、收齐可整组回看。
- **仅本机存档＋导入导出。** 账号/云同步/短信、照片 AI 生成、付费/会员全部后置。已有 API 和适配器保留，首发生产配置不开放相应入口或请求。
- 其余故事、新增用品/窗景、推送、matrix3d 均不阻塞首发。
- 当前所有已有素材已获用户批准，不要再次把人工审批列为未完成项。

## 已落盘的工程默认值

这些是代理将产品方向具体化后的可调参数，不是用户逐一指定的数值；已向用户说明，完整边界在执行规格中。

- 合格出发基础故事概率 20%，有对应可选故事物品时为 30%，不叠加超过 30%。
- `small-telescope` →《值夜观星》；`fish-biscuit` →《雾港看归船》；对应故事相对权重 ×2。
- 优先未完成故事；避免与另一只当前出行猫分配相同故事；两组都完成后可以重复，有替代时避开最近一组。
- 同猫完成一次故事后，至少完成一次普通旅行再触发故事。多猫同时出发用稳定顺序和持久化计划处理。
- 四幕在旅程 20%/40%/60%/80% 时抵达，100% 归家；沿用 2–24 小时及已有时长效果。
- 普通车票 80% 心愿命中优先保持普通真实地标旅行；无有效心愿或绕路/意外分支才可检查故事概率。故事不能伪装成到访原真实地标。
- 玩具/零食/普通车票保持当前返还/消耗行为。本次没有专属故事 Wish，因此旧概念“专属物品未命中返还”不应扩成所有物品免消耗。
- 小相机不产生第五幕；铃铛与姿势权重不改写批准的故事画面。
- 故事没有额外 Treat/纪念品/关卡奖励。故事中的小鱼是画面道具，不是玩家货币。

## 当前实际实现边界

**故事运行代码尚未实现，上一会话主要完成代码归并、素材批准记录与产品规格。**

- `packages/core/src/assets/devLatestArtCatalog.generated.ts` 中 cinematic 仍排除；无正式故事 catalog/act/collection 模型。
- `packages/core/src/itinerary/index.ts` 默认普通旅行 1–2 张来信，普通 Wish 概率 80%/15%/5%。不要把这个 80% 当作故事概率。
- `packages/core/src/travel/index.ts` 保存 `tripSeed`，在真正出发时锁定计划；`packages/core/src/planTrip.ts` 是规划入口。
- `packages/core/src/game/index.ts` 及 `controller/index.ts` 负责多猫推进、返程与持久化；已有纪念品发放/返还幂等行为不可回退。
- `packages/contracts/src/save-document.ts` 与 GameState 当前均 v4；故事要维护契约、状态和迁移，旧普通旅行不重抽。
- `packages/core/src/selection/index.ts` 的普通 PostcardRecipe 为 Scene + Portrait。**故事批准图已经含 Minho，不能再叠一只猫。** 需显式支持故事画面配方，保持本地文案/邮戳渲染，并记录对 ADR-0001 的扩展。
- 唯一内置 Portrait 为 Minho（正式6姿势/开发10姿势）；现有最多3个 CatProfile 仍可存在，故事记录实际 travelerCatId，不把多个姿势误作多套猫。
- `apps/web/src/App.svelte` 目前相册只有明信片/纪念品，无故事小辑和尾页。

## 素材与生产接入

选定来源：

- `docs/art/candidates/cinematic-v6/night-watch-stargazing/selected-four-act-v01/`
- `docs/art/candidates/cinematic-v6/mist-harbor-returning-boats/selected-four-act-v01/`

用户批准已冻结2043个媒体路径条目的 SHA-256，包括当前树与旧工作树；83张外部引用源图已保全，44张此前独有的源图在 `docs/art/archive/approved-source-snapshot-2026-09-29/`。

批准不代表已经完成尺寸归一、生产配方、PWA缓存和构建接线。使用准确批准字节，派生新文件但不覆盖母版。不要继续把旧 README 的待审批断言当当前阻塞，也不要假写不存在的第三方许可或真实服务验证。

现有 production gate 有技术债：`scripts/promote-landmarks.mjs` 仍偏向/硬编码 non-shipping；Vite/发布脚本校验权利指纹和 shipping 字段，不能全仓把 false 改 true。按执行规格完成正式 promotion，并保留未选素材隔离。

## 从这里继续执行

1. 读取规格、检查 main 状态；形成窄的故事模型和接口改动，更新必要的领域/ADR记录。无需重新 grill 已确认范围。
2. 实现故事目录、出发规划、重复/并发控制和 v4迁移。
3. 接入四幕定时揭晓、离线追赶、相册记录、尾页与返程幂等结算。
4. 实现相册小故事入口、顺序回看和已揭晓单卡保存，避免提前泄露后续画面。
5. 接入选定正式素材、生产构建与PWA缓存，确保免费本地版本没有云/生成/支付入口和请求，完善本地备份说明。
6. 跑有针对性的核心测试、check、Web生产构建；必要时检查跨workspace契约兼容。完成呈现/离线/安装所需的浏览器与真机验收，不以单测替代。
7. 主干提交/推送后核查 CI/E2E，再推进可审查的正式发行包。实际域名/托管、必要发行材料或真实设备缺失时，说明具体缺口；先完成不依赖它们的工作。

## 验证基线，不要扩大结论

- 收敛后本地：check通过；47个Vitest文件335用例＋24个脚本测试，共359项通过；Web与weapp构建通过。
- 最新规格基线 `feef7e6` 的远端 CI：成功，https://github.com/CCharlesMeng/BraveCat/actions/runs/36530699881 。
- 同SHA的 E2E：成功，https://github.com/CCharlesMeng/BraveCat/actions/runs/36530699896 。
- 当时生产构建明确排除地标，包含6个正式形象姿势；成功不代表最新开发美术已在正式包里。
- 新故事功能尚无实现或测试证据；移动真机、正式部署未完成。云模型/支付/短信/真实Postgres联调未执行且已后置。
- 本交接文档为文档变更，不需要为它重复整套测试；后续按实际代码改动验证。
