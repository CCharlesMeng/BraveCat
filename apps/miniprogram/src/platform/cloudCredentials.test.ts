import { beforeEach, describe, expect, it } from 'vitest'
import { resetTaroMock, storage } from './testing/taroMock'
import { wxCloudCredentialStore } from './cloudCredentials'

describe('wxCloudCredentialStore', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('没有凭证时 load 返回 null', async () => {
    await expect(wxCloudCredentialStore.load()).resolves.toBeNull()
  })

  it('save 后 load 还原同一份凭证（JSON 串落在固定键）', async () => {
    await wxCloudCredentialStore.save({ userId: 'user-1', token: 'tok-1' })

    expect(storage.get('bravecat.cloud.credentials')).toBe(
      JSON.stringify({ userId: 'user-1', token: 'tok-1' }),
    )
    await expect(wxCloudCredentialStore.load()).resolves.toEqual({
      userId: 'user-1',
      token: 'tok-1',
    })
  })

  it('损坏的 JSON 等价于没有凭证', async () => {
    storage.set('bravecat.cloud.credentials', '{broken')
    await expect(wxCloudCredentialStore.load()).resolves.toBeNull()
  })

  it('结构不完整（缺 token）时不当作有效凭证', async () => {
    storage.set(
      'bravecat.cloud.credentials',
      JSON.stringify({ userId: 'user-1' }),
    )
    await expect(wxCloudCredentialStore.load()).resolves.toBeNull()
  })

  it('非字符串值（旧数据或误写）回 null 而不是抛错', async () => {
    storage.set('bravecat.cloud.credentials', { userId: 'u', token: 't' })
    await expect(wxCloudCredentialStore.load()).resolves.toBeNull()
  })
})
