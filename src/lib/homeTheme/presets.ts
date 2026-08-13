import type { HomeCustomization, HomeThemePreset } from './types'

/** 现役 Home v4 打包成的默认主题预设。 */
export const CLASSIC_V4_PRESET = {
  id: 'classic-v4',
  formId: 'classic-v4',
  finishId: 'classic-v4-watercolor',
  pieces: {
    'postcard-display': 'classic-wall-frames',
    cabinet: 'classic-oak-cabinet',
  },
} as const satisfies HomeThemePreset

/** 错层窗台小屋（原型编号 F）的协调默认组合。 */
export const SPLIT_LEVEL_DEN_PRESET = {
  id: 'split-level-den',
  formId: 'split-level-den',
  finishId: 'split-level-den-watercolor',
  pieces: {
    scratcher: 'den-green-post',
    'feeding-set': 'den-ceramic-bowls',
  },
} as const satisfies HomeThemePreset

export const HOME_THEME_PRESETS = [
  CLASSIC_V4_PRESET,
  SPLIT_LEVEL_DEN_PRESET,
] as const

export const defaultHomeCustomization = (): HomeCustomization => ({
  presetId: CLASSIC_V4_PRESET.id,
  formId: CLASSIC_V4_PRESET.formId,
  finishId: CLASSIC_V4_PRESET.finishId,
  pieces: CLASSIC_V4_PRESET.pieces,
})
