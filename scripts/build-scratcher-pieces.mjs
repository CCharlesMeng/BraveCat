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

const width = 1200
const height = 1600
const stagingRoot = '/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets'
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)

const FORMS = [
  { slug: 'a-clear-sage', source: 'scratcher-a-sage-greenscreen-v01.png' },
  { slug: 'f-moonwhite-bluegray', source: 'scratcher-f-smokeblue-greenscreen-v01.png' },
]

const keyedPng = async (sourcePath) => {
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
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toBuffer()
}

for (const { slug, source } of FORMS) {
  const geometry = JSON.parse(await readFile(
    path.join(productionRoot, slug, 'geometry--measured-freeze-v02.json'), 'utf8',
  ))
  const region = geometry.sockets.find(({ id }) => id === 'scratcher').region
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
    .composite([{
      input: await sharp(trimmed).resize(scaledWidth, scaledHeight).png().toBuffer(),
      left,
      top,
    }])
    .png()
    .toFile(piecePath)

  const outline = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${region.x}" y="${region.y}" width="${region.width}"
    height="${region.height}" fill="none" stroke="#5a7a52"
    stroke-width="4" stroke-dasharray="12 8"/>
</svg>
  `)
  await sharp(path.join(productionRoot, slug, 'shell--aperture-alpha--candidate-v01.png'))
    .flatten({ background: '#9fc2d8' })
    .composite([{ input: await readFile(piecePath) }, { input: outline }])
    .png()
    .toFile(path.join(productionRoot, slug, 'qa--piece-scratcher--v01.png'))
  console.log(`${slug}: scratcher piece + QA written (${scaledWidth}x${scaledHeight} @ ${left},${top})`)
}
