/**
 * A/B/F feeding-set base 部件装配（生产顺序第 4 步，件序第 3 件）：
 *
 * 绿幕碗垫组键控 → 裁边 → 等比缩放进 geometry v02 的 feeding-set
 * socket region（底边中点对齐）→ 输出透明部件与 QA 合成。
 *
 * Usage:
 *   node scripts/build-feeding-set-pieces.mjs
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  keyedPng, contactShadowSvg, loadGeometry, resolveShell,
} from './lib/piece-utils.mjs'

const width = 1200
const height = 1600
const stagingRoot = '/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets'
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)

const FORMS = [
  { slug: 'a-clear-sage', source: 'feeding-a-celadon-greenscreen-v01.png' },
  { slug: 'b-warm-walnut-gallery', source: 'feeding-b-terracotta-greenscreen-v01.png' },
  { slug: 'f-moonwhite-bluegray', source: 'feeding-f-bluewhite-greenscreen-v01.png' },
]

/**
 * 布局调优 box（对照签收效果图，v03 冻结输入）：F 效果图的碗垫组
 * 立在抬高平台上、窗前偏右（避开 x300–405 的 treat 锚点），
 * 不在低层地面。A/B 维持冻结 region。
 */
const LAYOUT_TUNING = {
  'f-moonwhite-bluegray': { x: 390, y: 895, width: 230, height: 95 },
}

for (const { slug, source } of FORMS) {
  const geometry = await loadGeometry(productionRoot, slug)
  const region = LAYOUT_TUNING[slug]
    ?? geometry.sockets.find(({ id }) => id === 'feeding-set').region
  const keyed = await keyedPng(path.join(stagingRoot, source))
  const trimmed = await sharp(keyed).trim({ threshold: 10 }).png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  const scale = Math.min(region.width / meta.width, region.height / meta.height)
  const scaledWidth = Math.round(meta.width * scale)
  const scaledHeight = Math.round(meta.height * scale)
  const left = Math.round(region.x + (region.width - scaledWidth) / 2)
  const top = region.y + region.height - scaledHeight

  const piecePath = path.join(
    productionRoot, slug, 'piece--feeding-set--candidate-v01.png',
  )
  await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: contactShadowSvg({
          canvasWidth: width,
          canvasHeight: height,
          cx: left + scaledWidth / 2,
          cy: top + scaledHeight - 6,
          rx: Math.round(scaledWidth * 0.55),
          ry: 16,
          opacity: 0.22,
        }),
      },
      {
        input: await sharp(trimmed).resize(scaledWidth, scaledHeight).png().toBuffer(),
        left,
        top,
      },
    ])
    .png()
    .toFile(piecePath)

  const outline = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${region.x}" y="${region.y}" width="${region.width}"
    height="${region.height}" fill="none" stroke="#8a6f4f"
    stroke-width="4" stroke-dasharray="12 8"/>
</svg>
  `)
  await sharp(await resolveShell(productionRoot, slug))
    .flatten({ background: '#9fc2d8' })
    .composite([{ input: await readFile(piecePath) }, { input: outline }])
    .png()
    .toFile(path.join(productionRoot, slug, 'qa--piece-feeding-set--v01.png'))
  console.log(`${slug}: feeding-set piece + QA written (${scaledWidth}x${scaledHeight} @ ${left},${top})`)
}
