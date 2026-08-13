/**
 * 把「选择 ID + 动态上下文」解析成渲染层可直接消费的场景。
 *
 * 计算所有投影样式与图层选择都发生在这里；调用方不认识具体 form 的
 * 坐标，也不拼接层。未知或已下架的选择先经 normalizeHomeCustomization
 * 回退到预设默认值，因此解析对形状合法的输入总是成功。
 */
import { normalizeHomeCustomization } from './customization'
import { HOME_FORMS, homeFormFor } from './forms'
import {
  canvasStyle,
  displayCanvasStyle,
  homeCatSpriteStyle,
  homeCatStyle,
} from './projection'
import type {
  HomeCustomization,
  HomeSceneContext,
  ResolvedHomeScene,
} from './types'

export const listHomeForms = () => Object.values(HOME_FORMS).map((form) => ({
  id: form.id,
  name: form.name,
  shippingEligible: form.shippingEligible,
}))

export const resolveHomeScene = (
  selection: HomeCustomization,
  context: HomeSceneContext,
): ResolvedHomeScene => {
  const normalized = normalizeHomeCustomization(selection)
  const form = homeFormFor(normalized.formId)
  if (!form) {
    throw new RangeError(`归一化后仍无法解析房间形态：${normalized.formId}`)
  }

  const { canvas } = form
  const { time, activity, portraitId } = context

  const lightingSrc = form.lighting[time]
  const catPlacement = form.catPlacements[activity]
  const catAnimation = form.catAnimationsByPortrait[portraitId]?.[activity]

  return {
    formId: form.id,
    canvas,
    shippingEligible: form.shippingEligible,
    exterior: { id: `exterior-${time}`, src: form.exterior[time] },
    shell: {
      id: 'shell',
      src: form.shell.activityVariants[activity] ?? form.shell.default,
    },
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
      fixtureSrc: form.postcardDisplay.fixtureSrc,
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
      occlusionSrc: form.souvenirDisplay.occlusionSrc,
    },
  }
}
