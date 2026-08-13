/**
 * PostcardCanvas 的微信小程序实现：wx OffscreenCanvas 2D。
 *
 * 与 web 端差异及取舍：
 * - createCanvas：Taro.createOffscreenCanvas({ type: '2d' })。返回对象与
 *   HTMLCanvasElement 结构兼容（width/height/getContext），core 的合成器
 *   （getImageData、渐变、文字、ellipse）可直接使用；类型上用断言桥接。
 * - loadImage：小程序没有 Image 构造器，图片必须经 canvas.createImage()
 *   创建；同一 Skia 后端下跨 canvas 实例绘制可用，复用一个工厂 canvas。
 * - roundRect：部分基础库的 2D 上下文缺失，因此在 getContext 处打了
 *   arcTo 兜底补丁，core 合成器无需感知。
 * - toBlob：小程序没有 Blob/File，core 的 createPostcardPng 不适用；
 *   本端以 composePostcardToTempFile 产出临时文件路径替代——优先
 *   wx.canvasToTempFilePath({ canvas })，离屏 canvas 不被支持的基础库
 *   走 toDataURL + 文件系统写入兜底。
 * - context.filter（接触阴影的 blur）在部分真机上不生效，仅影响
 *   投影柔和度，不影响构图。
 */
import Taro from '@tarojs/taro'
import type { PostcardCanvas } from '@bravecat/core'
import {
  renderPostcardCanvas,
  type PostcardComposition,
} from '@bravecat/core/postcards'

interface WeappImage {
  src: string
  width: number
  height: number
  onload: (() => void) | null
  onerror: (() => void) | null
}

interface WeappOffscreenCanvas {
  width: number
  height: number
  getContext(type: string, attributes?: unknown): CanvasRenderingContext2D | null
  createImage(): WeappImage
  toDataURL?: (type?: string) => string
}

type RoundRectPatchable = CanvasRenderingContext2D & {
  roundRect?: CanvasRenderingContext2D['roundRect']
}

const patchRoundRect = (context: CanvasRenderingContext2D) => {
  const patchable = context as RoundRectPatchable
  if (typeof patchable.roundRect === 'function') return
  patchable.roundRect = function roundRect(
    ...args: Parameters<CanvasRenderingContext2D['roundRect']>
  ) {
    const [x, y, width, height, radii] = args
    // core 合成器只用「单一数字圆角」形态；其余形态按直角兜底。
    const radius = typeof radii === 'number' ? radii : 0
    const r = Math.min(radius, width / 2, height / 2)
    this.moveTo(x + r, y)
    this.arcTo(x + width, y, x + width, y + height, r)
    this.arcTo(x + width, y + height, x, y + height, r)
    this.arcTo(x, y + height, x, y, r)
    this.arcTo(x, y, x + width, y, r)
    this.closePath()
  }
}

export const createOffscreen2dCanvas = (): WeappOffscreenCanvas => {
  const canvas = Taro.createOffscreenCanvas(
    { type: '2d' },
  ) as unknown as WeappOffscreenCanvas
  const rawGetContext = canvas.getContext.bind(canvas)
  canvas.getContext = (type, attributes) => {
    const context = rawGetContext(type, attributes)
    if (type === '2d' && context) patchRoundRect(context)
    return context
  }
  return canvas
}

/** loadImage 用的图片工厂 canvas（图片跨 canvas 实例可用）。 */
let imageFactory: WeappOffscreenCanvas | null = null
const imageFactoryCanvas = () => {
  imageFactory ??= createOffscreen2dCanvas()
  return imageFactory
}

export const miniPostcardCanvas: PostcardCanvas = {
  createCanvas: () => (
    createOffscreen2dCanvas() as unknown as HTMLCanvasElement
  ),
  loadImage: (src) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = imageFactoryCanvas().createImage()
    image.onload = () => resolve(image as unknown as HTMLImageElement)
    image.onerror = () => reject(new Error(`无法载入明信片图层：${src}`))
    image.src = src
  }),
}

const writeDataUrlToTempFile = async (dataUrl: string): Promise<string> => {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const filePath = `${Taro.env.USER_DATA_PATH}/postcard-${Date.now()}.png`
  await new Promise<void>((resolve, reject) => {
    Taro.getFileSystemManager().writeFile({
      filePath,
      data: base64,
      encoding: 'base64',
      success: () => resolve(),
      fail: (error) => reject(new Error(error.errMsg)),
    })
  })
  return filePath
}

export const canvasToTempFilePath = async (
  canvas: WeappOffscreenCanvas,
): Promise<string> => {
  try {
    const { tempFilePath } = await Taro.canvasToTempFilePath({
      canvas,
      fileType: 'png',
    } as unknown as Taro.canvasToTempFilePath.Option)
    if (tempFilePath) return tempFilePath
  } catch {
    // 部分基础库不支持对离屏 canvas 调用，走 toDataURL 兜底。
  }
  const dataUrl = canvas.toDataURL?.('image/png')
  if (!dataUrl) throw new Error('当前设备无法导出明信片图片')
  return writeDataUrlToTempFile(dataUrl)
}

/** 合成明信片并落成临时文件；路径供预览、存相册与分享使用。 */
export const composePostcardToTempFile = async (
  composition: PostcardComposition,
  destinationName: string,
): Promise<string> => {
  const canvas = createOffscreen2dCanvas()
  await renderPostcardCanvas(
    canvas as unknown as HTMLCanvasElement,
    composition,
    destinationName,
    miniPostcardCanvas,
  )
  return canvasToTempFilePath(canvas)
}
