/**
 * PurchasePort：应用内购买端口（Phase 2 只搭结构，实现是 stub）。
 *
 * SKU 形态遵循 ADR-0006（docs/adr/0006-sell-ai-generation-not-game-currency.md）：
 * 只有「AI 形象生成次数包」与「会员」两类，不存在游戏币（Treat）直购。
 * 凭证一律交给 services/api 核销后才发放权益，客户端不自行入账。
 *
 * 接口先落在 web 端接线处；等第二个消费方（小程序端）出现时，
 * 再随其它端口一起上移到 @bravecat/core/ports。
 * 接 StoreKit 2 / Play Billing 的推荐插件与步骤见 apps/mobile/README.md。
 */

/** SKU 只有两类（ADR-0006）：生成次数包为消耗型，会员为自动续期订阅。 */
export type PurchaseProductKind = 'generation-pack' | 'membership'

export interface PurchaseProduct {
  /** App Store Connect / Play Console 里配置的商品 id。 */
  productId: string
  kind: PurchaseProductKind
  title: string
  description: string
  /** 商店返回的本地化展示价格，如「¥12.00」。 */
  displayPrice: string
}

/** 原生商店返回的购买凭证，原样上送 services/api 核销。 */
export interface PurchaseReceipt {
  platform: 'ios' | 'android'
  productId: string
  /** iOS：StoreKit 2 的 JWS transaction；Android：Play Billing 的 purchaseToken。 */
  token: string
}

export type PurchaseResult =
  | { status: 'purchased', receipt: PurchaseReceipt }
  | { status: 'cancelled' }

export interface PurchasePort {
  /** 拉取商店商品列表（生成次数包 / 会员）。 */
  listProducts: () => Promise<PurchaseProduct[]>
  /** 发起购买；成功返回待核销凭证。 */
  purchase: (productId: string) => Promise<PurchaseResult>
  /** 恢复购买（Apple 审核硬性要求），返回待核销凭证列表。 */
  restorePurchases: () => Promise<PurchaseReceipt[]>
  /**
   * 把凭证交给 services/api 核销入账的调用位。
   * 服务端用 StoreKit Server API / Play Developer API 验证凭证后
   * 才发放生成次数或会员权益（ADR-0006：生成次数严格服务端权威）。
   */
  redeemReceipt: (receipt: PurchaseReceipt) => Promise<void>
}

const notWiredYet = () => new Error('内购尚未接入，接入清单见 apps/mobile/README.md')

/** Phase 2 的占位实现：商品列表为空，购买/核销直接失败。 */
export const stubPurchasePort: PurchasePort = {
  listProducts: async () => [],
  purchase: async () => {
    throw notWiredYet()
  },
  restorePurchases: async () => [],
  redeemReceipt: async () => {
    throw notWiredYet()
  },
}

/**
 * 接线位：原生壳接入商店插件后，在这里按平台换成真实现；
 * web 端付费走网页支付（微信支付/支付宝），不经过本端口。
 */
export const purchasePort: PurchasePort = stubPurchasePort
