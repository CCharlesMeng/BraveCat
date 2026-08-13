/**
 * 全件穿戴 QA v02（还原修复轮）：每套 form 把全部候选部件与动态
 * 内容按 z 序合成，输出「住人状态」整房审阅图：
 *
 *   窗外景（江湾 v03，1.10 倍率居中）→ shell → window-frame →
 *   postcard 轨 → rug → cabinet → scratcher → feeding-set → plant →
 *   明信片（6 张外景母版裁片按槽位 quad 透视贴入）→
 *   F 前景相框 → 柜顶纪念品 → 窗台零食 → rug 上睡猫 → 光照层。
 *
 * 仅证据用途，不是 runtime 合成器。
 *
 * Usage:
 *   node scripts/build-dressed-room-qa.mjs
 */
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const width = 1200
const height = 1600
const scale = 1.1
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)
const mastersRoot = path.resolve(
  'docs/art/candidates/home-exteriors/approved-direction-2026-08-13/masters',
)
const webPublic = path.resolve('apps/web/public')

const PIECE_ORDER = [
  'piece--window-frame--candidate-v01.png',
  'piece--postcard-display-rails--candidate-v01.png',
  'piece--rug--candidate-v01.png',
  'piece--cabinet--candidate-v01.png',
  'piece--scratcher--candidate-v01.png',
  'piece--feeding-set--candidate-v01.png',
  'piece--plant--candidate-v01.png',
]

/** 明信片画面来源：6 张不同外景母版，营造旅行收藏感。 */
const POSTCARD_MASTERS = [
  'ext-riverbend-embankment--master--noon-clear--candidate-v03.png',
  'ext-quiet-sea-bay--master--noon-clear--candidate-v03.png',
  'ext-reed-lake--master--noon-clear--candidate-v02.png',
  'ext-irrigated-fields--master--noon-clear--candidate-v02.png',
  'ext-cedar-creek--master--noon-clear--candidate-v01.png',
  'ext-orchard-slope--master--noon-clear--candidate-v01.png',
]

/** 把源图（raw RGBA）按列线性映射进目标 quad（[TL,TR,BR,BL]）。 */
const warpIntoBuffer = (src, dst, quad) => {
  const [[x0, yTL], [x1, yTR], [, yBR], [, yBL]] = quad
  for (let x = Math.ceil(x0); x <= Math.min(Math.floor(x1), width - 1); x += 1) {
    const t = (x - x0) / (x1 - x0)
    const topY = yTL + t * (yTR - yTL)
    const bottomY = yBL + t * (yBR - yBL)
    for (let y = Math.max(0, Math.ceil(topY)); y <= Math.min(Math.floor(bottomY), height - 1); y += 1) {
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

/** 生成一张 2 倍分辨率的白边明信片（外景裁片 cover 进纸卡）。 */
const postcardCard = async (masterFile) => {
  const cardWidth = 360
  const cardHeight = 300
  const border = 18
  const photo = await sharp(path.join(mastersRoot, masterFile))
    .resize(cardWidth - border * 2, cardHeight - border * 2, { fit: 'cover' })
    .png().toBuffer()
  return sharp({
    create: {
      width: cardWidth,
      height: cardHeight,
      channels: 4,
      background: { r: 251, g: 247, b: 239, alpha: 1 },
    },
  })
    .composite([{ input: photo, left: border, top: border }])
    .raw().toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => ({ data, width: info.width, height: info.height }))
}

/** 透明底 contain 放置：返回 composite 图层。 */
const placeInto = async (buffer, box, { align = 'bottom' } = {}) => {
  const trimmed = await sharp(buffer).trim({ threshold: 10 }).png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  const fit = Math.min(box.width / meta.width, box.height / meta.height)
  const w = Math.max(1, Math.round(meta.width * fit))
  const h = Math.max(1, Math.round(meta.height * fit))
  return {
    input: await sharp(trimmed).resize(w, h).png().toBuffer(),
    left: Math.round(box.x + (box.width - w) / 2),
    top: align === 'bottom' ? Math.round(box.y + box.height - h) : Math.round(box.y + (box.height - h) / 2),
  }
}

const exterior = await sharp(path.join(mastersRoot, POSTCARD_MASTERS[0]))
  .resize(Math.round(width * scale), Math.round(height * scale))
  .extract({
    left: Math.round((width * scale - width) / 2),
    top: Math.round((height * scale - height) / 2),
    width,
    height,
  })
  .png()
  .toBuffer()

/* 动态内容素材 */
const souvenirPin = await readFile(path.join(webPublic, 'assets/souvenirs/souvenir--postmark-pin--v01.png'))
const souvenirCharm = await readFile(path.join(webPublic, 'assets/souvenirs/souvenir--travel-charm--v01.png'))
const treatBiscuit = await readFile(path.join(webPublic, 'assets/items/item--snack--fish-biscuit--v02.png'))
const catSleep = await sharp(path.join(webPublic, 'dev-art/home-v4/cat-animations/cat--minho--sleep--ambient--v01.webp'))
  .extract({ left: 0, top: 0, width: 512, height: 512 })
  .png().toBuffer()

const overviewPanels = []

for (const slug of ['a-clear-sage', 'b-warm-walnut-gallery', 'f-moonwhite-bluegray']) {
  const geometry = JSON.parse(await readFile(
    path.join(productionRoot, slug, 'geometry--measured-freeze-v02.json'), 'utf8',
  ))
  const placements = JSON.parse(await readFile(
    path.join(productionRoot, slug, 'placement--furnishings--v01.json'), 'utf8',
  ))

  const layers = [
    { input: path.join(productionRoot, slug, 'shell--aperture-alpha--candidate-v01.png') },
  ]
  for (const piece of PIECE_ORDER) {
    const piecePath = path.join(productionRoot, slug, piece)
    try {
      await access(piecePath)
      layers.push({ input: await readFile(piecePath) })
    } catch {
      // 该 form 尚未产出这件部件，跳过。
    }
  }

  /* 明信片：整层一次性 warp 进各槽位。 */
  const postcardLayer = Buffer.alloc(width * height * 4)
  for (const [index, slot] of geometry.postcardSlots.entries()) {
    const card = await postcardCard(POSTCARD_MASTERS[index % POSTCARD_MASTERS.length])
    warpIntoBuffer(card, postcardLayer, slot.quad)
  }
  layers.push({
    input: await sharp(postcardLayer, { raw: { width, height, channels: 4 } }).png().toBuffer(),
  })

  /* F 的前景空相框压在明信片之上。 */
  const framesPath = path.join(productionRoot, slug, 'piece--postcard-display-frames-foreground--candidate-v01.png')
  try {
    await access(framesPath)
    layers.push({ input: await readFile(framesPath) })
  } catch {
    // 无前景框形态。
  }

  /* 柜顶纪念品：x 取冻结锚点，y 锚到装配后的实际柜顶。 */
  const cabinetTop = placements.cabinet.top
  const souvenirSources = [souvenirPin, souvenirCharm, souvenirPin]
  for (const [index, anchor] of geometry.souvenirAnchors.entries()) {
    layers.push(await placeInto(souvenirSources[index % souvenirSources.length], {
      x: anchor.x,
      y: cabinetTop + 12 - anchor.height,
      width: anchor.width,
      height: anchor.height,
    }))
  }

  /* 窗台零食。 */
  layers.push(await placeInto(treatBiscuit, geometry.treatAnchor))

  /* rug 上的睡猫：宽度约为 rug 的 40%，卧在 rug 中带。 */
  const rug = placements.rug
  const catWidth = Math.round(rug.width * 0.4)
  layers.push(await placeInto(catSleep, {
    x: rug.left + Math.round((rug.width - catWidth) / 2),
    y: rug.top - 40,
    width: catWidth,
    height: rug.height + 20,
  }))

  /* 光照层永远最后。 */
  layers.push({ input: await readFile(path.join(productionRoot, slug, 'piece--lighting--candidate-v01.png')) })

  const outPath = path.join(productionRoot, slug, 'qa--dressed-room--v02.png')
  await sharp(exterior)
    .composite(layers)
    .png()
    .toFile(outPath)
  overviewPanels.push(await sharp(outPath).resize(600, 800).png().toBuffer())
  console.log(`${slug}: dressed-room QA v02 written (${layers.length - 1} layers)`)
}

await sharp({
  create: { width: 1800, height: 800, channels: 4, background: { r: 34, g: 30, b: 42, alpha: 1 } },
})
  .composite(overviewPanels.map((input, index) => ({ input, left: index * 600, top: 0 })))
  .png()
  .toFile(path.join(productionRoot, 'qa--dressed-room--overview--v02.png'))
console.log('overview strip written')
