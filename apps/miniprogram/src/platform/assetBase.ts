/**
 * 运行时资产 base URL 注入点（对应 web 端 apps/web/src/lib/platform/assetBase.ts）。
 *
 * 主包不含任何游戏美术图片（小程序主包 2MB 上限）；素材目录记录的
 * 根相对路径（/scenes/… /assets/… /portraits/… /dev-art/…）一律经
 * AssetResolver 前缀本值后从 CDN（或开发期本地静态服务器）加载。
 * 构建期通过 TARO_APP_ASSET_BASE_URL 注入，取值约定见 .env.example。
 */
import {
  configureAssetResolver,
  createBaseUrlAssetResolver,
  resolveAssetUrl,
} from '@bravecat/core'

export const assetBaseUrl: string = process.env.TARO_APP_ASSET_BASE_URL ?? ''

export const installMiniAssetResolver = () => {
  configureAssetResolver(createBaseUrlAssetResolver(assetBaseUrl))
}

/** 模板里直接引用素材目录路径时统一走 AssetResolver（与 web 端同名习惯）。 */
export const asset = resolveAssetUrl
