/**
 * RandomPort 的微信小程序实现。
 *
 * 取舍说明：wx.getRandomValues 是异步 API，而 RandomPort.nextUint32
 * 是同步调用（旅行种子、姿势抽取）。因此维护一个异步补给的熵池：
 * 池内有真随机字节则直接消费；池空（冷启动首帧、API 缺失或补给失败）
 * 时退化为 Math.random 拼 32 位。该退化路径只影响熵质量，不用于任何
 * 安全用途，且池补给成功后自动回到真随机。
 */
import Taro from '@tarojs/taro'
import type { RandomPort } from '@bravecat/core'

const POOL_BYTES = 1024

export interface WeappRandom extends RandomPort {
  /** 主动补给熵池；controller 接线时调用一次即可提前预热。 */
  refill(): void
}

export const createWeappRandom = (): WeappRandom => {
  let pool = new Uint8Array(0)
  let offset = 0
  let refilling = false

  const refill = () => {
    if (refilling) return
    if (typeof Taro.getRandomValues !== 'function') return
    refilling = true
    try {
      Taro.getRandomValues({ length: POOL_BYTES })
        .then((result) => {
          pool = new Uint8Array(result.randomValues)
          offset = 0
        })
        .catch(() => {
          // 保持退化路径，下次调用再尝试补给。
        })
        .finally(() => {
          refilling = false
        })
    } catch {
      refilling = false
    }
  }

  const fallbackUint32 = () => (
    (Math.floor(Math.random() * 0x1_0000) * 0x1_0000
      + Math.floor(Math.random() * 0x1_0000)) >>> 0
  )

  return {
    refill,
    nextUint32: () => {
      if (pool.length - offset < 4) refill()
      if (pool.length - offset >= 4) {
        const value = (
          (pool[offset] << 24)
          | (pool[offset + 1] << 16)
          | (pool[offset + 2] << 8)
          | pool[offset + 3]
        ) >>> 0
        offset += 4
        return value
      }
      return fallbackUint32()
    },
  }
}

export const weappRandom = createWeappRandom()
