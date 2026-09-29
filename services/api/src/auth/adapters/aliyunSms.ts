import { signAliyunRpcParams } from '../../aigc/adapters/aliyunSignature.js'
import type { SmsProvider } from '../ports.js'

/**
 * 阿里云短信服务（Dysmsapi SendSms）adapter。
 *
 * env 配置与请求结构已就位；未与真实服务联调（无凭证时工厂返回 undefined，
 * 入口注入 unavailable 占位）。上线前 TODO：
 * - 用真实签名/模板对拍返回码映射（isv.BUSINESS_LIMIT_CONTROL 等限流码
 *   建议向调用方透出更明确的提示）；
 * - 国际短信走 SendMessageToGlobe，本 adapter 目前只覆盖 +86 国内号。
 */

export interface AliyunSmsConfig {
  accessKeyId: string
  accessKeySecret: string
  /** 短信签名名称（控制台审核通过的签名）。 */
  signName: string
  /** 验证码模板 code，模板变量约定为 ${code}。 */
  templateCode: string
  /** 接入点，默认 dysmsapi.aliyuncs.com。 */
  endpoint: string
}

export const createAliyunSmsProviderFromEnv = (
  env: NodeJS.ProcessEnv,
): SmsProvider | undefined => {
  const accessKeyId = env.ALIYUN_SMS_ACCESS_KEY_ID ?? env.ALIYUN_ACCESS_KEY_ID
  const accessKeySecret =
    env.ALIYUN_SMS_ACCESS_KEY_SECRET ?? env.ALIYUN_ACCESS_KEY_SECRET
  const signName = env.ALIYUN_SMS_SIGN_NAME
  const templateCode = env.ALIYUN_SMS_TEMPLATE_CODE
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    return undefined
  }
  return createAliyunSmsProvider({
    accessKeyId,
    accessKeySecret,
    signName,
    templateCode,
    endpoint: env.ALIYUN_SMS_ENDPOINT ?? 'dysmsapi.aliyuncs.com',
  })
}

interface SendSmsResponse {
  Code?: string
  Message?: string
}

/** SendSms 的 PhoneNumbers：国内号不带 +86 前缀，其余保持 E.164 去掉 +。 */
const aliyunPhoneNumber = (e164: string): string =>
  e164.startsWith('+86') ? e164.slice(3) : e164.slice(1)

export const createAliyunSmsProvider = (
  config: AliyunSmsConfig,
): SmsProvider => ({
  sendCode: async (phone, code) => {
    const query = signAliyunRpcParams({
      method: 'POST',
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      params: {
        Action: 'SendSms',
        Version: '2017-05-25',
        PhoneNumbers: aliyunPhoneNumber(phone),
        SignName: config.signName,
        TemplateCode: config.templateCode,
        TemplateParam: JSON.stringify({ code }),
      },
    })

    const response = await fetch(`https://${config.endpoint}/`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: query.toString(),
    })
    if (!response.ok) {
      throw new Error(`阿里云短信接口 HTTP ${response.status}`)
    }
    const body = (await response.json()) as SendSmsResponse
    if (body.Code !== 'OK') {
      throw new Error(
        `阿里云短信发送失败：Code=${body.Code} ${body.Message ?? ''}`,
      )
    }
    return { ok: true }
  },
})
