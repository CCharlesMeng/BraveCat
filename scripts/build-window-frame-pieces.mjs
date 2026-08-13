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
import {
  keyedRaw, detectHole, loadGeometry, resolveShell,
} from './lib/piece-utils.mjs'

const width = 1200
const height = 1600
const stagingRoot = '/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets'
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)

/* B 画稿窗洞顶边斜差更大，卷帘上沿曾露出斜缝，包边加大到 20。 */
const FORMS = [
  { slug: 'a-clear-sage', source: 'window-frame-a-sage-greenscreen-v01.png', overlap: 12 },
  { slug: 'b-warm-walnut-gallery', source: 'window-frame-b-walnut-greenscreen-v01.png', overlap: 20 },
  { slug: 'f-moonwhite-bluegray', source: 'window-frame-f-oak-greenscreen-v01.png', overlap: 12 },
]

for (const { slug, source, overlap } of FORMS) {
  const geometry = await loadGeometry(productionRoot, slug)
  const aperture = geometry.windowAperture
  const rawQuad = aperture.quad ?? [
    [aperture.x, aperture.y],
    [aperture.x + aperture.width, aperture.y],
    [aperture.x + aperture.width, aperture.y + aperture.height],
    [aperture.x, aperture.y + aperture.height],
  ]
  // 框内沿相对实测窗洞向内包边：真实窗套要盖住毛洞边缘，
  // 也吸收画稿窗洞顶/底边不完全水平带来的楔形露边。
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
  await sharp(await resolveShell(productionRoot, slug))
    .flatten({ background: '#9fc2d8' })
    .composite([{ input: await readFile(piecePath) }, { input: outline }])
    .png()
    .toFile(path.join(productionRoot, slug, 'qa--piece-window-frame--v01.png'))
  console.log(`${slug}: window-frame piece + QA written (hole ${holeWidth}x${holeHeight} -> aperture)`)
}
