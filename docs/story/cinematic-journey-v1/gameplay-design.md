# 《最后一束光》在 BraveCat 中的玩法设计

- 系列 ID：`last-light`
- 状态：玩法设计；不承诺实现
- 依赖正典：`series-bible.md` 与 `chapters/chapter-01.json` 至 `chapter-10.json`
- 约束：不修改运行时代码，不进入 landmark Catalog，不生成或批准发布素材

## 结论

《最后一束光》最适合同时成为：

1. **一次较长的自主 Trip**：Cat 出发后沿固定的人类主线走完十章；玩家不能选章、催更、跳过或替它决定路线。
2. **一个 Album Collection**：十次“章节来信”各包含五张有序 Postcard，最终形成 50 张静态 Scene 的连续小辑。

它不应成为可从菜单直接启动的电影播放器、50 个关卡、一个伪装成真实地点的 Destination，也不应拆成十次由玩家逐章点击开始的 Trip。阿遥和周岸负责找胶片、修设备、判断风险、询问保管者并决定最终放映；Cat 只沿光线和安全 Perch 出现在画面里。玩家表达关心，但不指挥 Cat。

“50 Scene”在 BraveCat 里明确指 **50 张离线合成的静态 Postcard Scene**，不是 50 段视频。章节 JSON 中的时长、动作组、对白和声音是美术选帧与 recap 的作者资料；v1 不播放对白、动画或音轨。每个 Scene 只选择一个能代表该 `plotBeat` 的原创静态关键帧。

## 与现有 BraveCat 的契合点

可以直接保留的产品与架构原则：

- Pack 非空后只安排出发时刻，Cat 到时才原子生成完整 Trip。
- Wish 只强引导，不是命令；未命中不应形成损失。
- `PlanTrip` 一次冻结完整计划，刷新、离线重开和 Catalog 修订都不能重抽。
- Postcard 继续由 Cat-free Scene master、已批准 Portrait、构图位和短文案离线合成。
- Postcard 按 `revealAt` 幂等寄达，Album 全家共享。
- 本地优先、IndexedDB 保存、可导入导出。

现状不能仅靠追加 50 条素材完成，原因是：

- 普通 Itinerary 只有一个 Destination、1–2 个 Postcard slot 和最长 24 小时的默认节奏；本系列跨十处虚构地点。
- Selection 只在单一目的地内随机取 Scene，不能表达 50 个固定 story slot。
- Postcard 没有 Collection、chapter、ordinal、delivery packet、recap、clue 或 narrative alt 元数据。
- Album 目前只是收到时间顺序的平铺列表。
- `TripContent.souvenirIds` 已存在，但当前 Selection 永远返回空数组，返程结算也未完成。
- Travel 到 `returned` 后不会结算并回到 `home`；这是任何完整旅程的前置缺口。
- `CONTEXT.md` 仍把 Scene 定义为真实世界地标。本系列全部是原创虚构地点，不能混入现有 Destination 或 landmark Catalog。

## 玩家体验契约

### Cat 是光的见证者

Cat 是玩家与系列之间持续存在的情感视点，但不是人类剧情的发动机：

- 可以：坐、睡、走、吃、玩、眺望；被人物顺手擦干 Perch、放一小碟水或让出安全位置。
- 不可以：找出胶片、钥匙、布结、蜡筒或路线；搬运证物；示警；带路；按开关；判断天气；解决机械故障；让人物改变决定。
- 画面可以让 Cat 成为前景生活锚点，但 recap 必须把因果明确归给阿遥、周岸和当地保管者。
- Cat 不进入第十卷的最终影像，不成为社区行动的中心，也不取代人群完成结局。

这会扩展当前“Cat 始终是叙事主角”的领域表述：Cat 仍是玩家面对的旅行主角和情感主角，但阿遥、周岸承担本系列的因果主线。若玩法保留，应先记录这项领域决定，而不是把两位固定人物误归为 Ambient Life。

### 玩家关心，但不控制

玩家只做三件事：

1. 看见一条可能的长途路线。
2. 把无字的旅程引导物放进 Pack，表达“如果你想去，我替你准备好了”。
3. 等 Cat 自己决定出发，并阅读寄回来的内容。

玩家不能选择阿遥或周岸的行动，不能选下一站，不能在章节之间作分支决定，也不能用 Treat、广告、付费或连续点击缩短等待。

## 小而完整的玩法循环

### 1. 发现

玩家完成第三次普通 Trip 后，Album 自动多出一张不计稀有度的“无字旧票角”。出现条件只检查已结算的普通 Trip 数，幂等且不依赖某张随机 Postcard。

Album 文案：

> 相册夹页里多了一张没有地址的旧票角。光照过去时，能看见一道很浅的折痕。

它同时解锁一个免费的 Journey Hint。它不在 Shop 售卖、不消耗 Treat、不设活动期限，也不暗示任何现有电影。

### 2. 表达关心

玩家可把 Journey Hint 放入 Pack。界面在放入前明确提示：

> 这可能是一段比平常更久的旅行。小猫会自己决定要不要沿着它走。

清空 Pack 仍按现有规则取消尚未发生的出发安排；保持 Pack 非空时修改其他物品不重抽出发时刻。

### 3. 自主解锁路线

第一次携带 Journey Hint 到达出发时刻时：

- 80%：进入《最后一束光》。
- 15%：Cat 先走一次同类但不属于系列的普通 detour Trip。
- 5%：Cat 去完全意外的普通地点。

两种未命中都不是失败：Journey Hint 原样回家，Collection 保持 `available`，且下一次携带它的出发必定进入系列。玩家看不到概率或“保底”术语，只会看到：

> 它先绕去了别处。那张旧票角还在相册里。

这样保留 Wish 的“不保证”，同时把随机等待上限限制为一次。若正式研究发现一次 miss 已损害信任，直接改为首次必定命中；不能用更多奖励补偿挫败。

### 4. 原子规划一次长 Trip

路线命中时，一次性冻结：

- `last-light-v1` 的 50 个 canonical story slot；
- 十个章节 delivery packet；
- 所有 Scene、Portrait、构图、文案、alt、recap 与版本引用；
- 至多两个章节边界 detour；
- 返程时的 Souvenir；
- 完整 `revealAt` 和 `returnsAt`。

推荐生产节奏为五天：十个 packet 约每十二小时一封，分别位于 Trip 进度的 8%、18%、28%、38%、48%、58%、68%、78%、88% 和 94%，100% 时返家。具体时长是可配置节奏，不是内容字段；测试构建可以加速，但不得提供玩家加速按钮。

### 5. 章节来信

每个 packet 一次寄到五张 Postcard：

- 一个通知、一个未读 packet badge，不连续弹出五次。
- 五张按 `chapterNumber`、`sceneNumber` 固定顺序进入 Album。
- 玩家打开 packet 后可以逐张翻阅，也可以退出后再看。
- 是否阅读不影响下一 packet、返程或故事进度。

若玩家离线跨过多个 `revealAt`，应用在下次打开时按章节顺序补寄；Album 先显示最早未读 packet，不把 20–50 张卡一次性动画铺满屏幕。

### 6. Recap 与可选旁注

每章第五张寄达后，Album 自动出现 1–2 句第三人称 recap。Recap 说明阿遥与周岸做了什么，绝不把因果归给 Cat，也不要求玩家找齐 clue。

例：

> 阿遥和周岸在旧站确认了第二卷的来处。谭伯记得那场为误车旅客多放的电影，也把通往雾港的旧路交给了他们。

每章另有一条可选“旁注”，从已到达 Postcard 的背面明确进入。它不是像素级隐藏物，也没有倒计时、错误答案或全收集奖励。

### 7. 返家与 Souvenir

第十个 packet 寄达后，Cat 仍按已冻结的 `returnsAt` 返家。只有完成返程结算后才：

- 把 Travel 从 `returned` 结算回 `home`；
- 归还未消耗的普通 Pack 物品；
- 将三个非关键、低价值纪念物收进 Album：
  - 帆具阁楼赠送的干净帆布边角；
  - 红土停车带旁的一块风磨小石；
  - 最终拆台时社区赠送的象牙色银幕修补布。

这些物件必须明确是赠予、边角料或普通松散物，不得是钥匙、罗盘、镜头、胶片、布结、蜡筒、档案材料或其他剧情证物。它们不兑换 Treat、不解锁结局，也不形成稀有度。

### 8. Replay 与 variation

v1 的完整 replay 是 Album 内的“从头翻阅”：按 1–50 逐张阅读，可以按章跳转，但不会命令 Cat 再出发。

首版不要求再次跑完整五天 Trip。若后续保留旅行 variation：

- Journey Hint 仍只是强引导，不能选择指定章节或指定 Scene。
- canonical 1–50 顺序、recap 事实与结局不变。
- 只允许变化章节边界 detour、适配 Perch 的已批准 pose、天气微差和不改变事实的短文案。
- alternate print 叠在同一 story slot 后面，不覆盖首次收到的 recipe。
- 不重复发 Souvenir，不用 variation 填 Collection 完成度，也不设置另一结局。

## Scene 顺序与自主 detour

### 固定正典顺序

以 `series-bible.md` 为叙事正典，运行时顺序严格为：

1. `c01-s01`…`c01-s05`：尘埃与光束——旧影院、第一卷与透明第十卷建立旅程。
2. `c02-s01`…`c02-s05`：午夜后的汽笛——人类口述、物证和安全试映把路线送向雾港。
3. `c03-s01`…`c03-s05`：雾中钟声——潮汐协作取回第三卷，共同观看指向红土公路。
4. `c04-s01`…`c04-s05`：风掠银幕——故障、风沙和当地帮助让放映装置重新服务于人。
5. `c05-s01`…`c05-s05`：瓦上雨声——茶舍的等待与补映把“回到观众面前”变成承诺。
6. `c06-s01`…`c06-s05`：黎明前的信号——可测量的曝光时序确认第十卷的空白是有意保留。
7. `c07-s01`…`c07-s05`：缺失的一拍——舞厅用共同等待补回现场节奏，而不是伪造一首歌。
8. `c08-s01`…`c08-s05`：风暴胶片——众人遵守潮汐、电气和材料安全流程取回第八卷。
9. `c09-s01`…`c09-s05`：城市记得——档案和旧观众证词说明九卷拍的是聚到光前的人。
10. `c10-s01`…`c10-s05`：最后一束光——社区尊重危房限制，在户外共同完成最后一次观看。

ordinal 只由 `(chapterNumber - 1) * 5 + sceneNumber` 得出。任何 Catalog 迭代都不能插入、删除或重编号已有 v1 slot；新版本必须使用新的 `storyVersion`。

### Detour 只能插在章与章之间

一个 active plan 最多预选两个 detour，且：

- 只能位于一个完整 packet 之后、下一个 packet 之前；
- 不能连续出现；
- 只发送一张不带 Collection ordinal 的普通 Postcard；
- 不包含新线索、人物决定或 Souvenir；
- 不改变 50 张正典顺序、章节 recap 或返家结果；
- 由出发时的 seed 一次冻结，刷新不能重抽。

Detour 表达 Cat 偶尔去附近安全 Perch 看雨、闻食物或睡一会儿。它不是支线任务，也不能让 Cat 错过阿遥和周岸的关键决定。

## Story recap 与旁注目录

十章核心 recap 无论 clue 是否查看都完整可懂。可选旁注只补充物理与关系细节：

1. 旧钥匙只开第一章的门，不是后续通行证；第十卷从开场就在场。
2. 打孔旧票与胶片边孔的节奏由阿遥、周岸和谭伯共同验证。
3. 短尾布结只承载某个人的日常系法，不是秘密组织符号。
4. 长焦镜头经保管人授权和周岸测量后才被带走。
5. 三色布结是遮雨棚余料和实用路标，不是信物。
6. 星轨弧长记录曝光时间；观测站没有收到外星讯号。
7. 无字蜡筒留在舞厅，修复的是现场等待，不是遗失歌曲。
8. 深海蓝布结的运输罐由多人按防洪流程取出，Cat 没有进入湿区。
9. 捐赠记录与旧观众证词把路线闭合，第十卷的留白不是材料短缺。
10. 最终场地、拍摄边界和不入镜区由社区共同确认。

旁注入口使用明确按钮“看这张背面的旁注”，支持键盘与屏幕阅读器。不要要求玩家在远景中点中胶片孔、布结或 Cat。

## Cat Framing 与 v5 美术约束

沿用 landmark v5 的构图语言，但建立独立 cinematic 资产包，绝不修改或继承 v5 landmark active set。

每张源 Scene 必须：

- 1200×900、4:3、8-bit opaque RGB、sRGB；运行时再生成版本化 WebP derivative。
- Cat-free，但可以包含阿遥、周岸、林灯的原始投影和当地人物。
- 使用 normalized top-left 坐标和 Portrait full-canvas 的 bottom-center anchor。
- 提供 `compositionSlot`、`safeBounds`、`placementIntent`、`narrativeAlt`、人物遮挡检查和实际 approved Portrait placement preview。
- 不依赖 foreground occlusion mask；完整 Portrait 必须可见并落在真实 Perch 上。
- 通过 physical support、access plausibility、pose fit、clear silhouette、全身入画、无人物/车/栏杆/电缆/硬阴影重叠检查。
- 让 Ambient Life 按真实动线自然分组，变化深度、方向、尺度与动作；阿遥和周岸是 Story Figures，不算 Ambient Life。

景别使用 v5 量化带：

- foreground：Portrait height scale `0.18–0.28`。只用于安静停顿，让 Cat 在画面边缘提供生活尺度，不能挡住人物手部劳动、胶片、光路或关键表情。
- midground：`0.10–0.17`。默认的陪伴景别，让 Cat 与人类行动同处空间但不成为解释者。
- distant：`0.055–0.095`。关键决定、天气、地点和社区群像承担主要戏剧重量；Cat 保持可辨轮廓，不用聚光、描边或人为留白框。

正典目标按 series bible 为 foreground 9、midground 21、distant 20。当前十章 JSON 的标签合计为 foreground 5、midground 20、distant 25，且多处 distant scale 低于 v5 下限；这不是可忽略的文案差异，必须在生成素材前重新分配并通过 exact-set review。

当前内容还需统一：

- `chapter-01.json` 使用 `2.39:1`，其余生产约束与 v5 使用 4:3；运行时采用 4:3，不加黑边。
- Chapter 1 使用 `loaf`，部分章节把动作描述直接放入 `pose`；全部必须归一到现有 `sit`、`sleep`、`walk`、`eat`、`play`、`gaze`，不为本系列扩张 Portrait pose 集。
- 每个 foreground/midground/distant 标签必须与实际 scale 带一致，不能只改标签。
- 角色、车辆、银幕和片盒需做 50 Scene 连续性 QA；Scene master 仍只把玩家 Cat 留给运行时合成。

候选资产必须经历独立的 cinematic candidate manifest、hash、机器 QA、实际 Minho placement sheet、人物连续性审核、原创性/相似性盲测、权利审核、最终 composite 审核和明确 shipping approval。任何 landmark v5 批准都不批准本系列。

## 内容正典的待决冲突

玩法可以先设计，但内容包不能在以下冲突关闭前冻结：

- `series-bible.md` 明确第十卷是已冲洗的透明片基，不得再曝光、刻画或补拍；最终让它通过投影机形成纯光。
- 当前 `chapter-10.json` 把第十卷写成未曝光原片，并在清晨装入摄影机拍摄观众影子。

两者会改变第 50 张 Postcard、最终 recap、旁注和资产。因为 series bible 标记为“叙事与视觉正典”，本设计默认 **bible 优先**：第十卷保持透明并用于现场纯光，不记录或占有观众影子；Chapter 10 在进入 Catalog 前必须与之统一。玩法 Module 不应为两套结局增加分支。

工作标题也仍未清权。标题、人物、地点、对白、视觉、声音和营销渠道未通过 `rights-and-originality.md` 的门禁前，整个 Collection 必须保持 non-shipping。

## 状态模型

可持久化的 Journey 状态只保存不能从 Trip 和 Postcard 推导的事实：

```ts
type JourneyPhase = 'locked' | 'available' | 'active' | 'complete'

interface JourneyStateV1 {
  version: 1
  journeyId: 'last-light'
  storyVersion: 'v1'
  phase: JourneyPhase
  witnessCatId?: CatId
  unlockedAt?: number
  boundedMissUsed: boolean
  activeTripId?: TripId
  notedClueIds: readonly string[]
  recapReadThroughChapter: number
  completedAt?: number
  seenVariationIds: readonly string[]
}
```

不另存一个可漂移的 `receivedSceneCount`。已收到 ordinal 从 `PostcardState.received` 中的 immutable Collection reference 推导；已拥有 Souvenir 从 Album 的 Souvenir 集合推导。

长 Trip 的冻结快照概念上包含：

```ts
interface JourneyPlanSnapshot {
  planVersion: 1
  journeyId: string
  storyVersion: string
  travelerCatId: CatId
  chapterDeliveries: readonly ChapterDeliverySnapshot[] // exactly 10
  detours: readonly DetourSnapshot[]                     // 0..2
  souvenirIds: readonly SouvenirId[]
  returnsAt: number
}
```

每张 cinematic `PostcardRecipe` 需要冻结：

- `collectionId`、`storyVersion`、`chapterId`、`chapterNumber`；
- `slotId`、全局 `ordinal`、`deliveryId`、variant ID；
- Scene/Portrait revision、composition、pose、layers 与短文案；
- narrative alt、Cat 的位置说明和 recap beat reference。

Collection package 以 `(collectionId, storyVersion)` 不可变发布。修文、换图或改 recap 必须发布新版本并保留旧包，不能让已规划或已收到的卡改变。

### 状态转换

- `locked → available`：第三次普通 Trip 结算，创建免费 Journey Hint。
- `available → available`：首次携带 Hint 未命中；Hint 返回，`boundedMissUsed = true`。
- `available → active`：路线命中或 bounded miss 后再次携带 Hint；原子保存完整 Journey plan。
- `active → active`：packet 按时间幂等寄达；阅读、clue 和 recap 只增加附属状态。
- `active → complete`：50 个 ordinal 全部收到且 Trip 返程结算；一次性发 Souvenir。
- `complete → complete`：Album replay 或以后收到 alternate print；永不重置首次 Collection。

不存在 `failed`、`expired`、`wrongChoice` 或可回退状态。

## 进度规则

1. 一个 story slot 恰好对应一张 canonical Postcard；50 个 ordinal 必须连续且唯一。
2. Story Postcard ID 使用稳定 `tripId + slotId`，不能使用会因插入 detour 而移动的数组 index。
3. 一个 packet 只有在五张都可交付时才出现；不显示半章。
4. 下一章按时间解锁，不要求前章已读、recap 已读或 clue 已看。
5. 同一 `timePassed`、重开、导入或时钟跳跃可以重复处理，结果必须幂等。
6. 返家必须晚于第十 packet，并在结算前保持 Cat away。
7. 缺失或未通过 shipping gate 的任一 canonical Scene 会使整个 Journey plan 在出发前不可选；不能开始后用随机普通 Scene 填洞。
8. 内容不可用时保留 Hint 与 `available`，不消费物品、不写入半条 active plan。
9. 多猫 Home 中，Collection 绑定第一次命中路线的 `witnessCatId`；其他 Cat 可继续普通 Trip，Album 仍全家共享。
10. 更换 Portrait 不改变 Cat 身份或进度；每张已规划 recipe 继续使用出发时冻结的 Portrait revision。
11. clue、Souvenir、是否找到远景 Cat、是否读完文案都不影响 50 张主线寄达。
12. 没有真实时间截止；玩家几个月后打开也只做有序 catch-up。

## 最小 deep Module、Interface 与 seam

### Module

新增一个内容无关的 `journeys` Module。它隐藏：

- 发现条件与 bounded miss；
- ordinary 与 cinematic plan 的选择；
- 50 slot 校验、章节 packet、detour 和 reveal schedule；
- contiguous progression、幂等结算、Souvenir award；
- replay variation 去重与 Album projection。

### Interface

只暴露一个事件驱动 Interface：

```ts
type AdvanceJourney = (
  state: JourneyStateV1,
  event: JourneyEvent,
  catalog: JourneyCatalog,
) => {
  state: JourneyStateV1
  effects: readonly JourneyEffect[]
}
```

`JourneyEvent` 只需要通用事件：普通 Trip 已结算、即将规划 Trip、Trip 已结算、clue 已查看、Collection 已打开。`JourneyEffect` 只需要通用结果：使用完整 Journey plan、返回 Hint、发 Souvenir、更新 Album projection。随机只在“即将规划 Trip”事件中以已持久化 seed 注入。

Interface 的不变量：

- 同一 state、event、catalog 和 seed 得到同一结果。
- active plan 一旦返回即不可变。
- 所有进度单调，重复事件不重复交付或发奖。
- 规划最多扫描 50 个 slot，图片不进入存档或内存预载。
- 错误只在出发前返回“不可规划”，不产生半个 Trip。

### Seam

外部 seam 放在现有 `PlanTrip` 门面与 Game orchestration 之间：

1. 到达自主出发时刻后，Game 先把通用 `tripPlanning` 事件交给 `journeys`。
2. 若没有 Journey effect，继续调用现有 ordinary `PlanTrip`。
3. 若命中，effect 已包含一个普通 Travel/Postcard 能消费的完整冻结计划。
4. `reducePostcards` 仍只按计划与 Clock 寄达，不认识 `last-light`。
5. Album 只按通用 Collection reference 投影，不认识标题。
6. 返程结算只消费通用 item outcome 与 Souvenir effect，不认识章节。

不要在 `travel`、`selection`、`postcards`、`App.svelte` 或 Album 里出现 `if (journeyId === 'last-light')`。删除 `journeys` Module 后，发现条件、顺序、detour、packet、recap、clue、结算与 replay 的复杂度会重新散落到这些调用方，因此该 Module 有足够 Depth；它不是传递层。

## Core-system changes 与 content-only additions

### 必须是通用 Core-system change

- Travel 返程结算并重新进入 `home`。
- `JourneyId`、`CollectionId`、`StoryVersion` 与 route kind；不能把虚构路线伪装成 `DestinationId`。
- Journey Hint 作为一种通用强引导物，支持 miss 后返回和 bounded continuation。
- 可变时长、多地点、任意数量 story slot 与 chapter delivery packet 的冻结 Trip plan。
- Postcard recipe v2 的可选 Collection/accessibility snapshot；v1 普通 Postcard 保持可读。
- 以稳定 slot ID 交付、packet unread、离线有序 catch-up。
- 通用 Album Collection：封面、章节、recap、旁注、alternate print stack 和 Souvenir projection。
- `GameState` 中的 journeys/Album Souvenir 状态、校验与迁移。
- Postcard 组件的 narrative alt、Cat 位置说明、减少动态与远景定位辅助。
- 内容包 validator：exact 10×5、连续 ordinal、合法 pose、framing band、Perch metadata、revision 与 shipping gate。

### 只应是 content-only catalog addition

- `last-light-v1` 的标题、封面、十章、50 个 slot 与固定顺序。
- 每个 slot 的 Scene asset、story beat、chapter recap、旁注、短文案、alt 和 Cat placement。
- Journey Hint 的图片与文案。
- 最多两个边界 detour 的候选内容。
- 三个 Souvenir 定义。
- 阿遥、周岸、林灯和地方人物的视觉连续性资料。
- Scene master、runtime derivative、hash、provenance、QA、rights 和 approval 记录。
- 原创性盲测资料与渠道放行状态。

未来增加另一套 cinematic series 应只增加后一组 Catalog 记录与素材，不再改 Core。

## Save compatibility

推荐同时把 Save envelope 与 `GameState` 升到 v3：

- `GameState v2 → v3`：增加空的 `journeys` 与 Album Souvenir 状态；所有旧 Travel、Pack、Cat 和 Postcard 原样保留。
- `SaveDocument schema 2 → 3`：使导入的旧导出文件有明确连续迁移；不能只提高 `GameState` 校验而让 schema 2 导入直接失败。
- 原始 IndexedDB load 仍通过 `restoreGameState` 把缺字段补成默认值。
- Recipe parser 同时接受 v1 ordinary recipe 和 v2 recipe；不批量重写旧 Postcard。
- 导入 active Journey 后，从已保存 plan 与当前 Clock 补寄到期 packet，绝不重新调用随机选择。
- 已规划但尚未寄达的 Scene、copy、alt、recap 和 Portrait revision 全部从 plan snapshot 读取。
- 完成态从 50 个 Collection reference 与已结算 trip 验证；状态损坏时宁可保留普通存档并把 Journey 恢复为可重试，也不能删除 Album。
- 未知的未来 storyVersion 不应让普通 GameState 无法打开；保留原始 card snapshot，并在 Collection 页面显示“这套旧小辑暂时只能逐张阅读”。
- 图片不内嵌存档；已发布的版本化 asset path 必须长期保留或由离线迁移表解析。

导出文件继续包含 Cat、Pack、Travel、Album、未读 packet、clue、recap cursor、Souvenir 和完整 active plan。

## Accessibility

- Album 同时提供“章节列表”和“连续翻阅”；50 张卡不能只能横向拖动。
- 所有操作支持键盘、焦点可见、触控目标足够大；章节跳转不是唯一阅读方式。
- 不自动播放连续翻页、闪白、胶片抖动或亮度脉冲；遵守 `prefers-reduced-motion`。
- 每张卡有 authored narrative alt，顺序为：地点/天气、阿遥或周岸的关键动作、Cat 的景别与具体位置。不能只写“某地旅行风景”。
- distant Cat 提供“告诉我小猫在哪里”文本按钮；视觉辅助可短暂显示静态高对比轮廓，但默认不改变原图，也不作为 clue。
- clue 使用明确的背面入口，不使用 hover、颜色差、微小热点或限时观察。
- 光束、布结颜色和未读状态都有文本/形状冗余；不靠红绿或亮暗单独传达。
- 章节 packet 到达不抢焦点，不在屏幕阅读器中连续播报五次；使用一次礼貌 `aria-live` 更新。
- 字号放大到 200% 时，章节标题、ordinal、recap 和按钮不截断；Postcard 可单独放大。
- 若以后加入对白、环境声或音乐，必须有字幕、逐章 transcript、独立音量和完全静音等价体验。v1 建议全部裁掉。
- 低视力用户即使不看见远景 Cat、胶片孔或布结，也能通过 alt 和 recap 获得完整故事。
- 不让五天真实等待成为必须保持应用前台的计时任务；系统时钟只在打开时结算。

## Copy tone

### Postcard 边注

Postcard 文案是 BraveCat 的 para-diegetic 手写边注，不表示 Cat 在人类剧情里开口。规则：

- 12–30 个汉字，一次只写一个当下的声音、温度、光线或安全落脚感。
- 可用“我”，但不能说明 Cat 不可能知道的线索、名字、动机或未来。
- 不写“我找到了”“我带他们去”“我提醒了”“我们完成任务”。
- 不引用对白，不使用电影术语炫耀，不暗示具体作品。

例：

> 雨声很大，我在干燥的长凳上等了一会儿。

> 墙上的光慢慢走过去，他们还在认真收好每一卷。

### Recap

Recap 使用克制第三人称，明确因果：

> 阿遥判断片基仍需缓慢回温，周岸和许澄按防洪流程把运输罐送到干燥台。Cat 一直留在楼上的安全长凳。

### UI

使用“旅程、小辑、来信、绕路、旁注、回家”；避免“任务、关卡、通关、失败、掉落、稀有度、100% 收集、下一集按钮”。完成 copy：

> 五十张来信都到了。它还在回家的路上。

最终 recap：

> 阿遥学会为不能被技术代替的空白留出位置，周岸学会让机器和自己的手艺留在人群之中。Cat 没有替他们找到答案；它只是沿着一束束普通的光走过，把相遇的样子寄回了家。

## Test scenarios

### Route 与自主性

1. 第三次普通 Trip 结算只解锁一次 Journey Hint。
2. Hint 放入 Pack 后仍先安排出发，不能立即启动 Journey。
3. 等待时清空 Pack 取消安排；修改非空 Pack 不重抽时刻。
4. 首次 miss 归还 Hint，不写 active plan；下一次携带 Hint 必定命中。
5. 同一 seed 命中同一 50-slot plan、packet 时间、detour 与 Souvenir。
6. Journey 命中后改变 Pack、重开应用或修订 Catalog 都不改变 plan。
7. 多猫 Home 只让 `witnessCatId` 进入长 Trip，其他 Cat 和共享 Album 正常工作。

### 顺序与寄达

8. Catalog validator 拒绝不是 10×5、ordinal 不连续、重复 slot 或缺 Scene 的系列。
9. 每个 packet 一次增加五张，ID 由 slot ID 稳定生成。
10. Detour 只能在章节边界，不占 ordinal，不改变之后的 Postcard ID。
11. 同一 `timePassed` 重复执行不重复寄卡或未读 packet。
12. 离线跨越三个 packet 后按章节顺序补寄，不自动标为已读。
13. 第十 packet 之前不能 complete，50 张到齐但未返家时仍为 active。
14. 返程结算只发一次三个 Souvenir，并把 Cat 恢复为 home。

### Album、clue 与 replay

15. 五张到齐即显示 recap；五张中的任一张缺失时保持整封“在路上”。
16. 不打开 packet、不读 recap、不看 clue 也能继续寄达并返家。
17. clue 可用键盘和屏幕阅读器打开，重复查看不重复写状态。
18. “从头翻阅”不修改 Travel、received recipe、未读或完成时间。
19. alternate print 追加到已有 slot，不覆盖首次 recipe，不重发 Souvenir。

### Save 与兼容

20. v2 新旧存档迁移到 v3 后普通玩法逐字段保持。
21. recipe v1 与 v2 可在同一 Album 共存。
22. active Journey 导出、导入、跨时钟恢复后不重抽且正确 catch-up。
23. story Catalog 新版本发布后，旧 active/received 卡继续使用 v1 snapshot。
24. 缺少旧 Collection package 时普通存档仍可打开，旧卡仍按冻结图层逐张显示。

### 美术、无障碍与原创性

25. 50 个 pose 全部属于六个已批准 pose；每个 scale 落在其 framing band。
26. exact framing 分布为 9/21/20；每个 Perch 通过支撑、可达、姿势、轮廓和无 occlusion 检查。
27. narrative alt 能说明关键人类动作和 distant Cat 位置，不依赖图像热点。
28. 200% 字号、键盘、屏幕阅读器、reduced motion 和高对比模式完成两章阅读。
29. 无提示测试中，参与者能说明阿遥和周岸如何推进情节，不把 Cat 当成解谜者。
30. 两名独立评审若指出同一具体既有作品及相同识别组合，对应 Scene 必须重构，而不是标记为彩蛋。

## Metrics 与研究问题

默认本地版不上传 analytics。若做研究构建，需明确 opt-in，只记录聚合事件，不记录 Cat 名、导出文件、文案内容、精确地点、永久设备 ID 或可关联身份的时间戳。

可记录：

- Hint 被看见、放入 Pack、首次 miss、Journey 开始。
- packet 到达、首次打开、recap 打开、clue 查看。
- 最大未读 packet backlog、离线 catch-up 数、Collection 完成与 Album replay。
- Souvenir 首次查看和“告诉我小猫在哪里”使用次数。

首轮纵向测试建议成功标准：

- 至少 80% 的参与者认为出发时刻和绕路属于 Cat，而不是自己下达命令。
- 至少 80% 能指出阿遥和周岸是主要决定者，Cat 是同行见证者。
- 至少 80% 不看 clue 也能用 recap 复述每章核心因果。
- 没有人认为 clue、Souvenir、找到 distant Cat 或及时打开 packet 会阻挡进度。
- 至少 75% 认为一封五张比五次单独通知更易阅读。
- median 未读 backlog 不超过两个 packet；若更高，先降低寄达频率，不加入催读奖励。
- 视觉用户能在不使用强制描边的情况下发现大多数 distant Cat；所有用户都能通过 alt/定位按钮知道其位置。
- 两名独立参与者若把同一画面联想到同一具体受保护作品，进入强制 originality review。

核心定性问题：

- 五天 away 是否仍像“惦记”，还是变成长期失去 Cat？
- 50 张静态 Scene 与 recap 是否足以承载人类主线，还是需要删减，而不是加视频系统？
- 玩家会不会寻找“下一章”按钮？若会，copy 和节奏是否误导成任务链？
- 人物剧情是否压过 BraveCat 的陪伴感？若会，优先减人物解释和 packet 频率，不让 Cat 介入因果。

## Scope cuts

首版明确不做：

- 运行时 AI 图片生成、视频、镜头移动、角色动画、配音、音乐或互动对白。
- 玩家选项、分支结局、好感度、谜题、隐藏物点击、QTE、失败状态或重试惩罚。
- 章节选择式出发、跳过等待、付费加速、推送催读、限时活动或赛季。
- 新货币、成就、稀有度、Treat 奖励、排行榜或全 clue 奖杯。
- 真实地标映射、named-film trivia、台词识别、演员 likeness 或“致敬彩蛋”。
- 新 Portrait pose、foreground occlusion mask、自由行走地图、NPC 交互系统。
- 多套 cinematic series 框架、动态下载内容、云存档或跨设备同步。
- 第一次完成后再次跑完整五天 Journey；v1 replay 只在 Album。
- 在 vertical slice 通过前生产全部 50 张最终 Scene。

如果静态关键帧和 recap 无法讲清某个 Scene，应删改该 Scene 的动作密度或 recap，不应以建设通用 cutscene engine 解决。

## 推荐 vertical slice

最小能验证“连续来信”而非单张 novelty 的 slice 是前两章，不是一章：

- 10 个 canonical slot：Chapter 1 与 Chapter 2。
- 两个 packet，各五张；一个固定 seed 的章节边界 detour。
- 一条 miss seed 和一条 hit seed，验证 bounded autonomy。
- 24 小时用户测试节奏；开发测试可压缩到数分钟。
- 每章一个 recap、一个可选旁注；返家时只发“帆布边角”一个 Souvenir。
- 10 张 non-shipping、Cat-free、1200×900 4:3 Scene master，加一张 detour Scene。
- 每张都有 approved Minho exact-placement preview，且 slice 内至少包含一个 foreground、一个 midground 和一个 distant Cat。
- 完成 v2→v3 migration、离线跨 packet catch-up、返程结算和 Album replay。

开始前先修正 Chapter 1 的 2.39:1、`loaf` 和 scale metadata。Slice 不需要最终美术质量，但必须使用真实的 Scene + Portrait 合成与实际 Perch；纯灰框无法回答 distant Cat、人物遮挡和光束可读性。

通过标准：

1. 玩家能复述“旧影院发现 → 雨夜铁路确认下一站”的人类因果。
2. 玩家不认为自己命令了 Cat，也不认为 Cat 找到钥匙、胶片或路线。
3. 两个 packet 的顺序、未读、recap、离线恢复和返家全部幂等。
4. 三种 Cat Framing 都清楚、安全，且不抢阿遥和周岸的动作。
5. 无具体作品识别依赖，title/rights/shipping gate 仍保持关闭。

只有这些成立，才继续制作 Chapter 3–10；否则优先缩短 Collection、降低 packet 频率或删减 Scene，不扩大系统。
