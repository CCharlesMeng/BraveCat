# 家的美术按 form/finish/piece 分层出资产，不再新增整图背景变体

Home v4 时期的模式是给 `interior-foreground` 追加整图变体（如吃饭
变体），任何可变细节都要重画全屋。改为三层出资产：HomeForm 冻结
几何事实（画布、透视、socket、锚点、猫落位），HomeFinish 携带连续
表面（shell、窗外时间层、室内 lighting），HomePiece 是装入类型化
socket 的整幅透明 PNG，前景遮挡属于具体部件而非全屋。

坐标一律实测自已验收的美术候选并冻结进 form 数据（灭点收敛等不变量
由测试锁定），不手工调整单点。迁移期允许部件本体暂时烘焙在 shell 里
（piece 只承担遮挡层），但欠账必须记录在候选目录 README，拆出后
shell 换成干净底。

## Consequences

- 禁止新增 `interior-foreground-*` 式整图变体；换细节 = 换部件资产，
  换氛围 = 换 finish 资产。
- 全屋通用遮挡图退役；遮挡层随部件出图，部件被替换时遮挡一起替换。
- 每个新 form/finish 候选合入前必须过几何测量（measure/QA 脚本），
  测量值与 form 数据一致才可冻结。
- `shippingEligible` 按 form/finish/piece 粒度放行，生产环境按此过滤
  玩家可选项；未放行内容只进 `public/dev-art/`，不进 `public/assets/`。
- 从整图差分抠出的迁移期部件（自带阴影与背景残影）只限原 form 原
  位置使用，跨 form 复用必须重新出干净资产。
