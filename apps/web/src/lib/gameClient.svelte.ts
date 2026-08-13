/**
 * 把平台无关的 GameController 快照桥接到 Svelte 5 runes。
 * controller 本身不含框架原语；这里持有一个整体替换的 $state.raw
 * 快照，视图经 `client.snapshot` 读取即可获得响应式。
 */
import type { GameController, GameSnapshot } from '@bravecat/core'

export const bridgeGameController = (controller: GameController) => {
  let snapshot = $state.raw<GameSnapshot>(controller.getSnapshot())
  controller.subscribe((next) => {
    snapshot = next
  })
  return {
    get snapshot() {
      return snapshot
    },
  }
}
