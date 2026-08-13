import type { HomeFormDefinition } from '../types'
import { CLASSIC_V4_FORM } from './classic-v4'
import { SPLIT_LEVEL_DEN_FORM } from './split-level-den'

export const HOME_FORMS: Readonly<Record<string, HomeFormDefinition>> = {
  [CLASSIC_V4_FORM.id]: CLASSIC_V4_FORM,
  [SPLIT_LEVEL_DEN_FORM.id]: SPLIT_LEVEL_DEN_FORM,
}

export const homeFormFor = (formId: string): HomeFormDefinition | null => (
  HOME_FORMS[formId] ?? null
)
