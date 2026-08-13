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
  {
    slug: 'f-moonwhite-bluegray',
    source: 'rail-f-white-oak-greenscreen-v01.png',
    framesForeground: 'frame-f-white-oak-greenscreen-v01.png',
  },
  { slug: 'b-warm-walnut-gallery', source: 'rail-b-walnut-greenscreen-v01.png' },
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

/** 把轨条素材按透视 quad 逐列双线性采样写进目标 RGBA 缓冲。 */
const warpStripIntoBuffer = (src, dst, quad) => {
  const [[x0, yTL], [x1, yTR], [, yBR], [, yBL]] = quad
  for (let x = Math.ceil(x0); x <= Math.min(Math.floor(x1), width - 1); x += 1) {
    const t = (x - x0) / (x1 - x0)
    const topY = yTL + t * (yTR - yTL)
    const bottomY = yBL + t * (yBR - yBL)
    for (let y = Math.ceil(topY); y <= Math.floor(bottomY); y += 1) {
      const v = (y - topY) / (bottomY - topY)
      const sx = t * (src.width - 1)
      const sy = v * (src.height - 1)
      const gx = Math.min(Math.floor(sx), src.width - 2)
      const gy = Math.min(Math.floor(sy), src.height - 2)
      const fx = sx - gx
      const fy = sy - gy
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
}

for (const { slug, source, framesForeground } of FORMS) {
  const geometry = JSON.parse(await readFile(
    path.join(productionRoot, slug, 'geometry--measured-freeze-v02.json'), 'utf8',
  ))
  const keyed = await keyedPng(path.join(stagingRoot, source))
  const trimmed = await sharp(keyed).trim({ threshold: 10 }).png().toBuffer()

  const piecePath = path.join(
    productionRoot, slug, 'piece--postcard-display-rails--candidate-v01.png',
  )
  const usesQuadRails = geometry.rails.some((rail) => 'quad' in rail)
  if (usesQuadRails) {
    const { data, info } = await sharp(trimmed).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true })
    const src = { data, width: info.width, height: info.height }
    const dst = Buffer.alloc(width * height * 4)
    for (const rail of geometry.rails) warpStripIntoBuffer(src, dst, rail.quad)
    await sharp(dst, { raw: { width, height, channels: 4 } })
      .png().toFile(piecePath)
  } else {
    const composites = []
    for (const rail of geometry.rails) {
      const strip = await sharp(trimmed).resize({ width: rail.width }).png().toBuffer()
      composites.push({ input: strip, left: rail.x, top: rail.y })
    }
    await sharp({
      create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite(composites).png().toFile(piecePath)
  }

  // F 的六个空框是压住动态卡片的 foreground occlusion 层；
  // 框外沿比 slot 各方向大 8px，卡片边缘滑入框后。
  let foregroundPath = null
  if (framesForeground) {
    const keyedFrame = await keyedPng(path.join(stagingRoot, framesForeground))
    const trimmedFrame = await sharp(keyedFrame).trim({ threshold: 10 }).png().toBuffer()
    const composites = []
    for (const { quad } of geometry.postcardSlots) {
      const xs = quad.map(([x]) => x)
      const ys = quad.map(([, y]) => y)
      const box = {
        x: Math.min(...xs) - 8,
        y: Math.min(...ys) - 8,
        width: Math.max(...xs) - Math.min(...xs) + 16,
        height: Math.max(...ys) - Math.min(...ys) + 16,
      }
      composites.push({
        input: await sharp(trimmedFrame)
          .resize(box.width, box.height, { fit: 'fill' })
          .png().toBuffer(),
        left: box.x,
        top: box.y,
      })
    }
    foregroundPath = path.join(
      productionRoot, slug,
      'piece--postcard-display-frames-foreground--candidate-v01.png',
    )
    await sharp({
      create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite(composites).png().toFile(foregroundPath)
  }

  const outlines = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${geometry.postcardSlots.map(({ quad }) => `
    <polygon points="${quad.map(([x, y]) => `${x},${y}`).join(' ')}"
      fill="none" stroke="#d84632" stroke-width="3"/>
  `).join('')}
</svg>
  `)
  const qaLayers = [{ input: await readFile(piecePath) }]
  if (foregroundPath) qaLayers.push({ input: await readFile(foregroundPath) })
  qaLayers.push({ input: outlines })
  await sharp(path.join(productionRoot, slug, 'shell--aperture-alpha--candidate-v01.png'))
    .flatten({ background: '#9fc2d8' })
    .composite(qaLayers)
    .png()
    .toFile(path.join(productionRoot, slug, 'qa--piece-postcard-rails--v01.png'))
  console.log(`${slug}: rails piece${foregroundPath ? ' + frames foreground' : ''} + QA written`)
}
