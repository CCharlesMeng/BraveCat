/**
 * 家外观选择的形状校验与回退归一化。
 *
 * 校验只看结构，不看 ID 是否仍然存在——存档引用已下架内容不算损坏。
 * 未知或不兼容的选择在解析前由 normalizeHomeCustomization 回退到
 * 对应 form 的预设默认值，与「更换 HomeForm 时不兼容者回退」共用
 * 同一条路径。
 */
import { homeFormFor } from './forms'
import { CLASSIC_V4_PRESET, HOME_THEME_PRESETS } from './presets'
import type { HomeCustomization, HomeFormDefinition } from './types'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

export const isHomeCustomization = (
  value: unknown,
): value is HomeCustomization => (
  isRecord(value)
  && typeof value.formId === 'string'
  && typeof value.finishId === 'string'
  && (value.presetId === undefined || typeof value.presetId === 'string')
  && isRecord(value.pieces)
  && Object.entries(value.pieces).every(([socketId, pieceId]) => (
    typeof socketId === 'string' && typeof pieceId === 'string'
  ))
)

const presetForForm = (form: HomeFormDefinition) => (
  HOME_THEME_PRESETS.find((preset) => preset.formId === form.id)
  ?? CLASSIC_V4_PRESET
)

/**
 * 把任意形状合法的选择归一化成当前注册表可解析的选择。
 * 选择本身已合法时原样返回同一个对象引用。
 */
export const normalizeHomeCustomization = (
  selection: HomeCustomization,
): HomeCustomization => {
  const form = homeFormFor(selection.formId)
  if (!form) {
    // 整个房间形态已不存在：采用默认预设，不保留旧选择。
    return {
      presetId: CLASSIC_V4_PRESET.id,
      formId: CLASSIC_V4_PRESET.formId,
      finishId: CLASSIC_V4_PRESET.finishId,
      pieces: CLASSIC_V4_PRESET.pieces,
    }
  }

  const preset = presetForForm(form)
  const finishId = form.finishIds.includes(selection.finishId)
    ? selection.finishId
    : preset.finishId
  const pieceEntries = Object.entries(selection.pieces)
  const keptPieces = pieceEntries.filter(
    ([socketId]) => form.socketIds.includes(socketId),
  )

  if (
    finishId === selection.finishId
    && keptPieces.length === pieceEntries.length
  ) return selection

  return {
    ...selection,
    finishId,
    pieces: Object.fromEntries(keptPieces),
  }
}
