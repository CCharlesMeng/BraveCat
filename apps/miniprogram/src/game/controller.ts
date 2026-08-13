/**
 * GameController 单例接线（对应 web 端 App.svelte 的端口注入段）。
 * 编排逻辑全部在 @bravecat/core；本端只注入 wx storage 存档与
 * 小程序随机源，并安装 CDN AssetResolver。
 */
import { createGameController } from '@bravecat/core'
import { apiBaseUrl } from '../platform/apiBase'
import { installMiniAssetResolver } from '../platform/assetBase'
import { weappRandom } from '../platform/random'
import { createWxStorageSaveStore } from '../platform/saveStore'
import { createMiniCloudSync } from './cloudSync'

installMiniAssetResolver()
weappRandom.refill()

export const controller = createGameController({
  createSaveStore: (options) => {
    const store = createWxStorageSaveStore('bravecat', options)
    if (!apiBaseUrl) return store
    // 云同步接线：本地保存行为不变，落盘成功后另行通知节流推送。
    return {
      ...store,
      save: async (state) => {
        await store.save(state)
        cloudSync?.notifyLocalSaved(() => store.export(state))
      },
    }
  },
  random: weappRandom,
})

// 云同步（feature flag：TARO_APP_API_BASE_URL 非空才启用；默认构建下
// cloudSync 为 null，不发起任何云端请求，行为与纯本地版一致）。
export const cloudSync = apiBaseUrl
  ? createMiniCloudSync({
    baseUrl: apiBaseUrl,
    exportDocument: () => controller.exportDocument(),
    importDocument: (raw) => controller.importDocument(raw),
    hasLocalProgress: () => controller.getSnapshot().game.cats.length > 0,
  })
  : null

let hydration: Promise<{ loadFailed: boolean }> | null = null

/** 启动水合只执行一次；各页面 onShow 都可安全调用。 */
export const hydrateOnce = () => {
  hydration ??= controller.hydrate().then((result) => {
    // 启动同步要等本地水合完成，pull 比较才有正确的本地基准。
    void cloudSync?.start()
    return result
  })
  return hydration
}
