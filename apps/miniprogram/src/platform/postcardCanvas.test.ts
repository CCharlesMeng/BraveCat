import { beforeEach, describe, expect, it } from 'vitest'
import { resetTaroMock, state } from './testing/taroMock'
import {
  canvasToTempFilePath,
  createOffscreen2dCanvas,
  miniPostcardCanvas,
} from './postcardCanvas'

describe('createOffscreen2dCanvas', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('给缺失 roundRect 的 2D 上下文打 arcTo 兜底补丁', () => {
    const canvas = createOffscreen2dCanvas()
    const context = canvas.getContext('2d') as CanvasRenderingContext2D & {
      roundRect: (
        x: number, y: number, w: number, h: number, r: number,
      ) => void
      arcTo: ReturnType<typeof import('vitest').vi.fn>
    }
    expect(typeof context.roundRect).toBe('function')

    context.roundRect(0, 0, 100, 50, 8)
    expect(context.arcTo).toHaveBeenCalledTimes(4)
  })
})

describe('miniPostcardCanvas.loadImage', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('经 canvas.createImage 载入并在 onload 后回图', async () => {
    const image = await miniPostcardCanvas.loadImage('https://cdn/scene.png')
    expect(image).toBeTruthy()
  })

  it('载入失败时以路径报错', async () => {
    await expect(miniPostcardCanvas.loadImage('https://cdn/missing.png'))
      .rejects.toThrow('无法载入明信片图层：https://cdn/missing.png')
  })
})

describe('canvasToTempFilePath', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('优先走 wx.canvasToTempFilePath', async () => {
    const canvas = createOffscreen2dCanvas()
    await expect(canvasToTempFilePath(canvas))
      .resolves.toBe('wxfile://tmp/composed.png')
  })

  it('离屏 canvas 不被支持时回退 toDataURL + 文件系统写入', async () => {
    state.canvasToTempFilePathFails = true
    const canvas = createOffscreen2dCanvas()
    const filePath = await canvasToTempFilePath(canvas)

    expect(filePath).toMatch(/^wxfile:\/\/usr\/postcard-\d+\.png$/)
    expect(state.writtenFiles).toHaveLength(1)
    expect(state.writtenFiles[0]).toMatchObject({
      filePath,
      data: 'ZmFrZQ==',
      encoding: 'base64',
    })
  })
})
