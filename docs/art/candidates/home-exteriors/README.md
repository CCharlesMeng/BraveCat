# Home Exterior 候选资产

状态：**视觉方向已于 2026-08-13 批准**，批准级别为
`visual-direction-approved`；归档见
`approved-direction-2026-08-13/`。该批准不代表 production-ready，
`runtimeEligible=false`，任何图片仍不得进入 `public/`。

现有技术阻断继续有效：归档图为 2:3（山谷母版另为 `546 × 819`），不符合
正式 `1200 × 1600`（3:4）合同；生成式派生存在像素级漂移；A/B/F 真实窗洞
mask、合成 QA、production RGBA surface mask 与确定性派生流程仍缺失。

## 目标

Home Exterior 是独立于房间 shell、窗框、HomeForm 和 Home Theme preset 的
窗外景层。同一地点使用固定相机和固定地形，只派生时间、天气及表面响应；
不得为 A/B/F 等不同窗洞分别缩放、平移或重画。

时间和天气不作为新地点。运行时目标是：

- 4 个时间底图：`dawn`、`noon`、`dusk`、`deep-night`
- 共享天气 atmosphere：雨丝、雾纹理、飘雪
- 地点专属 weather response：湿润、风响应、积雪
- 地点专属 RGBA surface mask

这样避免产出地点 × 时间 × 天气的完整组合图。

## 视差与视角预留（2026-08-13 增补）

用户决议：Exterior 是可按视角重新定位的独立图层，后期可能加入陀螺仪
视差/视角切换。因此：

- 母版仍注册在 Home 的 1200×1600 房间画布坐标上（分层合成的对位基准
  不变），但真正的规格要求是**在任意视差偏移下盖满窗洞**，而不是
  "等于画布尺寸"。
- 按 A/B/F 控制图（`../home-theme-prototypes/2026-08-13/form-controls/`）
  计算，三套窗洞并集约为 x 40–655、y 166–939；按视差行程 ±60px 预留，
  母版关键内容之外还须有 ≥60px 安全出血。
- 构图约束：地点锚定物（山口、防波堤、天际线、芦岛等）不得贴近窗洞
  边缘，须在行程两端仍完整可读；跨窗型合成 QA 必须在视差行程两端
  （±60px）各验一次，而不只验静止位。
- 视差本身是运行时渲染层行为（exterior 层放大 + 偏移），不改变画布
  合同、form 几何与存档结构。

## 候选目录

```text
home-exteriors/
  README.md
  catalog.candidate.v01.json
  shared/v01/
    weather-atmospheres/
  scenes/<scene-id>/v01/
    manifest.candidate.v01.json
    scene-master/
    time-grades/
    weather-atmospheres/
    surface-masks/
    continuity-qa/
```

当前图片仍位于 Cursor 会话候选暂存区。完成命名、尺寸、连续性和跨窗型审核
后，才复制到上述目录；不在清点阶段伪造 manifest 或把暂存路径写入运行时。

## 地点清单与母版进度

以下 10 个地点均已有正午清朗 scene master，但本轮实测并非正式规格：
山谷草地为 `546 × 819`，其余 9 张为 `1024 × 1536`，全部是 2:3。正式
Exterior 继承 Home 的 `1200 × 1600` 画布合同，即 3:4；当前 2:3 图片只可
用于构图、色彩和天气方向审阅，不得直接晋升。

1. `ext-valley-meadow`｜山谷草地
2. `ext-riverbend-embankment`｜江湾堤岸
3. `ext-quiet-sea-bay`｜静海湾礁岸
4. `ext-neighborhood-rooftops`｜邻里屋顶
5. `ext-metropolitan-highrise`｜大都会高楼
6. `ext-cedar-creek`｜杉林溪谷
7. `ext-reed-lake`｜湖畔芦荡
8. `ext-orchard-slope`｜果园缓坡
9. `ext-irrigated-fields`｜田野水渠
10. `ext-garden-greenhouse`｜邻里庭园温室

### 2026-08-13 母版单图审阅

以下结论只针对无遮罩整图。当前没有 A/B/F 真实窗洞 mask，不能代替跨窗型
裁切或合成 QA：

1. `ext-valley-meadow`：V 形山口、草甸通道和左右树丛辨识明确，构图稳定；
   但绿色和受光草地比江海组更明亮偏黄，且 `546 × 819` 与其余母版分辨率
   不一致。建议保留概念、暂停继续派生，先统一尺寸与色彩基线。
2. `ext-riverbend-embankment`：弯曲近岸、宽江横带、对岸堤岸与民居形成
   强辨识；v02 高机位明显优于旧版，低饱和也与系列相符。水面留白适合天气
   表现，但对岸小屋和两侧前景枝叶容易在窄窗洞中丢失。建议优先保留，
   等真实 mask 验证安全裁切。
3. `ext-quiet-sea-bay`：左侧山岸、水平海平线、右侧防波堤和近岸岩石构成
   唯一轮廓；v02 高机位方向成立，色彩克制。大面积水面利于气氛变化，但
   防波堤靠右、海平线必须严格注册。建议优先保留，等待 mask 与注册差分。
4. `ext-neighborhood-rooftops`：阶梯屋顶和烟囱辨识清楚，暖屋瓦仍在系列
   饱和度容限内；天空占比偏大，主要地点信息集中在下半部，窄窗可能只剩
   天空或切断主屋顶。建议暂缓派生，先做真实窗洞裁切判断。
5. `ext-metropolitan-highrise`：高楼天际线、退台和水塔形成最强城市辨识；
   建筑密度、边缘对比和暖灰立面比自然场景更重，细小窗格又是最容易发生
   生成漂移的部位。建议保留为概念母版，只做代表性夜雨验证。
6. `ext-cedar-creek`：双树干、中央溪流和远山纵深辨识强，派生锚点充分；
   整体橄榄棕较重，两根树干贴近左右边界，跨窗裁切可能破坏框景。建议保留，
   后续先验证裁切再统一色调。
7. `ext-reed-lake`：中央芦苇岛与倒影可辨识，但上半部空天占比过高，地点
   锚点单一且集中；任一窗格遮住芦岛后容易退化为泛化湖面。建议母版重构
   或证明所有目标 mask 都保留芦岛后再派生。
8. `ext-orchard-slope`：果树行列、石墙和坡顶小屋能说明果园，低饱和基本
   一致；左侧近树遮挡强，小屋过小，跨窗后可能只剩普通绿坡。建议暂缓派生，
   先用真实 mask 判断是否需要强化地点锚点。
9. `ext-irrigated-fields`：中央水渠、田垄和远处农舍的透视辨识最稳，适合
   做雨、雾及水面响应；稻田黄绿比江海组偏亮。建议保留，后续做统一色级
   与真实窗洞验证。
10. `ext-garden-greenhouse`：温室、木桶、花床和右侧棚架地点辨识充分；
    近景细节和结构较多，温室与棚架分别靠近两侧，窄窗可能只截到半个主体。
    建议保留概念但暂停派生，先验证窗洞构图。

本轮建议不是淘汰地点，而是分流：江湾、海湾、杉林溪谷、田野水渠和
大都会高楼可继续概念验证；山谷、邻里屋顶、湖畔芦荡、果园缓坡和庭园温室
先解决尺寸、色级或窗洞构图证据。未通过者保留归档，不删除旧文件。

## 暂存源文件

这些绝对路径仅用于本地候选清点，不得写入 runtime manifest：

```text
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-exterior--noon-1200--v02.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-riverbend-embankment--master--noon-clear--candidate-v02.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-quiet-sea-bay--master--noon-clear--candidate-v02.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-neighborhood-rooftops--noon-clear--scene-master--v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-metropolitan-highrise--noon-clear--scene-master--v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-cedar-creek--master--noon-clear--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-reed-lake--master--noon-clear--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-orchard-slope--master--noon-clear--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-irrigated-fields--master--noon-clear--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-garden-greenhouse--master--noon-clear--candidate-v01.png
```

江湾与海湾 v02 使用更高机位和轻微俯视，替代各自 v01 作为当前母版候选；
旧版保留用于比较，不进入后续派生。

山谷草地另有一组时间与天气实验候选：

```text
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-exterior--early-morning-0630--v02.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-exterior--dusk-1830--v02.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-exterior--late-night-2300--v02.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-exterior--light-rain--v02.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-exterior--morning-fog--v02.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-exterior--first-snow--v02.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/bravecat-home-exterior--windy-overcast--v02.png
```

生成式精修仍可能产生像素级漂移，因此这些实验图不能仅凭肉眼描述晋升。
进入候选 bundle 前必须做注册点差分和 A/B/F 窗洞合成 QA。

## 2026-08-13 新增优先切片

本轮以江湾 v02、海湾 v02 为 reference 生成了 14 张气氛概念候选，并为
大都会高楼补充 2 张代表性验证。所有新增图实测均为 `1024 × 1536`（2:3）；
没有覆盖旧文件，也没有创建 runtime manifest。

### 江湾堤岸 v01 派生

```text
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-riverbend-embankment--time--dawn--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-riverbend-embankment--time--dusk--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-riverbend-embankment--time--deep-night--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-riverbend-embankment--weather-response--light-rain--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-riverbend-embankment--weather-response--morning-fog--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-riverbend-embankment--weather-response--first-snow--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-riverbend-embankment--weather-response--overcast-wind--candidate-v01.png
```

### 静海湾 v01 派生

```text
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-quiet-sea-bay--time--dawn--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-quiet-sea-bay--time--dusk--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-quiet-sea-bay--time--deep-night--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-quiet-sea-bay--weather-response--light-rain--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-quiet-sea-bay--weather-response--morning-fog--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-quiet-sea-bay--weather-response--first-snow--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-quiet-sea-bay--weather-response--overcast-wind--candidate-v01.png
```

### 大都会高楼 v01 代表性派生

```text
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-metropolitan-highrise--time--deep-night--candidate-v01.png
/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets/ext-metropolitan-highrise--weather-response--light-rain--candidate-v01.png
```

## 派生视觉 QA

### 证据边界

- 本轮生成采用 reference conditioning，不是对母版执行确定性的像素级调色或
  合成。肉眼可检查宏观相机与轮廓，但水彩纹理、枝叶、石块、窗格和水纹均有
  重新采样迹象。
- 因此 16 张新增图统一标记为：**概念候选，不可交叉淡入，不可
  production-ready**。尚未通过注册点差分、像素误差阈值或 source hash
  绑定。
- 当前没有 A/B/F 窗洞 mask，也没有窗洞合成结果；本轮没有、也不得声称
  通过跨窗型 QA。
- 所有新增图延续母版的 2:3，而不是文档原先声称的 3:4。尺寸门未通过。

### 江湾逐张检查

- `dawn`：江弯、两岸线、堤岸、地平线和小屋群在宏观位置上保持；对岸树冠、
  小屋细节、云和卵石纹理被重绘。保留为色彩方向概念。
- `dusk`：宏观轮廓保持，暮色低饱和方向成立；对岸植被与水纹重新采样。
  保留为色彩方向概念。
- `deep-night`：宏观轮廓保持，深蓝夜色可读；前景和远岸细节压暗较多，
  仍需窗洞内可读性测试。保留，不能淡入。
- `light-rain`：岸线与建筑群宏观保持，湿润和细雨方向克制；天空、水纹、
  植被细节重绘。保留为天气方向概念。
- `morning-fog`：近岸保持可读，远岸与小屋被较强雾层遮蔽；遮蔽使地平线
  不能仅靠肉眼完成注册检查。保留但要求降低雾量的 v02 对比。
- `first-snow`：宏观岸线保持，但覆盖范围已接近连续薄雪，不够像“初雪”
  的零散响应。当前 v01 建议停止在概念层，下一版减薄积雪。
- `overcast-wind`：固定地形在宏观上保持，云层和定向水纹表达有效；水面、
  草叶纹理按天气被整体重采样。保留为风响应概念，不能淡入。

### 海湾逐张检查

- `dawn`：海平线、左山岸、防波堤和近岸岩群宏观保持，晨光方向成立；
  山体边缘与岩石细节重绘。保留为色彩方向概念。
- `dusk`：四个地点锚点宏观保持，紫灰暮色与系列相符；山岸、岩石和水纹
  不是像素固定。保留为色彩方向概念。
- `deep-night`：海平线、防波堤与岩岸仍可辨，暗部未完全压死；局部轮廓
  仍有生成式重采样。保留，等待注册和窗洞可读性测试。
- `light-rain`：宏观锚点保持，湿岩和冷灰水面方向成立；雨云偏重、海面
  纹理整体更新。保留概念，下一版可降低云层压迫感。
- `morning-fog`：近岸岩石保持可读，但山岸与海平线被大面积高亮雾吞没，
  无法据此证明固定轮廓。当前 v01 建议淘汰出审批集、保留归档，重做较薄雾
  v02。
- `first-snow`：海面保持液态，岩顶和植被积雪方向合理；岩群与岸草细节
  仍被重绘。保留为初雪概念，不能淡入。
- `overcast-wind`：海平线、山岸、防波堤和岩岸宏观保持，浪向表达最明确；
  海面因场景响应被整体重建。保留为风响应概念，仅用于方向审批。

### 大都会逐张检查

- `deep-night`：天际线、退台和水塔宏观保持，既有窗格中的暖窗方向有效；
  窗格明暗和立面细节发生重采样。建议保留为夜景方向概念。
- `light-rain`：天际线宏观保持，但雨量读感接近中到大雨，且“玻璃湿润”
  不如雨幕本身明确。当前 v01 建议淘汰出审批集、保留归档，下一版降低雨密度
  并强化已有窗面上的克制湿润反射。

## 命名

- Scene ID：`ext-<place>`，全小写 kebab-case
- 候选母版：
  `<scene-id>--master--noon-clear--candidate-vNN.png`
- 时间：
  `<scene-id>--time--<state>--candidate-vNN.png`
- 天气响应：
  `<scene-id>--weather-response--<state>--candidate-vNN.png`
- 表面蒙版：
  `<scene-id>--surface-mask--weather-rgba--candidate-vNN.png`
- QA：
  `<scene-id>--qa--<scope>--candidate-vNN.png`

文件不可覆盖。相机、地形、岸线、建筑或树干拓扑变化时，整个地点 bundle
升版并重新派生。

## 审批门

1. 母版门：地点辨识、低饱和水彩、固定相机及 A/B/F 安全裁切通过。
2. 派生门：时间注册无漂移，雨雾风雪具备正确的场景表面响应。
3. 晋升门：命名、尺寸、透明度、来源、哈希、manifest 和明确签收完整。

下一道审批门依次是：

1. **已完成：**用户于 2026-08-13 批准江湾 v02、海湾 v02 及本批
   Exterior 的地点、构图与气氛视觉方向；正式资产仍须按
   `1200 × 1600`（3:4）重制，不采用生成器输出的 2:3 作为产品规格。
2. 提供真实 A/B/F 窗洞 mask，在同一像素坐标合成 10 张母版；任何窗型不得
   单独缩放、平移或重画。
3. 用户从本轮江海气氛图中只审批色彩与天气方向；`海湾 morning-fog v01`、
   `大都会 light-rain v01` 建议重做，`江湾 first-snow v01` 建议减雪。
4. 获得方向签收后，使用能锁定母版像素的调色、atmosphere、scene response
   和 RGBA mask 流程重制；以注册点差分和阈值报告证明可交叉淡入。
5. 最后才清点 production 资产的尺寸、透明度、来源、哈希和签收，创建
   runtime manifest，并把另行批准的 production 资产晋升到 `public/`。
   本轮仅创建方向归档 manifest，未执行任何 runtime 晋升。
