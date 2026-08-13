/**
 * 画布投影工具：把设计画布坐标转换成响应式 CSS 定位。
 *
 * 所有函数以 form 的设计画布为参数，本身不携带任何具体房间的尺寸。
 */
import type {
  CanvasRect,
  CanvasSize,
  CatPlacement,
  DisplayRect,
  PaintBounds,
  ProjectedDisplayRect,
} from './types'

export const canvasStyle = (
  canvas: CanvasSize,
  rect: CanvasRect,
) => [
  `left: ${(rect.x / canvas.width) * 100}%`,
  `top: ${(rect.y / canvas.height) * 100}%`,
  `width: ${(rect.width / canvas.width) * 100}%`,
  `height: ${(rect.height / canvas.height) * 100}%`,
].join('; ')

export const homeCatStyle = (
  canvas: CanvasSize,
  placement: CatPlacement,
) => [
  canvasStyle(canvas, placement),
  `transform: scaleX(${placement.flip ? -1 : 1})`,
].join('; ')

export const homeCatSpriteStyle = (
  canvas: CanvasSize,
  placement: CatPlacement,
  animationSrc: string,
) => [
  homeCatStyle(canvas, placement),
  `--home-cat-animation-src: url("${animationSrc}")`,
].join('; ')

export const paintedCanvasRect = (
  placement: CatPlacement,
  bounds: PaintBounds,
) => {
  const sourceX = placement.flip
    ? bounds.sourceWidth - bounds.x - bounds.width
    : bounds.x
  const x = placement.x + (sourceX / bounds.sourceWidth) * placement.width
  const y = placement.y + (bounds.y / bounds.sourceHeight) * placement.height
  const width = (bounds.width / bounds.sourceWidth) * placement.width
  const height = (bounds.height / bounds.sourceHeight) * placement.height

  return {
    x,
    y,
    width,
    height,
    right: x + width,
    bottom: y + height,
  }
}

export const displayCanvasStyle = (
  canvas: CanvasSize,
  rect: DisplayRect | ProjectedDisplayRect,
) => {
  if (!('quad' in rect)) {
    return [
      canvasStyle(canvas, rect),
      `z-index: ${rect.zIndex ?? 1}`,
      `transform: skewY(${rect.skewY ?? 0}deg) rotate(${rect.rotation}deg)`,
    ].join('; ')
  }

  const xs = rect.quad.map(([x]) => x)
  const ys = rect.quad.map(([, y]) => y)
  const bounds = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
  const polygon = rect.quad.map(([x, y]) => [
    ((x - bounds.x) / bounds.width) * 100,
    ((y - bounds.y) / bounds.height) * 100,
  ].map((value) => `${value}%`).join(' ')).join(', ')

  return [
    canvasStyle(canvas, bounds),
    `z-index: ${rect.zIndex ?? 1}`,
    `clip-path: polygon(${polygon})`,
    `--display-content-skew-y: ${rect.contentSkewY}deg`,
  ].join('; ')
}
