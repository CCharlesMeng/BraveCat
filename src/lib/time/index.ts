export interface Clock {
  now(): number
  getAcceleration(): number
  setAcceleration(multiplier: number): void
  setNow(timestamp: number): void
}

export interface ClockOptions {
  realNow?: () => number
  startAt?: number
  acceleration?: number
}

const assertAcceleration = (multiplier: number) => {
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new RangeError('时间加速倍率必须是大于 0 的有限数')
  }
}

/**
 * 游戏内唯一时间源。切换加速倍率时会保留当前投影时间，避免时间跳变。
 */
export const createClock = (options: ClockOptions = {}): Clock => {
  const realNow = options.realNow ?? Date.now
  let acceleration = options.acceleration ?? 1
  assertAcceleration(acceleration)

  let realAnchor = realNow()
  let gameAnchor = options.startAt ?? realAnchor

  const now = () => gameAnchor + (realNow() - realAnchor) * acceleration

  return {
    now,
    getAcceleration: () => acceleration,
    setAcceleration: (multiplier) => {
      assertAcceleration(multiplier)
      gameAnchor = now()
      realAnchor = realNow()
      acceleration = multiplier
    },
    setNow: (timestamp) => {
      if (!Number.isFinite(timestamp)) {
        throw new RangeError('游戏时间锚点必须是有限数')
      }
      gameAnchor = timestamp
      realAnchor = realNow()
    },
  }
}
