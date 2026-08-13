import { beforeEach, describe, expect, it } from 'vitest'
import { SAVE_SCHEMA_VERSION, type SaveDocument } from '@bravecat/core/cloud'
import { resetTaroMock, storage } from './testing/taroMock'
import {
  CLOUD_BACKUP_SLOT_LIMIT,
  listCloudBackups,
  readCloudBackup,
  writeCloudBackup,
} from './cloudBackup'

const document = (marker: number): SaveDocument => ({
  schemaVersion: SAVE_SCHEMA_VERSION,
  exportedAt: marker,
  state: { marker },
})

describe('cloudBackup 备份槽', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('写入一份备份：键带时间戳，索引新在前', async () => {
    await writeCloudBackup(document(1), 1_000)

    expect(storage.get('bravecat.cloud.backup:1000')).toBe(
      JSON.stringify(document(1)),
    )
    await expect(listCloudBackups()).resolves.toEqual([1_000])
  })

  it('只保留最近 2 份：第三份写入时最旧的键被删除', async () => {
    await writeCloudBackup(document(1), 1_000)
    await writeCloudBackup(document(2), 2_000)
    await writeCloudBackup(document(3), 3_000)

    await expect(listCloudBackups()).resolves.toEqual([3_000, 2_000])
    expect(storage.has('bravecat.cloud.backup:1000')).toBe(false)
    expect(storage.has('bravecat.cloud.backup:2000')).toBe(true)
    expect(storage.has('bravecat.cloud.backup:3000')).toBe(true)
    expect(CLOUD_BACKUP_SLOT_LIMIT).toBe(2)
  })

  it('同一毫秒的重复写入顺移一格，键不互相覆盖', async () => {
    await writeCloudBackup(document(1), 1_000)
    const savedAt = await writeCloudBackup(document(2), 1_000)

    expect(savedAt).toBe(1_001)
    await expect(listCloudBackups()).resolves.toEqual([1_001, 1_000])
    await expect(readCloudBackup(1_000)).resolves.toEqual(document(1))
    await expect(readCloudBackup(1_001)).resolves.toEqual(document(2))
  })

  it('readCloudBackup 对缺失或损坏的备份回 null', async () => {
    await expect(readCloudBackup(9_999)).resolves.toBeNull()

    storage.set('bravecat.cloud.backup:42', '{broken')
    await expect(readCloudBackup(42)).resolves.toBeNull()

    storage.set('bravecat.cloud.backup:43', JSON.stringify({ not: 'a doc' }))
    await expect(readCloudBackup(43)).resolves.toBeNull()
  })

  it('索引损坏时等价于没有备份，不抛错', async () => {
    storage.set('bravecat.cloud.backup:index', '{broken')
    await expect(listCloudBackups()).resolves.toEqual([])

    storage.set('bravecat.cloud.backup:index', JSON.stringify(['abc', 1_000]))
    await expect(listCloudBackups()).resolves.toEqual([1_000])
  })
})
