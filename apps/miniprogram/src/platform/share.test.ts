import { beforeEach, describe, expect, it } from 'vitest'
import taro, { resetTaroMock, state } from './testing/taroMock'
import { savePostcardToAlbum } from './share'

describe('savePostcardToAlbum', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('已授权时直接保存', async () => {
    await expect(savePostcardToAlbum('wxfile://tmp/p.png'))
      .resolves.toBe('saved')
    expect(taro.saveImageToPhotosAlbum).toHaveBeenCalledTimes(1)
  })

  it('非授权类失败不弹设置引导，返回 failed', async () => {
    state.saveImageErrors = ['saveImageToPhotosAlbum:fail file not found']
    await expect(savePostcardToAlbum('wxfile://tmp/p.png'))
      .resolves.toBe('failed')
    expect(taro.showModal).not.toHaveBeenCalled()
  })

  it('授权被拒→引导开启权限→重试成功', async () => {
    state.saveImageErrors = ['saveImageToPhotosAlbum:fail auth deny']
    await expect(savePostcardToAlbum('wxfile://tmp/p.png'))
      .resolves.toBe('saved')
    expect(taro.openSetting).toHaveBeenCalledTimes(1)
    expect(taro.saveImageToPhotosAlbum).toHaveBeenCalledTimes(2)
  })

  it('玩家不去设置页时返回 denied 且不重试', async () => {
    state.saveImageErrors = ['saveImageToPhotosAlbum:fail auth deny']
    state.modalConfirm = false
    await expect(savePostcardToAlbum('wxfile://tmp/p.png'))
      .resolves.toBe('denied')
    expect(taro.openSetting).not.toHaveBeenCalled()
    expect(taro.saveImageToPhotosAlbum).toHaveBeenCalledTimes(1)
  })

  it('设置页里仍未开启权限时返回 denied', async () => {
    state.saveImageErrors = ['saveImageToPhotosAlbum:fail auth deny']
    state.openSettingGrants = false
    await expect(savePostcardToAlbum('wxfile://tmp/p.png'))
      .resolves.toBe('denied')
    expect(taro.saveImageToPhotosAlbum).toHaveBeenCalledTimes(1)
  })
})
