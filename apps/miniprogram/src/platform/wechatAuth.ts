/**
 * 微信登录（游客账号绑定微信身份）的客户端接线位。
 *
 * 链路已完整封装：wx.login 拿一次性 code → 带 bearer token POST
 * services/api 的 /v1/auth/bind/wechat（服务端骨架路由，用 code 换
 * openid/unionid 的 OAuth 流程在 Phase 2 实现，当前固定回 501）。
 *
 * 服务端 501 归一为 'not-open' 结果——UI 入口据此标注「待开通」，
 * 不把骨架状态当错误弹给玩家。服务端实现落地后本文件无需改动。
 */
import Taro from '@tarojs/taro'
import {
  CloudSyncError,
  type CloudCredentialStore,
  type CloudFetch,
} from '@bravecat/core/cloud'
import { taroCloudFetch } from './cloudFetch'
import { wxCloudCredentialStore } from './cloudCredentials'

export type WechatBindResult =
  /** 绑定成功；同一 userId 此后可经微信身份找回。 */
  | { status: 'bound'; userId: string }
  /** 服务端还是 501 骨架（Phase 2 开通前的常态）。 */
  | { status: 'not-open' }

export interface WechatBindOptions {
  baseUrl: string
  /** 测试注入位；默认 Taro.request 适配器与 wx storage 凭证。 */
  fetch?: CloudFetch
  credentials?: CloudCredentialStore
}

export const bindWechatAccount = async (
  options: WechatBindOptions,
): Promise<WechatBindResult> => {
  const fetch = options.fetch ?? taroCloudFetch
  const store = options.credentials ?? wxCloudCredentialStore

  const credentials = await store.load()
  if (!credentials) {
    throw new CloudSyncError(
      'TOKEN_MISSING',
      '本地没有云端账号凭证，请先完成一次云同步再绑定微信',
    )
  }

  const { code } = await Taro.login()
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/v1/auth/bind/wechat`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${credentials.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ code }),
  })

  if (response.status === 200) {
    const body = (await response.json()) as { userId: string }
    return { status: 'bound', userId: body.userId }
  }
  if (response.status === 501) {
    return { status: 'not-open' }
  }

  let message = `微信绑定失败（HTTP ${response.status}）`
  try {
    const body = (await response.json()) as {
      error?: { message?: string }
    }
    if (body.error?.message) message = body.error.message
  } catch {
    // 响应体不可解析时保留默认文案。
  }
  throw new CloudSyncError('INTERNAL_ERROR', message, response.status)
}
