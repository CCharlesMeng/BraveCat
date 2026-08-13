import type { PostcardComposition } from './index'

export const POSTCARD_WIDTH = 1_200
export const POSTCARD_HEIGHT = 900
export const POSTCARD_RECIPE_VERSION = 1

export interface PixelBounds {
  x: number
  y: number
  width: number
  height: number
  supportLeft: number
  supportRight: number
}

export interface PortraitPlacement {
  x: number
  y: number
  width: number
  height: number
  anchorX: number
  anchorY: number
  supportWidth: number
}

/**
 * PostcardCanvas 平台端口：明信片合成所需的 canvas 与图片加载能力。
 * 浏览器实现在 apps/web 的 platform/ports 中注入。
 */
export interface PostcardRenderDependencies {
  createCanvas: () => HTMLCanvasElement
  loadImage: (src: string) => Promise<HTMLImageElement>
}

/**
 * SharePort 平台端口：系统分享与 Blob 下载（未来含存相册）。
 * 浏览器实现在 apps/web 的 platform/ports 中注入。
 */
export interface PostcardShareDependencies {
  navigator: Pick<Navigator, 'canShare' | 'share'>
  createFile: (
    bits: BlobPart[],
    fileName: string,
    options: FilePropertyBag,
  ) => File
  download: (blob: Blob, fileName: string) => void
}

export type PostcardShareResult = 'shared' | 'downloaded' | 'cancelled'

const imageWidth = (image: HTMLImageElement) => (
  image.naturalWidth || image.width
)

const imageHeight = (image: HTMLImageElement) => (
  image.naturalHeight || image.height
)

export const findPixelBounds = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 8,
): PixelBounds => {
  let left = width
  let top = height
  let right = -1
  let bottom = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] <= alphaThreshold) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  if (right < left || bottom < top) {
    return {
      x: 0,
      y: 0,
      width,
      height,
      supportLeft: Math.round(width * 0.35),
      supportRight: Math.round(width * 0.65),
    }
  }

  const supportStartY = Math.max(top, bottom - Math.max(
    1,
    Math.round((bottom - top + 1) * 0.08),
  ))
  let supportLeft = right
  let supportRight = left

  for (let y = supportStartY; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] <= alphaThreshold) continue
      supportLeft = Math.min(supportLeft, x)
      supportRight = Math.max(supportRight, x)
    }
  }

  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
    supportLeft,
    supportRight,
  }
}

export const calculatePortraitPlacement = (
  image: { width: number, height: number },
  bounds: PixelBounds,
  portrait: PostcardComposition['portrait'],
): PortraitPlacement => {
  const contentHeight = portrait.heightScale * POSTCARD_HEIGHT
  const scale = contentHeight / bounds.height
  const anchorX = portrait.anchorX * POSTCARD_WIDTH
  const anchorY = portrait.anchorY * POSTCARD_HEIGHT

  return {
    x: anchorX - (bounds.x + bounds.width / 2) * scale,
    y: anchorY - (bounds.y + bounds.height) * scale,
    width: image.width * scale,
    height: image.height * scale,
    anchorX,
    anchorY,
    supportWidth: Math.max(
      1,
      (bounds.supportRight - bounds.supportLeft + 1) * scale,
    ),
  }
}

const readPixelBounds = (
  image: HTMLImageElement,
  createCanvas: () => HTMLCanvasElement,
) => {
  const width = imageWidth(image)
  const height = imageHeight(image)
  const canvas = createCanvas()
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('当前设备无法读取小猫图层')
  context.drawImage(image, 0, 0, width, height)
  return findPixelBounds(
    context.getImageData(0, 0, width, height).data,
    width,
    height,
  )
}

const drawScene = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
) => {
  const width = imageWidth(image)
  const height = imageHeight(image)
  const sourceAspect = width / height
  const targetAspect = POSTCARD_WIDTH / POSTCARD_HEIGHT
  let sourceX = 0
  let sourceY = 0
  let sourceWidth = width
  let sourceHeight = height

  if (sourceAspect > targetAspect) {
    sourceWidth = height * targetAspect
    sourceX = (width - sourceWidth) / 2
  } else if (sourceAspect < targetAspect) {
    sourceHeight = width / targetAspect
    sourceY = (height - sourceHeight) / 2
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    POSTCARD_WIDTH,
    POSTCARD_HEIGHT,
  )
}

const drawContactShadow = (
  context: CanvasRenderingContext2D,
  placement: PortraitPlacement,
) => {
  const width = Math.max(20, placement.supportWidth * 1.18)
  const height = Math.max(5, Math.min(18, width * 0.1))
  context.save()
  context.filter = 'blur(8px)'
  context.fillStyle = 'rgba(61, 52, 39, 0.24)'
  context.beginPath()
  context.ellipse(
    placement.anchorX,
    placement.anchorY + 2,
    width / 2,
    height / 2,
    0,
    0,
    Math.PI * 2,
  )
  context.fill()
  context.restore()
}

const drawPortrait = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  placement: PortraitPlacement,
  flip: boolean,
) => {
  context.save()
  if (flip) {
    context.translate(placement.anchorX * 2, 0)
    context.scale(-1, 1)
  }
  context.drawImage(
    image,
    placement.x,
    placement.y,
    placement.width,
    placement.height,
  )
  context.restore()
}

const wrapText = (
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  maxLines: number,
) => {
  const characters = [...value]
  const lines: string[] = []
  let line = ''

  for (const character of characters) {
    const next = `${line}${character}`
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line)
      line = character
      if (lines.length === maxLines - 1) break
    } else {
      line = next
    }
  }

  const consumed = lines.join('').length
  const remaining = characters.slice(consumed).join('')
  if (remaining) {
    let finalLine = remaining
    while (
      finalLine.length > 1
      && context.measureText(finalLine).width > maxWidth
    ) {
      finalLine = finalLine.slice(0, -1)
    }
    if (finalLine.length < remaining.length) {
      finalLine = `${finalLine.slice(0, -1)}…`
    }
    lines.push(finalLine)
  }

  return lines.slice(0, maxLines)
}

const drawMessage = (
  context: CanvasRenderingContext2D,
  composition: PostcardComposition,
  destinationName: string,
) => {
  const panelWidth = 560
  const panelHeight = 190
  const panelX = composition.portrait.anchorX < 0.5
    ? POSTCARD_WIDTH - panelWidth - 38
    : 38
  const panelY = POSTCARD_HEIGHT - panelHeight - 34

  context.save()
  context.fillStyle = 'rgba(248, 239, 216, 0.92)'
  context.strokeStyle = 'rgba(91, 83, 64, 0.28)'
  context.lineWidth = 2
  context.beginPath()
  context.roundRect(panelX, panelY, panelWidth, panelHeight, 16)
  context.fill()
  context.stroke()

  context.fillStyle = 'rgba(97, 89, 69, 0.045)'
  for (let y = panelY + 9; y < panelY + panelHeight; y += 13) {
    for (let x = panelX + 9; x < panelX + panelWidth; x += 13) {
      context.fillRect(x, y, 1.4, 1.4)
    }
  }

  context.fillStyle = '#4d4b42'
  context.font = '25px "STKaiti", "KaiTi", serif'
  const lines = wrapText(context, composition.note, 390, 3)
  lines.forEach((line, index) => {
    context.fillText(line, panelX + 28, panelY + 40 + index * 33)
  })

  context.fillStyle = '#77766b'
  context.font = '19px system-ui, sans-serif'
  context.fillText(destinationName, panelX + 29, panelY + 168)

  const postmarkX = panelX + panelWidth - 76
  const postmarkY = panelY + 96
  context.translate(postmarkX, postmarkY)
  context.rotate(-8 * Math.PI / 180)
  context.strokeStyle = 'rgba(145, 82, 66, 0.68)'
  context.fillStyle = 'rgba(130, 74, 61, 0.82)'
  context.lineWidth = 4
  context.beginPath()
  context.arc(0, 0, 48, 0, Math.PI * 2)
  context.stroke()
  context.font = '17px system-ui, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(
    composition.postmarkDate.slice(5).replace('-', '.'),
    0,
    0,
  )
  context.restore()
}

export const renderPostcardCanvas = async (
  canvas: HTMLCanvasElement,
  composition: PostcardComposition,
  destinationName: string,
  dependencies: PostcardRenderDependencies,
) => {
  const [scene, portrait] = await Promise.all([
    dependencies.loadImage(composition.scene.src),
    dependencies.loadImage(composition.portrait.src),
  ])
  const bounds = readPixelBounds(portrait, dependencies.createCanvas)
  const placement = calculatePortraitPlacement({
    width: imageWidth(portrait),
    height: imageHeight(portrait),
  }, bounds, composition.portrait)

  canvas.width = POSTCARD_WIDTH
  canvas.height = POSTCARD_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前设备无法合成明信片')

  context.fillStyle = '#f8efd8'
  context.fillRect(0, 0, POSTCARD_WIDTH, POSTCARD_HEIGHT)
  drawScene(context, scene)

  const edgeBand = context.createLinearGradient(
    placement.anchorX - placement.width * 0.55,
    0,
    placement.anchorX + placement.width * 0.55,
    0,
  )
  edgeBand.addColorStop(0, 'rgba(248, 239, 216, 0)')
  edgeBand.addColorStop(0.5, 'rgba(248, 239, 216, 0.07)')
  edgeBand.addColorStop(1, 'rgba(248, 239, 216, 0)')
  context.fillStyle = edgeBand
  context.fillRect(0, 0, POSTCARD_WIDTH, POSTCARD_HEIGHT)

  drawContactShadow(context, placement)
  drawPortrait(context, portrait, placement, composition.portrait.flip)
  drawMessage(context, composition, destinationName)
}

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type = 'image/png',
) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob)
    else reject(new Error('当前设备无法导出明信片图片'))
  }, type)
})

export const createPostcardPng = async (
  composition: PostcardComposition,
  destinationName: string,
  dependencies: PostcardRenderDependencies,
) => {
  const canvas = dependencies.createCanvas()
  await renderPostcardCanvas(
    canvas,
    composition,
    destinationName,
    dependencies,
  )
  return canvasToBlob(canvas)
}

export const postcardFileName = (
  destinationName: string,
  postmarkDate: string,
) => {
  const destination = destinationName
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    || '远方'
  return `咪游记-${destination}-${postmarkDate.slice(0, 10)}.png`
}

export const shareOrDownloadPostcard = async (
  blob: Blob,
  fileName: string,
  dependencies: PostcardShareDependencies,
): Promise<PostcardShareResult> => {
  const file = dependencies.createFile(
    [blob],
    fileName,
    { type: 'image/png' },
  )
  const shareData: ShareData = {
    files: [file],
    title: '咪游记明信片',
  }

  if (
    typeof dependencies.navigator.share === 'function'
    && dependencies.navigator.canShare?.(shareData)
  ) {
    try {
      await dependencies.navigator.share(shareData)
      return 'shared'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return 'cancelled'
      }
    }
  }

  dependencies.download(blob, fileName)
  return 'downloaded'
}
