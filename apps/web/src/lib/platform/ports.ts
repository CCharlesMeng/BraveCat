/**
 * 五个平台端口的 web（浏览器）实现。接口定义见 @bravecat/core/ports。
 */
import {
  configureAssetResolver,
  createBaseUrlAssetResolver,
  type PostcardCanvas,
  type RandomPort,
  type SharePort,
} from '@bravecat/core'
import { assetBaseUrl } from './assetBase'
import { lookupCloudAssetUrl } from './cloudAssetRegistry'
import { Capacitor } from '@capacitor/core'
import {
  nativeSaveTransfer,
  nativeShare,
  type SaveTransferPort,
} from './nativePorts'

/** Clock 端口用 core 默认的 Date.now；SaveStore 用 IndexedDB 实现。 */

export const webRandom: RandomPort = {
  nextUint32: () => {
    const values = new Uint32Array(1)
    crypto.getRandomValues(values)
    return values[0]
  },
}

export const webPostcardCanvas: PostcardCanvas = {
  createCanvas: () => document.createElement('canvas'),
  loadImage: (src) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`无法载入明信片图层：${src}`))
    image.src = src
  }),
}

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const webShare: SharePort = {
  navigator,
  createFile: (bits, fileName, options) => new File(bits, fileName, options),
  download: downloadBlob,
}

/**
 * web 端默认相对根路径；设 VITE_ASSET_BASE_URL 后改走 CDN（见 assetBase.ts）。
 * 云端形象的会话内 blob URL 优先（登记表默认为空，见 cloudAssetRegistry.ts）。
 */
export const installWebAssetResolver = () => {
  const base = createBaseUrlAssetResolver(assetBaseUrl)
  configureAssetResolver({
    resolve: (assetPath) => lookupCloudAssetUrl(assetPath) ?? base.resolve(assetPath),
  })
}

/**
 * 分享/保存端口的接线位：Capacitor 原生壳（apps/mobile）里换用系统
 * 分享面板与文件系统实现，浏览器里仍是 navigator.share + Blob 下载。
 */
export const sharePort: SharePort = Capacitor.isNativePlatform()
  ? nativeShare
  : webShare

/**
 * 存档导出/导入的原生接线位：浏览器里为 null，App.svelte 照旧走
 * 锚点下载 + <input type=file>；原生壳里换成分享面板 + 系统文件选择器。
 */
export const saveTransferPort: SaveTransferPort | null =
  Capacitor.isNativePlatform() ? nativeSaveTransfer : null
