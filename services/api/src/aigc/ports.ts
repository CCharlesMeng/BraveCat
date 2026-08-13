import type { PortraitPose, PurchasePlatform } from '@bravecat/contracts'

/**
 * AIGC 形象管线的可插拔 provider 端口。
 * 生产实现见 src/aigc/adapters/（阿里云内容安全 / 百炼万相 / S3 兼容对象存储），
 * 测试与本地开发用 src/aigc/fakes.ts 的内存实现。
 */

/** 审核判定：reject 是业务拒绝；provider 故障请抛错（归类为生成失败而非审核拒绝）。 */
export type ModerationVerdict =
  | { verdict: 'pass' }
  | { verdict: 'reject'; reason: string }

export interface ModerationInput {
  /** 照片在对象存储中的 key（生产 adapter 需将其转为审核可访问的 URL）。 */
  key: string
  bytes: Uint8Array
}

/** 用户上传照片的内容审核端口（生产：阿里云内容安全图片审核增强版）。 */
export interface ModerationProvider {
  moderateImage(input: ModerationInput): Promise<ModerationVerdict>
}

/** 风格化产物：逐姿势生成时的身份参考。 */
export interface StylizedCharacter {
  /** 特征锁定文字（花色分块/眼色/体型逐条锁定），随参考图进入逐姿势提示词。 */
  featureLock: string
  /** 身份参考图（用户照片或风格化基准图）。 */
  referenceImage: Uint8Array
}

/**
 * 形象生成端口（生产：阿里云百炼/通义万相）。
 * 按 spike 管线建议组织为三步调用结构：
 * stylize（特征提取/风格化）→ generatePose（逐姿势，双参考图 + 特征文字）
 * → removeBackground（抠图后处理：浅底 → 透明 RGBA，禁用阈值法、须用分割模型）。
 */
export interface GenerationProvider {
  stylize(input: { photo: Uint8Array }): Promise<StylizedCharacter>
  generatePose(input: {
    character: StylizedCharacter
    pose: PortraitPose
  }): Promise<Uint8Array>
  removeBackground(input: { image: Uint8Array }): Promise<Uint8Array>
}

/** S3 兼容对象存储端口：用户上传照片与生成产出图（生产：阿里云 OSS S3 兼容用法）。 */
export interface AssetStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>
  get(key: string): Promise<Uint8Array | undefined>
  exists(key: string): Promise<boolean>
}

/** 购买凭证核销结果；unavailable 表示核销通道未接入（路由返回 503）。 */
export type PurchaseVerification =
  | { ok: true; orderId: string; credits: number }
  | { ok: false; code: 'invalid_receipt' | 'unavailable'; message: string }

/**
 * 生成次数包购买核销端口。
 * Apple StoreKit Server API / 微信支付核销 adapter 在 Phase 2/4 客户端接入时
 * 实现同一端口；测试与联调注入 fakes.ts 的 stub。
 */
export interface PurchaseVerifier {
  verify(input: {
    platform: PurchasePlatform
    receipt: string
  }): Promise<PurchaseVerification>
}
