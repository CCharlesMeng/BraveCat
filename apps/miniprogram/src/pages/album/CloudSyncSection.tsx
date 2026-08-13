/**
 * 相册页的云同步小节（对应 web 端 App.svelte 的 cloud-sync 区块）。
 * 仅在 TARO_APP_API_BASE_URL 非空（cloudSync 非 null）时由父页面渲染。
 *
 * 相对 web 端多出两块小程序特有 UI：
 * - 恢复备份：云端覆盖本地前写入的备份槽（platform/cloudBackup.ts，
 *   保留最近 2 份），恢复走 controller.importDocument 的完整校验链；
 * - 微信登录入口：客户端链路已封装（platform/wechatAuth.ts），
 *   服务端为 501 骨架，入口标注「待开通」不实连。
 */
import { useState, useSyncExternalStore } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { controller } from '../../game/controller'
import type { MiniCloudSync } from '../../game/cloudSync'
import { listCloudBackups, readCloudBackup } from '../../platform/cloudBackup'

const pad = (value: number) => String(value).padStart(2, '0')

const formatBackupTime = (savedAt: number): string => {
  const date = new Date(savedAt)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function CloudSyncSection({ sync }: { sync: MiniCloudSync }) {
  const cloud = useSyncExternalStore(sync.subscribe, sync.getSnapshot)
  const [backups, setBackups] = useState<number[]>([])
  const [restoreNotice, setRestoreNotice] = useState('')

  useDidShow(() => {
    void listCloudBackups().then(setBackups)
  })

  const restoreBackup = async (savedAt: number) => {
    const { confirm } = await Taro.showModal({
      title: '恢复备份',
      content: '当前进度会被这份备份替换，之后照常同步到云端。',
      confirmText: '恢复',
      cancelText: '先不用',
    })
    if (!confirm) return
    try {
      const document = await readCloudBackup(savedAt)
      if (!document) {
        setRestoreNotice('这份备份读不出来了，换另一份试试。')
        return
      }
      await controller.importDocument(document)
      setRestoreNotice('已经换回这份备份，稍后会同步到云端。')
    } catch (error) {
      setRestoreNotice(error instanceof Error && error.message
        ? `没有恢复：${error.message}`
        : '没有恢复：备份内容无法读取。')
    }
  }

  const wechatLoginPending = () => {
    void Taro.showToast({ title: '微信登录待开通', icon: 'none' })
  }

  return (
    <View className="cloud-sync">
      <Text className="card-title">云同步</Text>
      <Text className="muted small">{cloud.statusText}</Text>

      <View className="cloud-facts">
        <View className="cloud-fact">
          <Text className="muted small">账号</Text>
          <Text>{cloud.accountId ? cloud.accountId.slice(0, 8) : '——'}</Text>
        </View>
        <View className="cloud-fact">
          <Text className="muted small">生成次数</Text>
          <Text>{cloud.creditsBalance ?? '——'}</Text>
        </View>
      </View>
      {cloud.notice && <Text className="notice">{cloud.notice}</Text>}

      <View className="cloud-backups">
        <Text className="muted small">
          云端覆盖本地前的存档会备份在这里，最多保留最近 2 份。
        </Text>
        {backups.map((savedAt) => (
          <View key={savedAt} className="backup-row">
            <Text className="small">{formatBackupTime(savedAt)} 的存档</Text>
            <View
              className="card-action secondary"
              onClick={() => void restoreBackup(savedAt)}
            >
              <Text>恢复备份</Text>
            </View>
          </View>
        ))}
        {restoreNotice && <Text className="notice">{restoreNotice}</Text>}
      </View>

      <View className="card-action disabled" onClick={wechatLoginPending}>
        <Text>微信登录（待开通）</Text>
      </View>
      <Text className="muted small">
        绑定微信后，换设备也能找回同一个云端账号；等服务端开通后这里会亮起来。
      </Text>
    </View>
  )
}
