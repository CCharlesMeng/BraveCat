import { createHash } from 'node:crypto'
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  PORTRAIT_POSES,
  PORTRAIT_POSE_VOCABULARY,
} from '../packages/core/src/assets/portraitPoseVocabulary.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
import { movedRepoRelativePath } from './lib/monorepo-paths.mjs'
// 清单里的历史仓库相对路径保持原样，文件访问时重定向到搬迁后位置。
const resolveRepoPath = (...segments) => path.join(
  root,
  movedRepoRelativePath(path.posix.join(...segments)),
)
const cliArgs = process.argv.slice(2)
const checkOnly = cliArgs.includes('--check')
const poses = PORTRAIT_POSES
const poseVocabularyPath = 'src/lib/assets/portraitPoseVocabulary.js'
const candidateRoot = 'docs/art/candidates/portraits/minho-watercolor-v2'
const matteRoot = `${candidateRoot}/mattes`
const poseRoot = `${candidateRoot}/poses`
const manifestPath = `${candidateRoot}/manifest.candidate.json`
const contactSheetPath =
  `${candidateRoot}/contact-sheet--minho-watercolor-v2--non-final.png`
const alphaContactSheetPath =
  `${candidateRoot}/contact-sheet--minho-watercolor-v2--alpha-qa--non-final.png`
const minimumMarginPx = 64
const normalizedContentSizePx = 1024 - minimumMarginPx * 2

const sha256 = (contents) => (
  createHash('sha256').update(contents).digest('hex')
)

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const matteInputs = new Map()
for (let index = 0; index < cliArgs.length; index += 1) {
  if (cliArgs[index] !== '--matte') continue
  const value = cliArgs[index + 1]
  const separator = value?.indexOf('=')
  assert(separator > 0, '--matte requires pose=/absolute/path.png')
  const pose = value.slice(0, separator)
  assert(poses.includes(pose), `unknown Portrait pose: ${pose}`)
  assert(!matteInputs.has(pose), `duplicate --matte for ${pose}`)
  matteInputs.set(pose, value.slice(separator + 1))
}
assert(
  matteInputs.size === 0 || poses.every((pose) => matteInputs.has(pose)),
  `provide either zero mattes or all ${poses.length} canonical poses`,
)

const identityLocks = {
  identityId: 'minho-silver-shaded-v1',
  breedType: 'round-headed-british-shorthair',
  eyeColor: 'muted-blue-green',
  coat: 'silver-shaded-with-soft-broad-bands',
  tail: 'thick-tapered-with-soft-ring-markings',
  body: 'compact-sturdy-athletic',
  nose: 'soft-pink',
  accessories: 'none',
}
const identityLockSha256 = sha256(Buffer.from(
  `${JSON.stringify(identityLocks)}\n`,
))
const poseVocabularyContents = await readFile(
  resolveRepoPath(poseVocabularyPath),
)
const poseVocabularySha256 = sha256(poseVocabularyContents)

const archivedMattePath = (pose) => (
  `${matteRoot}/matte--minho--${pose}--watercolor--v02.png`
)
const normalizedPosePath = (pose) => (
  `${poseRoot}/portrait--minho--${pose}--watercolor--v02.png`
)

const inspectPng = async (contents, label) => {
  const metadata = await sharp(contents).metadata()
  assert(
    metadata.format === 'png'
      && metadata.width === 1024
      && metadata.height === 1024
      && metadata.depth === 'uchar',
    `${label}: expected 1024x1024 PNG`,
  )
  return metadata
}

const extractMagentaMatte = async (contents, pose) => {
  const source = await sharp(contents)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  assert(
    source.info.width === 1024
      && source.info.height === 1024
      && source.info.channels === 3,
    `${pose}: matte must be 1024x1024 RGB`,
  )

  const cornerOffsets = [
    0,
    (source.info.width - 1) * 3,
    (source.info.height - 1) * source.info.width * 3,
    (source.info.width * source.info.height - 1) * 3,
  ]
  assert(
    cornerOffsets.every((offset) => (
      source.data[offset] >= 180
      && source.data[offset + 2] >= 180
      && Math.min(source.data[offset], source.data[offset + 2])
        - source.data[offset + 1] >= 140
    )),
    `${pose}: matte corners must be chroma magenta; got ${JSON.stringify(
      cornerOffsets.map((offset) => [
        source.data[offset],
        source.data[offset + 1],
        source.data[offset + 2],
      ]),
    )}`,
  )
  const cornerColors = cornerOffsets.map((offset) => (
    [0, 1, 2].map((channel) => source.data[offset + channel])
  ))
  const background = [0, 1, 2].map((channel) => (
    cornerColors.reduce((total, corner) => total + corner[channel], 0)
      / cornerColors.length
  ))
  const backgroundMagentaExcess =
    Math.min(background[0], background[2]) - background[1]
  assert(
    backgroundMagentaExcess >= 140,
    `${pose}: matte background is not separable; magenta excess `
      + `${backgroundMagentaExcess.toFixed(1)}`,
  )

  const rgba = Buffer.alloc(source.info.width * source.info.height * 4)
  for (
    let sourceOffset = 0, targetOffset = 0;
    sourceOffset < source.data.length;
    sourceOffset += 3, targetOffset += 4
  ) {
    const pixel = sourceOffset / 3
    const x = (pixel % source.info.width) / (source.info.width - 1)
    const y = Math.floor(pixel / source.info.width)
      / (source.info.height - 1)
    const localBackground = [0, 1, 2].map((channel) => {
      const top = cornerColors[0][channel] * (1 - x)
        + cornerColors[1][channel] * x
      const bottom = cornerColors[2][channel] * (1 - x)
        + cornerColors[3][channel] * x
      return top * (1 - y) + bottom * y
    })
    const red = source.data[sourceOffset]
    const green = source.data[sourceOffset + 1]
    const blue = source.data[sourceOffset + 2]
    const magentaExcess = Math.max(0, Math.min(red, blue) - green)
    const localBackgroundMagentaExcess =
      Math.min(localBackground[0], localBackground[2]) - localBackground[1]
    let alpha = 1 - magentaExcess / localBackgroundMagentaExcess
    if (alpha < 0.025) alpha = 0
    if (alpha > 0.975) alpha = 1
    rgba[targetOffset + 3] = Math.round(alpha * 255)
    if (alpha === 0) continue

    rgba[targetOffset] = Math.max(
      0,
      Math.min(
        255,
        Math.round((red - (1 - alpha) * localBackground[0]) / alpha),
      ),
    )
    rgba[targetOffset + 1] = Math.max(
      0,
      Math.min(
        255,
        Math.round((green - (1 - alpha) * localBackground[1]) / alpha),
      ),
    )
    rgba[targetOffset + 2] = Math.max(
      0,
      Math.min(
        255,
        Math.round((blue - (1 - alpha) * localBackground[2]) / alpha),
      ),
    )
  }

  const keyed = sharp(rgba, {
    raw: {
      width: source.info.width,
      height: source.info.height,
      channels: 4,
    },
  })
  const trimmed = await keyed
    .trim({
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      threshold: 2,
    })
    .png()
    .toBuffer({ resolveWithObject: true })
  const scale = Math.min(
    normalizedContentSizePx / trimmed.info.width,
    normalizedContentSizePx / trimmed.info.height,
  )
  const width = Math.max(1, Math.round(trimmed.info.width * scale))
  const height = Math.max(1, Math.round(trimmed.info.height * scale))
  const painted = await sharp(trimmed.data)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer()
  const left = Math.round((1024 - width) / 2)
  const top = 1024 - minimumMarginPx - height
  const normalized = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: painted, left, top }])
    .withIccProfile('srgb')
    .png({ compressionLevel: 9 })
    .toBuffer()

  const normalizedMetadata = await sharp(normalized).metadata()
  assert(
    normalizedMetadata.format === 'png'
      && normalizedMetadata.width === 1024
      && normalizedMetadata.height === 1024
      && normalizedMetadata.depth === 'uchar'
      && normalizedMetadata.hasAlpha === true
      && normalizedMetadata.space === 'srgb'
      && (normalizedMetadata.icc?.length ?? 0) > 0,
    `${pose}: normalized pose must be 1024x1024 8-bit RGBA with embedded sRGB`,
  )
  const normalizedRaw = await sharp(normalized)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let minimumX = 1024
  let minimumY = 1024
  let maximumX = -1
  let maximumY = -1
  let transparentPixelRgbZero = true
  let transparentPixelCount = 0
  let translucentPixelCount = 0
  let opaquePixelCount = 0
  for (let offset = 0; offset < normalizedRaw.data.length; offset += 4) {
    const pixel = offset / 4
    const x = pixel % 1024
    const y = Math.floor(pixel / 1024)
    const alpha = normalizedRaw.data[offset + 3]
    if (alpha === 0) {
      transparentPixelCount += 1
      transparentPixelRgbZero &&= (
        normalizedRaw.data[offset] === 0
        && normalizedRaw.data[offset + 1] === 0
        && normalizedRaw.data[offset + 2] === 0
      )
    } else if (alpha === 255) {
      opaquePixelCount += 1
    } else {
      translucentPixelCount += 1
    }
    if (alpha <= 8) continue
    minimumX = Math.min(minimumX, x)
    minimumY = Math.min(minimumY, y)
    maximumX = Math.max(maximumX, x)
    maximumY = Math.max(maximumY, y)
  }
  assert(maximumX >= minimumX && maximumY >= minimumY, `${pose}: empty matte`)
  assert(transparentPixelCount > 0, `${pose}: alpha has no transparent pixels`)
  assert(opaquePixelCount > 0, `${pose}: alpha has no opaque pixels`)
  assert(translucentPixelCount > 0, `${pose}: alpha has no softened edge pixels`)
  assert(transparentPixelRgbZero, `${pose}: transparent RGB must be zero`)
  const bounds = {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX + 1,
    height: maximumY - minimumY + 1,
  }
  const margins = {
    left: bounds.x,
    top: bounds.y,
    right: 1024 - bounds.x - bounds.width,
    bottom: 1024 - bounds.y - bounds.height,
  }
  assert(
    Object.values(margins).every((margin) => margin >= minimumMarginPx),
    `${pose}: normalized pose has a margin below ${minimumMarginPx}px`,
  )
  return {
    normalized,
    bounds,
    margins,
    alphaQa: {
      transparentPixelCount,
      translucentPixelCount,
      opaquePixelCount,
      transparentPixelRgbZero,
      contentAlphaThreshold: 8,
    },
    colorQa: {
      colorSpace: 'sRGB',
      embeddedIccProfile: true,
      bitDepth: 8,
      channels: 4,
      alpha: 'straight',
    },
  }
}

const writeOrCheck = async (repoPath, contents) => {
  const absolutePath = resolveRepoPath(repoPath)
  if (checkOnly) {
    let current
    try {
      current = await readFile(absolutePath)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error(
          `${repoPath} is missing; run npm run assets:build-minho-watercolor`,
        )
      }
      throw error
    }
    assert(
      sha256(current) === sha256(contents),
      `${repoPath} is stale; run npm run assets:build-minho-watercolor`,
    )
    return
  }
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, contents)
}

const artifacts = []
for (const pose of poses) {
  const poseDefinition = PORTRAIT_POSE_VOCABULARY.find(
    ({ id }) => id === pose,
  )
  assert(poseDefinition, `${pose}: missing canonical vocabulary entry`)
  const mattePath = archivedMattePath(pose)
  const externalPath = matteInputs.get(pose)
  const matteContents = externalPath
    ? await readFile(externalPath)
    : await readFile(resolveRepoPath(mattePath))
  await inspectPng(matteContents, `${pose} matte`)
  const {
    normalized,
    bounds,
    margins,
    alphaQa,
    colorQa,
  } = await extractMagentaMatte(matteContents, pose)
  await writeOrCheck(mattePath, matteContents)
  await writeOrCheck(normalizedPosePath(pose), normalized)
  artifacts.push({
    pose,
    semantics: {
      support: poseDefinition.support,
      interaction: poseDefinition.interaction,
    },
    identity: {
      identityId: identityLocks.identityId,
      identityLockSha256,
    },
    matte: {
      repoPath: mattePath,
      sha256: sha256(matteContents),
    },
    normalized: {
      repoPath: normalizedPosePath(pose),
      sha256: sha256(normalized),
      dimensions: {
        width: 1024,
        height: 1024,
        format: 'png',
        colorSpace: 'sRGB',
        alpha: 'straight',
      },
      contentBoundsPx: bounds,
      marginsPx: margins,
      alphaQa,
      colorQa,
    },
  })
}

const tileWidth = 384
const tileHeight = 420
const contactSheetColumns = 5
const contactSheetRows = Math.ceil(artifacts.length / contactSheetColumns)
const portraitDisplaySize = 332
const labelHeight = 44

const buildContactSheet = async ({ splitBackground }) => {
  const tiles = await Promise.all(
    artifacts.map(async ({ pose, normalized }) => {
      const portrait = await sharp(resolveRepoPath(normalized.repoPath))
        .resize(portraitDisplaySize, portraitDisplaySize, { fit: 'contain' })
        .png()
        .toBuffer()
      const background = splitBackground
        ? Buffer.from(
            `<svg width="${tileWidth}" height="${tileHeight}">`
              + `<rect width="${tileWidth / 2}" height="100%" fill="#f5f0e4"/>`
              + `<rect x="${tileWidth / 2}" width="${tileWidth / 2}" `
              + 'height="100%" fill="#26323c"/>'
              + '</svg>',
          )
        : Buffer.from(
            `<svg width="${tileWidth}" height="${tileHeight}">`
              + '<rect width="100%" height="100%" fill="#f5f0e4"/>'
              + '</svg>',
          )
      const labelBackground = splitBackground ? '#d9d2c5' : '#f5f0e4'
      const label = Buffer.from(
        `<svg width="${tileWidth}" height="${labelHeight}">`
          + `<rect width="100%" height="100%" fill="${labelBackground}"/>`
          + `<text x="16" y="30" font-family="sans-serif" font-size="21" `
          + `fill="#4f4a40">${pose}</text></svg>`,
      )
      return sharp(background)
        .composite([
          {
            input: portrait,
            left: Math.round((tileWidth - portraitDisplaySize) / 2),
            top: 18,
          },
          { input: label, left: 0, top: tileHeight - labelHeight },
        ])
        .withIccProfile('srgb')
        .png({ compressionLevel: 9 })
        .toBuffer()
    }),
  )
  return sharp({
    create: {
      width: tileWidth * contactSheetColumns,
      height: tileHeight * contactSheetRows,
      channels: 3,
      background: '#f5f0e4',
    },
  })
    .composite(tiles.map((input, index) => ({
      input,
      left: (index % contactSheetColumns) * tileWidth,
      top: Math.floor(index / contactSheetColumns) * tileHeight,
    })))
    .withIccProfile('srgb')
    .png({ compressionLevel: 9 })
    .toBuffer()
}

const contactSheet = await buildContactSheet({ splitBackground: false })
const alphaContactSheet = await buildContactSheet({ splitBackground: true })
await writeOrCheck(contactSheetPath, contactSheet)
await writeOrCheck(alphaContactSheetPath, alphaContactSheet)

const contentSetSha256 = sha256(Buffer.from(
  artifacts
    .map(({ pose, normalized }) => (
      `${pose}\t${normalized.sha256}\t${identityLockSha256}`
        + `\t${poseVocabularySha256}`
    ))
    .join('\n'),
))
const manifest = {
  schemaVersion: 2,
  manifestKind: 'portrait-watercolor-candidate-set',
  candidateSetId: 'minho-watercolor-v2',
  generatedAt: '2026-07-21',
  status: 'machine-qa-pass-pending-human-review',
  shippingEligible: false,
  portraitId: 'minho',
  poseVocabulary: {
    source: poseVocabularyPath,
    sha256: poseVocabularySha256,
    poseCount: poses.length,
    poseIds: poses,
    entries: PORTRAIT_POSE_VOCABULARY.map(({
      id,
      baseline,
      support,
      interaction,
    }) => ({
      id,
      baseline,
      support,
      interaction,
    })),
  },
  poseCoverage: {
    required: poses.length,
    produced: artifacts.length,
    missing: poses.filter(
      (pose) => !artifacts.some((artifact) => artifact.pose === pose),
    ),
  },
  identity: {
    locks: identityLocks,
    metadataSha256: identityLockSha256,
    machineCheck: 'consistent-metadata-reference-on-all-poses',
    visualConsistencyReview: 'pending-human-review',
  },
  style: {
    direction: 'user-approved-watercolor-c',
    rendering: 'broad-watercolor-masses-with-sparse-warm-pencil-contour',
    eyeDetail: 'subdued-flat-blue-green-washes-with-minimal-highlights',
    hairDetail: 'simplified-coat-masses-without-individual-fur-rendering',
    contrast: 'restrained',
    photorealisticFur: false,
  },
  contactSheet: {
    repoPath: contactSheetPath,
    sha256: sha256(contactSheet),
  },
  alphaQaContactSheet: {
    repoPath: alphaContactSheetPath,
    sha256: sha256(alphaContactSheet),
  },
  contentSetSha256,
  artifacts,
  machineQa: {
    result: 'pass',
    checks: {
      canonicalPoseCoverage: true,
      png1024Square: true,
      rgba8Bit: true,
      embeddedSrgb: true,
      straightAlpha: true,
      transparentRgbZero: true,
      minimumMarginPx,
      contentBoundsRecorded: true,
      artifactHashesRecorded: true,
      identityMetadataConsistent: artifacts.every(
        ({ identity }) => (
          identity.identityId === identityLocks.identityId
          && identity.identityLockSha256 === identityLockSha256
        ),
      ),
      contactSheetsRecorded: true,
    },
  },
  review: {
    decision: 'pending',
    reviewer: '',
    reviewedAt: null,
    requiredChecks: [
      'minho-identity-consistency',
      'watercolor-c-low-realism',
      'pose-semantics',
      'support-contact',
      'interaction-target-fit',
      'alpha-edge-quality',
    ],
  },
  remainingGate:
    'human-portrait-and-dedicated-scene-composite-approval-before-promotion',
}
await writeOrCheck(
  manifestPath,
  Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
)

console.log(
  `Minho watercolor candidates ${checkOnly ? 'verified' : 'generated'}: `
  + `${artifacts.length} poses`,
)
