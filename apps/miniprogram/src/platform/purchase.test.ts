import { beforeEach, describe, expect, it } from 'vitest'
import { resetTaroMock, state } from './testing/taroMock'
import { isVirtualPaymentBlocked, weappPurchasePort } from './purchase'

describe('weappPurchasePort', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('iOS 端禁虚拟支付：canPurchase 为 false，购买入口不渲染', () => {
    state.devicePlatform = 'ios'
    expect(isVirtualPaymentBlocked()).toBe(true)
    expect(weappPurchasePort.canPurchase()).toBe(false)
  })

  it('Android 端可购买', () => {
    state.devicePlatform = 'android'
    expect(weappPurchasePort.canPurchase()).toBe(true)
  })

  it('stub：商品列表为空，购买/核销以接线提示失败', async () => {
    await expect(weappPurchasePort.listProducts()).resolves.toEqual([])
    await expect(weappPurchasePort.purchase('generation-pack-10'))
      .rejects.toThrow('微信支付尚未接入')
    await expect(weappPurchasePort.redeemReceipt({
      platform: 'wechat',
      productId: 'generation-pack-10',
      token: 'order-1',
    })).rejects.toThrow('微信支付尚未接入')
  })
})
