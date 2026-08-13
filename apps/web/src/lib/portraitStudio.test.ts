import { describe, expect, it } from 'vitest'
import {
  MAX_PORTRAIT_PHOTO_BYTES,
  type UserPortrait,
} from '@bravecat/core/cloud'
import {
  cloudPortraitAssetPath,
  cloudPortraitName,
  cloudPortraitSetRevision,
  generationFailureText,
  generationStatusText,
  toCatalogPortrait,
  validatePortraitPhoto,
} from './portraitStudio'

describe('validatePortraitPhoto', () => {
  it('接受限内的 PNG 与 JPEG', () => {
    expect(
      validatePortraitPhoto({ type: 'image/png', size: 1024 }),
    ).toEqual({ ok: true, contentType: 'image/png' })
    expect(
      validatePortraitPhoto({
        type: 'image/jpeg',
        size: MAX_PORTRAIT_PHOTO_BYTES,
      }),
    ).toEqual({ ok: true, contentType: 'image/jpeg' })
  })

  it('拒绝不支持的格式、空文件与超限文件，并给中文提示', () => {
    const gif = validatePortraitPhoto({ type: 'image/gif', size: 1024 })
    expect(gif.ok).toBe(false)
    expect(!gif.ok && gif.message).toContain('PNG 或 JPEG')

    const empty = validatePortraitPhoto({ type: 'image/png', size: 0 })
    expect(empty.ok).toBe(false)

    const oversized = validatePortraitPhoto({
      type: 'image/png',
      size: MAX_PORTRAIT_PHOTO_BYTES + 1,
    })
    expect(oversized.ok).toBe(false)
    expect(!oversized.ok && oversized.message).toContain('3MB')
  })
})

describe('generationStatusText', () => {
  it('覆盖状态机全部状态', () => {
    for (const status of [
      'pending',
      'moderating',
      'generating',
      'qa',
      'awaiting_confirm',
      'confirmed',
      'failed',
    ] as const) {
      expect(generationStatusText(status)).not.toHaveLength(0)
    }
  })
})

describe('generationFailureText', () => {
  it('三种失败原因都说明次数已自动退回', () => {
    for (const reason of [
      'moderation_rejected',
      'generation_failed',
      'qa_failed',
    ] as const) {
      const text = generationFailureText({ reason, message: 'x' })
      expect(text.title).not.toHaveLength(0)
      expect(text.detail).toContain('自动退回')
    }
  })

  it('缺失 failure 时给通用文案', () => {
    expect(generationFailureText(undefined).title).toContain('没有成功')
  })
})

describe('toCatalogPortrait', () => {
  const samplePortrait: UserPortrait = {
    id: 'bbbbbbbb-0000-4000-8000-000000000002',
    jobId: 'aaaaaaaa-0000-4000-8000-000000000001',
    poses: Object.fromEntries(
      [
        'sit',
        'sleep',
        'walk',
        'eat',
        'play',
        'gaze',
        'sniff',
        'reach',
        'stretch',
        'greet',
      ].map((pose) => [
        pose,
        `portraits/generations/job-1/${pose}.png`,
      ]),
    ) as UserPortrait['poses'],
    createdAt: 1,
  }

  it('姿势 key 映射为「/ + 存储 key」的稳定资产路径', () => {
    const portrait = toCatalogPortrait(samplePortrait, '专属形象 1')

    expect(portrait.id).toBe(samplePortrait.id)
    expect(portrait.name).toBe('专属形象 1')
    expect(Object.keys(portrait.poses)).toHaveLength(10)
    expect(portrait.poses.sit).toBe('/portraits/generations/job-1/sit.png')
  })

  it('set revision 非空以通过 changeCatPortrait 校验', () => {
    expect(cloudPortraitSetRevision(samplePortrait.id).trim()).not.toHaveLength(0)
  })

  it('命名与资产路径辅助函数', () => {
    expect(cloudPortraitName(0)).toBe('专属形象 1')
    expect(cloudPortraitAssetPath('portraits/generations/j/sit.png')).toBe(
      '/portraits/generations/j/sit.png',
    )
  })
})
