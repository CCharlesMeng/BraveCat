/**
 * 手机号绑定 / 登录的客户端接线位（对应 wechatAuth.ts；微信一键授权
 * 留在 Phase 2，本期两端统一走短信验证码）。
 *
 * 与 wechatAuth.ts 不同，这里不手写 HTTP：逻辑已在
 * @bravecat/core/cloud 的 CloudSyncClient 实现（requestSmsCode /
 * bindPhone / loginWithPhone / getAuthIdentities），本文件只负责注入
 * 小程序端口（Taro.request 适配器 + wx storage 凭证）并按调用方
 * 习惯展开为独立函数。
 *
 * 错误语义（由 core 统一）：失败抛 CloudSyncError，message 是服务端
 * 中文文案可直接展示；唯一的例外是 bindPhone 的 409 冲突——返回
 * conflict 结果而不抛错，由 UI 走「切换账号 / 保留进度」二选一。
 */
import {
  createCloudSyncClient,
  type BindPhoneResult,
  type CloudCredentials,
  type PullSaveResult,
  type SmsCodePurpose,
} from '@bravecat/core/cloud'
import { taroCloudFetch } from './cloudFetch'
import { wxCloudCredentialStore } from './cloudCredentials'

const clientFor = (baseUrl: string) => createCloudSyncClient({
  baseUrl,
  fetch: taroCloudFetch,
  credentials: wxCloudCredentialStore,
})

/**
 * 请求发送短信验证码（6 位、10 分钟有效；同号 60s 冷却）。
 * 限流抛 SMS_RATE_LIMITED，通道未接入抛 SMS_UNAVAILABLE。
 */
export const requestPhoneCode = (
  baseUrl: string,
  phoneNumber: string,
  purpose: SmsCodePurpose,
): Promise<void> => clientFor(baseUrl).requestSmsCode({ phoneNumber, purpose })

/**
 * 把手机号绑定到当前账号。手机号已属其他账号时返回 conflict
 * （验证码不被消费，可原样复用给 loginWithPhoneNumber 走切换流程）；
 * 验证码错误抛 SMS_CODE_INVALID。
 */
export const bindPhoneNumber = (
  baseUrl: string,
  input: { phoneNumber: string, verificationCode: string },
): Promise<BindPhoneResult> => clientFor(baseUrl).bindPhone(input)

/**
 * 手机号验证码登录（登录注册合一）。成功后**覆盖 wx storage 里的
 * 云端凭证**——调用方必须在调用前把本地存档写入备份槽
 * （platform/cloudBackup.ts），否则切换账号会造成本地进度不可找回。
 */
export const loginWithPhoneNumber = (
  baseUrl: string,
  input: { phoneNumber: string, verificationCode: string },
): Promise<{ credentials: CloudCredentials, isNewUser: boolean }> =>
  clientFor(baseUrl).loginWithPhone(input)

/**
 * 当前账号已绑定的脱敏手机号（如 138****8000）；未绑定、无凭证或
 * 请求失败一律回 null——绑定状态只是展示信息，失败时按「未绑定」
 * 渲染表单即可，不打扰玩家。
 */
export const getBoundMaskedPhone = async (
  baseUrl: string,
): Promise<string | null> => {
  try {
    const { identities } = await clientFor(baseUrl).getAuthIdentities()
    return identities.find((identity) => identity.provider === 'phone')
      ?.maskedId ?? null
  } catch {
    return null
  }
}

/**
 * 下载云端存档（切换账号后取回目标账号进度用）。
 * 直接透传 client.pullSave；结果语义见 @bravecat/core/cloud。
 */
export const pullCloudSave = (baseUrl: string): Promise<PullSaveResult> =>
  clientFor(baseUrl).pullSave()
