/**
 * Derive Cat Item foreground occlusion from the same master alpha as each base.
 *
 * Near-lip (rest-cloud-bed) / near-tunnel-wall (play-soft-tunnel) bands keep
 * source RGB and alpha from the registered base; pixels outside the band are
 * cleared. Occlusion alpha is always a subset of base alpha (never new art).
 *
 * Usage:
 *   node scripts/build-cat-item-occlusion.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const sourcesRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources',
)
const evidenceRoot = path.join(sourcesRoot, 'evidence')

const assets = [
  {
    item: 'rest-cloud-bed',
    theme: 'a-clear-sage',
    kind: 'near-lip',
    // Keep lower fraction of alpha bbox (front cushion lip).
    bandStart: 0.58,
  },
  {
    item: 'rest-cloud-bed',
    theme: 'b-warm-walnut',
    kind: 'near-lip',
    bandStart: 0.58,
  },
  {
    item: 'rest-cloud-bed',
    theme: 'f-moonwhite-bluegray',
    kind: 'near-lip',
    bandStart: 0.58,
  },
  {
    item: 'play-soft-tunnel',
    theme: 'a-clear-sage',
    kind: 'near-tunnel-wall',
    bandStart: 0.52,
  },
  {
    item: 'play-soft-tunnel',
    theme: 'b-warm-walnut',
    kind: 'near-tunnel-wall',
    bandStart: 0.52,
  },
  {
    item: 'play-soft-tunnel',
    theme: 'f-moonwhite-bluegray',
    kind: 'near-tunnel-wall',
    bandStart: 0.52,
  },
]

const alphaBBox = (data, width, height) => {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 8) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < 0) return null
  return [minX, minY, maxX + 1, maxY + 1]
}

const metricsFor = (data, width, height) => {
  let opaque = 0
  let transparent = 0
  let semi = 0
  const corners = [
    data[3],
    data[(width - 1) * 4 + 3],
    data[((height - 1) * width) * 4 + 3],
    data[((height - 1) * width + (width - 1)) * 4 + 3],
  ]
  for (let i = 0; i < width * height; i += 1) {
    const a = data[i * 4 + 3]
    if (a === 0) transparent += 1
    else if (a === 255) opaque += 1
    else semi += 1
  }
  return {
    hasAlpha: true,
    alphaBBox: alphaBBox(data, width, height),
    semiTransparentPixels: semi,
    cornerAlpha: corners,
    opaquePixels: opaque,
    transparentPixels: transparent,
  }
}

const deriveOcclusion = (data, width, height, bandStart) => {
  const bbox = alphaBBox(data, width, height)
  if (!bbox) throw new Error('base has empty alpha')
  const [left, top, right, bottom] = bbox
  const bandTop = Math.floor(top + (bottom - top) * bandStart)
  const out = Buffer.from(data)
  let kept = 0
  let cleared = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const baseA = data[offset + 3]
      if (baseA === 0) {
        out[offset] = 0
        out[offset + 1] = 0
        out[offset + 2] = 0
        out[offset + 3] = 0
        continue
      }
      const inBand = y >= bandTop && x >= left && x < right
      if (!inBand) {
        out[offset] = 0
        out[offset + 1] = 0
        out[offset + 2] = 0
        out[offset + 3] = 0
        cleared += 1
        continue
      }
      kept += 1
    }
  }
  return { out, bbox, bandTop, kept, cleared }
}

const occlusionEntries = []

for (const asset of assets) {
  const baseName = `cat-item--${asset.item}--${asset.theme}--base--candidate-v01.png`
  const basePath = path.join(sourcesRoot, asset.item, asset.theme, baseName)
  const { data, info } = await sharp(basePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const { out, bbox, bandTop, kept, cleared } = deriveOcclusion(
    data,
    width,
    height,
    asset.bandStart,
  )

  // Subset invariant: every non-zero occlusion alpha must be ≤ base alpha.
  for (let i = 0; i < width * height; i += 1) {
    const baseA = data[i * 4 + 3]
    const occA = out[i * 4 + 3]
    if (occA > baseA) {
      throw new Error(`${baseName}: occlusion alpha not subset of base at ${i}`)
    }
  }

  const outName = `cat-item--${asset.item}--${asset.theme}--foreground-occlusion--candidate-v01.png`
  const outDir = path.join(sourcesRoot, asset.item, asset.theme)
  await mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, outName)
  await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(outPath)

  const m = metricsFor(out, width, height)
  occlusionEntries.push({
    path: `cat-items/${asset.item}/${asset.theme}/${outName}`,
    derivedFrom: `cat-items/${asset.item}/${asset.theme}/${baseName}`,
    kind: asset.kind,
    bandStart: asset.bandStart,
    bandTop,
    sourceAlphaBBox: bbox,
    width,
    height,
    ...m,
    keptOpaqueOrSemiPixels: kept,
    clearedFromBaseOpaquePixels: cleared,
    alphaSubsetOfBase: true,
  })
  console.log(`${asset.item}/${asset.theme}: occlusion kept=${kept} cleared=${cleared}`)
}

const qaPath = path.join(evidenceRoot, 'alpha-qa--candidate-v01.json')
const qa = JSON.parse(await readFile(qaPath, 'utf8'))
qa.occlusionMethod = (
  'Same-master alpha band: keep lower fraction of source alpha bbox '
  + '(near-lip for rest-cloud-bed, near-tunnel-wall for play-soft-tunnel); '
  + 'RGB and alpha copied from base; outside band zeroed; alpha ⊆ base.'
)
qa.occlusionAssets = occlusionEntries
qa.occlusionContactNote = (
  'Foreground occlusion PNGs live beside each base under production-sources; '
  + 'Pose contact sheets are separate evidence under evidence/.'
)
await writeFile(qaPath, `${JSON.stringify(qa, null, 2)}\n`)
console.log(`updated ${qaPath} with ${occlusionEntries.length} occlusion entries`)
