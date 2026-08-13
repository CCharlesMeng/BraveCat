/**
 * 把「选择 ID + 动态上下文」解析成渲染层可直接消费的场景。
 *
 * 计算所有投影样式与图层选择都发生在这里；调用方不认识具体 form 的
 * 坐标，也不拼接层。未知或已下架的选择先经 normalizeHomeCustomization
 * 回退到预设默认值，因此解析对形状合法的输入总是成功。
 */
import {
  isPieceAllowedInSocket,
  normalizeHomeCustomization,
  presetForForm,
} from './customization'
import { HOME_FORMS, homeFormFor } from './forms'
import { HOME_PIECES, homePieceFor } from './pieces'
import {
  canvasStyle,
  displayCanvasStyle,
  homeCatSpriteStyle,
  homeCatStyle,
} from './projection'
import type {
  HomeCustomization,
  HomePiece,
  HomeSceneContext,
  ResolvedHomeScene,
  SceneImageLayer,
} from './types'

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

export const resolveHomeScene = (
  selection: HomeCustomization,
  context: HomeSceneContext,
): ResolvedHomeScene => {
  const normalized = normalizeHomeCustomization(selection)
  const form = homeFormFor(normalized.formId)
  if (!form) {
    throw new RangeError(`归一化后仍无法解析房间形态：${normalized.formId}`)
  }

  const finish = form.finishes.find(({ id }) => id === normalized.finishId)
  if (!finish) {
    throw new RangeError(`归一化后仍无法解析表面风格：${normalized.finishId}`)
  }

  const { canvas } = form
  const { time, activity, portraitId } = context

  const lightingSrc = finish.lighting[time]
  const catPlacement = form.catPlacements[activity]
  const catAnimation = form.catAnimationsByPortrait[portraitId]?.[activity]

  const backdrop: SceneImageLayer[] = []
  if (finish.exterior) {
    backdrop.push({ id: `exterior-${time}`, src: finish.exterior[time] })
  }
  backdrop.push({
    id: 'shell',
    src: finish.shell.activityVariants[activity] ?? finish.shell.default,
  })

  // 逐 socket 解析部件；normalize 已保证条目合法，缺省用预设默认值。
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
    const pieceId = normalized.pieces[socket.id] ?? preset.pieces[socket.id]
    const piece = pieceId ? homePieceFor(pieceId) : null
    if (!piece) continue
    pieceSelections.push({
      socketId: socket.id,
      kind: socket.kind,
      pieceId: piece.id,
      pieceName: piece.name,
    })
    const baseSrc = piece.art.activityVariants?.[activity] ?? piece.art.base
    if (socket.kind === 'postcard-display') {
      // 画框墙 fixture 与明信片同区渲染，走 postcardDisplay 通道。
      postcardFixtureSrc = baseSrc
      continue
    }
    if (baseSrc) {
      rearPieces.push({ id: `piece-${socket.id}`, src: baseSrc })
    }
    if (socket.kind === 'cabinet' && piece.art.foregroundOcclusion) {
      souvenirOcclusionSrc = piece.art.foregroundOcclusion
    }
  }

  return {
    formId: form.id,
    finishId: finish.id,
    canvas,
    shippingEligible: form.shippingEligible,
    backdrop,
    rearPieces,
    pieces: pieceSelections,
    lighting: lightingSrc
      ? { id: `lighting-${time}`, src: lightingSrc }
      : null,
    cat: {
      placement: catPlacement,
      imageStyle: homeCatStyle(canvas, catPlacement),
      sprite: catAnimation
        ? {
          src: catAnimation.src,
          frameCount: catAnimation.frameCount,
          style: homeCatSpriteStyle(canvas, catPlacement, catAnimation.src),
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
