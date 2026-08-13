import { describe, expect, it, vi } from 'vitest'
import {
  calculatePortraitPlacement,
  findPixelBounds,
  postcardFileName,
  shareOrDownloadPostcard,
  type PostcardShareDependencies,
} from './composer'

const createPixels = (
  width: number,
  height: number,
  opaque: readonly [number, number][],
) => {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (const [x, y] of opaque) {
    pixels[(y * width + x) * 4 + 3] = 255
  }
  return pixels
}

const createShareDependencies = (
  navigator: PostcardShareDependencies['navigator'],
) => {
  const download = vi.fn()
  const dependencies: PostcardShareDependencies = {
    navigator,
    createFile: (bits, fileName, options) => (
      { bits, name: fileName, type: options.type } as unknown as File
    ),
    download,
  }
  return { dependencies, download }
}

describe('Postcard compositor', () => {
  it('从透明图层找出真实像素边界和底部支撑宽度', () => {
    const pixels = createPixels(6, 6, [
      [2, 1],
      [3, 1],
      [1, 2],
      [4, 2],
      [2, 4],
      [3, 4],
    ])

    expect(findPixelBounds(pixels, 6, 6)).toEqual({
      x: 1,
      y: 1,
      width: 4,
      height: 4,
      supportLeft: 2,
      supportRight: 3,
    })
  })

  it('按真实像素底边落地，不让透明画布留白抬高小猫', () => {
    const placement = calculatePortraitPlacement(
      { width: 1_024, height: 1_024 },
      {
        x: 64,
        y: 164,
        width: 896,
        height: 796,
        supportLeft: 360,
        supportRight: 664,
      },
      {
        src: '/portrait.png',
        anchorX: 0.25,
        anchorY: 0.8,
        heightScale: 0.3,
        flip: false,
      },
    )

    expect(placement.anchorX).toBe(300)
    expect(placement.anchorY).toBe(720)
    expect(placement.y + (164 + 796) * (270 / 796)).toBeCloseTo(720)
    expect(placement.supportWidth).toBeCloseTo(305 * (270 / 796))
  })

  it('生成适合下载且不含文件系统保留字符的文件名', () => {
    expect(postcardFileName(
      '巴黎 / 铁塔',
      '2026-07-20 12:34',
    )).toBe('咪游记-巴黎-铁塔-2026-07-20.png')
  })

  it('设备支持文件分享时打开原生分享面板', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const { dependencies, download } = createShareDependencies({
      canShare: () => true,
      share,
    })

    await expect(shareOrDownloadPostcard(
      new Blob(['png'], { type: 'image/png' }),
      'postcard.png',
      dependencies,
    )).resolves.toBe('shared')
    expect(share).toHaveBeenCalledOnce()
    expect(download).not.toHaveBeenCalled()
  })

  it('不支持文件分享或分享失败时回退为 PNG 下载', async () => {
    const share = vi.fn().mockRejectedValue(new Error('share failed'))
    const { dependencies, download } = createShareDependencies({
      canShare: () => true,
      share,
    })
    const blob = new Blob(['png'], { type: 'image/png' })

    await expect(shareOrDownloadPostcard(
      blob,
      'postcard.png',
      dependencies,
    )).resolves.toBe('downloaded')
    expect(download).toHaveBeenCalledWith(blob, 'postcard.png')
  })
})
