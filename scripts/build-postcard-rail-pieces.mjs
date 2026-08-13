/**
 * A/F postcard-display 轨条部件装配（生产顺序第 4 步首件）：
 *
 * 把绿幕生成的单条轨条键控成透明素材，按 geometry v02
 * （measured-freeze）的 rails 坐标缩放落位到 1200×1600 透明画布，
 * 输出部件 PNG 与叠在 clean shell 上的 QA 合成图。
 *
 * Usage:
 *   node scripts/build-postcard-rail-pieces.mjs
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
  { slug: 'a-clear-sage', source: 'rail-a-light-wood-brass-greenscreen-v01.png' },
  { slug: 'f-moonwhite-bluegray', source: 'rail-f-white-oak-greenscreen-v01.png' },
]

/** 绿度主导键控，与 build-den-alt-pieces.mjs 同一套阈值。 */
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
  const keyed = await keyedPng(path.join(stagingRoot, source))
  const trimmed = await sharp(keyed).trim({ threshold: 10 }).png().toBuffer()

  const composites = []
  for (const rail of geometry.rails) {
    const strip = await sharp(trimmed).resize({ width: rail.width }).png().toBuffer()
    composites.push({ input: strip, left: rail.x, top: rail.y })
  }
  const piecePath = path.join(
    productionRoot, slug, 'piece--postcard-display-rails--candidate-v01.png',
  )
  await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(composites).png().toFile(piecePath)

  const outlines = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${geometry.postcardSlots.map(({ quad }) => `
    <polygon points="${quad.map(([x, y]) => `${x},${y}`).join(' ')}"
      fill="none" stroke="#d84632" stroke-width="3"/>
  `).join('')}
</svg>
  `)
  await sharp(path.join(productionRoot, slug, 'shell--aperture-alpha--candidate-v01.png'))
    .flatten({ background: '#9fc2d8' })
    .composite([
      { input: await readFile(piecePath) },
      { input: outlines },
    ])
    .png()
    .toFile(path.join(productionRoot, slug, 'qa--piece-postcard-rails--v01.png'))
  console.log(`${slug}: rails piece + QA written`)
}
