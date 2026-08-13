/**
 * A/F scratcher base 部件装配（生产顺序第 4 步，件序第 2 件）：
 *
 * 绿幕抓柱键控 → 裁边 → 等比缩放进 geometry v02 的 scratcher socket
 * region（底边中点对齐 region 底边中点）→ 输出透明部件与 QA 合成。
 *
 * Usage:
 *   node scripts/build-scratcher-pieces.mjs
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
  { slug: 'a-clear-sage', source: 'scratcher-a-sage-greenscreen-v01.png' },
  { slug: 'b-warm-walnut-gallery', source: 'scratcher-b-walnut-greenscreen-v01.png' },
  { slug: 'f-moonwhite-bluegray', source: 'scratcher-f-smokeblue-greenscreen-v01.png' },
]

/**
 * 布局调优 box（对照签收效果图，v03 冻结输入）：
 * A/B 爬架比效果图高大，收矮并前移落地；F 效果图爬架立在抬高平台上
 * （平台前沿左端 y≈990），不在低层地面。
 */
const LAYOUT_TUNING = {
  'a-clear-sage': { x: 55, y: 850, width: 185, height: 440 },
  'b-warm-walnut-gallery': { x: 70, y: 930, width: 170, height: 430 },
  'f-moonwhite-bluegray': { x: 45, y: 535, width: 200, height: 440 },
}

for (const { slug, source } of FORMS) {
  const geometry = await loadGeometry(productionRoot, slug)
  const region = LAYOUT_TUNING[slug]
    ?? geometry.sockets.find(({ id }) => id === 'scratcher').region
  const keyed = await keyedPng(path.join(stagingRoot, source))
  const trimmed = await sharp(keyed).trim({ threshold: 10 }).png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  const scale = Math.min(region.width / meta.width, region.height / meta.height)
  const scaledWidth = Math.round(meta.width * scale)
  const scaledHeight = Math.round(meta.height * scale)
  const left = Math.round(region.x + (region.width - scaledWidth) / 2)
  const top = region.y + region.height - scaledHeight

  const piecePath = path.join(
    productionRoot, slug, 'piece--scratcher--candidate-v01.png',
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
          cy: top + scaledHeight + 4,
          rx: Math.round(scaledWidth * 0.5),
          ry: 22,
          opacity: 0.28,
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
    height="${region.height}" fill="none" stroke="#5a7a52"
    stroke-width="4" stroke-dasharray="12 8"/>
</svg>
  `)
  await sharp(await resolveShell(productionRoot, slug))
    .flatten({ background: '#9fc2d8' })
    .composite([{ input: await readFile(piecePath) }, { input: outline }])
    .png()
    .toFile(path.join(productionRoot, slug, 'qa--piece-scratcher--v01.png'))
  console.log(`${slug}: scratcher piece + QA written (${scaledWidth}x${scaledHeight} @ ${left},${top})`)
}
