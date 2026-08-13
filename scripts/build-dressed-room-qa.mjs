/**
 * 全件穿戴 QA v03（去模板化轮）：每套 form 把全部候选部件与动态
 * 内容按 z 序合成，输出「住人状态」整房审阅图。
 *
 * 相对 v02 的修正（对照签收效果图的自查结论）：
 *   1. 每套 form 用不同的窗外景母版与不同的明信片照片顺序，
 *      消除「同一模板放三个场景」的读感；
 *   2. B 的明信片按概念稿装进胡桃厚木框（绿幕空框洞对位合成后
 *      随 slot quad 透视 warp），A 维持概念稿的无框白卡，
 *      F 由既有前景白橡框压边；
 *   3. 猫每套不同行为与位置：A 睡 rug、B 在碗边进食、F 在平台
 *      窗座望窗。
 *
 * 仅证据用途，不是 runtime 合成器。
 *
 * Usage:
 *   node scripts/build-dressed-room-qa.mjs
 */
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  keyedRaw, detectHole, loadGeometry, resolveShell,
} from './lib/piece-utils.mjs'

const width = 1200
const height = 1600
const exteriorScale = 1.1
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)
const mastersRoot = path.resolve(
  'docs/art/candidates/home-exteriors/approved-direction-2026-08-13/masters',
)
const webPublic = path.resolve('apps/web/public')
const stagingRoot = '/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets'

const PIECE_ORDER = [
  'piece--window-frame--candidate-v01.png',
  'piece--postcard-display-rails--candidate-v01.png',
  'piece--rug--candidate-v01.png',
  'piece--cabinet--candidate-v01.png',
  'piece--scratcher--candidate-v01.png',
  'piece--feeding-set--candidate-v01.png',
  'piece--plant--candidate-v01.png',
]

const POSTCARD_MASTERS = [
  'ext-riverbend-embankment--master--noon-clear--candidate-v03.png',
  'ext-quiet-sea-bay--master--noon-clear--candidate-v03.png',
  'ext-reed-lake--master--noon-clear--candidate-v02.png',
  'ext-irrigated-fields--master--noon-clear--candidate-v02.png',
  'ext-cedar-creek--master--noon-clear--candidate-v01.png',
  'ext-orchard-slope--master--noon-clear--candidate-v01.png',
]

/**
 * 每套 form 的动态内容配方：外景、照片顺序偏移、明信片框、
 * 纪念品组合、猫（spritesheet 行为 + 落位方式）。
 */
const FORM_DRESS = {
  'a-clear-sage': {
    exterior: 'ext-riverbend-embankment--master--noon-clear--candidate-v03.png',
    postcardOffset: 0,
    postcardFrame: null,
    souvenirs: ['pin', 'charm', 'pin'],
    cat: { sheet: 'sleep', place: 'rug' },
  },
  'b-warm-walnut-gallery': {
    exterior: 'ext-cedar-creek--master--noon-clear--candidate-v01.png',
    postcardOffset: 2,
    postcardFrame: 'postcard-frame-b-walnut-greenscreen-v01.png',
    souvenirs: ['charm', 'pin'],
    cat: { sheet: 'eat', place: 'feeding' },
  },
  'f-moonwhite-bluegray': {
    exterior: 'ext-quiet-sea-bay--master--noon-clear--candidate-v03.png',
    postcardOffset: 4,
    postcardFrame: null,
    souvenirs: ['pin', 'charm'],
    cat: { sheet: 'gaze', place: 'platform-sill' },
  },
}

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

/** 无框白卡明信片（2 倍分辨率 raw）。 */
const plainCard = async (masterFile) => {
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

/** 带木框明信片：照片洞对位填进绿幕键控后的空框（raw）。 */
const framedCard = async (masterFile, frame, hole) => {
  const bleed = 6
  const photo = await sharp(path.join(mastersRoot, masterFile))
    .resize(hole.right - hole.left + bleed * 2, hole.bottom - hole.top + bleed * 2, { fit: 'cover' })
    .png().toBuffer()
  const framePng = await sharp(frame.data, {
    raw: { width: frame.width, height: frame.height, channels: 4 },
  }).png().toBuffer()
  return sharp({
    create: {
      width: frame.width,
      height: frame.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: photo, left: hole.left - bleed, top: hole.top - bleed },
      { input: framePng, left: 0, top: 0 },
    ])
    .raw().toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => ({ data, width: info.width, height: info.height }))
}

/** quad 以质心为基准向外扩 scale 倍（带框卡片需要盖过名义卡位）。 */
const inflateQuad = (quad, scale) => {
  const cx = quad.reduce((sum, [x]) => sum + x, 0) / 4
  const cy = quad.reduce((sum, [, y]) => sum + y, 0) / 4
  return quad.map(([x, y]) => [cx + (x - cx) * scale, cy + (y - cy) * scale])
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

/* 动态内容素材 */
const SOUVENIR_FILES = {
  pin: 'assets/souvenirs/souvenir--postmark-pin--v01.png',
  charm: 'assets/souvenirs/souvenir--travel-charm--v01.png',
}
const souvenirBuffers = Object.fromEntries(await Promise.all(
  Object.entries(SOUVENIR_FILES).map(async ([key, file]) => [
    key, await readFile(path.join(webPublic, file)),
  ]),
))
const treatBiscuit = await readFile(path.join(webPublic, 'assets/items/item--snack--fish-biscuit--v02.png'))
const catFrame = async (sheet) => sharp(
  path.join(webPublic, `dev-art/home-v4/cat-animations/cat--minho--${sheet}--ambient--v01.webp`),
)
  .extract({ left: 0, top: 0, width: 512, height: 512 })
  .png().toBuffer()

const overviewPanels = []

for (const [slug, dress] of Object.entries(FORM_DRESS)) {
  const geometry = await loadGeometry(productionRoot, slug)
  const placements = JSON.parse(await readFile(
    path.join(productionRoot, slug, 'placement--furnishings--v01.json'), 'utf8',
  ))

  const exterior = await sharp(path.join(mastersRoot, dress.exterior))
    .resize(Math.round(width * exteriorScale), Math.round(height * exteriorScale))
    .extract({
      left: Math.round((width * exteriorScale - width) / 2),
      top: Math.round((height * exteriorScale - height) / 2),
      width,
      height,
    })
    .png()
    .toBuffer()

  const layers = [{ input: await resolveShell(productionRoot, slug) }]
  for (const piece of PIECE_ORDER) {
    const piecePath = path.join(productionRoot, slug, piece)
    try {
      await access(piecePath)
      layers.push({ input: await readFile(piecePath) })
    } catch {
      // 该 form 尚未产出这件部件，跳过。
    }
  }

  /* 明信片：整层一次性 warp 进各槽位；B 装胡桃框并外扩盖过名义卡位。 */
  let frame = null
  let hole = null
  if (dress.postcardFrame) {
    frame = await keyedRaw(path.join(stagingRoot, dress.postcardFrame))
    hole = detectHole(frame)
  }
  const postcardLayer = Buffer.alloc(width * height * 4)
  for (const [index, slot] of geometry.postcardSlots.entries()) {
    const master = POSTCARD_MASTERS[(index + dress.postcardOffset) % POSTCARD_MASTERS.length]
    if (frame) {
      warpIntoBuffer(await framedCard(master, frame, hole), postcardLayer, inflateQuad(slot.quad, 1.16))
    } else {
      warpIntoBuffer(await plainCard(master), postcardLayer, slot.quad)
    }
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

  /* 柜顶纪念品：x 取冻结锚点，y 锚到装配后的实际柜顶；数量按配方。 */
  const cabinetTop = placements.cabinet.top
  for (const [index, kind] of dress.souvenirs.entries()) {
    const anchor = geometry.souvenirAnchors[index]
    layers.push(await placeInto(souvenirBuffers[kind], {
      x: anchor.x,
      y: cabinetTop + 12 - anchor.height,
      width: anchor.width,
      height: anchor.height,
    }))
  }

  /* 窗台零食。 */
  layers.push(await placeInto(treatBiscuit, geometry.treatAnchor))

  /* 猫：每套不同行为与位置。 */
  const cat = await catFrame(dress.cat.sheet)
  if (dress.cat.place === 'rug') {
    const rug = placements.rug
    const catWidth = Math.round(rug.width * 0.4)
    layers.push(await placeInto(cat, {
      x: rug.left + Math.round((rug.width - catWidth) / 2),
      y: rug.top - 40,
      width: catWidth,
      height: rug.height + 20,
    }))
  } else if (dress.cat.place === 'feeding') {
    const region = geometry.sockets.find(({ id }) => id === 'feeding-set').region
    layers.push(await placeInto(cat, {
      x: region.x + region.width - 40,
      y: region.y + region.height - 210,
      width: 230,
      height: 230,
    }))
  } else {
    /* platform-sill：平台窗座，爬架与碗组之间望向窗外。 */
    layers.push(await placeInto(cat, { x: 235, y: 795, width: 160, height: 185 }))
  }

  /* 光照层永远最后。 */
  layers.push({ input: await readFile(path.join(productionRoot, slug, 'piece--lighting--candidate-v01.png')) })

  const outPath = path.join(productionRoot, slug, 'qa--dressed-room--v03.png')
  await sharp(exterior)
    .composite(layers)
    .png()
    .toFile(outPath)
  overviewPanels.push(await sharp(outPath).resize(600, 800).png().toBuffer())
  console.log(`${slug}: dressed-room QA v03 written (${layers.length - 1} layers)`)
}

await sharp({
  create: { width: 1800, height: 800, channels: 4, background: { r: 34, g: 30, b: 42, alpha: 1 } },
})
  .composite(overviewPanels.map((input, index) => ({ input, left: index * 600, top: 0 })))
  .png()
  .toFile(path.join(productionRoot, 'qa--dressed-room--overview--v03.png'))
console.log('overview strip written')
