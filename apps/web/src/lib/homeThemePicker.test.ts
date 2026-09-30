import { describe, expect, it } from 'vitest'
import {
  customizationForHomeTheme,
  listCatItems,
  listHomeThemes,
  normalizeHomeCustomization,
} from '@bravecat/core/homeTheme'

/**
 * HomeThemePicker 映射契约：组件内联 apply* 调用这些 core API。
 * Theme Lab（?themeLab）只改内存、不写存档；持久化走 HomeThemePicker →
 * applyHomeCustomization。
 */
describe('HomeThemePicker mapping', () => {
  it('maps A/B/F theme picks to base-plate customizations with defaults', () => {
    for (const themeId of listHomeThemes().map(({ id }) => id)) {
      const next = customizationForHomeTheme(themeId)
      expect(next).toMatchObject({
        homeThemeId: themeId,
        catItems: {
          rest: 'rest-cloud-bed',
          play: 'play-soft-tunnel',
          feed: 'feed-daily-bowls',
        },
      })
    }
  })

  it('preserves cat-item semantic ids across theme switches (ADR-0010)', () => {
    const fromA = customizationForHomeTheme('a-clear-sage')!
    const toB = customizationForHomeTheme('b-warm-walnut-gallery')!
    // 与 HomeThemePicker.applyBasePlateTheme 相同合并顺序。
    const switched = {
      ...toB,
      catItems: {
        ...toB.catItems,
        ...fromA.catItems,
      },
    }
    expect(normalizeHomeCustomization(switched).catItems).toEqual({
      rest: 'rest-cloud-bed',
      play: 'play-soft-tunnel',
      feed: 'feed-daily-bowls',
    })
  })

  it('exposes only fully-adapted Cat Items for slot groups', () => {
    expect(listCatItems('rest').map(({ id }) => id)).toEqual(['rest-cloud-bed'])
    expect(listCatItems('play').map(({ id }) => id)).toEqual(['play-soft-tunnel'])
    expect(listCatItems('scratch')).toEqual([])
    expect(listCatItems('feed').map(({ id }) => id)).toEqual(['feed-daily-bowls'])
  })
})
