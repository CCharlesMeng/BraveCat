/**
 * 启动同步的纯决策逻辑（与 UI / 网络解耦，便于单测）。
 *
 * 策略（简单优先，取舍见 @bravecat/core/cloud 模块注释与 ADR-0009）：
 * - 版本护栏最优先：云端 schemaVersion 更高 → 提示升级，本会话停用推送。
 * - exportedAt 较新者胜。云端文档的 exportedAt 语义是「来源设备最后一次
 *   本地改动的时间」（推送时由本端写入，见 cloudSync.svelte.ts），
 *   与本地记录的 lastLocalChangeAt 直接可比：
 *   同设备回访时两者相等 → 本地未保存改动优先推送，不会误触备份下载。
 * - 云端较新（其他设备玩过）→ 以云端为准；覆盖本地前由调用方先把
 *   本地导出为下载备份——数据安全优先于同步便利。
 */
import type { PullSaveResult, SaveDocument } from '@bravecat/core/cloud'

export type StartupSyncDecision =
  | { action: 'push-local' }
  | { action: 'adopt-cloud'; document: SaveDocument; savedAt: number }
  | { action: 'upgrade-required'; cloudSchemaVersion: number }

export const decideStartupSync = (
  pull: PullSaveResult,
  /** 本地最后一次真实改动的时间戳；null = 本设备从未记录过改动。 */
  lastLocalChangeAt: number | null,
): StartupSyncDecision => {
  if (pull.status === 'schema-too-new') {
    return {
      action: 'upgrade-required',
      cloudSchemaVersion: pull.cloudSchemaVersion,
    }
  }
  if (pull.status === 'empty') {
    return { action: 'push-local' }
  }
  if (pull.document.exportedAt > (lastLocalChangeAt ?? 0)) {
    return {
      action: 'adopt-cloud',
      document: pull.document,
      savedAt: pull.savedAt,
    }
  }
  return { action: 'push-local' }
}
