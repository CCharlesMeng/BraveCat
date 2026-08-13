import { describe, expect, it } from 'vitest'
import { STARTER_ITEMS } from '../assets/starterItems'
import { resolvePackEffects } from './index'

describe('Pack effects', () => {
  it('把行囊物品归一化为行程与内容选取共同使用的效果', () => {
    const effects = resolvePackEffects(
      STARTER_ITEMS,
      [
        'fish-biscuit',
        'travel-tin',
        'small-blanket',
        'yarn-ball',
        'small-bell',
        'small-camera',
        'small-telescope',
        'ticket',
      ],
    )

    expect(effects).toEqual({
      travelDurationMultiplier: 1.25,
      secondPostcardChanceBonus: 0.2,
      companionChanceBonus: 0.1,
      poseWeights: {
        eat: 1.5,
        sleep: 1.5,
        play: 1.5,
        gaze: 1.5,
      },
      copyTagWeights: {
        food: 1.5,
      },
    })
  })

  it('忽略未知物品并把第二张明信片概率增量限制在二十个百分点', () => {
    const effects = resolvePackEffects(
      STARTER_ITEMS,
      ['small-camera', 'small-camera', 'unknown-item'],
    )

    expect(effects.secondPostcardChanceBonus).toBe(0.2)
  })
})
