import { describe, expect, it } from 'vitest'
import { encodeSolidPng } from '../src/aigc/fakes.js'
import { parsePngHeader, pngHasAlpha } from '../src/aigc/png.js'
import { createBaselinePortraitQa } from '../src/aigc/qa.js'

const qa = createBaselinePortraitQa()

const statusOf = (
  results: Awaited<ReturnType<typeof qa.evaluate>>,
  checkId: string,
) => results.find((result) => result.checkId === checkId)?.status

describe('PNG 头解析', () => {
  it('解析 fake 产出图的尺寸与通道', () => {
    const header = parsePngHeader(encodeSolidPng(1024, 1024, { alpha: true }))
    expect(header).toMatchObject({ width: 1024, height: 1024, colorType: 6 })
    expect(pngHasAlpha(header!)).toBe(true)
  })

  it('拒绝非 PNG 字节', () => {
    expect(parsePngHeader(new Uint8Array([1, 2, 3]))).toBeUndefined()
    expect(parsePngHeader(new TextEncoder().encode('x'.repeat(64)))).toBeUndefined()
  })
})

describe('基线自动 QA', () => {
  it('合规产出：规格类检查全过，语义类检查登记为 not_implemented', async () => {
    const results = await qa.evaluate({
      pose: 'sit',
      image: encodeSolidPng(1024, 1024, { alpha: true }),
    })
    expect(statusOf(results, 'spec-format-png')).toBe('pass')
    expect(statusOf(results, 'spec-dimensions')).toBe('pass')
    expect(statusOf(results, 'spec-alpha-channel')).toBe('pass')
    // 语义类检查位（锚点/单主体/姿势承重/目标物/花色/alpha 质量）只登记不拦截。
    const notImplemented = results.filter(
      (result) => result.status === 'not_implemented',
    )
    expect(notImplemented.map((result) => result.checkId)).toEqual([
      'anchor-bottom-center',
      'single-subject',
      'pose-support-contacts',
      'interaction-target',
      'palette-consistency',
      'alpha-quality',
    ])
    expect(results.some((result) => result.status === 'fail')).toBe(false)
  })

  it('尺寸不符判 fail', async () => {
    const results = await qa.evaluate({
      pose: 'walk',
      image: encodeSolidPng(512, 512, { alpha: true }),
    })
    expect(statusOf(results, 'spec-dimensions')).toBe('fail')
  })

  it('缺 alpha 通道判 fail（透明度检查）', async () => {
    const results = await qa.evaluate({
      pose: 'eat',
      image: encodeSolidPng(1024, 1024, { alpha: false }),
    })
    expect(statusOf(results, 'spec-alpha-channel')).toBe('fail')
  })

  it('非 PNG 字节：三项规格检查全部 fail', async () => {
    const results = await qa.evaluate({
      pose: 'sleep',
      image: new TextEncoder().encode('not a png at all, just bytes'),
    })
    expect(statusOf(results, 'spec-format-png')).toBe('fail')
    expect(statusOf(results, 'spec-dimensions')).toBe('fail')
    expect(statusOf(results, 'spec-alpha-channel')).toBe('fail')
  })
})
