# 首屏右墙原型 · 封闭记忆角

日期：2026-08-13。状态：**候选，未批准，不得进入 `public/`**。

## 2026-08-13 标准户型重置

`candidate-v03` 虽然补上了右侧返回墙，但仍把窗户、记忆墙和返回墙切成
三段折墙，形成不合理的异形户型，已否决。

新的 `perspective-control--standard-rectangular-room--v05.png` 只保留正常
矩形房间的两面主墙：

- 窗户与明信片位于同一面连续后墙，共享右灭点。
- 后墙在 `x≈1030` 形成唯一远端内角。
- 右侧墙从该内角朝镜头返回，使用左灭点。
- 不再存在 `x≈660` 的中间凸角或第三面墙。

本轮只审批透视控制图；未据此继续生成水彩底图。

`perspective-control--standard-rectangular-room--v06-wide-right-wall.png`
把远端内角从 `x=1030` 左移到 `x=930`，令右墙从画宽 `14.2%` 增加到
`22.5%`；窗户和六卡整体向左收紧，右墙可完整容纳柜子。当前优先审阅 v06。

并行房间结构方案及共同的猫生活/陈列门槛见
`../2026-08-13-room-variants/README.md`。

## 要回答的问题

怎样让右列明信片自然缩小，同时让右侧明确读成一个封闭的小房间，而不是
继续通向画外的开放走廊？

## 空间定案

现 Home v4 把 `x≈768` 画成远端内凹墙角，因此右侧实际越来越靠近镜头；
它不能承载“右列收小”的陈列。

本候选改变的是房间拓扑，而不只是斜率：

- `x≈660` 是窗龛右侧的近端窗套。
- 记忆墙从这里向右退深，但不再延伸到画外。
- `x≈1030` 是画内可见的**远端内凹墙角**；右侧返回墙从该处朝镜头展开，
  在画面右缘封住房间。
- 水平线：`y=947`。
- 当前水彩候选的记忆墙实测灭点：`(2305,947)`。
- 右侧返回墙使用另一组朝左灭点的方向；墙地交线在远端内角形成 V。
- 水平线上方的同高横边向右下收敛；水平线下方的地脚线向右上收敛。
- 竖线保持竖直。

墙面投影比例为：

```text
scale(x) = (2305 - x) / (2305 - 660)
y(x) = 947 + (yNear - 947) * scale(x)
```

同尺寸明信片按这套投影放置后，右列的宽、高、边框、间距和承托轨会一起
缩小，不再用独立的角度常量制造“假透视”。

## 布局

- 三条薄暖木展示轨，每条两张明信片。
- 两列在墙面上具有相同真实宽度；右列因退深自然缩小。
- 最新明信片从左上近端开始排列。
- `?wallProto=p`：干净布局。
- `?wallProto=g`：同一布局叠加水平线、消失方向和斜率符号。

## 资产

- `perspective-control--background--v02.png` /
  `perspective-control--right-recede--v02.png`：image generation 前使用的
  初始结构控制图。
- `perspective-control--closed-room-background--v04.png` /
  `perspective-control--closed-room--v04.png`：先建立有限记忆墙、画内远端
  内角和右侧返回墙，再据此生成封闭房间。
- `source--interior-right-recede--imagegen-v01.png` /
  `interior-foreground--right-recede--candidate-v01.png`：仅靠文字提示生成的
  第一版，因底图与代码透视没有共享结构约束而被替换。
- `source--interior-right-recede--imagegen-v02.png` /
  `interior-foreground--right-recede--candidate-v02.png`：控制图生成的开放
  右退深版本；因缺少返回墙而被替换。
- `source--interior-right-recede--imagegen-v03.png`：先将封闭房间控制图
  水彩化，再以原 Home 为风格参考精修后的受控源图。
- `interior-foreground--right-recede--candidate-v03.png`：当前候选。按 Home v4
  `1024×1536 → crop(top=62,height=1365) → 1200×1600` 规则规范化，并把
  黑色窗洞恢复为透明。
- `wall-proto--p--mobile-470.png`：布局运行时截图。
- `wall-proto--g--mobile-470.png`：透视原理运行时截图。

生成顺序固定为：**透视控制图 → 控制图水彩化 → 原 Home 风格精修 →
规范化候选 → 叠加同源投影布局**。不得再直接用文字要求模型“向右退深”。

`scripts/measure-wall-perspective-candidate.mjs` 对当前候选的墙地交线拟合为
`-11.6°`、RMSE `0.31 px`，在 `y=947` 推得灭点 `x=2305`。最终布局以这个
水彩落地后的实测灭点为准，而不是继续沿用生成前的理想值。

当前候选只能供本轮方向审批；批准后仍需为正式 Home 图层重建 eat 差分、
Display fixture、遮挡层和正式 manifest。
