import type {
  GenerationProvider,
  ModerationProvider,
  PurchaseVerifier,
} from './ports.js'

/**
 * 生产入口在真实云服务未配置时注入的占位实现：
 * 审核/生成调用即抛错（执行器会把 job 置为失败并自动退回次数），
 * 购买核销返回 unavailable（路由 503）。配置齐全后由 adapters/ 的实现替换注入。
 */

export const createUnavailableModerationProvider = (): ModerationProvider => ({
  moderateImage: async () => {
    throw new Error(
      '内容审核 provider 未配置（缺少 ALIYUN_ACCESS_KEY_ID/SECRET 与 ASSET_PUBLIC_BASE_URL）',
    )
  },
})

export const createUnavailableGenerationProvider = (): GenerationProvider => {
  const unavailable = () => {
    throw new Error('形象生成 provider 未配置（缺少 DASHSCOPE_API_KEY）')
  }
  return {
    stylize: async () => unavailable(),
    generatePose: async () => unavailable(),
    removeBackground: async () => unavailable(),
  }
}

export const createUnavailablePurchaseVerifier = (): PurchaseVerifier => ({
  verify: async () => ({
    ok: false,
    code: 'unavailable',
    message:
      '购买核销通道未接入（Apple StoreKit / 微信支付核销 adapter 于 Phase 2/4 实现）',
  }),
})
