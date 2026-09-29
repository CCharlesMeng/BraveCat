import type { SmsProvider } from './ports.js'

/** 本地演示用：不真发短信，验证码直接打进程日志。 */
export const createLoggingSmsProvider = (
  log: (message: string) => void = console.log,
): SmsProvider => ({
  sendCode: async (phone, code) => {
    log(`[SMS] 发送验证码 ${code} 到 ${phone}`)
    return { ok: true }
  },
})

export interface RecordingSmsProvider extends SmsProvider {
  sent: { phone: string; code: string }[]
  /** 最近一次发到该号码的验证码（测试断言与绑定辅助用）。 */
  lastCodeFor(phone: string): string | undefined
}

/** 测试用：记录全部发码，供用例读取真实验证码完成绑定/登录。 */
export const createRecordingSmsProvider = (): RecordingSmsProvider => {
  const sent: { phone: string; code: string }[] = []
  return {
    sent,
    lastCodeFor: (phone) =>
      [...sent].reverse().find((entry) => entry.phone === phone)?.code,
    sendCode: async (phone, code) => {
      sent.push({ phone, code })
      return { ok: true }
    },
  }
}
