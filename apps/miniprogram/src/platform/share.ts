/**
 * SharePort 在小程序上下文的重定义。
 *
 * web 端 SharePort = navigator.share + Blob 下载；小程序两者皆无：
 * - 明信片图 → wx.saveImageToPhotosAlbum（含 scope.writePhotosAlbum
 *   授权流程：拒绝后引导去设置页开启并重试一次）；
 * - 会话分享 → 页面级 onShareAppMessage 开放能力（useShareAppMessage），
 *   由明信片详情页配置，不经过本模块；
 * - core 的 shareOrDownloadPostcard 依赖 Blob/File，本端不适用，页面
 *   直接消费 composePostcardToTempFile 的临时文件路径 + 本模块。
 */
import Taro from '@tarojs/taro'

export type SaveToAlbumResult = 'saved' | 'denied' | 'failed'

const isAuthDenied = (error: unknown): boolean => {
  const message = (
    typeof error === 'object' && error !== null && 'errMsg' in error
      ? String((error as { errMsg: unknown }).errMsg)
      : ''
  )
  return message.includes('auth')
}

const askToOpenSetting = async (): Promise<boolean> => {
  try {
    const modal = await Taro.showModal({
      title: '需要相册权限',
      content: '把明信片保存到相册，需要在设置里允许「添加到相册」。',
      confirmText: '去设置',
      cancelText: '先不了',
    })
    if (!modal.confirm) return false
    const setting = await Taro.openSetting()
    return setting.authSetting['scope.writePhotosAlbum'] === true
  } catch {
    return false
  }
}

/** 保存图片到相册；授权被拒时引导开启权限并重试一次。 */
export const savePostcardToAlbum = async (
  filePath: string,
): Promise<SaveToAlbumResult> => {
  try {
    await Taro.saveImageToPhotosAlbum({ filePath })
    return 'saved'
  } catch (error) {
    if (!isAuthDenied(error)) return 'failed'
  }

  const granted = await askToOpenSetting()
  if (!granted) return 'denied'
  try {
    await Taro.saveImageToPhotosAlbum({ filePath })
    return 'saved'
  } catch {
    return 'failed'
  }
}
