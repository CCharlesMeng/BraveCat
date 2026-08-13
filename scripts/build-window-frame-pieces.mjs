/**
 * A/B/F window-frame base 部件装配（生产顺序第 4 步，件序第 5 件提前，
 * 因 treat 锚点依赖窗台）：
 *
 * 绿幕窗框（洞内也是纯绿）键控后，以「洞对位」方式落位：检测素材内
 * 透明洞的边界，把洞精确映射到 geometry v02 的实测窗洞（A/B 为矩形，
 * F 为透视 quad——按窗洞平面的列线性映射整体变形，框/帘/窗台随平面
 * 一致倾斜），框体、窗台与帘布随映射比例外扩。输出透明部件与 QA。
 *
 * Usage:
 *   node scripts/build-window-frame-pieces.mjs
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const width = 1200
const height = 1600
const stagingRoot = '/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets'
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)

const FORMS = [
  { slug: 'a-clear-sage', source: 'window-frame-a-sage-greenscreen-v01.png' },
  { slug: 'b-warm-walnut-gallery', source: 'window-frame-b-walnut-greenscreen-v01.png' },
  { slug: 'f-moonwhite-bluegray', source: 'window-frame-f-oak-greenscreen-v01.png' },
]

const keyedRaw = async (sourcePath) => {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true })
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    const greenness = green - Math.max(red, blue)
    if (greenness >= 70) {
      data[offset + 3] = 0
    } else if (greenness > 30) {
      data[offset + 3] = Math.round(255 * (1 - (greenness - 30) / 40))
    }
    if (data[offset + 3] > 0) {
      data[offset + 1] = Math.min(green, Math.round(Math.max(red, blue) * 1.15))
    }
  }
  return { data, width: info.width, height: info.height }
}

/** 找包含中心的透明洞：多行/多列取最宽 alpha=0 连续段。 */
const detectHole = (src) => {
  const alphaAt = (x, y) => src.data[(y * src.width + x) * 4 + 3]
  const spanContaining = (values, isClear, center) => {
    if (!isClear(center)) return null
    let low = center
    let high = center
    while (low > 0 && isClear(low - 1)) low -= 1
    while (high < values - 1 && isClear(high + 1)) high += 1
    return { low, high }
  }
  let left = Infinity
  let right = -Infinity
  for (const fraction of [0.4, 0.45, 0.5, 0.55, 0.6]) {
    const y = Math.round(src.height * fraction)
    const span = spanContaining(
      src.width, (x) => alphaAt(x, y) === 0, Math.round(src.width / 2),
    )
    if (span) {
      left = Math.min(left, span.low)
      right = Math.max(right, span.high)
    }
  }
  let top = Infinity
  let bottom = -Infinity
  for (const fraction of [0.42, 0.5, 0.58]) {
    const x = Math.round(left + (right - left) * fraction)
    const span = spanContaining(
      src.height, (y) => alphaAt(x, y) === 0, Math.round(src.height / 2),
    )
    if (span) {
      top = Math.min(top, span.low)
      bottom = Math.max(bottom, span.high)
    }
  }
  return { left, right, top, bottom }
}

for (const { slug, source } of FORMS) {
  const geometry = JSON.parse(await readFile(
    path.join(productionRoot, slug, 'geometry--measured-freeze-v02.json'), 'utf8',
  ))
  const aperture = geometry.windowAperture
  const rawQuad = aperture.quad ?? [
    [aperture.x, aperture.y],
    [aperture.x + aperture.width, aperture.y],
    [aperture.x + aperture.width, aperture.y + aperture.height],
    [aperture.x, aperture.y + aperture.height],
  ]
  // 框内沿相对实测窗洞向内包边 12px：真实窗套要盖住毛洞边缘，
  // 也吸收画稿窗洞顶/底边不完全水平带来的楔形露边。
  const overlap = 12
  const quad = [
    [rawQuad[0][0] + overlap, rawQuad[0][1] + overlap],
    [rawQuad[1][0] - overlap, rawQuad[1][1] + overlap],
    [rawQuad[2][0] - overlap, rawQuad[2][1] - overlap],
    [rawQuad[3][0] + overlap, rawQuad[3][1] - overlap],
  ]
  const [[xL, yTL], [xR, yTR], [, yBR], [, yBL]] = quad

  const src = await keyedRaw(path.join(stagingRoot, source))
  const hole = detectHole(src)
  const holeWidth = hole.right - hole.left
  const holeHeight = hole.bottom - hole.top

  // 列映射：u ∈ 洞两侧线性外扩；行映射按该列的窗洞高度缩放。
  const scaleX = (xR - xL) / holeWidth
  const outLeft = Math.max(0, Math.floor(xL - hole.left * scaleX))
  const outRight = Math.min(width - 1, Math.ceil(xR + (src.width - 1 - hole.right) * scaleX))
  const topLine = (x) => yTL + ((x - xL) / (xR - xL)) * (yTR - yTL)
  const bottomLine = (x) => yBL + ((x - xL) / (xR - xL)) * (yBR - yBL)

  const dst = Buffer.alloc(width * height * 4)
  for (let x = outLeft; x <= outRight; x += 1) {
    const sxFloat = hole.left + (x - xL) / scaleX
    if (sxFloat < 0 || sxFloat > src.width - 1.001) continue
    const columnTop = topLine(x)
    const scaleY = (bottomLine(x) - columnTop) / holeHeight
    const yStart = Math.max(0, Math.floor(columnTop - hole.top * scaleY))
    const yEnd = Math.min(
      height - 1, Math.ceil(bottomLine(x) + (src.height - 1 - hole.bottom) * scaleY),
    )
    for (let y = yStart; y <= yEnd; y += 1) {
      const syFloat = hole.top + (y - columnTop) / scaleY
      if (syFloat < 0 || syFloat > src.height - 1.001) continue
      const gx = Math.floor(sxFloat)
      const gy = Math.floor(syFloat)
      const fx = sxFloat - gx
      const fy = syFloat - gy
      const dstOffset = (y * width + x) * 4
      for (let channel = 0; channel < 4; channel += 1) {
        const s = (dx, dy) => src.data[((gy + dy) * src.width + gx + dx) * 4 + channel]
        dst[dstOffset + channel] = Math.round(
          s(0, 0) * (1 - fx) * (1 - fy) + s(1, 0) * fx * (1 - fy)
          + s(0, 1) * (1 - fx) * fy + s(1, 1) * fx * fy,
        )
      }
    }
  }

  const piecePath = path.join(
    productionRoot, slug, 'piece--window-frame--candidate-v01.png',
  )
  await sharp(dst, { raw: { width, height, channels: 4 } }).png().toFile(piecePath)

  const outline = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <polygon points="${rawQuad.map(([px, py]) => `${px},${py}`).join(' ')}"
    fill="none" stroke="#d84632" stroke-width="3" stroke-dasharray="10 8"/>
  <rect x="${geometry.treatAnchor.x}" y="${geometry.treatAnchor.y}"
    width="${geometry.treatAnchor.width}" height="${geometry.treatAnchor.height}"
    fill="none" stroke="#2b5c8a" stroke-width="3"/>
</svg>
  `)
  await sharp(path.join(productionRoot, slug, 'shell--aperture-alpha--candidate-v01.png'))
    .flatten({ background: '#9fc2d8' })
    .composite([{ input: await readFile(piecePath) }, { input: outline }])
    .png()
    .toFile(path.join(productionRoot, slug, 'qa--piece-window-frame--v01.png'))
  console.log(`${slug}: window-frame piece + QA written (hole ${holeWidth}x${holeHeight} -> aperture)`)
}
