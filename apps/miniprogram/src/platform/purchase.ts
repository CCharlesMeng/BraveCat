/**
 * PurchasePort 的微信小程序版接口（与 apps/web/src/lib/platform/purchase.ts
 * 对齐；等本端真正接线时，两端接口一起上移到 @bravecat/core/ports）。
 *
 * SKU 形态遵循 ADR-0006（docs/adr/0006-sell-ai-generation-not-game-currency.md）：
 * 只有「AI 形象生成次数包」与「会员」两类，不存在游戏币（Treat）直购，
 * 小铺只收 Treat、付费入口独立于小铺。
 *
 * 支付链路（实现为 stub，接线清单见 README）：
 * 1. 客户端向 services/api 请求统一下单，拿到 wx.requestPayment 参数；
 * 2. wx.requestPayment 拉起微信支付；
 * 3. 微信支付回调打到 services/api，服务端核销后发放生成次数
 *    （POST /v1/credits/purchases，platform='wechat'，见
 *    @bravecat/contracts/credits；次数严格服务端权威）。
 *
 * iOS 端禁虚拟支付：iOS 微信小程序不允许售卖虚拟商品，购买入口必须
 * 隐藏（canPurchase() === false），只保留已购权益的消费；购买引导到
 * Android / App / Web 端完成。
 */
import Taro from '@tarojs/taro'

/** SKU 只有两类（ADR-0006）：生成次数包为消耗型，会员为订阅。 */
export type PurchaseProductKind = 'generation-pack' | 'membership'

export interface PurchaseProduct {
  productId: string
  kind: PurchaseProductKind
  title: string
  description: string
  /** 展示价格，如「¥12.00」。 */
  displayPrice: string
}

/** 待核销凭证；platform/token 语义对齐 @bravecat/contracts/credits。 */
export interface WeappPurchaseReceipt {
  platform: 'wechat'
  productId: string
  /** 微信支付商户订单号，上送 services/api 核销后才入账。 */
  token: string
}

export type WeappPurchaseResult =
  | { status: 'purchased', receipt: WeappPurchaseReceipt }
  | { status: 'cancelled' }

export interface WeappPurchasePort {
  /** iOS 禁虚拟支付：false 时购买入口一律不渲染。 */
  canPurchase: () => boolean
  listProducts: () => Promise<PurchaseProduct[]>
  purchase: (productId: string) => Promise<WeappPurchaseResult>
  /** 凭证交给 services/api 核销入账（生成次数严格服务端权威）。 */
  redeemReceipt: (receipt: WeappPurchaseReceipt) => Promise<void>
}

/** iOS 端微信小程序禁虚拟支付；平台探测失败时按可购买处理（服务端仍会核销把关）。 */
export const isVirtualPaymentBlocked = (): boolean => {
  try {
    if (typeof Taro.getDeviceInfo === 'function') {
      return Taro.getDeviceInfo().platform === 'ios'
    }
    return Taro.getSystemInfoSync().platform === 'ios'
  } catch {
    return false
  }
}

const notWiredYet = () => new Error(
  '微信支付尚未接入：需要 services/api 的统一下单接口与支付回调核销位，接线清单见 apps/miniprogram/README.md',
)

/** stub 实现：商品列表为空，购买/核销直接失败；iOS gating 已生效。 */
export const weappPurchasePort: WeappPurchasePort = {
  canPurchase: () => !isVirtualPaymentBlocked(),
  listProducts: async () => [],
  purchase: async () => {
    throw notWiredYet()
  },
  redeemReceipt: async () => {
    throw notWiredYet()
  },
}
