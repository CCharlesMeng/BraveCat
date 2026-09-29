/**
 * 相册页的云同步小节（对应 web 端 App.svelte 的 cloud-sync 区块）。
 * 仅在 TARO_APP_API_BASE_URL 非空（cloudSync 非 null）时由父页面渲染。
 *
 * 相对 web 端多出两块小程序特有 UI：
 * - 恢复备份：云端覆盖本地前写入的备份槽（platform/cloudBackup.ts，
 *   保留最近 2 份），恢复走 controller.importDocument 的完整校验链；
 * - 绑定手机号：短信验证码绑定当前游客账号（platform/phoneAuth.ts），
 *   手机号已属其他账号时弹「切换账号 / 保留进度」二选一；微信一键
 *   授权留在 Phase 2（platform/wechatAuth.ts 保留不动）。
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Input, Text, View } from '@tarojs/components'
import {
  CloudSyncError,
  type PhoneBindExistingAccount,
} from '@bravecat/core/cloud'
import { controller } from '../../game/controller'
import type { MiniCloudSync } from '../../game/cloudSync'
import { apiBaseUrl } from '../../platform/apiBase'
import {
  listCloudBackups,
  readCloudBackup,
  writeCloudBackup,
} from '../../platform/cloudBackup'
import {
  bindPhoneNumber,
  getBoundMaskedPhone,
  loginWithPhoneNumber,
  pullCloudSave,
  requestPhoneCode,
} from '../../platform/phoneAuth'

/** 发码冷却秒数（与服务端同号 60s 冷却对齐，纯展示用）。 */
const SMS_COOLDOWN_SECONDS = 60

const pad = (value: number) => String(value).padStart(2, '0')

const formatBackupTime = (savedAt: number): string => {
  const date = new Date(savedAt)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const formatDate = (at: number): string => {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 本地脱敏兜底（服务端口径 138****8000）；切换账号后展示用。 */
const maskPhone = (phone: string): string => (
  phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone
)

const describeExistingAccount = (
  account: PhoneBindExistingAccount,
): string => [
  `创建于 ${formatDate(account.createdAt)}`,
  account.hasSave ? '有云端存档' : '暂无云端存档',
  `生成次数 ${account.creditBalance}`,
].join('、')

export default function CloudSyncSection({ sync }: { sync: MiniCloudSync }) {
  const cloud = useSyncExternalStore(sync.subscribe, sync.getSnapshot)
  const [backups, setBackups] = useState<number[]>([])
  const [restoreNotice, setRestoreNotice] = useState('')

  const [maskedPhone, setMaskedPhone] = useState<string | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)
  const [bindBusy, setBindBusy] = useState(false)
  const [phoneNotice, setPhoneNotice] = useState('')

  useDidShow(() => {
    void listCloudBackups().then(setBackups)
    // 无凭证 / 请求失败回 null，按「未绑定」展示表单即可。
    void getBoundMaskedPhone(apiBaseUrl).then(setMaskedPhone)
  })

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1_000)
    return () => clearTimeout(timer)
  }, [cooldown])

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

  const sendCode = async () => {
    if (sendingCode || cooldown > 0) return
    const phone = phoneNumber.trim()
    if (!phone) {
      setPhoneNotice('先填写手机号，再发送验证码。')
      return
    }
    setSendingCode(true)
    try {
      await requestPhoneCode(apiBaseUrl, phone, 'bind')
      setCooldown(SMS_COOLDOWN_SECONDS)
      setPhoneNotice('验证码已发送，10 分钟内有效。')
    } catch (error) {
      setPhoneNotice(error instanceof CloudSyncError
        ? error.message
        : '验证码没有发出去，请稍后再试。')
    } finally {
      setSendingCode(false)
    }
  }

  /**
   * 冲突弹窗确认后的切换流程。服务端保证 409 冲突不消费验证码，且
   * login/phone 接受仍有效的 bind 用途验证码——直接复用玩家刚输入的
   * 同一组手机号+验证码，无需重新发码。
   */
  const switchToExistingAccount = async (phone: string, code: string) => {
    // 有实质进度才备份（口径与 controller 接线的 hasLocalProgress 一致）；
    // 备份失败会抛到调用方 catch：不备份就不覆盖凭证，数据安全优先。
    if (controller.getSnapshot().game.cats.length > 0) {
      await writeCloudBackup(controller.exportDocument())
    }
    await loginWithPhoneNumber(apiBaseUrl, {
      phoneNumber: phone,
      verificationCode: code,
    })
    const pulled = await pullCloudSave(apiBaseUrl)
    if (pulled.status === 'ok') {
      await controller.importDocument(pulled.document)
      setPhoneNotice('已切换到该账号，云端进度已取回；原进度在上方备份槽。')
    } else if (pulled.status === 'schema-too-new') {
      setPhoneNotice('已切换到该账号，但云端存档来自更新的版本，请先升级小程序再取回。')
    } else {
      setPhoneNotice('已切换到该账号；云端还没有存档，会以当前进度继续。')
    }
    // 已知局限：小节顶部的「账号」展示来自 MiniCloudSync 快照，切换后
    // 仍是旧值，要到下次冷启动的启动同步才刷新；本期不刷新其内部状态。
    setMaskedPhone(await getBoundMaskedPhone(apiBaseUrl) ?? maskPhone(phone))
  }

  const submitBind = async () => {
    if (bindBusy) return
    const phone = phoneNumber.trim()
    const code = smsCode.trim()
    if (!phone || !code) {
      setPhoneNotice('手机号和验证码都填好后再绑定。')
      return
    }
    setBindBusy(true)
    try {
      const result = await bindPhoneNumber(apiBaseUrl, {
        phoneNumber: phone,
        verificationCode: code,
      })
      if (result.status === 'bound') {
        setMaskedPhone(result.maskedPhone)
        setPhoneNotice('绑定成功，换设备也能用这个手机号找回账号。')
        return
      }
      const { confirm } = await Taro.showModal({
        title: '手机号已绑定其他账号',
        content: `该账号${describeExistingAccount(result.existingAccount)}。`
          + '切换后当前进度会先存入备份槽，再取回该账号的云端进度。',
        confirmText: '切换账号',
        cancelText: '保留进度',
      })
      if (!confirm) {
        setPhoneNotice('已保留当前进度，手机号未绑定。')
        return
      }
      await switchToExistingAccount(phone, code)
    } catch (error) {
      setPhoneNotice(error instanceof CloudSyncError
        ? error.message
        : '这次没能绑定，请稍后再试。')
    } finally {
      setBindBusy(false)
    }
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

      <View className="cloud-phone">
        {maskedPhone ? (
          <>
            <Text>已绑定 {maskedPhone}</Text>
            <Text className="muted small">
              换设备时用这个手机号加验证码就能找回账号。
            </Text>
          </>
        ) : (
          <>
            <Text className="muted small">
              绑定手机号后，换设备也能找回同一个云端账号。
            </Text>
            <Input
              className="phone-input"
              type="number"
              maxlength={11}
              placeholder="手机号"
              value={phoneNumber}
              onInput={(event) => setPhoneNumber(event.detail.value)}
            />
            <View className="phone-code-row">
              <Input
                className="phone-input"
                type="number"
                maxlength={6}
                placeholder="验证码"
                value={smsCode}
                onInput={(event) => setSmsCode(event.detail.value)}
              />
              <View
                className={'card-action secondary'
                  + (sendingCode || cooldown > 0 ? ' disabled' : '')}
                onClick={() => void sendCode()}
              >
                <Text>
                  {cooldown > 0 ? `${cooldown}s 后重发` : '发送验证码'}
                </Text>
              </View>
            </View>
            <View
              className={`card-action${bindBusy ? ' disabled' : ''}`}
              onClick={() => void submitBind()}
            >
              <Text>{bindBusy ? '绑定中……' : '绑定手机号'}</Text>
            </View>
          </>
        )}
        {phoneNotice && <Text className="notice">{phoneNotice}</Text>}
      </View>
    </View>
  )
}
