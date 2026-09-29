/**
 * Freeze Cat Item slot geometry for furnished base plates (v02).
 *
 * Upgrades v01 `catItemReserveBBoxes` (scratch/feed only) to full
 * `catItemSlots` for scratch / feed / rest / play. rest and play occupy
 * disjoint zones per ADR-0011; placement seeds from dressed QA
 * `dress.itemBox` in build-furnished-base-plates.mjs, then refined so
 * rest (left-front floor/platform) and play (central rug) do not overlap.
 *
 * Usage:
 *   node scripts/freeze-cat-item-slots.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const WIDTH = 1200
const HEIGHT = 1600
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)

const rectPoly = ({ x, y, width, height }) => [
  [x, y],
  [x + width, y],
  [x + width, y + height],
  [x, y + height],
]

const insetRect = ({ x, y, width, height }, padX, padYTop, padYBottom = padYTop) => ({
  x: x + padX,
  y: y + padYTop,
  width: Math.max(1, width - padX * 2),
  height: Math.max(1, height - padYTop - padYBottom),
})

const aabbOverlap = (a, b) => !(
  a.x + a.width <= b.x
  || b.x + b.width <= a.x
  || a.y + a.height <= b.y
  || b.y + b.height <= a.y
)

const inCanvas = ({ x, y, width, height }) => (
  x >= 0 && y >= 0 && x + width <= WIDTH && y + height <= HEIGHT
)

const slotFromReserve = (placement, {
  supportInset = [24, 40, 18],
  interactionInset = [8, 12, 8],
  catAnchor,
  flip = false,
  zBand = 'cat-item-base',
} = {}) => {
  const support = insetRect(placement, supportInset[0], supportInset[1], supportInset[2])
  const interaction = insetRect(
    placement,
    interactionInset[0],
    interactionInset[1],
    interactionInset[2],
  )
  return {
    placement,
    supportSurface: rectPoly(support),
    interactionRegion: rectPoly(interaction),
    catAnchor: {
      x: catAnchor?.x ?? Math.round(placement.x + placement.width * 0.5),
      y: catAnchor?.y ?? Math.round(placement.y + placement.height * 0.72),
      flip,
    },
    zBand,
  }
}

/**
 * Per-theme slot seeds.
 * - scratch/feed: v01 reserve bboxes
 * - rest: dress.itemBox when that QA dressed a bed (A/F), or left-front floor
 *   for B (ADR-0011 rest band; B's dressed QA temporarily put play on left)
 * - play: central rug band, refined away from rest
 */
const themes = {
  'a-clear-sage': {
    sourceGeometry: 'geometry--furnished-base-plate--measured-freeze-v01.json',
    plate: 'furnished-base-plate--aperture-alpha--candidate-v01.png',
    slots: {
      scratch: slotFromReserve(
        { x: 35, y: 795, width: 220, height: 430 },
        { catAnchor: { x: 145, y: 1140 }, flip: false },
      ),
      feed: slotFromReserve(
        { x: 225, y: 1035, width: 300, height: 205 },
        {
          supportInset: [36, 90, 24],
          catAnchor: { x: 375, y: 1185 },
          flip: false,
        },
      ),
      // dress.itemBox for rest-cloud-bed dressed QA
      rest: slotFromReserve(
        { x: 55, y: 1045, width: 385, height: 245 },
        {
          supportInset: [48, 70, 28],
          catAnchor: { x: 250, y: 1205 },
          flip: false,
        },
      ),
      // central rug, clear of rest (rest right edge 440)
      play: slotFromReserve(
        { x: 480, y: 1220, width: 420, height: 280 },
        {
          supportInset: [40, 55, 30],
          catAnchor: { x: 690, y: 1410 },
          flip: false,
        },
      ),
    },
  },
  'b-warm-walnut-gallery': {
    sourceGeometry: 'geometry--furnished-base-plate--measured-freeze-v01.json',
    plate: 'furnished-base-plate--aperture-alpha--candidate-v01.png',
    slots: {
      scratch: slotFromReserve(
        { x: 35, y: 855, width: 250, height: 420 },
        { catAnchor: { x: 155, y: 1185 }, flip: false },
      ),
      feed: slotFromReserve(
        { x: 230, y: 1075, width: 300, height: 195 },
        {
          supportInset: [36, 85, 24],
          catAnchor: { x: 380, y: 1215 },
          flip: false,
        },
      ),
      // left-front floor band (ADR-0011); seeded from former dress.itemBox
      rest: slotFromReserve(
        { x: 35, y: 1050, width: 340, height: 250 },
        {
          supportInset: [44, 68, 28],
          catAnchor: { x: 205, y: 1215 },
          flip: false,
        },
      ),
      // central rug, clear of rest (rest right edge 375)
      play: slotFromReserve(
        { x: 420, y: 1285, width: 400, height: 260 },
        {
          supportInset: [40, 50, 28],
          catAnchor: { x: 620, y: 1465 },
          flip: false,
        },
      ),
    },
  },
  'f-moonwhite-bluegray': {
    sourceGeometry: 'geometry--furnished-base-plate--measured-freeze-v01.json',
    plate: 'furnished-base-plate--aperture-alpha--candidate-v01.png',
    slots: {
      scratch: slotFromReserve(
        { x: 75, y: 770, width: 255, height: 285 },
        { catAnchor: { x: 200, y: 980 }, flip: false },
      ),
      feed: slotFromReserve(
        { x: 330, y: 900, width: 300, height: 145 },
        {
          supportInset: [40, 55, 20],
          catAnchor: { x: 480, y: 1005 },
          flip: false,
        },
      ),
      // dress.itemBox for rest on upper platform
      rest: slotFromReserve(
        { x: 45, y: 820, width: 395, height: 245 },
        {
          supportInset: [48, 70, 28],
          catAnchor: { x: 248, y: 980 },
          flip: false,
        },
      ),
      // lower central rug
      play: slotFromReserve(
        { x: 340, y: 1200, width: 480, height: 280 },
        {
          supportInset: [44, 55, 30],
          catAnchor: { x: 580, y: 1395 },
          flip: false,
        },
      ),
    },
  },
}

const assertSlots = (slug, slots) => {
  for (const [id, slot] of Object.entries(slots)) {
    if (!inCanvas(slot.placement)) {
      throw new Error(`${slug}/${id}: placement out of canvas`)
    }
  }
  if (aabbOverlap(slots.rest.placement, slots.play.placement)) {
    throw new Error(`${slug}: rest and play placements overlap (ADR-0011)`)
  }
}

const writeOverlay = async (slug, plate, slots) => {
  const p = (points) => points.map(([x, y]) => `${x},${y}`).join(' ')
  const colors = {
    scratch: '#ff4f81',
    feed: '#ff8a30',
    rest: '#3d8bfd',
    play: '#2fbf71',
  }
  const overlay = Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${Object.entries(slots).map(([id, slot]) => {
    const c = colors[id]
    const r = slot.placement
    const a = slot.catAnchor
    return `
      <rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"
        fill="none" stroke="${c}" stroke-width="4"/>
      <polygon points="${p(slot.supportSurface)}" fill="${c}" fill-opacity="0.12"
        stroke="${c}" stroke-width="2" stroke-dasharray="10 8"/>
      <polygon points="${p(slot.interactionRegion)}" fill="none" stroke="${c}"
        stroke-width="2" stroke-dasharray="4 6"/>
      <circle cx="${a.x}" cy="${a.y}" r="10" fill="${c}"/>
      <text x="${r.x + 12}" y="${r.y + 28}" font-size="22" font-family="monospace"
        fill="${c}">${id.toUpperCase()}${a.flip ? ' FLIP' : ''}</text>
    `
  }).join('')}
</svg>`)
  await sharp(path.join(productionRoot, slug, plate))
    .flatten({ background: '#9fc2d8' })
    .composite([{ input: overlay }])
    .png()
    .toFile(path.join(
      productionRoot,
      slug,
      'qa--cat-item-slots-overlay--measured-freeze-v02.png',
    ))
}

for (const [slug, theme] of Object.entries(themes)) {
  const v01 = JSON.parse(await readFile(
    path.join(productionRoot, slug, theme.sourceGeometry),
    'utf8',
  ))
  assertSlots(slug, theme.slots)

  const manifest = {
    ...v01,
    freezeLevel: 'furnished-base-plate-measured-freeze-v02',
    runtimeEligible: false,
    adr: 'docs/adr/0011-cat-item-slots-occupy-disjoint-frozen-zones.md',
    catItemSlots: theme.slots,
  }
  delete manifest.catItemReserveBBoxes

  const outPath = path.join(
    productionRoot,
    slug,
    'geometry--furnished-base-plate--measured-freeze-v02.json',
  )
  await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await writeOverlay(slug, theme.plate, theme.slots)

  const rest = theme.slots.rest.placement
  const play = theme.slots.play.placement
  console.log(
    `${slug}: rest=${rest.x},${rest.y},${rest.width}x${rest.height}`
    + ` play=${play.x},${play.y},${play.width}x${play.height}`,
  )
}
