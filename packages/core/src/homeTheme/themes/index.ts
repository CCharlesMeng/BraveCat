import type { HomeThemeDefinition } from '../types'
import { A_CLEAR_SAGE_THEME } from './a-clear-sage'
import { B_WARM_WALNUT_GALLERY_THEME } from './b-warm-walnut-gallery'
import { F_MOONWHITE_BLUEGRAY_THEME } from './f-moonwhite-bluegray'

export const HOME_THEMES: Readonly<Record<string, HomeThemeDefinition>> = {
  [A_CLEAR_SAGE_THEME.id]: A_CLEAR_SAGE_THEME,
  [B_WARM_WALNUT_GALLERY_THEME.id]: B_WARM_WALNUT_GALLERY_THEME,
  [F_MOONWHITE_BLUEGRAY_THEME.id]: F_MOONWHITE_BLUEGRAY_THEME,
}

export const homeThemeFor = (
  themeId: string,
): HomeThemeDefinition | null => HOME_THEMES[themeId] ?? null

export const listHomeThemes = () => Object.values(HOME_THEMES).map((theme) => ({
  id: theme.id,
  name: theme.name,
  shippingEligible: theme.shippingEligible,
  kind: theme.kind,
}))

export {
  A_CLEAR_SAGE_THEME,
  B_WARM_WALNUT_GALLERY_THEME,
  F_MOONWHITE_BLUEGRAY_THEME,
}
