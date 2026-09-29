import { createHash } from 'node:crypto'
import {
  access,
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')
const approvalDate = '2026-07-21'

const source = (candidatePath, destination) => ({ candidatePath, destination })
const sources = [
  source('docs/art/candidates/home/v3/layers/home-exterior--morning--full-canvas--non-shipping-v03.png', 'public/assets/home/exterior-morning.png'),
  source('docs/art/candidates/home/v3/layers/home-exterior--noon--full-canvas--non-shipping-v03.png', 'public/assets/home/exterior-noon.png'),
  source('docs/art/candidates/home/v3/layers/home-exterior--dusk--full-canvas--non-shipping-v03.png', 'public/assets/home/exterior-dusk.png'),
  source('docs/art/candidates/home/v3/layers/home-exterior--late-night--full-canvas--non-shipping-v03.png', 'public/assets/home/exterior-late-night.png'),
  source('docs/art/candidates/home/v3/layers/home-interior-foreground--window-transparent--non-shipping-v03.png', 'public/assets/home/interior-foreground.png'),
  source('docs/art/candidates/home/v3/layers/home-lighting-overlay--morning--non-shipping-v03.png', 'public/assets/home/lighting-morning.png'),
  source('docs/art/candidates/home/v3/layers/home-lighting-overlay--dusk--non-shipping-v03.png', 'public/assets/home/lighting-dusk.png'),
  source('docs/art/candidates/home/v3/layers/home-lighting-overlay--late-night--non-shipping-v03.png', 'public/assets/home/lighting-late-night.png'),
  source('docs/art/candidates/home/v3/icons/nav-icon--pack--runtime-128--non-shipping-v03.png', 'public/assets/home/nav-pack.png'),
  source('docs/art/candidates/home/v3/icons/nav-icon--shop--runtime-128--non-shipping-v03.png', 'public/assets/home/nav-shop.png'),
  source('docs/art/candidates/home/v3/icons/nav-icon--album--runtime-128--non-shipping-v03.png', 'public/assets/home/nav-album.png'),
  source('docs/art/candidates/home/v4/state-art/away-note-with-wood-memo-stand--blank--master-512x640--non-shipping-v04.png', 'public/assets/home/away-note.png'),
  source('docs/art/candidates/home/v4/state-art/dried-fish-sill-tray--master-512--non-shipping-v04.png', 'public/assets/home/treat-tray.png'),
  source('docs/art/candidates/shop/v2/runtime-128/item--snack--fish-biscuit--runtime-128--non-shipping-v02.png', 'public/assets/items/item--snack--fish-biscuit--v02.png'),
  source('docs/art/candidates/shop/v2/runtime-128/item--snack--travel-tin--runtime-128--non-shipping-v02.png', 'public/assets/items/item--snack--travel-tin--v02.png'),
  source('docs/art/candidates/shop/v2/runtime-128/item--toy--small-blanket--runtime-128--non-shipping-v02.png', 'public/assets/items/item--toy--small-blanket--v02.png'),
  source('docs/art/candidates/shop/v2/runtime-128/item--toy--yarn-ball--runtime-128--non-shipping-v02.png', 'public/assets/items/item--toy--yarn-ball--v02.png'),
  source('docs/art/candidates/shop/v2/runtime-128/item--toy--small-bell--runtime-128--non-shipping-v02.png', 'public/assets/items/item--toy--small-bell--v02.png'),
  source('docs/art/candidates/shop/v2/runtime-128/item--toy--small-camera--runtime-128--non-shipping-v02.png', 'public/assets/items/item--toy--small-camera--v02.png'),
  source('docs/art/candidates/shop/v2/runtime-128/item--toy--small-telescope--runtime-128--non-shipping-v02.png', 'public/assets/items/item--toy--small-telescope--v02.png'),
  source('docs/art/candidates/shop/v2/runtime-128/item--wish--ticket--runtime-128--non-shipping-v02.png', 'public/assets/items/item--wish--ticket--v02.png'),
  source('docs/art/candidates/pack/v1/runtime/pack-opened-base--css-342--non-shipping-v01.png', 'public/assets/pack/base-342.png'),
  source('docs/art/candidates/pack/v1/runtime/pack-opened-base--css-382--non-shipping-v01.png', 'public/assets/pack/base-382.png'),
  source('docs/art/candidates/pack/v1/runtime/pack-opened-foreground-rim--css-342--non-shipping-v01.png', 'public/assets/pack/rim-342.png'),
  source('docs/art/candidates/pack/v1/runtime/pack-opened-foreground-rim--css-382--non-shipping-v01.png', 'public/assets/pack/rim-382.png'),
  source('docs/art/candidates/postcard-gifts/v1/runtime/items/reward--treat--dried-fish--runtime-24--non-shipping-v01.png', 'public/assets/treat/treat-24.png'),
  source('docs/art/candidates/postcard-gifts/v1/runtime/items/reward--treat--dried-fish--runtime-32--non-shipping-v01.png', 'public/assets/treat/treat-32.png'),
  source('docs/art/candidates/postcard-gifts/v1/runtime/items/reward--treat--dried-fish--runtime-96--non-shipping-v01.png', 'public/assets/treat/treat-96.png'),
  source('docs/art/candidates/postcard-gifts/v1/runtime/presentation/presentation--blank-postcard-back--runtime-338x254--non-shipping-v01.png', 'public/assets/postcards/blank-back-338.png'),
  source('docs/art/candidates/postcard-gifts/v1/runtime/presentation/presentation--blank-postcard-back--runtime-378x284--non-shipping-v01.png', 'public/assets/postcards/blank-back-378.png'),
  source('docs/art/candidates/postcard-gifts/v1/runtime/presentation/presentation--postcard-stack-holder--runtime-338x254--non-shipping-v01.png', 'public/assets/postcards/stack-holder-338.png'),
  source('docs/art/candidates/postcard-gifts/v1/runtime/presentation/presentation--postcard-stack-holder--runtime-378x284--non-shipping-v01.png', 'public/assets/postcards/stack-holder-378.png'),
  source('docs/art/candidates/postcard-status/v1/masters/scene--unavailable-covered-photo--master-1200x900--non-shipping-v01.png', 'public/assets/postcards/scene-unavailable.png'),
  source('docs/art/candidates/postcard-status/v1/runtime/postmark--ring-waves--runtime-120x80--non-shipping-v01.png', 'public/assets/postcards/postmark.png'),
  source('docs/art/candidates/postcard-status/v1/runtime/album--empty-open--runtime-256--non-shipping-v01.png', 'public/assets/album/empty.png'),
  source('docs/art/candidates/adoption/v1/masters/adoption-welcome-base--master-1200x1600--non-shipping-v01.png', 'public/assets/adoption/welcome-base.png'),
  source('docs/art/candidates/system-states/v1/runtime/loading-vignette--letter-tray--runtime-256--non-shipping-v01.png', 'public/assets/system/loading-letter-tray.png'),
  source('docs/art/candidates/ui-surfaces/v1/runtime/surface--paper-warm--tile-512--1x--non-shipping-v01.webp', 'public/assets/surfaces/paper-1x.webp'),
  source('docs/art/candidates/ui-surfaces/v1/runtime/surface--paper-warm--tile-1024--2x--non-shipping-v01.webp', 'public/assets/surfaces/paper-2x.webp'),
  source('docs/art/candidates/ui-surfaces/v1/runtime/surface--sage-wash--tile-512--1x--non-shipping-v01.webp', 'public/assets/surfaces/sage-1x.webp'),
  source('docs/art/candidates/ui-surfaces/v1/runtime/surface--sage-wash--tile-1024--2x--non-shipping-v01.webp', 'public/assets/surfaces/sage-2x.webp'),
  source('docs/art/candidates/ui-glyphs/v1/sources/glyph-close--source--non-shipping-v01.svg', 'public/assets/glyphs/close.svg'),
  source('docs/art/candidates/ui-glyphs/v1/sources/glyph-export--source--non-shipping-v01.svg', 'public/assets/glyphs/export.svg'),
  source('docs/art/candidates/ui-glyphs/v1/sources/glyph-import--source--non-shipping-v01.svg', 'public/assets/glyphs/import.svg'),
  source('docs/art/candidates/ui-glyphs/v1/sources/glyph-lock--source--non-shipping-v01.svg', 'public/assets/glyphs/lock.svg'),
  source('docs/art/candidates/ui-glyphs/v1/sources/glyph-retry--source--non-shipping-v01.svg', 'public/assets/glyphs/retry.svg'),
  source('docs/art/candidates/app-identity/v1/runtime/app-icon--minho-envelope--180--apple--candidate-a--non-shipping-v01.png', 'public/apple-touch-icon.png'),
  source('docs/art/candidates/app-identity/v1/runtime/app-icon--minho-envelope--192--any--candidate-a--non-shipping-v01.png', 'public/icon-192.png'),
  source('docs/art/candidates/app-identity/v1/runtime/app-icon--minho-envelope--512--maskable-any--candidate-a--non-shipping-v01.png', 'public/icon-512.png'),
  source('docs/art/candidates/app-identity/v1/runtime/app-icon--minho-envelope--32--simplified--candidate-a--non-shipping-v01.png', 'public/favicon-32.png'),
  source('docs/art/candidates/app-identity/v1/runtime/app-icon--minho-envelope--48--simplified--candidate-a--non-shipping-v01.png', 'public/favicon-48.png'),
]

const candidateManifests = [
  'docs/art/candidates/home/v3/manifest.v3.json',
  'docs/art/candidates/home/v4/manifest.v4.json',
  'docs/art/candidates/home/v6/manifest.v6.json',
  'docs/art/candidates/shop/v2/manifest.v2.json',
  'docs/art/candidates/pack/v1/manifest.v1.json',
  'docs/art/candidates/postcard-gifts/v1/manifest.v1.json',
  'docs/art/candidates/postcard-status/v1/manifest.v1.json',
  'docs/art/candidates/adoption/v1/manifest.v1.json',
  'docs/art/candidates/system-states/v1/manifest.v1.json',
  'docs/art/candidates/ui-surfaces/v1/manifest.v1.json',
  'docs/art/candidates/ui-glyphs/v1/manifest.v1.json',
  'docs/art/candidates/app-identity/v1/manifest.v1.json',
]

const sha256 = (contents) => createHash('sha256').update(contents).digest('hex')
const absolute = (relativePath) => path.join(root, relativePath)

const flattenManifestHashes = (manifestPath, manifest) => {
  const rootPath = manifest.root ?? path.posix.dirname(manifestPath)
  const records = [
    ...(manifest.files ?? []),
    ...(manifest.assets ?? []),
    ...(manifest.artifacts ?? []),
  ]

  return records.flatMap((record) => {
    if (!record.path || !record.sha256) return []
    const normalizedPath = record.path.startsWith('docs/')
      ? record.path
      : path.posix.join(rootPath, record.path)
    return [[normalizedPath, record.sha256]]
  })
}

const createFoodBowlPatch = async () => {
  const interior = absolute(
    'docs/art/candidates/home/v3/layers/home-interior-foreground--window-transparent--non-shipping-v03.png',
  )
  const sample = await sharp(interior)
    .extract({ left: 500, top: 1155, width: 150, height: 153 })
    .resize(150, 153, { kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const original = await sharp(interior)
    .extract({ left: 350, top: 1175, width: 150, height: 153 })
    .ensureAlpha()
    .raw()
    .toBuffer()
  const mask = await sharp({
    create: {
      width: 150,
      height: 153,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([{
      input: Buffer.from(
        '<svg width="150" height="153" xmlns="http://www.w3.org/2000/svg"><ellipse cx="76.5" cy="76.5" rx="68.5" ry="71.5" fill="white"/></svg>',
      ),
    }])
    .blur(6)
    .extractChannel(0)
    .raw()
    .toBuffer()
  const patch = Buffer.from(sample.data)
  const channels = sample.info.channels
  const deltas = [0, 1, 2].map((channel) => {
    const values = []
    for (let index = 0; index < mask.length; index += 1) {
      if (mask[index] >= 12 && mask[index] <= 96) {
        values.push(original[index * channels + channel] - patch[index * channels + channel])
      }
    }
    values.sort((left, right) => left - right)
    return values[Math.floor(values.length / 2)] ?? 0
  })
  for (let index = 0; index < mask.length; index += 1) {
    if (index % 150 < 8) {
      mask[index] = 0
    }
    for (let channel = 0; channel < 3; channel += 1) {
      patch[index * channels + channel] = Math.max(
        0,
        Math.min(255, patch[index * channels + channel] + deltas[channel]),
      )
    }
    patch[index * channels + 3] = mask[index]
  }
  return sharp(patch, {
    raw: { width: 150, height: 153, channels: 4 },
  }).png().toBuffer()
}

const copyVerified = async (entry, knownHashes) => {
  const expectedSha256 = knownHashes.get(entry.candidatePath)
  if (!expectedSha256) {
    throw new Error(`No manifest hash for approved source: ${entry.candidatePath}`)
  }
  const sourceContents = await readFile(absolute(entry.candidatePath))
  const actualSha256 = sha256(sourceContents)
  if (actualSha256 !== expectedSha256) {
    throw new Error(`${entry.candidatePath}: candidate hash mismatch`)
  }

  const destination = absolute(entry.destination)
  const destinationExists = await access(destination).then(() => true).catch(() => false)
  const destinationMatches = destinationExists
    && sha256(await readFile(destination)) === actualSha256
  if (!destinationMatches) {
    if (checkOnly) throw new Error(`${entry.destination} is missing or stale`)
    await mkdir(path.dirname(destination), { recursive: true })
    await copyFile(absolute(entry.candidatePath), destination)
  }
  return {
    candidateSource: entry.candidatePath,
    sourceSha256: expectedSha256,
    destination: entry.destination,
    destinationSha256: actualSha256,
    status: 'promoted',
    approvalDate,
  }
}

const knownHashes = new Map()
for (const manifestPath of candidateManifests) {
  const manifest = JSON.parse(await readFile(absolute(manifestPath), 'utf8'))
  for (const [candidatePath, hash] of flattenManifestHashes(manifestPath, manifest)) {
    knownHashes.set(candidatePath, hash)
  }
}

const promotedAssets = await Promise.all(
  sources.map((entry) => copyVerified(entry, knownHashes)),
)
const patchDestination = 'public/assets/home/eat-food-bowl-removal-patch.png'
const patchSource = 'docs/art/candidates/home/v6/eat-placement-metadata.v6.json'
const patchSourceSha256 = knownHashes.get(patchSource)
if (!patchSourceSha256) throw new Error(`No manifest hash for ${patchSource}`)
const patch = await createFoodBowlPatch()
const patchSha256 = sha256(patch)
const patchPath = absolute(patchDestination)
const patchExists = await access(patchPath).then(() => true).catch(() => false)
if (!patchExists || sha256(await readFile(patchPath)) !== patchSha256) {
  if (checkOnly) throw new Error(`${patchDestination} is missing or stale`)
  await mkdir(path.dirname(patchPath), { recursive: true })
  await writeFile(patchPath, patch)
}
promotedAssets.push({
  candidateSource: patchSource,
  sourceSha256: patchSourceSha256,
  destination: patchDestination,
  destinationSha256: patchSha256,
  status: 'derived-from-approved-patch-metadata',
  approvalDate,
  derivation: {
    sourceLayer: 'docs/art/candidates/home/v3/layers/home-interior-foreground--window-transparent--non-shipping-v03.png',
    targetBounds: [350, 1175, 500, 1328],
    sampleBounds: [500, 1155, 650, 1308],
    placement: { left: 350 / 1200, top: 1175 / 1600, width: 150 / 1200, height: 153 / 1600 },
  },
})

const manifest = {
  schemaVersion: 1,
  manifestKind: 'bravecat-home-art-production-integration',
  status: 'approved-and-integrated',
  approvedAt: approvalDate,
  selections: {
    appIdentity: 'candidate-a / minho-envelope',
    loadingVignette: 'letter-tray',
    home: 'v3 foundation, v5 responsive placement, v6 eat correction',
    starterItems: 'shop/v2 only',
    pack: 'v1 structure with v3 transforms',
  },
  exclusions: [
    'landmark scenes remain blocked from shipping',
    'additional portrait candidates remain blocked by issue #2 policy',
    'souvenirs and licensed typography are not integrated',
    'shop/v1, pack/v2 product evidence, and postcard-gifts starter-item duplicates are not promotion sources',
  ],
  assets: promotedAssets,
}
const manifestPath = absolute('docs/art/production/home/manifest.v1.json')
const manifestContents = `${JSON.stringify(manifest, null, 2)}\n`
const existingManifest = await readFile(manifestPath, 'utf8').catch(() => null)
if (existingManifest !== manifestContents) {
  if (checkOnly) throw new Error('docs/art/production/home/manifest.v1.json is missing or stale')
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, manifestContents)
}

console.log(`${checkOnly ? 'verified' : 'promoted'} ${promotedAssets.length} approved home-art assets`)
