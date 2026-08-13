/**
 * SharePort 的 Capacitor 原生实现（iOS/Android 壳，apps/mobile）。
 *
 * - 分享：明信片 PNG 先写入应用缓存目录，再交给系统分享面板
 *   （@capacitor/share）；分享面板里自带「存储图像（存入相册）」入口。
 * - 「下载」：web 端的 Blob 下载在原生端落为写入应用 Documents 目录
 *   （@capacitor/filesystem）；iOS 已开 UIFileSharingEnabled，文件 App 可见。
 *
 * 仅在 Capacitor.isNativePlatform() 时被接线，见 ports.ts 的 sharePort。
 */
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
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
