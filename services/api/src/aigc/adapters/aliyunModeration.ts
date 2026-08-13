import type { ModerationProvider } from '../ports.js'
import { signAliyunRpcParams } from './aliyunSignature.js'

/**
 * 阿里云内容安全（图片审核增强版 ImageModeration）adapter。
 *
 * env 配置与请求结构已就位；未与真实服务联调（无凭证时工厂返回 undefined，
 * 入口注入 unavailable 占位）。上线前必须用官方测试图核对 RiskLevel 映射，
 * 并把 imageUrlForKey 换成审核专用的带签名临时 URL。
 */

export interface AliyunModerationConfig {
  accessKeyId: string
  accessKeySecret: string
  /** 接入点，如 green-cip.cn-shanghai.aliyuncs.com（就近选择已开通的地域）。 */
  endpoint: string
  /** 服务编码：baselineCheck（通用基线检测）等，控制台可配。 */
  service: string
  /** 把对象存储 key 转为审核服务可访问的图片 URL。 */
  imageUrlForKey: (key: string) => string
}

export const createAliyunModerationProviderFromEnv = (
  env: NodeJS.ProcessEnv,
): ModerationProvider | undefined => {
  const accessKeyId = env.ALIYUN_ACCESS_KEY_ID
  const accessKeySecret = env.ALIYUN_ACCESS_KEY_SECRET
  const publicBaseUrl = env.ASSET_PUBLIC_BASE_URL
  if (!accessKeyId || !accessKeySecret || !publicBaseUrl) {
    return undefined
  }
  return createAliyunModerationProvider({
    accessKeyId,
    accessKeySecret,
    endpoint: env.ALIYUN_GREEN_ENDPOINT ?? 'green-cip.cn-shanghai.aliyuncs.com',
    service: env.ALIYUN_GREEN_SERVICE ?? 'baselineCheck',
    imageUrlForKey: (key) => `${publicBaseUrl.replace(/\/+$/, '')}/${key}`,
  })
}

interface ImageModerationResponse {
  Code?: number | string
  Msg?: string
  Data?: {
    RiskLevel?: string
    Result?: { Label?: string; Confidence?: number }[]
  }
}

export const createAliyunModerationProvider = (
  config: AliyunModerationConfig,
): ModerationProvider => ({
  moderateImage: async ({ key }) => {
    const query = signAliyunRpcParams({
      method: 'POST',
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      params: {
        Action: 'ImageModeration',
        Version: '2022-03-02',
        Service: config.service,
        ServiceParameters: JSON.stringify({
          imageUrl: config.imageUrlForKey(key),
          dataId: key,
        }),
      },
    })

    const response = await fetch(`https://${config.endpoint}/`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: query.toString(),
    })
    if (!response.ok) {
      throw new Error(`内容安全接口 HTTP ${response.status}`)
    }
    const body = (await response.json()) as ImageModerationResponse
    if (Number(body.Code) !== 200) {
      throw new Error(`内容安全接口错误：Code=${body.Code} ${body.Msg ?? ''}`)
    }

    // 保守策略：high 与 medium 都拒绝（用户可换照片，审核义务不可漏）。
    const riskLevel = body.Data?.RiskLevel?.toLowerCase()
    if (riskLevel === 'high' || riskLevel === 'medium') {
      const label = body.Data?.Result?.[0]?.Label
      return {
        verdict: 'reject',
        reason: `内容审核未通过（riskLevel=${riskLevel}${label ? `，label=${label}` : ''}）`,
      }
    }
    return { verdict: 'pass' }
  },
})
