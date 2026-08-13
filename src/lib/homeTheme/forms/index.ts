import type { HomeFormDefinition } from '../types'
import { CLASSIC_V4_FORM } from './classic-v4'

export const HOME_FORMS: Readonly<Record<string, HomeFormDefinition>> = {
  [CLASSIC_V4_FORM.id]: CLASSIC_V4_FORM,
}

export const homeFormFor = (formId: string): HomeFormDefinition | null => (
  HOME_FORMS[formId] ?? null
)
