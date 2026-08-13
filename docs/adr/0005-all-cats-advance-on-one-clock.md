# 所有小猫由同一个 Clock 批量推进

Home 最多包含三只 Cat。Treat 与 Album 属于全家；Pack 与 Trip 以 Cat ID 隔离。`activeCatId` 只表示 Home 当前查看和准备行囊的 Cat，不代表只有它在运行。

每次 Clock 推进时，应用先为所有 Cat 推进各自的等待或旅行状态，再通过 Game 门面批量揭晓 Postcard、交付 Souvenir、结算 Pack 并处理回家。未被选中的 Cat 不会因为玩家没有切换查看而暂停。

## Consequences

- 多只 Cat 可以同时等待出发或处于 Trip 中。
- 切换当前 Cat 只改变 UI 焦点，经济、旅行与 Album 状态引用保持不变。
- 每只 Cat 必须拥有唯一 ID 与唯一获批准 Portrait；同一 Portrait 不在多只 Cat 间共用。
- 第四只 Cat 会被领域接口拒绝。
- 新增 Cat 的 UI 入口只有在存在另一套未被占用、同时进入 production 与运行时目录的获批准 Portrait 后才开放。
