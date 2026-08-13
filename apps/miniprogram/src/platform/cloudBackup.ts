/**
 * 云同步的本地备份槽：小程序没有「导出为下载文件」（web 端覆盖本地前
 * 的备份手段），务实替代为 wx storage 里的独立备份键。
 *
 * 结构与轮替：
 * - 每份备份一个键 `bravecat.cloud.backup:<时间戳>`，值为完整
 *   SaveDocument 信封 JSON；
 * - 索引键 `bravecat.cloud.backup:index` 记录时间戳列表（新在前），
 *   只保留最近 CLOUD_BACKUP_SLOT_LIMIT 份，写入时把溢出的旧键删掉；
 * - 恢复入口在相册页云同步小节，走 controller.importDocument 的
 *   完整校验迁移链。
 *
 * 容量：单份存档几十 KB，两份备份远低于 wx storage 单键 1MB /
 * 总量 10MB 上限。写入失败会原样抛出——调用方（启动同步的
 * adopt-cloud 分支）必须在备份成功后才允许云端覆盖本地。
 */
import Taro from '@tarojs/taro'
import type { SaveDocument } from '@bravecat/core/cloud'

const BACKUP_INDEX_KEY = 'bravecat.cloud.backup:index'
const backupKey = (savedAt: number) => `bravecat.cloud.backup:${savedAt}`

/** 保留最近几份被覆盖的本地存档。 */
export const CLOUD_BACKUP_SLOT_LIMIT = 2

const readIndex = async (): Promise<number[]> => {
  let raw: unknown
  try {
    raw = (await Taro.getStorage({ key: BACKUP_INDEX_KEY })).data
  } catch {
    return []
  }
  try {
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is number => (
      typeof value === 'number' && Number.isFinite(value)
    ))
  } catch {
    return []
  }
}

/** 备份槽里的时间戳列表（新在前）；读取失败等价于没有备份。 */
export const listCloudBackups = (): Promise<number[]> => readIndex()

/**
 * 把即将被云端覆盖的本地存档写入备份槽并轮替旧份。
 * 返回本份备份的时间戳键；写入失败原样抛出。
 */
export const writeCloudBackup = async (
  document: SaveDocument,
  at: number = Date.now(),
): Promise<number> => {
  const existing = await readIndex()
  // 同一毫秒的重复写入顺移一格，保证键唯一、索引无重复。
  let savedAt = at
  while (existing.includes(savedAt)) savedAt += 1

  await Taro.setStorage({
    key: backupKey(savedAt),
    data: JSON.stringify(document),
  })

  const next = [savedAt, ...existing]
  const kept = next.slice(0, CLOUD_BACKUP_SLOT_LIMIT)
  const dropped = next.slice(CLOUD_BACKUP_SLOT_LIMIT)
  for (const stale of dropped) {
    try {
      await Taro.removeStorage({ key: backupKey(stale) })
    } catch {
      // 删除失败只多占一点存储，不影响备份本身。
    }
  }
  await Taro.setStorage({ key: BACKUP_INDEX_KEY, data: JSON.stringify(kept) })
  return savedAt
}

/** 读出一份备份的存档信封；缺失或损坏回 null，由视图提示。 */
export const readCloudBackup = async (
  savedAt: number,
): Promise<SaveDocument | null> => {
  let raw: unknown
  try {
    raw = (await Taro.getStorage({ key: backupKey(savedAt) })).data
  } catch {
    return null
  }
  try {
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (
      typeof parsed !== 'object'
      || parsed === null
      || !('schemaVersion' in parsed)
      || !('state' in parsed)
    ) {
      return null
    }
    return parsed as SaveDocument
  } catch {
    return null
  }
}
