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

const expectedCatAnimations = [
  'sleep',
  'play',
  'eat',
  'gaze',
].map((activity) => (
  `cat-animations/cat--minho--${activity}--ambient--v02.webp`
))

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

for (const filename of expectedCatAnimations) {
  const runtimePath = resolveRepoPath(previewRoot, filename)
  const contents = await readFile(runtimePath).catch(() => {
    throw new Error(`${runtimePath} is missing`)
  })
  const metadata = await sharp(contents).metadata()
  if (
    metadata.width !== 4096
    || metadata.height !== 512
    || metadata.hasAlpha !== true
  ) {
    throw new Error(`${runtimePath} must be a 4096x512 alpha sprite`)
  }

  const frames = await Promise.all(
    Array.from({ length: 8 }, async (_, index) => {
      return sharp(contents)
        .extract({ left: index * 512, top: 0, width: 512, height: 512 })
        .ensureAlpha()
        .raw()
        .toBuffer()
    }),
  )
  const frameHashes = frames.map(sha256)
  if (new Set(frameHashes).size !== frameHashes.length) {
    throw new Error(`${runtimePath} contains duplicate frames`)
  }
  if (filename.includes('--gaze--')) {
    const lockedBodyStart = 170 * 512 * 4
    const lockedBody = frames[0].subarray(lockedBodyStart)
    if (frames.slice(1).some((frame) => (
      !frame.subarray(lockedBodyStart).equals(lockedBody)
    ))) {
      throw new Error(`${runtimePath} moves the gaze body below the head`)
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
  `verified ${Object.keys(expectedFiles).length} non-shipping development home-art layers and ${expectedCatAnimations.length} eight-frame cat animations`,
)
