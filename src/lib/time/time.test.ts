import { describe, expect, it } from 'vitest'
import { createClock } from './index'

describe('Clock', () => {
  it('在开发者加速开启后投影游戏时间', () => {
    let realNow = 1_000
    const clock = createClock({
      realNow: () => realNow,
      acceleration: 4,
    })

    realNow = 2_500

    expect(clock.now()).toBe(7_000)
  })

  it('切换加速倍率时游戏时间连续且可以恢复实时', () => {
    let realNow = 1_000
    const clock = createClock({
      realNow: () => realNow,
    })

    realNow = 2_000
    clock.setAcceleration(10)
    expect(clock.now()).toBe(2_000)

    realNow = 2_500
    expect(clock.now()).toBe(7_000)

    clock.setAcceleration(1)
    realNow = 3_000
    expect(clock.now()).toBe(7_500)
  })
})
