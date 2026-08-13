import { beforeEach, describe, expect, it, vi } from 'vitest'
import taro, { resetTaroMock, state } from './testing/taroMock'
import { createWeappRandom } from './random'

describe('createWeappRandom', () => {
  beforeEach(() => {
    resetTaroMock()
  })

  it('熵池补给后按序消费 wx.getRandomValues 的字节', async () => {
    state.randomBytes = Uint8Array.from([0, 1, 2, 3, 0xff, 0xff, 0xff, 0xff])
    const random = createWeappRandom()
    random.refill()
    await vi.waitFor(() => {
      expect(taro._getRandomValues).toHaveBeenCalled()
    })

    expect(random.nextUint32()).toBe(0x00_01_02_03)
    expect(random.nextUint32()).toBe(0xff_ff_ff_ff)
  })

  it('池空时退化为 Math.random 拼 32 位且不抛错', () => {
    state.randomValuesAvailable = false
    const random = createWeappRandom()
    for (let index = 0; index < 16; index += 1) {
      const value = random.nextUint32()
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(0xff_ff_ff_ff)
    }
  })

  it('补给失败后仍走退化路径，后续调用不中断', async () => {
    taro._getRandomValues.mockRejectedValueOnce(
      { errMsg: 'getRandomValues:fail' },
    )
    const random = createWeappRandom()
    const first = random.nextUint32()
    await Promise.resolve()
    const second = random.nextUint32()
    for (const value of [first, second]) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(0xff_ff_ff_ff)
    }
  })
})
