/**
 * 家外观选择的形状校验与回退归一化。
 *
 * 校验只看结构，不看 ID 是否仍然存在——存档引用已下架内容不算损坏。
 * 未知或不兼容的选择在解析前由 normalizeHomeCustomization 回退到
 * 对应 form / theme 的预设默认值，与「更换 HomeForm 时不兼容者回退」共用
 * 同一条路径。
 */
import { CAT_ITEMS, catItemFor } from './catItems'
import { homeFormFor } from './forms'
import { homePieceFor } from './pieces'
import { CLASSIC_V4_PRESET, HOME_THEME_PRESETS } from './presets'
import { HOME_THEMES, homeThemeFor } from './themes'
import type {
  CatItemSlot,
  HomeCustomization,
  HomeFormDefinition,
  HomeSocket,
  HomeThemeDefinition,
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
  && (value.homeThemeId === undefined || typeof value.homeThemeId === 'string')
  && isRecord(value.pieces)
  && Object.entries(value.pieces).every(([socketId, pieceId]) => (
    typeof socketId === 'string' && typeof pieceId === 'string'
  ))
  && (value.catItems === undefined || (
    isRecord(value.catItems)
    && Object.entries(value.catItems).every(([slot, itemId]) => (
      typeof slot === 'string' && typeof itemId === 'string'
    ))
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
 * 用品存在、槽位匹配且对该主题有 adapter 才可装入。
 * ADR-0010：缺任一已注册主题 adapter 的用品不进入 listCatItems，
 * 但存档仍可能引用——解析时回退默认。
 */
export const isCatItemAllowedInSlot = (
  itemId: string,
  slot: CatItemSlot,
  themeId: string,
) => {
  const item = catItemFor(itemId)
  return item !== null
    && item.slot === slot
    && item.adapters[themeId] !== undefined
}

/** 构造一份可解析的 base-plate 主题选择（含缺省 Cat Item）。 */
export const customizationForHomeTheme = (
  themeId: string,
): HomeCustomization | null => {
  const theme = homeThemeFor(themeId)
  if (!theme) return null
  return {
    presetId: theme.id,
    homeThemeId: theme.id,
    // 形状仍要求 form/finish；base-plate 路径不消费它们。
    formId: CLASSIC_V4_PRESET.formId,
    finishId: CLASSIC_V4_PRESET.finishId,
    pieces: {},
    catItems: { ...theme.defaultCatItems },
  }
}

const normalizeCatItems = (
  theme: HomeThemeDefinition,
  requested: Readonly<Partial<Record<CatItemSlot, string>>> | undefined,
): {
  catItems: Partial<Record<CatItemSlot, string>>
  changed: boolean
} => {
  const catItems: Partial<Record<CatItemSlot, string>> = {}
  let changed = false
  for (const slot of theme.slots) {
    const wanted = requested?.[slot]
    if (wanted && isCatItemAllowedInSlot(wanted, slot, theme.id)) {
      catItems[slot] = wanted
      continue
    }
    const fallback = theme.defaultCatItems[slot]
    if (fallback) catItems[slot] = fallback
    if (wanted !== fallback) changed = true
  }
  if (requested) {
    for (const slot of Object.keys(requested) as CatItemSlot[]) {
      if (!theme.slots.includes(slot)) changed = true
    }
  }
  return { catItems, changed }
}

/**
 * 把任意形状合法的选择归一化成当前注册表可解析的选择：
 * 未知 homeThemeId 整体回退默认预设；未知 catItemId / 槽位不匹配回退
 * 该主题该槽默认值；未知 form 整体回退默认预设；未知 finish 回退该
 * form 预设默认值；指向不存在 socket 的条目丢弃；已下架或不兼容的部件
 * 回退该 socket 的预设默认值。选择本身已合法时原样返回同一个对象引用。
 */
export const normalizeHomeCustomization = (
  selection: HomeCustomization,
): HomeCustomization => {
  if (selection.homeThemeId !== undefined) {
    const theme = homeThemeFor(selection.homeThemeId)
    if (!theme) {
      return {
        presetId: CLASSIC_V4_PRESET.id,
        formId: CLASSIC_V4_PRESET.formId,
        finishId: CLASSIC_V4_PRESET.finishId,
        pieces: CLASSIC_V4_PRESET.pieces,
      }
    }
    const { catItems, changed } = normalizeCatItems(theme, selection.catItems)
    const sameCatItems = !changed
      && selection.catItems !== undefined
      && theme.slots.every((slot) => selection.catItems?.[slot] === catItems[slot])
      && Object.keys(selection.catItems).every(
        (slot) => theme.slots.includes(slot as CatItemSlot),
      )
    if (sameCatItems && selection.homeThemeId === theme.id) {
      return selection
    }
    return {
      ...selection,
      homeThemeId: theme.id,
      catItems,
    }
  }

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
  const finishId = form.finishes.some(({ id }) => id === selection.finishId)
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

/**
 * ADR-0010：某 Cat Item 缺任一已注册 base-plate 主题的 adapter 就不进列表。
 * 可选按槽位过滤。
 */
export const listCatItems = (slot?: CatItemSlot) => {
  const themeIds = Object.keys(HOME_THEMES)
  return Object.values(CAT_ITEMS)
    .filter((item) => (
      (slot === undefined || item.slot === slot)
      && themeIds.every((themeId) => item.adapters[themeId] !== undefined)
    ))
    .map(({ id, slot: itemSlot, name }) => ({ id, slot: itemSlot, name }))
}
