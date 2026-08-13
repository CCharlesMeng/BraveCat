import type { HomeCustomization, HomeThemePreset } from './types'

/** 现役 Home v4 打包成的默认主题预设。 */
export const CLASSIC_V4_PRESET = {
  id: 'classic-v4',
  formId: 'classic-v4',
  finishId: 'classic-v4-watercolor',
  pieces: {},
} as const satisfies HomeThemePreset

export const HOME_THEME_PRESETS = [CLASSIC_V4_PRESET] as const

export const defaultHomeCustomization = (): HomeCustomization => ({
  presetId: CLASSIC_V4_PRESET.id,
  formId: CLASSIC_V4_PRESET.formId,
  finishId: CLASSIC_V4_PRESET.finishId,
  pieces: CLASSIC_V4_PRESET.pieces,
})
