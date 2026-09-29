/**
 * Machine checks for A/B/F base-plate themes + Cat Items in public/dev-art/.
 * Asserts registry-referenced paths, alpha / corner / occlusion-subset,
 * rest↔play placement disjointness within 1200×1600, and full adapter cover.
 *
 * Invoked from check-development-home-art.mjs (and runnable alone).
 * Does NOT flip runtimeEligible.
 */
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { movedRepoRelativePath } from './lib/monorepo-paths.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resolveRepoPath = (...segments) => path.join(
  root,
  movedRepoRelativePath(path.posix.join(...segments)),
)

/** Mirrors packages/core homeTheme themes + catItems registries. */
const THEME_IDS = [
  'a-clear-sage',
  'b-warm-walnut-gallery',
  'f-moonwhite-bluegray',
]
const CAT_ITEMS = [
  { id: 'rest-cloud-bed', slot: 'rest' },
  { id: 'play-soft-tunnel', slot: 'play' },
]
const CANVAS = { width: 1200, height: 1600 }

const geometryPath = (themeId) => resolveRepoPath(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
  themeId,
  'geometry--furnished-base-plate--measured-freeze-v02.json',
)

const publicArt = (themeId, filename) => resolveRepoPath(
  'public/dev-art/home-theme',
  themeId,
  filename,
)

const registryPathsForTheme = (themeId) => {
  const paths = [
    publicArt(themeId, 'base-plate--aperture-alpha.png'),
    publicArt(themeId, 'exterior-noon.png'),
    publicArt(themeId, 'lighting.png'),
  ]
  for (const item of CAT_ITEMS) {
    paths.push(publicArt(themeId, `cat-item--${item.id}--base.png`))
    paths.push(publicArt(themeId, `cat-item--${item.id}--occlusion.png`))
  }
  return paths
}

const assertExists = async (filePath) => {
  await access(filePath).catch(() => {
    throw new Error(`missing registry-referenced asset: ${filePath}`)
  })
}

const loadRgba = async (filePath) => {
  const contents = await readFile(filePath)
  const { data, info } = await sharp(contents)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, metadata: info }
}

const cornerAlphas = (data, width, height) => [
  data[3],
  data[(width - 1) * 4 + 3],
  data[((height - 1) * width) * 4 + 3],
  data[((height - 1) * width + (width - 1)) * 4 + 3],
]

const assertCatItemAlpha = async (label, filePath) => {
  const { data, width, height, metadata } = await loadRgba(filePath)
  if (metadata.hasAlpha !== true) {
    throw new Error(`${label}: hasAlpha must be true (${filePath})`)
  }
  const corners = cornerAlphas(data, width, height)
  if (corners.some((alpha) => alpha !== 0)) {
    throw new Error(
      `${label}: corner alpha must be 0, got ${JSON.stringify(corners)}`,
    )
  }
  return { data, width, height }
}

const assertOcclusionSubset = (base, occlusion, label) => {
  if (base.width !== occlusion.width || base.height !== occlusion.height) {
    throw new Error(`${label}: base/occlusion dimension mismatch`)
  }
  const pixels = base.width * base.height
  for (let i = 0; i < pixels; i += 1) {
    const baseA = base.data[i * 4 + 3]
    const occA = occlusion.data[i * 4 + 3]
    if (occA > baseA) {
      throw new Error(
        `${label}: occlusion alpha not ⊆ base at pixel ${i} `
        + `(occ=${occA} base=${baseA})`,
      )
    }
  }
}

const rectsOverlap = (a, b) => !(
  a.x + a.width <= b.x
  || b.x + b.width <= a.x
  || a.y + a.height <= b.y
  || b.y + b.height <= a.y
)

const assertPlacementInCanvas = (themeId, slot, placement) => {
  const { x, y, width, height } = placement
  if (
    x < 0
    || y < 0
    || x + width > CANVAS.width
    || y + height > CANVAS.height
  ) {
    throw new Error(
      `${themeId}/${slot}: placement ${JSON.stringify(placement)} `
      + `outside ${CANVAS.width}×${CANVAS.height}`,
    )
  }
}

const assertAdaptersInRegistrySource = async () => {
  const source = await readFile(
    path.join(
      root,
      'packages/core/src/homeTheme/catItems/index.ts',
    ),
    'utf8',
  )
  for (const item of CAT_ITEMS) {
    for (const themeId of THEME_IDS) {
      const marker = `'${themeId}': adapter('${themeId}', '${item.id}'`
      if (!source.includes(marker)) {
        throw new Error(
          `listable Cat Item ${item.id} missing adapter for ${themeId}`,
        )
      }
    }
  }
}

let checkedPaths = 0
let checkedAlphaPairs = 0
let checkedPlacements = 0

for (const themeId of THEME_IDS) {
  for (const filePath of registryPathsForTheme(themeId)) {
    await assertExists(filePath)
    checkedPaths += 1
  }

  for (const item of CAT_ITEMS) {
    const basePath = publicArt(themeId, `cat-item--${item.id}--base.png`)
    const occPath = publicArt(themeId, `cat-item--${item.id}--occlusion.png`)
    const label = `${themeId}/${item.id}`
    const base = await assertCatItemAlpha(`${label} base`, basePath)
    const occ = await assertCatItemAlpha(`${label} occlusion`, occPath)
    assertOcclusionSubset(base, occ, label)
    checkedAlphaPairs += 1
  }

  const geometry = JSON.parse(await readFile(geometryPath(themeId), 'utf8'))
  if (geometry.runtimeEligible !== false) {
    throw new Error(`${themeId}: runtimeEligible must remain false`)
  }
  const rest = geometry.catItemSlots?.rest?.placement
  const play = geometry.catItemSlots?.play?.placement
  if (!rest || !play) {
    throw new Error(`${themeId}: geometry v02 missing rest/play placements`)
  }
  assertPlacementInCanvas(themeId, 'rest', rest)
  assertPlacementInCanvas(themeId, 'play', play)
  if (rectsOverlap(rest, play)) {
    throw new Error(
      `${themeId}: rest and play placements overlap `
      + `(${JSON.stringify(rest)} vs ${JSON.stringify(play)})`,
    )
  }
  checkedPlacements += 1
}

await assertAdaptersInRegistrySource()

console.log(
  `verified base-plate home art: ${checkedPaths} paths, `
  + `${checkedAlphaPairs} base/occlusion alpha pairs, `
  + `${checkedPlacements} theme rest/play placements, `
  + `${CAT_ITEMS.length} items × ${THEME_IDS.length} theme adapters `
  + `(runtimeEligible still false)`,
)
