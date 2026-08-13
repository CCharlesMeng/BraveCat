/**
 * CloudCredentialStore 的微信小程序实现：wx storage 里的单 JSON 串
 * （对应 web 端 localStorage 的同名键，见 apps/web/src/lib/cloudSync.svelte.ts）。
 *
 * token 是不透明 bearer 凭证，服务端只存哈希，丢失即游客账号丢失
 * （ADR-0009）；wx storage 随小程序卸载清空，与 web 清 localStorage
 * 的风险面一致。存储不可用时静默降级：load 回 null（本次会话重新
 * 建号），save 失败只影响下次会话复用。
 */
import Taro from '@tarojs/taro'
import type { CloudCredentialStore, CloudCredentials } from '@bravecat/core/cloud'

const CREDENTIALS_KEY = 'bravecat.cloud.credentials'

const parseCredentials = (raw: unknown): CloudCredentials | null => {
  if (typeof raw !== 'string' || raw === '') return null
  try {
    const parsed = JSON.parse(raw) as Partial<CloudCredentials>
    return typeof parsed.userId === 'string' && typeof parsed.token === 'string'
      ? { userId: parsed.userId, token: parsed.token }
      : null
  } catch {
    return null
  }
}

export const wxCloudCredentialStore: CloudCredentialStore = {
  load: async () => {
    try {
      const { data } = await Taro.getStorage({ key: CREDENTIALS_KEY })
      return parseCredentials(data)
    } catch {
      // 键不存在或存储不可用都等价于「还没有凭证」。
      return null
    }
  },
  save: async (credentials) => {
    try {
      await Taro.setStorage({
        key: CREDENTIALS_KEY,
        data: JSON.stringify(credentials),
      })
    } catch {
      // 忽略：仅影响下次会话的复用，不影响本次同步。
    }
  },
}
