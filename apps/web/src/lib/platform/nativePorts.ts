/**
 * SharePort 与存档导出/导入端口的 Capacitor 原生实现（iOS/Android 壳，apps/mobile）。
 *
 * - 分享：明信片 PNG 先写入应用缓存目录，再交给系统分享面板
 *   （@capacitor/share）；分享面板里自带「存储图像（存入相册）」入口。
 * - 「下载」：web 端的 Blob 下载在原生端落为写入应用 Documents 目录
 *   （@capacitor/filesystem）；iOS 已开 UIFileSharingEnabled，文件 App 可见。
 * - 存档导出：JSON 写入缓存后同样走系统分享面板（可存文件 App / 隔空投送）；
 *   存档导入：系统文件选择器（@capawesome/capacitor-file-picker）读取 JSON，
 *   校验与迁移仍走 core 的 SaveStore.import。
 *
 * 仅在 Capacitor.isNativePlatform() 时被接线，见 ports.ts 的
 * sharePort / saveTransferPort。
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { FilePicker } from '@capawesome/capacitor-file-picker'
import type { SharePort } from '@bravecat/core'

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result as string
    resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
  }
  reader.onerror = () => {
    reject(reader.error ?? new Error('无法读取明信片图片数据'))
  }
  reader.readAsDataURL(blob)
})

const writeBlobFile = async (
  blob: Blob,
  fileName: string,
  directory: Directory,
) => {
  const result = await Filesystem.writeFile({
    path: fileName,
    data: await blobToBase64(blob),
    directory,
  })
  return result.uri
}

export const nativeShare: SharePort = {
  navigator: {
    // 原生壳始终有系统分享面板可用。
    canShare: () => true,
    share: async (data) => {
      const file = data?.files?.[0]
      if (!(file instanceof File)) {
        throw new Error('原生分享目前只支持图片文件')
      }
      const uri = await writeBlobFile(file, file.name, Directory.Cache)
      try {
        await Share.share({ title: data?.title, files: [uri] })
      } catch (error) {
        // 用户关掉分享面板时插件以普通 Error 拒绝；
        // 归一成 AbortError，让 core 按「取消」而非「降级下载」处理。
        if (error instanceof Error && /cancel/i.test(error.message)) {
          throw Object.assign(new Error(error.message), { name: 'AbortError' })
        }
        throw error
      }
    },
  },
  createFile: (bits, fileName, options) => new File(bits, fileName, options),
  download: (blob, fileName) => {
    void writeBlobFile(blob, fileName, Directory.Documents)
  },
}

/**
 * 存档导出/导入端口。web 端没有对应实现：浏览器里 App.svelte 仍直接走
 * 锚点下载 + <input type=file>，只有原生壳才需要经这里绕开 WebView 限制。
 */
export interface SaveTransferPort {
  /** 存档 JSON 写入缓存后交给系统分享面板；用户关掉面板返回 'cancelled'。 */
  exportSave(json: string, fileName: string): Promise<'shared' | 'cancelled'>
  /** 系统文件选择器选取存档文件并读出文本；用户取消返回 null。 */
  pickSaveFile(): Promise<string | null>
}

const isCancellation = (error: unknown): boolean =>
  error instanceof Error && /cancel/i.test(error.message)

/** FilePicker 返回 base64；存档含中文，必须按 UTF-8 解码而非 atob 直用。 */
const decodeBase64Utf8 = (base64: string) => {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export const nativeSaveTransfer: SaveTransferPort = {
  exportSave: async (json, fileName) => {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    try {
      await Share.share({ title: fileName, files: [result.uri] })
      return 'shared'
    } catch (error) {
      if (isCancellation(error)) return 'cancelled'
      throw error
    }
  },
  pickSaveFile: async () => {
    let files
    try {
      ({ files } = await FilePicker.pickFiles({
        types: ['application/json'],
        limit: 1,
        readData: true,
      }))
    } catch (error) {
      if (isCancellation(error)) return null
      throw error
    }
    const data = files[0]?.data
    if (!data) {
      throw new Error('存档文件无法读取')
    }
    return decodeBase64Utf8(data)
  },
}
