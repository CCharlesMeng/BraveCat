/**
 * Minho Pose QA contact sheets for rest/play slots on A/B/F base plates.
 *
 * Composites: furnished base plate → Cat Item base → Minho first frame →
 * Cat Item foreground occlusion. Proves supportSurface alignment and that
 * near-lip / near-tunnel occlusion sits above the cat without inventing art.
 *
 * Usage:
 *   node scripts/build-cat-item-pose-qa.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const WIDTH = 1200
const HEIGHT = 1600
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)
const sourcesRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources',
)
const evidenceRoot = path.join(sourcesRoot, 'evidence')
const catRoot = path.resolve('apps/web/public/dev-art/home-v4/cat-animations')

const themes = [
  {
    slug: 'a-clear-sage',
    itemTheme: 'a-clear-sage',
    plate: 'furnished-base-plate--aperture-alpha--candidate-v01.png',
  },
  {
    slug: 'b-warm-walnut-gallery',
    itemTheme: 'b-warm-walnut',
    plate: 'furnished-base-plate--aperture-alpha--candidate-v01.png',
  },
  {
    slug: 'f-moonwhite-bluegray',
    itemTheme: 'f-moonwhite-bluegray',
    plate: 'furnished-base-plate--aperture-alpha--candidate-v01.png',
  },
]

const slotItems = {
  rest: {
    item: 'rest-cloud-bed',
    catSheet: 'cat--minho--sleep--ambient--v03.webp',
    catSize: 190,
  },
  play: {
    item: 'play-soft-tunnel',
    catSheet: 'cat--minho--play--ambient--v03.webp',
    catSize: 200,
  },
}

const placedContain = async (input, box, { bottomAlign = true, trim = true } = {}) => {
  let source = typeof input === 'string' ? input : input
  if (trim) {
    source = await sharp(source).trim({ threshold: 8 }).png().toBuffer()
  }
  const metadata = await sharp(source).metadata()
  const scale = Math.min(box.width / metadata.width, box.height / metadata.height)
  const width = Math.max(1, Math.round(metadata.width * scale))
  const height = Math.max(1, Math.round(metadata.height * scale))
  const png = await sharp(source).resize(width, height).png().toBuffer()
  return {
    input: png,
    left: Math.round(box.x + (box.width - width) / 2),
    top: bottomAlign
      ? Math.round(box.y + box.height - height)
      : Math.round(box.y + (box.height - height) / 2),
  }
}

const firstFrame = async (sheet) => sharp(path.join(catRoot, sheet))
  .webp({ page: 0 })
  .ensureAlpha()
  .png()
  .toBuffer()

const labelOverlay = (text) => Buffer.from(`
<svg width="${WIDTH}" height="56" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="56" fill="rgba(20,24,28,0.72)"/>
  <text x="24" y="36" font-size="24" font-family="monospace" fill="#f4f1ea">${text}</text>
</svg>`)

const cells = []
const cellMeta = []

for (const theme of themes) {
  const geometry = JSON.parse(await readFile(
    path.join(
      productionRoot,
      theme.slug,
      'geometry--furnished-base-plate--measured-freeze-v02.json',
    ),
    'utf8',
  ))
  const platePath = path.join(productionRoot, theme.slug, theme.plate)
  const plate = await sharp(platePath)
    .flatten({ background: '#9fc2d8' })
    .png()
    .toBuffer()

  for (const [slotId, config] of Object.entries(slotItems)) {
    const slot = geometry.catItemSlots[slotId]
    const basePath = path.join(
      sourcesRoot,
      config.item,
      theme.itemTheme,
      `cat-item--${config.item}--${theme.itemTheme}--base--candidate-v01.png`,
    )
    const occPath = path.join(
      sourcesRoot,
      config.item,
      theme.itemTheme,
      `cat-item--${config.item}--${theme.itemTheme}--foreground-occlusion--candidate-v01.png`,
    )
    const itemLayer = await placedContain(basePath, slot.placement)
    const occLayer = await placedContain(occPath, slot.placement)
    const catFrame = await firstFrame(config.catSheet)
    const catBox = {
      x: Math.round(slot.catAnchor.x - config.catSize / 2),
      y: Math.round(slot.catAnchor.y - config.catSize * 0.82),
      width: config.catSize,
      height: config.catSize,
    }
    let catLayer = await placedContain(catFrame, catBox, { bottomAlign: true })
    if (slot.catAnchor.flip) {
      const flipped = await sharp(catLayer.input).flop().png().toBuffer()
      catLayer = { ...catLayer, input: flipped }
    }

    const supportSvg = Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <polygon points="${slot.supportSurface.map(([x, y]) => `${x},${y}`).join(' ')}"
    fill="rgba(61,139,253,0.14)" stroke="#3d8bfd" stroke-width="3"/>
  <circle cx="${slot.catAnchor.x}" cy="${slot.catAnchor.y}" r="8" fill="#d84632"/>
</svg>`)

    const composite = await sharp(plate)
      .composite([
        itemLayer,
        catLayer,
        occLayer,
        { input: supportSvg },
        { input: labelOverlay(`${theme.slug} · ${slotId} · ${config.item}`), top: 0, left: 0 },
      ])
      .png()
      .toBuffer()

    const cellName = `qa--pose--${theme.slug}--${slotId}--candidate-v01.png`
    await writeFile(path.join(evidenceRoot, cellName), composite)
    cells.push(composite)
    cellMeta.push({ theme: theme.slug, slot: slotId, file: cellName })
    console.log(`wrote ${cellName}`)
  }
}

// 3×2 contact sheet (themes × slots), each cell scaled to 400×533
const cellW = 400
const cellH = 533
const gap = 16
const cols = 2
const rows = 3
const sheetW = cols * cellW + (cols + 1) * gap
const sheetH = rows * cellH + (rows + 1) * gap + 48

const thumbLayers = []
for (let i = 0; i < cells.length; i += 1) {
  const col = i % cols
  const row = Math.floor(i / cols)
  const thumb = await sharp(cells[i])
    .resize(cellW, cellH, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()
  thumbLayers.push({
    input: thumb,
    left: gap + col * (cellW + gap),
    top: 48 + gap + row * (cellH + gap),
  })
}

const title = Buffer.from(`
<svg width="${sheetW}" height="48" xmlns="http://www.w3.org/2000/svg">
  <rect width="${sheetW}" height="48" fill="#1c2228"/>
  <text x="20" y="32" font-size="22" font-family="monospace" fill="#f4f1ea">
    Minho Pose QA · rest/play × A/B/F · support + occlusion · candidate-v01
  </text>
</svg>`)

const sheet = await sharp({
  create: {
    width: sheetW,
    height: sheetH,
    channels: 3,
    background: '#2a3138',
  },
})
  .composite([{ input: title, top: 0, left: 0 }, ...thumbLayers])
  .png()
  .toBuffer()

const sheetName = 'qa--minho-pose--rest-play-abf-contact-sheet--candidate-v01.png'
await mkdir(evidenceRoot, { recursive: true })
await writeFile(path.join(evidenceRoot, sheetName), sheet)

const index = {
  method: (
    'Composite furnished base plate + Cat Item base at frozen placement + '
    + 'Minho v03 first frame at catAnchor + same-master foreground occlusion; '
    + 'supportSurface polygon and anchor overlaid for review.'
  ),
  catSheets: {
    rest: 'cat--minho--sleep--ambient--v03.webp',
    play: 'cat--minho--play--ambient--v03.webp',
  },
  geometry: 'geometry--furnished-base-plate--measured-freeze-v02.json',
  cells: cellMeta,
  contactSheet: sheetName,
  runtimeEligible: false,
}
await writeFile(
  path.join(evidenceRoot, 'pose-qa--candidate-v01.json'),
  `${JSON.stringify(index, null, 2)}\n`,
)
console.log(`contact sheet ${sheetName} (${cells.length} cells)`)
