# 更换形象只向未来生效

更换 Portrait 只修改 CatProfile 上的 `portraitId`，不创建新的 Cat，也不重写已经锁定的 Trip 或已经收藏的 Postcard。尚在等待出发的 Cat 会在真正出发、生成不可变旅行计划时读取最新 Portrait；已经出发的 Trip 继续使用出发时冻结在 Postcard 配方里的 Portrait 图层。

这样既保证名字、Pack、旅行状态和全家共享 Album 等进度属于同一只 Cat，也避免素材更新或玩家选择追溯改变已经发生的旅行记忆。

## Consequences

- Home 与下一次新生成的 Postcard 使用新 Portrait。
- 已规划 Trip 和已收藏 Postcard 的场景、Portrait、文案与邮戳快照保持不变。
- Save 只需持久化 CatProfile 的当前 `portraitId`；历史内容仍由已有 Postcard 配方自包含。
- UI 只展示同时存在于 production 目录与当前运行时目录中的已批准 Portrait。
