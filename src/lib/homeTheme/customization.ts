/**
 * 家外观选择的形状校验与回退归一化。
 *
 * 校验只看结构，不看 ID 是否仍然存在——存档引用已下架内容不算损坏。
 * 未知或不兼容的选择在解析前由 normalizeHomeCustomization 回退到
 * 对应 form 的预设默认值，与「更换 HomeForm 时不兼容者回退」共用
 * 同一条路径。
 */
import { homeFormFor } from './forms'
import { homePieceFor } from './pieces'
import { CLASSIC_V4_PRESET, HOME_THEME_PRESETS } from './presets'
import type {
  HomeCustomization,
  HomeFormDefinition,
  HomeSocket,
  HomeThemePreset,
} from './types'

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

export const presetForForm = (form: HomeFormDefinition): HomeThemePreset => (
  HOME_THEME_PRESETS.find((preset) => preset.formId === form.id)
  ?? CLASSIC_V4_PRESET
)

/** 部件存在、种类匹配且声明兼容该 socket 才算可装入。 */
export const isPieceAllowedInSocket = (
  pieceId: string,
  socket: HomeSocket,
) => {
  const piece = homePieceFor(pieceId)
  return piece !== null
    && piece.kind === socket.kind
    && piece.compatibleProfiles.includes(socket.compatibilityProfile)
}

/**
 * 把任意形状合法的选择归一化成当前注册表可解析的选择：
 * 未知 form 整体回退默认预设；未知 finish 回退该 form 预设默认值；
 * 指向不存在 socket 的条目丢弃；已下架或不兼容的部件回退该 socket
 * 的预设默认值。选择本身已合法时原样返回同一个对象引用。
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
  let piecesChanged = false
  const pieces: Record<string, string> = {}
  for (const [socketId, pieceId] of Object.entries(selection.pieces)) {
    const socket = form.sockets.find(({ id }) => id === socketId)
    if (!socket) {
      piecesChanged = true
      continue
    }
    if (isPieceAllowedInSocket(pieceId, socket)) {
      pieces[socketId] = pieceId
      continue
    }
    piecesChanged = true
    const fallback = preset.pieces[socketId]
    if (fallback) pieces[socketId] = fallback
  }

  if (finishId === selection.finishId && !piecesChanged) return selection

  return {
    ...selection,
    finishId,
    pieces,
  }
}
