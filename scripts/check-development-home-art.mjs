import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
import { movedRepoRelativePath } from './lib/monorepo-paths.mjs'
// 清单里的历史仓库相对路径保持原样，文件访问时重定向到搬迁后位置。
const resolveRepoPath = (...segments) => path.join(
  root,
  movedRepoRelativePath(path.posix.join(...segments)),
)
const previewRoot = 'public/dev-art/home-v4'
const manifest = JSON.parse(await readFile(
  resolveRepoPath('docs/art/candidates/home-v4/manifest.candidate.json'),
  'utf8',
))
const approval = JSON.parse(await readFile(
  resolveRepoPath('docs/art/reviews/home-v4/approval.v1.json'),
  'utf8',
))
const catAnimationManifest = JSON.parse(await readFile(
  resolveRepoPath(
    'docs/art/candidates/home-v4/cat-animations-v03/manifest.candidate.json',
  ),
  'utf8',
))

if (
  manifest.shippingEligible !== false
  || manifest.status !== 'approved-for-development-preview'
  || manifest.rightWallPlane?.seamTreatment !== 'single-dark-step'
  || manifest.rightWallPlane?.displayProjection
    !== 'cabinet-referenced-quadrilaterals'
  || approval.decision !== 'approved-for-development-preview'
  || approval.shippingEligible !== false
) {
  throw new Error('Home v4 development-preview approval is invalid')
}

const candidateRuntimeNames = {
  'interior-foreground': 'interior-foreground.png',
  'interior-foreground-eat': 'interior-foreground-eat.png',
  'exterior-morning': 'exterior-morning.png',
  'exterior-noon': 'exterior-noon.png',
  'exterior-dusk': 'exterior-dusk.png',
  'exterior-late-night': 'exterior-late-night.png',
  'lighting-morning': 'lighting-morning.png',
  'lighting-dusk': 'lighting-dusk.png',
  'lighting-late-night': 'lighting-late-night.png',
}
const expectedFiles = Object.fromEntries(
  manifest.outputs
    .filter(({ id }) => id in candidateRuntimeNames)
    .map(({ id, sha256: hash }) => [candidateRuntimeNames[id], hash]),
)

const sha256 = (contents) => (
  createHash('sha256').update(contents).digest('hex')
)

const expectedCatFrameCounts = {
  sleep: 128,
  play: 64,
  eat: 64,
  gaze: 64,
}

if (
  JSON.stringify(catAnimationManifest.outputFrameCounts)
    !== JSON.stringify(expectedCatFrameCounts)
  || catAnimationManifest.fixedCanvas?.width !== 512
  || catAnimationManifest.fixedCanvas?.height !== 512
) {
  throw new Error('Home cat animation candidate contract is invalid')
}

for (const [filename, expectedHash] of Object.entries(expectedFiles)) {
  const runtimePath = resolveRepoPath(previewRoot, filename)
  const contents = await readFile(runtimePath).catch(() => {
    throw new Error(`${runtimePath} is missing`)
  })
  if (sha256(contents) !== expectedHash) {
    throw new Error(`${runtimePath} does not match its non-shipping candidate`)
  }
  const metadata = await sharp(contents).metadata()
  if (
    metadata.width !== manifest.canvas.width
    || metadata.height !== manifest.canvas.height
    || metadata.hasAlpha !== true
    || metadata.space !== 'srgb'
  ) {
    throw new Error(`${runtimePath} has invalid dimensions, alpha, or colour space`)
  }
}

const frameAnchor = (frame) => {
  let bottom = -1
  for (let y = 0; y < 512; y += 1) {
    for (let x = 0; x < 512; x += 1) {
      if (frame[(y * 512 + x) * 4 + 3] > 32) bottom = y
    }
  }
  let alphaTotal = 0
  let weightedX = 0
  for (let y = Math.max(0, bottom - 23); y <= bottom; y += 1) {
    for (let x = 0; x < 512; x += 1) {
      const alpha = frame[(y * 512 + x) * 4 + 3]
      if (alpha <= 32) continue
      alphaTotal += alpha
      weightedX += x * alpha
    }
  }
  return { bottom, x: weightedX / alphaTotal }
}

for (const row of catAnimationManifest.rows) {
  const filename = `cat-animations/${row.animation.file}`
  const runtimePath = resolveRepoPath(previewRoot, filename)
  const contents = await readFile(runtimePath).catch(() => {
    throw new Error(`${runtimePath} is missing`)
  })
  if (sha256(contents) !== row.animation.sha256) {
    throw new Error(`${runtimePath} does not match its animation candidate`)
  }
  const metadata = await sharp(contents, { animated: true }).metadata()
  if (
    metadata.width !== 512
    || metadata.pageHeight !== 512
    || metadata.pages !== expectedCatFrameCounts[row.activity]
    || metadata.hasAlpha !== true
    || metadata.delay?.reduce((sum, delay) => sum + delay, 0)
      !== row.animation.durationMs
  ) {
    throw new Error(`${runtimePath} has an invalid fixed-canvas frame count`)
  }

  const decoded = await sharp(contents, { animated: true })
    .ensureAlpha()
    .raw()
    .toBuffer()
  const frameBytes = 512 * 512 * 4
  const frames = Array.from({ length: metadata.pages }, (_, index) => (
    decoded.subarray(index * frameBytes, (index + 1) * frameBytes)
  ))
  const frameHashes = frames.map(sha256)
  if (
    frameHashes.some((hash, index) => (
      index > 0 && hash === frameHashes[index - 1]
    ))
    || new Set(frameHashes).size < frames.length / 2
  ) {
    throw new Error(`${runtimePath} contains duplicate frames`)
  }

  const keyframeAnchors = frames
    .filter((_, index) => index % 8 === 0)
    .map(frameAnchor)
  if (keyframeAnchors.some((anchor) => (
    anchor.bottom !== row.registration.target.bottom
    || Math.abs(anchor.x - row.registration.target.x) >= 1
  ))) {
    throw new Error(`${runtimePath} moves a keyframe off its pixel anchor`)
  }

  const posterPath = resolveRepoPath(
    previewRoot,
    `cat-animations/${row.poster.file}`,
  )
  const posterContents = await readFile(posterPath).catch(() => {
    throw new Error(`${posterPath} is missing`)
  })
  if (sha256(posterContents) !== row.poster.sha256) {
    throw new Error(`${posterPath} does not match its animation candidate`)
  }
  const posterMetadata = await sharp(posterContents).metadata()
  if (
    posterMetadata.width !== 512
    || posterMetadata.height !== 512
    || posterMetadata.hasAlpha !== true
  ) {
    throw new Error(`${posterPath} must be a 512px alpha poster`)
  }
  if (row.activity === 'gaze') {
    const lockedBodyStart = 170 * 512 * 4
    const lockedBodyAlpha = Buffer.alloc((512 - 170) * 512)
    for (let offset = lockedBodyStart, index = 0; offset < frameBytes; offset += 4) {
      lockedBodyAlpha[index] = frames[0][offset + 3]
      index += 1
    }
    for (const frame of frames.slice(1)) {
      let index = 0
      for (let offset = lockedBodyStart; offset < frameBytes; offset += 4) {
        if (frame[offset + 3] !== lockedBodyAlpha[index]) {
          throw new Error(`${runtimePath} moves the gaze body below the head`)
        }
        index += 1
      }
    }
  }
  if (row.activity === 'sleep') {
    const belly = { x: 340, y: 295, rx: 108, ry: 76 }
    const reference = frames[0]
    const alphaAreas = []
    for (const frame of frames) {
      let alphaArea = 0
      for (let y = 0; y < 512; y += 1) {
        for (let x = 0; x < 512; x += 1) {
          const offset = (y * 512 + x) * 4
          const alpha = frame[offset + 3]
          alphaArea += alpha
          const normalizedDistance = (
            ((x - belly.x) / belly.rx) ** 2
            + ((y - belly.y) / belly.ry) ** 2
          )
          if (
            normalizedDistance >= 1
            && alpha !== reference[offset + 3]
          ) {
            throw new Error(`${runtimePath} moves pixels outside the belly`)
          }
        }
      }
      alphaAreas.push(alphaArea)
    }
    const alphaRange = Math.max(...alphaAreas) - Math.min(...alphaAreas)
    if (alphaRange / alphaAreas[0] > 0.002) {
      throw new Error(`${runtimePath} changes the sleeping cat's whole volume`)
    }
  }
}

const normalInterior = await sharp(resolveRepoPath(
  previewRoot,
  'interior-foreground.png',
)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const eatInterior = await sharp(resolveRepoPath(
  previewRoot,
  'interior-foreground-eat.png',
)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
let changedInsideEatPatch = 0
let changedOutsideEatPatch = 0
for (let y = 0; y < normalInterior.info.height; y += 1) {
  for (let x = 0; x < normalInterior.info.width; x += 1) {
    const offset = (y * normalInterior.info.width + x) * 4
    const changed = normalInterior.data[offset] !== eatInterior.data[offset]
      || normalInterior.data[offset + 1] !== eatInterior.data[offset + 1]
      || normalInterior.data[offset + 2] !== eatInterior.data[offset + 2]
      || normalInterior.data[offset + 3] !== eatInterior.data[offset + 3]
    if (!changed) continue
    if (x >= 300 && x <= 540 && y >= 1180 && y <= 1435) {
      changedInsideEatPatch += 1
    } else {
      changedOutsideEatPatch += 1
    }
  }
}
if (changedInsideEatPatch === 0 || changedOutsideEatPatch !== 0) {
  throw new Error('eat Home layer changes pixels outside the food-bowl patch')
}

const verticalEdgeScore = (x, startY, endY) => {
  let score = 0
  for (let y = startY; y < endY; y += 1) {
    const leftOffset = (y * normalInterior.info.width + x - 1) * 4
    const rightOffset = (y * normalInterior.info.width + x) * 4
    for (let channel = 0; channel < 3; channel += 1) {
      score += Math.abs(
        normalInterior.data[rightOffset + channel]
        - normalInterior.data[leftOffset + channel],
      )
    }
  }
  return score / ((endY - startY) * 3)
}
const signedVerticalEdgeScore = (x, startY, endY) => {
  let score = 0
  for (let y = startY; y < endY; y += 1) {
    const leftOffset = (y * normalInterior.info.width + x - 1) * 4
    const rightOffset = (y * normalInterior.info.width + x) * 4
    for (let channel = 0; channel < 3; channel += 1) {
      score += (
        normalInterior.data[rightOffset + channel]
        - normalInterior.data[leftOffset + channel]
      )
    }
  }
  return score / ((endY - startY) * 3)
}
const strongestVerticalEdge = (startX, endX, startY, endY) => {
  let strongest = { x: startX, score: -1 }
  for (let x = startX; x <= endX; x += 1) {
    const score = verticalEdgeScore(x, startY, endY)
    if (score > strongest.score) strongest = { x, score }
  }
  return strongest
}
const upperWallCorner = strongestVerticalEdge(740, 800, 100, 850)
const lowerWallCorner = strongestVerticalEdge(750, 790, 1040, 1140)
const ceilingWallCorner = strongestVerticalEdge(740, 800, 0, 100)
if (
  Math.abs(upperWallCorner.x - lowerWallCorner.x) > 3
  || Math.abs(upperWallCorner.x - manifest.rightWallPlane.cornerX) > 3
  || Math.abs(ceilingWallCorner.x - manifest.rightWallPlane.cornerX) > 3
) {
  throw new Error('right-wall corner does not continue from ceiling to baseboard')
}
if (verticalEdgeScore(845, 100, 850) >= upperWallCorner.score) {
  throw new Error('stale generated wall seam is stronger than the physical room corner')
}
for (const [startY, endY] of [[0, 100], [100, 850], [1040, 1140]]) {
  if (signedVerticalEdgeScore(manifest.rightWallPlane.cornerX, startY, endY) > -8) {
    throw new Error('right-wall corner is not a continuous dark edge')
  }
  let strongestLightReturn = -Infinity
  for (
    let x = manifest.rightWallPlane.cornerX + 1;
    x <= manifest.rightWallPlane.cornerX + 12;
    x += 1
  ) {
    strongestLightReturn = Math.max(
      strongestLightReturn,
      signedVerticalEdgeScore(x, startY, endY),
    )
  }
  if (strongestLightReturn > 5) {
    throw new Error('right-wall corner still has a competing light seam')
  }
}

console.log(
  `verified ${Object.keys(expectedFiles).length} non-shipping development home-art layers and ${catAnimationManifest.rows.length} fixed-canvas cat animations`,
)

// A/B/F base-plate + Cat Item gates (sibling script keeps this file focused).
await import('./check-base-plate-home-art.mjs')
