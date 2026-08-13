/**
 * GameController 单例接线（对应 web 端 App.svelte 的端口注入段）。
 * 编排逻辑全部在 @bravecat/core；本端只注入 wx storage 存档与
 * 小程序随机源，并安装 CDN AssetResolver。
 */
import { createGameController } from '@bravecat/core'
import { installMiniAssetResolver } from '../platform/assetBase'
import { weappRandom } from '../platform/random'
import { createWxStorageSaveStore } from '../platform/saveStore'

installMiniAssetResolver()
weappRandom.refill()

export const controller = createGameController({
  createSaveStore: (options) => createWxStorageSaveStore('bravecat', options),
  random: weappRandom,
})

let hydration: Promise<{ loadFailed: boolean }> | null = null

/** 启动水合只执行一次；各页面 onShow 都可安全调用。 */
export const hydrateOnce = () => {
  hydration ??= controller.hydrate()
  return hydration
}
