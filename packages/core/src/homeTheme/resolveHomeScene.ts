/**
 * 把「选择 ID + 动态上下文」解析成渲染层可直接消费的场景。
 *
 * 计算所有投影样式与图层选择都发生在这里；调用方不认识具体 form 的
 * 坐标，也不拼接层。未知或已下架的选择先经 normalizeHomeCustomization
 * 回退到预设默认值，因此解析对形状合法的输入总是成功。
 *
 * homeThemeId 命中 base-plate 注册表时走新路径；否则走旧 form 路径。
 * 图层次序（契约）：exterior → base plate → Cat Item base → cat →
 * postcard/souvenir/Treat → Cat Item occlusion → lighting。
 */
import {
  isPieceAllowedInSocket,
  normalizeHomeCustomization,
  presetForForm,
} from './customization'
import { catItemFor } from './catItems'
import { HOME_FORMS, homeFormFor } from './forms'
import { HOME_PIECES, homePieceFor } from './pieces'
import {
  canvasStyle,
  displayCanvasStyle,
  homeCatSpriteStyle,
  homeCatStyle,
} from './projection'
import { homeThemeFor } from './themes'
import { placementFromAnchor } from './themes/shared'
import { resolveAssetUrl } from '../ports/assetResolver'
import type {
  CatItemSlot,
  HomeActivity,
  HomeCustomization,
  HomePiece,
  HomeSceneContext,
  HomeThemeDefinition,
  ResolvedCatItemLayer,
  ResolvedHomeScene,
  SceneImageLayer,
} from './types'

const ACTIVITY_TO_SLOT: Readonly<Partial<Record<HomeActivity, CatItemSlot>>> = {
  sleep: 'rest',
  play: 'play',
  eat: 'feed',
}

const polygonBounds = (points: readonly (readonly [number, number])[]) => {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  }
}

export const listHomeForms = () => Object.values(HOME_FORMS).map((form) => ({
  id: form.id,
  name: form.name,
  shippingEligible: form.shippingEligible,
}))

/** 一个 socket 允许装入的全部注册部件。 */
export const listCompatiblePieces = (
  formId: string,
  socketId: string,
): readonly HomePiece[] => {
  const socket = homeFormFor(formId)?.sockets.find(
    ({ id }) => id === socketId,
  )
  if (!socket) return []
  return Object.values(HOME_PIECES).filter(
    (piece) => isPieceAllowedInSocket(piece.id, socket),
  )
}

/** 一个 form 可选的全部表面风格。 */
export const listHomeFinishes = (formId: string) => (
  homeFormFor(formId)?.finishes.map(({ id, name }) => ({ id, name })) ?? []
)

const resolveBasePlateScene = (
  theme: HomeThemeDefinition,
  catItemIds: Readonly<Partial<Record<CatItemSlot, string>>>,
  context: HomeSceneContext,
): ResolvedHomeScene => {
  const { canvas } = theme
  const { time, activity, portraitId } = context

  const backdrop: SceneImageLayer[] = []
  if (theme.exterior) {
    backdrop.push({
      id: `exterior-${time}`,
      src: resolveAssetUrl(theme.exterior[time]),
    })
  }
  backdrop.push({
    id: 'shell',
    src: resolveAssetUrl(theme.basePlate),
  })

  const catItems: ResolvedCatItemLayer[] = []
  const catItemOcclusion: (SceneImageLayer & { style: string })[] = []
  for (const slot of theme.slots) {
    const itemId = catItemIds[slot]
    if (!itemId) continue
    const item = catItemFor(itemId)
    const adapter = item?.adapters[theme.id]
    if (!item || !adapter) continue
    const itemStyle = canvasStyle(canvas, adapter.placement)
    catItems.push({
      slot,
      itemId: item.id,
      itemName: item.name,
      src: resolveAssetUrl(adapter.base),
      style: itemStyle,
      interactionStyle: canvasStyle(
        canvas,
        polygonBounds(adapter.interactionRegion),
      ),
    })
    if (adapter.foregroundOcclusion) {
      catItemOcclusion.push({
        id: `cat-item-occlusion-${slot}`,
        src: resolveAssetUrl(adapter.foregroundOcclusion),
        style: itemStyle,
      })
    }
  }

  const activitySlot = ACTIVITY_TO_SLOT[activity]
  const activeItemId = activitySlot ? catItemIds[activitySlot] : undefined
  const activeAdapter = activeItemId
    ? catItemFor(activeItemId)?.adapters[theme.id]
    : undefined
  const catPlacement = activeAdapter
    ? placementFromAnchor(activeAdapter.catAnchor, theme.catPlacements[activity].width)
    : theme.catPlacements[activity]
  const catAnimation = theme.catAnimationsByPortrait[portraitId]?.[activity]
  const lightingSrc = theme.lighting[time]

  return {
    formId: theme.id,
    finishId: theme.id,
    homeThemeId: theme.id,
    canvas,
    shippingEligible: theme.shippingEligible,
    backdrop,
    rearPieces: [],
    pieces: [],
    catItems,
    catItemOcclusion,
    lighting: lightingSrc
      ? { id: `lighting-${time}`, src: resolveAssetUrl(lightingSrc) }
      : null,
    cat: {
      placement: catPlacement,
      imageStyle: homeCatStyle(canvas, catPlacement),
      sprite: catAnimation
        ? {
          src: resolveAssetUrl(catAnimation.src),
          posterSrc: resolveAssetUrl(catAnimation.posterSrc),
          frameCount: catAnimation.frameCount,
          style: homeCatSpriteStyle(canvas, catPlacement),
        }
        : null,
    },
    treat: {
      placement: theme.treatPlacement,
      style: canvasStyle(canvas, theme.treatPlacement),
    },
    postcardDisplay: {
      fixtureSrc: null,
      slots: theme.postcardDisplay.slots.map((slot) => ({
        quad: slot.quad,
        contentSkewY: slot.contentSkewY,
        style: displayCanvasStyle(canvas, slot),
      })),
    },
    souvenirDisplay: {
      anchors: theme.souvenirDisplay.anchors.map((anchor) => ({
        style: displayCanvasStyle(canvas, anchor),
      })),
      occlusionSrc: null,
    },
  }
}

const resolveFormScene = (
  selection: HomeCustomization,
  context: HomeSceneContext,
): ResolvedHomeScene => {
  const form = homeFormFor(selection.formId)
  if (!form) {
    throw new RangeError(`归一化后仍无法解析房间形态：${selection.formId}`)
  }

  const finish = form.finishes.find(({ id }) => id === selection.finishId)
  if (!finish) {
    throw new RangeError(`归一化后仍无法解析表面风格：${selection.finishId}`)
  }

  const { canvas } = form
  const { time, activity, portraitId } = context

  const lightingSrc = finish.lighting[time]
  const catPlacement = form.catPlacements[activity]
  const catAnimation = form.catAnimationsByPortrait[portraitId]?.[activity]

  const backdrop: SceneImageLayer[] = []
  if (finish.exterior) {
    backdrop.push({
      id: `exterior-${time}`,
      src: resolveAssetUrl(finish.exterior[time]),
    })
  }
  backdrop.push({
    id: 'shell',
    src: resolveAssetUrl(
      finish.shell.activityVariants[activity] ?? finish.shell.default,
    ),
  })

  const preset = presetForForm(form)
  const rearPieces: SceneImageLayer[] = []
  const pieceSelections: {
    socketId: string
    kind: HomePiece['kind']
    pieceId: string
    pieceName: string
  }[] = []
  let postcardFixtureSrc: string | null = null
  let souvenirOcclusionSrc: string | null = null
  for (const socket of form.sockets) {
    const pieceId = selection.pieces[socket.id] ?? preset.pieces[socket.id]
    const piece = pieceId ? homePieceFor(pieceId) : null
    if (!piece) continue
    pieceSelections.push({
      socketId: socket.id,
      kind: socket.kind,
      pieceId: piece.id,
      pieceName: piece.name,
    })
    const rawBaseSrc = piece.art.activityVariants?.[activity] ?? piece.art.base
    const baseSrc = rawBaseSrc === null ? null : resolveAssetUrl(rawBaseSrc)
    if (socket.kind === 'postcard-display') {
      postcardFixtureSrc = baseSrc
      continue
    }
    if (baseSrc) {
      rearPieces.push({ id: `piece-${socket.id}`, src: baseSrc })
    }
    if (socket.kind === 'cabinet' && piece.art.foregroundOcclusion) {
      souvenirOcclusionSrc = resolveAssetUrl(piece.art.foregroundOcclusion)
    }
  }

  return {
    formId: form.id,
    finishId: finish.id,
    homeThemeId: null,
    canvas,
    shippingEligible: form.shippingEligible,
    backdrop,
    rearPieces,
    pieces: pieceSelections,
    catItems: [],
    catItemOcclusion: [],
    lighting: lightingSrc
      ? { id: `lighting-${time}`, src: resolveAssetUrl(lightingSrc) }
      : null,
    cat: {
      placement: catPlacement,
      imageStyle: homeCatStyle(canvas, catPlacement),
      sprite: catAnimation
        ? {
          src: resolveAssetUrl(catAnimation.src),
          posterSrc: resolveAssetUrl(catAnimation.posterSrc),
          frameCount: catAnimation.frameCount,
          style: homeCatSpriteStyle(
            canvas,
            catPlacement,
          ),
        }
        : null,
    },
    treat: {
      placement: form.treatPlacement,
      style: canvasStyle(canvas, form.treatPlacement),
    },
    postcardDisplay: {
      fixtureSrc: postcardFixtureSrc,
      slots: form.postcardDisplay.slots.map((slot) => ({
        quad: slot.quad,
        contentSkewY: slot.contentSkewY,
        style: displayCanvasStyle(canvas, slot),
      })),
    },
    souvenirDisplay: {
      anchors: form.souvenirDisplay.anchors.map((anchor) => ({
        style: displayCanvasStyle(canvas, anchor),
      })),
      occlusionSrc: souvenirOcclusionSrc,
    },
  }
}

export const resolveHomeScene = (
  selection: HomeCustomization,
  context: HomeSceneContext,
): ResolvedHomeScene => {
  const normalized = normalizeHomeCustomization(selection)
  if (normalized.homeThemeId) {
    const theme = homeThemeFor(normalized.homeThemeId)
    if (theme) {
      return resolveBasePlateScene(
        theme,
        normalized.catItems ?? {},
        context,
      )
    }
  }
  return resolveFormScene(normalized, context)
}
