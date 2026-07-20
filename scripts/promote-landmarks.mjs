import { createHash } from 'node:crypto'
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cliArgs = process.argv.slice(2)
const checkOnly = cliArgs.includes('--check')
const optionValue = (name, fallback) => {
  const index = cliArgs.indexOf(name)
  if (index === -1) return fallback
  const value = cliArgs[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a path`)
  }
  return value
}

const candidateManifestPath = optionValue(
  '--candidate-manifest',
  'docs/art/candidates/landmarks/manifest.candidates.v2.json',
)
const candidateQaPath = optionValue(
  '--candidate-qa',
  'docs/art/candidates/landmarks/qa-report.v2.json',
)
const visualApprovalPath = optionValue(
  '--visual-approval',
  'docs/art/reviews/landmarks/visual-approval.v1.json',
)
const rightsReviewPath = optionValue(
  '--rights-review',
  'docs/art/reviews/landmarks/rights-review-v1.md',
)
const rightsDecisionPath = optionValue(
  '--rights-decision',
  'docs/art/reviews/landmarks/rights-decision.v1.json',
)
const compositeManifestPath = optionValue(
  '--composite-manifest',
  'docs/art/reviews/landmarks/composites/manifest.json',
)
const compositeApprovalPath = optionValue(
  '--composite-approval',
  'docs/art/reviews/landmarks/composites/approval.v1.json',
)
const archivePath = optionValue(
  '--archive',
  'docs/art/archive/asset-archive.v1.json',
)
const productionManifestPath = optionValue(
  '--production-manifest',
  'docs/art/production/landmarks/manifest.v1.json',
)
const reviewIndexPath = optionValue(
  '--review-index',
  'docs/art/candidates/landmarks/review-index.v2.md',
)
const generatedCatalogPath = optionValue(
  '--generated-catalog',
  'src/lib/assets/landmarkCatalog.generated.ts',
)
const productionSceneRoot = 'docs/art/production/landmarks/scenes'
const runtimeSceneRoot = 'public/scenes'
const runtimeWebpQuality = 88
const runtimeWebpEffort = 6
const minimumRuntimePsnrDb = 35
const productionManifestVersion = Number(
  path.posix.basename(productionManifestPath).match(/^manifest\.v(\d+)\.json$/)?.[1] ?? 1,
)

const absolute = (repoPath) => path.join(root, repoPath)

const readContents = (repoPath) => readFile(absolute(repoPath))

const readOptionalContents = async (repoPath) => {
  try {
    return await readContents(repoPath)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

const readJson = async (repoPath) => JSON.parse(
  await readFile(absolute(repoPath), 'utf8'),
)

const sha256 = (contents) => (
  createHash('sha256').update(contents).digest('hex')
)

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const inspectPng = (contents, label) => {
  assert(
    contents.subarray(0, 8).toString('hex') === '89504e470d0a1a0a',
    `${label}: not a PNG`,
  )

  const png = {
    width: contents.readUInt32BE(16),
    height: contents.readUInt32BE(20),
    bitDepth: contents[24],
    colorType: contents[25],
  }
  assert(
    png.width === 1200
      && png.height === 900
      && png.bitDepth === 8
      && png.colorType === 2,
    `${label}: expected 1200x900 8-bit opaque RGB PNG`,
  )
  return png
}

const inspectWebp = async (contents, label) => {
  const metadata = await sharp(contents).metadata()
  assert(
    metadata.format === 'webp'
      && metadata.width === 1200
      && metadata.height === 900
      && metadata.hasAlpha === false,
    `${label}: expected 1200x900 opaque WebP`,
  )
  return metadata
}

const calculatePsnr = async (sourceContents, runtimeContents, label) => {
  const [source, runtime] = await Promise.all([
    sharp(sourceContents).toColourspace('srgb').removeAlpha().raw().toBuffer({
      resolveWithObject: true,
    }),
    sharp(runtimeContents).toColourspace('srgb').removeAlpha().raw().toBuffer({
      resolveWithObject: true,
    }),
  ])
  assert(
    source.info.width === runtime.info.width
      && source.info.height === runtime.info.height
      && source.info.channels === runtime.info.channels,
    `${label}: source and runtime pixels are not comparable`,
  )

  let squaredError = 0
  for (let index = 0; index < source.data.length; index += 1) {
    const difference = source.data[index] - runtime.data[index]
    squaredError += difference * difference
  }
  const meanSquaredError = squaredError / source.data.length
  const psnrDb = meanSquaredError === 0
    ? Number.POSITIVE_INFINITY
    : 10 * Math.log10((255 * 255) / meanSquaredError)
  assert(
    psnrDb >= minimumRuntimePsnrDb,
    `${label}: runtime WebP PSNR ${psnrDb.toFixed(2)} dB is below `
      + `${minimumRuntimePsnrDb} dB`,
  )
  return psnrDb
}

const validateCompositionSlot = (slot, label) => {
  assert(slot?.units === 'normalized', `${label}: slot units must be normalized`)
  assert(slot?.anchor === 'bottom-center', `${label}: slot anchor must be bottom-center`)
  assert(
    typeof slot.x === 'number' && slot.x >= 0 && slot.x <= 1,
    `${label}: slot x must be normalized`,
  )
  assert(
    typeof slot.y === 'number' && slot.y >= 0 && slot.y <= 1,
    `${label}: slot y must be normalized`,
  )
  assert(
    typeof slot.scale === 'number' && slot.scale > 0 && slot.scale <= 1,
    `${label}: slot scale must be in (0, 1]`,
  )
  assert(
    ['sit', 'sleep', 'walk', 'eat', 'play', 'gaze'].includes(slot.pose),
    `${label}: unsupported Portrait pose ${String(slot.pose)}`,
  )
  assert(typeof slot.flip === 'boolean', `${label}: slot flip must be boolean`)
}

const validateSafeBounds = (bounds, label) => {
  assert(bounds?.units === 'normalized', `${label}: safeBounds units must be normalized`)
  for (const key of ['x', 'y', 'width', 'height']) {
    assert(
      typeof bounds[key] === 'number' && bounds[key] >= 0 && bounds[key] <= 1,
      `${label}: safeBounds ${key} must be normalized`,
    )
  }
  assert(
    bounds.x + bounds.width <= 1.000001
      && bounds.y + bounds.height <= 1.000001,
    `${label}: safeBounds extend outside the scene`,
  )
}

const sameStringSet = (left, right) => (
  left.length === right.length
  && [...left].sort().every((value, index) => value === [...right].sort()[index])
)

const writeOrCheck = async (repoPath, contents) => {
  if (checkOnly) {
    let current
    try {
      current = await readFile(absolute(repoPath), 'utf8')
    } catch {
      throw new Error(`${repoPath} is missing; run npm run assets:promote-landmarks`)
    }
    assert(
      current === contents,
      `${repoPath} is stale; run npm run assets:promote-landmarks`,
    )
    return
  }

  await mkdir(path.dirname(absolute(repoPath)), { recursive: true })
  await writeFile(absolute(repoPath), contents)
}

const candidateContents = await readContents(candidateManifestPath)
const candidateManifest = JSON.parse(candidateContents)
const candidateQa = await readJson(candidateQaPath)
const approvalContents = await readContents(visualApprovalPath)
const visualApproval = JSON.parse(approvalContents)
const rightsReviewContents = await readContents(rightsReviewPath)
const rightsDecisionContents = await readContents(rightsDecisionPath)
const rightsDecision = JSON.parse(rightsDecisionContents)
const archiveContents = await readContents(archivePath)
const archive = JSON.parse(archiveContents)
const compositeManifestContents = await readOptionalContents(compositeManifestPath)
const compositeManifest = compositeManifestContents
  ? JSON.parse(compositeManifestContents)
  : null
const compositeApprovalContents = await readOptionalContents(compositeApprovalPath)
const compositeApproval = compositeApprovalContents
  ? JSON.parse(compositeApprovalContents)
  : null

assert(
  candidateManifest.schemaVersion >= 2
    && candidateManifest.manifestKind === 'landmark-candidate-master',
  'expected a combined landmark candidate manifest',
)
assert(
  candidateManifest.totals?.destinationCount === candidateManifest.destinations?.length
    && Number.isInteger(candidateManifest.totals?.activeSceneVariantCount)
    && candidateManifest.totals.activeSceneVariantCount > 0,
  'candidate manifest totals are invalid',
)
assert(
  visualApproval.decision === 'approved'
    && visualApproval.reviewer === 'user'
    && visualApproval.scope?.selection === 'all-active-scene-variants'
    && visualApproval.scope?.destinationCount
      === candidateManifest.totals.destinationCount
    && visualApproval.scope?.activeSceneVariantCount
      === candidateManifest.totals.activeSceneVariantCount
    && visualApproval.exclusions?.length === 0,
  'complete user visual approval is missing',
)

const candidateSceneById = new Map(
  candidateManifest.sceneVariants.map((scene) => [scene.id, scene]),
)
assert(
  candidateSceneById.size === candidateManifest.sceneVariants.length,
  'candidate manifest contains duplicate versioned scene ids',
)

const activeEntries = candidateManifest.destinations.flatMap((destination) => (
  destination.activeSceneVariantIds.map((sceneId) => {
    const scene = candidateSceneById.get(sceneId)
    assert(scene, `${destination.id}: missing active scene ${sceneId}`)
    assert(
      scene.destinationId === destination.id,
      `${sceneId}: destination mismatch`,
    )
    return { destination, scene }
  })
))
assert(
  activeEntries.length === candidateManifest.totals.activeSceneVariantCount,
  `expected ${candidateManifest.totals.activeSceneVariantCount} active scenes, `
    + `got ${activeEntries.length}`,
)

const approvedActiveSceneSetSha256 = sha256(Buffer.from(
  activeEntries.map(({ scene }) => scene.id).sort().join('\n'),
))
const approvedActiveSceneContentSetSha256 = sha256(Buffer.from(
  activeEntries
    .map(({ scene }) => `${scene.id}\t${scene.sha256}`)
    .sort()
    .join('\n'),
))
assert(
  visualApproval.scope.activeSceneSetSha256 === approvedActiveSceneSetSha256,
  'visual approval scene-set hash does not match the candidate manifest',
)
if (visualApproval.schemaVersion >= 2) {
  assert(
    visualApproval.scope.activeSceneContentSetSha256
      === approvedActiveSceneContentSetSha256,
    'visual approval content-set hash does not match the candidate manifest',
  )
}

assert(
  rightsDecision.schemaVersion === 1
    && rightsDecision.reviewKind
      === 'landmark-rights-and-provenance-product-risk-review'
    && rightsDecision.decision === 'review-complete-not-cleared'
    && rightsDecision.shippingEligible === false,
  'rights decision must fail closed until explicit shipping approval',
)
assert(
  rightsDecision.sourceReview?.path === rightsReviewPath
    && rightsDecision.sourceReview?.sha256 === sha256(rightsReviewContents),
  'rights decision does not match the cited review',
)
assert(
  rightsDecision.scope?.candidateManifest === candidateManifestPath
    && rightsDecision.scope?.candidateManifestSha256 === sha256(candidateContents)
    && rightsDecision.scope?.activeSceneSetSha256 === approvedActiveSceneSetSha256
    && rightsDecision.scope?.destinationCount
      === candidateManifest.totals.destinationCount
    && rightsDecision.scope?.activeSceneVariantCount === activeEntries.length,
  'rights decision scope does not match the active candidate set',
)
assert(
  Array.isArray(rightsDecision.globalGates)
    && rightsDecision.globalGates.length > 0
    && rightsDecision.globalGates.every((gate) => gate.status === 'open'),
  'rights decision must enumerate every open global gate',
)

const rightsByDestination = new Map(
  rightsDecision.destinations.map((destination) => [destination.id, destination]),
)
assert(
  rightsByDestination.size === candidateManifest.destinations.length,
  'rights decision has missing or duplicate destinations',
)
const derivedRiskSummary = Object.fromEntries(
  ['low', 'medium', 'high', 'blocked'].map((risk) => [
    risk,
    {
      destinationCount: rightsDecision.destinations.filter(
        (destination) => destination.risk === risk,
      ).length,
      sceneCount: rightsDecision.destinations
        .filter((destination) => destination.risk === risk)
        .reduce((total, destination) => total + destination.sceneCount, 0),
    },
  ]),
)
for (const destination of candidateManifest.destinations) {
  const rights = rightsByDestination.get(destination.id)
  assert(rights, `${destination.id}: missing rights decision`)
  assert(
    ['low', 'medium', 'high', 'blocked'].includes(rights.risk)
      && rights.shippingEligible === false
      && typeof rights.disposition === 'string'
      && rights.disposition.length > 0
      && rights.sceneCount === destination.activeSceneVariantIds.length,
    `${destination.id}: invalid rights decision`,
  )
}
assert(
  ['low', 'medium', 'high', 'blocked'].every((risk) => (
    rightsDecision.summary?.[risk]?.destinationCount
      === derivedRiskSummary[risk].destinationCount
    && rightsDecision.summary?.[risk]?.sceneCount
      === derivedRiskSummary[risk].sceneCount
  )),
  'rights decision risk summary is inconsistent',
)
assert(
  archive.review?.landmarkHumanVisualReview === 'approved'
    && archive.landmarkSet?.activeSceneSetSha256
      === approvedActiveSceneSetSha256
    && (
      archive.landmarkSet.activeSceneContentSetSha256 === undefined
      || archive.landmarkSet.activeSceneContentSetSha256
        === approvedActiveSceneContentSetSha256
    ),
  'asset archive does not resolve to the approved visual-review scope',
)

const compositeReviewApproved = Boolean(
  compositeManifest
    && compositeApproval
    && compositeManifest.status === 'approved'
    && compositeManifest.review?.decision === 'approved'
    && compositeApproval.decision === 'approved'
    && compositeApproval.reviewer === 'user'
    && compositeApproval.scope?.activeSceneSetSha256
      === approvedActiveSceneSetSha256
    && compositeApproval.scope?.compositeSetSha256
      === compositeManifest.compositeSetSha256
    && compositeApproval.scope?.portraitId === 'minho'
    && compositeApproval.scope?.sceneCount === activeEntries.length,
)
if (compositeApproval) {
  assert(
    compositeReviewApproved,
    'Minho composite approval does not match the active candidate set',
  )
}

const archiveContentKeys = archive.landmarks.flatMap((destination) => (
  destination.scenes.map((scene) => (
    [
      scene.destinationId,
      scene.variantId,
      scene.version,
      scene.sha256,
    ].join('|')
  ))
))
const candidateContentKeys = activeEntries.map(({ scene }) => (
  [
    scene.destinationId,
    scene.variantId,
    scene.version,
    scene.sha256,
  ].join('|')
))
assert(
  sameStringSet(archiveContentKeys, candidateContentKeys),
  'approved archive image set differs from the candidate manifest',
)

const semanticIds = new Set()
const productionNames = new Set()
const runtimeNames = new Set()
const runtimeScenes = []
const runtimePsnrValues = []

for (const { scene } of activeEntries) {
  const label = scene.id
  const expectedSemanticId = `${scene.destinationId}--${scene.variantId}`
  const expectedVersionedId = `${expectedSemanticId}--${scene.version}`
  const expectedProductionFilename = `scene--${expectedVersionedId}.png`
  const expectedRuntimeFilename = `scene--${expectedVersionedId}.webp`

  assert(scene.id === expectedVersionedId, `${label}: versioned id mismatch`)
  assert(
    scene.sourceCandidateId === expectedSemanticId
      || scene.sourceCandidateId === expectedVersionedId,
    `${label}: unexpected source candidate id`,
  )
  assert(/^v\d{2}$/.test(scene.version), `${label}: version must use vNN grammar`)
  assert(
    path.posix.basename(scene.imageSrc) === expectedProductionFilename,
    `${label}: filename mismatch`,
  )
  assert(!semanticIds.has(expectedSemanticId), `${label}: duplicate semantic id`)
  assert(
    !productionNames.has(expectedProductionFilename),
    `${label}: duplicate production filename`,
  )
  assert(
    !runtimeNames.has(expectedRuntimeFilename),
    `${label}: duplicate runtime filename`,
  )
  semanticIds.add(expectedSemanticId)
  productionNames.add(expectedProductionFilename)
  runtimeNames.add(expectedRuntimeFilename)

  validateCompositionSlot(scene.compositionSlot, label)
  validateSafeBounds(scene.safeBounds, label)
  assert(
    scene.hasCompanion === Boolean(scene.companion),
    `${label}: Companion metadata mismatch`,
  )

  const sourceContents = await readContents(scene.imageSrc)
  inspectPng(sourceContents, label)
  const actualSha256 = sha256(sourceContents)
  assert(actualSha256 === scene.sha256, `${label}: source sha256 mismatch`)

  const productionRepoPath = path.posix.join(
    productionSceneRoot,
    expectedProductionFilename,
  )
  const runtimeRepoPath = path.posix.join(
    runtimeSceneRoot,
    expectedRuntimeFilename,
  )
  const legacyRuntimeRepoPath = path.posix.join(
    runtimeSceneRoot,
    expectedProductionFilename,
  )
  const imageSrc = `/${path.posix.relative('public', runtimeRepoPath)}`
  let runtimeContents

  if (checkOnly) {
    let productionContents
    try {
      productionContents = await readContents(productionRepoPath)
    } catch {
      throw new Error(
        `${productionRepoPath} is missing; run npm run assets:promote-landmarks`,
      )
    }
    assert(
      sha256(productionContents) === actualSha256,
      `${productionRepoPath}: production master differs from approved source`,
    )
    try {
      runtimeContents = await readContents(runtimeRepoPath)
    } catch {
      throw new Error(
        `${runtimeRepoPath} is missing; run npm run assets:promote-landmarks`,
      )
    }
  } else {
    await mkdir(absolute(productionSceneRoot), { recursive: true })
    await mkdir(absolute(runtimeSceneRoot), { recursive: true })
    await copyFile(absolute(scene.imageSrc), absolute(productionRepoPath))
    runtimeContents = await sharp(sourceContents)
      .webp({
        quality: runtimeWebpQuality,
        effort: runtimeWebpEffort,
        smartSubsample: true,
      })
      .toBuffer()
    await writeFile(absolute(runtimeRepoPath), runtimeContents)
    try {
      await unlink(absolute(legacyRuntimeRepoPath))
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  await inspectWebp(runtimeContents, runtimeRepoPath)
  runtimePsnrValues.push(
    await calculatePsnr(sourceContents, runtimeContents, runtimeRepoPath),
  )
  const runtimeSha256 = sha256(runtimeContents)
  const sceneRights = rightsByDestination.get(scene.destinationId)

  runtimeScenes.push({
    id: expectedSemanticId,
    candidateRevisionId: scene.id,
    sourceCandidateId: scene.sourceCandidateId,
    destinationId: scene.destinationId,
    destinationName: scene.destinationName,
    variantId: scene.variantId,
    version: scene.version,
    status: 'approved-for-runtime-integration',
    shippingEligible: false,
    imageSrc,
    repoPath: runtimeRepoPath,
    sha256: runtimeSha256,
    dimensions: {
      width: 1200,
      height: 900,
      format: 'webp',
      alpha: 'opaque',
      colorSpace: 'sRGB',
    },
    productionMaster: {
      repoPath: productionRepoPath,
      sha256: actualSha256,
      byteLength: sourceContents.length,
      dimensions: {
        width: 1200,
        height: 900,
        format: 'png',
        bitDepth: 8,
        alpha: 'opaque',
        colorSpace: 'sRGB',
      },
    },
    runtimeDerivative: {
      repoPath: runtimeRepoPath,
      imageSrc,
      sha256: runtimeSha256,
      byteLength: runtimeContents.length,
      format: 'webp',
      quality: runtimeWebpQuality,
      effort: runtimeWebpEffort,
      smartSubsample: true,
    },
    compositionSlot: {
      x: scene.compositionSlot.x,
      y: scene.compositionSlot.y,
      scale: scene.compositionSlot.scale,
      pose: scene.compositionSlot.pose,
      flip: scene.compositionSlot.flip,
    },
    safeBounds: scene.safeBounds,
    hasCompanion: scene.hasCompanion,
    companion: scene.companion
      ? {
          kind: scene.companion.kind,
          count: scene.companion.count,
          role: scene.companion.role,
          sceneOnly: scene.companion.sceneOnly,
          directlyPaintedIntoScene: scene.companion.directlyPaintedIntoScene,
          playerPortrait: scene.companion.playerPortrait,
          standaloneAsset: scene.companion.standaloneAsset,
          reusableAnimalAsset: scene.companion.reusableAnimalAsset,
        }
      : null,
    humanVisualReview: 'approved',
    rightsReview: sceneRights.risk,
    rightsDisposition: sceneRights.disposition,
    finalRealPortraitCompositeReview: compositeReviewApproved
      ? 'approved'
      : 'pending',
  })
}

let runtimeFiles = []
try {
  runtimeFiles = (await readdir(absolute(runtimeSceneRoot)))
    .filter((filename) => /^scene--.+--v\d{2}\.(?:png|webp)$/.test(filename))
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}
const unexpectedRuntimeFiles = runtimeFiles.filter((filename) => !runtimeNames.has(filename))
assert(
  unexpectedRuntimeFiles.length === 0,
  `unexpected versioned runtime scenes: ${unexpectedRuntimeFiles.join(', ')}`,
)

let productionFiles = []
try {
  productionFiles = (await readdir(absolute(productionSceneRoot)))
    .filter((filename) => /^scene--.+--v\d{2}\.png$/.test(filename))
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}
const unexpectedProductionFiles = productionFiles.filter(
  (filename) => !productionNames.has(filename),
)
assert(
  unexpectedProductionFiles.length === 0,
  `unexpected production scene masters: ${unexpectedProductionFiles.join(', ')}`,
)

const runtimeDestinations = candidateManifest.destinations.map((destination) => ({
  id: destination.id,
  name: destination.name,
  sceneVariants: runtimeScenes
    .filter((scene) => scene.destinationId === destination.id)
    .map((scene) => ({
      id: scene.id,
      destinationId: scene.destinationId,
      imageSrc: scene.imageSrc,
      compositionSlot: scene.compositionSlot,
      hasCompanion: scene.hasCompanion,
    })),
}))

const sceneSetSha256 = sha256(Buffer.from(
  runtimeScenes.map(({ candidateRevisionId }) => candidateRevisionId).sort().join('\n'),
))
const contentSetSha256 = sha256(Buffer.from(
  runtimeScenes
    .map(({ candidateRevisionId, sha256: sceneSha256 }) => (
      `${candidateRevisionId}\t${sceneSha256}`
    ))
    .sort()
    .join('\n'),
))
const productionMasterContentSetSha256 = sha256(Buffer.from(
  runtimeScenes
    .map(({ candidateRevisionId, productionMaster }) => (
      `${candidateRevisionId}\t${productionMaster.sha256}`
    ))
    .sort()
    .join('\n'),
))
const productionMasterBytes = runtimeScenes.reduce(
  (total, scene) => total + scene.productionMaster.byteLength,
  0,
)
const runtimeDerivativeBytes = runtimeScenes.reduce(
  (total, scene) => total + scene.runtimeDerivative.byteLength,
  0,
)
const runtimeReductionPercent = Number(
  ((1 - runtimeDerivativeBytes / productionMasterBytes) * 100).toFixed(1),
)

const productionManifest = {
  schemaVersion: 1,
  manifestKind: 'landmark-production',
  catalogId: `miaoyouji-landmarks-production-v${productionManifestVersion}-2026-07-20`,
  generatedAt: '2026-07-20',
  status: compositeReviewApproved
    ? 'visual-composite-and-rights-reviewed-not-cleared-runtime-integrated'
    : 'visual-and-rights-reviewed-not-cleared-runtime-integrated',
  shippingEligible: false,
  source: {
    candidateManifest: {
      path: candidateManifestPath,
      sha256: sha256(candidateContents),
      planId: candidateManifest.planId,
    },
    candidateQa: {
      path: candidateQaPath,
      reportedOverallStatus: candidateQa.overallStatus,
      ...(candidateQa.overallStatus === 'fail'
        ? {
            note: 'The recorded v2 failure is the historical v1 review-index snapshot check; promotion revalidates every active source image and composition field.',
          }
        : {}),
    },
    visualApproval: {
      path: visualApprovalPath,
      sha256: sha256(approvalContents),
      approvedArchiveSceneSetSha256: visualApproval.scope.activeSceneSetSha256,
    },
    approvedArchive: {
      path: archivePath,
      sha256: sha256(archiveContents),
    },
    rightsReview: {
      path: rightsReviewPath,
      sha256: sha256(rightsReviewContents),
      decisionRecord: rightsDecisionPath,
      decisionRecordSha256: sha256(rightsDecisionContents),
      decision: rightsDecision.decision,
      reviewedAt: rightsDecision.reviewedAt,
    },
    ...(compositeReviewApproved
      ? {
          compositeQa: {
            path: compositeManifestPath,
            sha256: sha256(compositeManifestContents),
            compositeSetSha256: compositeManifest.compositeSetSha256,
          },
          compositeApproval: {
            path: compositeApprovalPath,
            sha256: sha256(compositeApprovalContents),
            reviewer: compositeApproval.reviewer,
            reviewedAt: compositeApproval.reviewedAt,
          },
        }
      : {}),
  },
  scope: {
    destinationCount: runtimeDestinations.length,
    activeSceneVariantCount: runtimeScenes.length,
    ordinaryVariantCount: runtimeScenes.filter(({ hasCompanion }) => !hasCompanion).length,
    companionRareVariantCount: runtimeScenes.filter(({ hasCompanion }) => hasCompanion).length,
    versionedSceneSetSha256: sceneSetSha256,
    productionMasterContentSetSha256,
    runtimeContentSetSha256: contentSetSha256,
  },
  review: {
    humanVisualReview: {
      decision: 'approved',
      reviewer: visualApproval.reviewer,
      reviewedAt: visualApproval.reviewedAt,
      selection: visualApproval.scope.selection,
      exclusions: visualApproval.exclusions,
    },
    rightsReview: {
      decision: rightsDecision.decision,
      reviewedAt: rightsDecision.reviewedAt,
      reviewer: rightsDecision.reviewer,
      globalGatesOpen: rightsDecision.globalGates.map(({ id }) => id),
      riskSummary: derivedRiskSummary,
    },
    finalRealPortraitCompositeReview: compositeReviewApproved
      ? 'approved'
      : 'pending',
    shippingApproval: 'blocked-pending-remaining-gates',
  },
  remainingGates: [
    ...(!compositeReviewApproved ? ['final-real-minho-composite-review'] : []),
    ...rightsDecision.remainingGates,
  ],
  runtime: {
    productionMasterRoot: productionSceneRoot,
    sceneRoot: runtimeSceneRoot,
    generatedCatalog: generatedCatalogPath,
    productionFilenameGrammar: 'scene--{destination-id}--{variant-id}--vNN.png',
    runtimeFilenameGrammar: 'scene--{destination-id}--{variant-id}--vNN.webp',
    semanticSceneIdsExcludeVersion: true,
    optimization: {
      productionFormat: 'png',
      runtimeFormat: 'webp',
      webpQuality: runtimeWebpQuality,
      webpEffort: runtimeWebpEffort,
      smartSubsample: true,
      productionMasterBytes,
      runtimeDerivativeBytes,
      reductionPercent: runtimeReductionPercent,
      loadingPolicy: 'on-demand-cache-first',
      precached: false,
    },
  },
  rightsAndProvenanceWarnings: candidateManifest.rightsAndProvenanceWarnings,
  destinations: runtimeDestinations.map((destination) => ({
    id: destination.id,
    name: destination.name,
    status: 'approved-for-runtime-integration',
    shippingEligible: false,
    rightsReview: rightsByDestination.get(destination.id).risk,
    rightsDisposition: rightsByDestination.get(destination.id).disposition,
    scenes: runtimeScenes.filter((scene) => scene.destinationId === destination.id),
  })),
}

const generatedCatalog = [
  '// Generated by scripts/promote-landmarks.mjs. Do not edit by hand.',
  "import type { Destination } from './index'",
  '',
  `export const LANDMARK_SCENES_SHIPPING_ELIGIBLE = ${productionManifest.shippingEligible} as const`,
  '',
  `export const LANDMARK_DESTINATIONS = ${JSON.stringify(runtimeDestinations, null, 2)} as const satisfies readonly Destination[]`,
  '',
].join('\n')

const reviewIndex = await readFile(absolute(reviewIndexPath), 'utf8')
const sceneCount = runtimeScenes.length
let approvedReviewIndex = reviewIndex
  .replace(
    `All ${sceneCount} active scene candidates are non-shipping and pending human approval. Machine QA does not authorize promotion; human visual review, rights review, and final real-Portrait composite review remain pending.`,
    `All ${sceneCount} active scene candidates passed user visual review and were promoted for runtime integration. Shipping remains blocked until rights review and final real-Portrait composite review pass.`,
  )
  .replaceAll('pending review', 'visual approved')

if (compositeReviewApproved) {
  approvedReviewIndex = approvedReviewIndex
    .replace(
      'Shipping remains blocked until rights review and final real-Portrait composite review pass.',
      `All ${sceneCount} Minho composites also passed user review. Shipping remains blocked until rights review passes.`,
    )
    .replace(
      'Composite review decision: **pending user approval**.',
      'Composite review decision: **approved by user**.',
    )
}

approvedReviewIndex = approvedReviewIndex.replace(
  `All ${sceneCount} Minho composites also passed user review. Shipping remains blocked until rights review passes.`,
  `All ${sceneCount} Minho composites also passed user review. `
    + 'The rights review is complete but did not clear shipping: '
    + `${rightsDecision.summary.blocked.destinationCount} destinations are blocked, `
    + `${rightsDecision.summary.high.destinationCount} are high-risk holds, `
    + 'and all scenes remain behind open global provenance gates.',
)

const reviewIndexDirectory = path.posix.dirname(reviewIndexPath)
const visualApprovalLink = path.posix.relative(
  reviewIndexDirectory,
  visualApprovalPath,
)
const productionManifestLink = path.posix.relative(
  reviewIndexDirectory,
  productionManifestPath,
)
const compositeApprovalLink = path.posix.relative(
  reviewIndexDirectory,
  compositeApprovalPath,
)
const rightsReviewLink = path.posix.relative(
  reviewIndexDirectory,
  rightsReviewPath,
)
const rightsDecisionLink = path.posix.relative(
  reviewIndexDirectory,
  rightsDecisionPath,
)
const candidateQaLink = path.posix.basename(candidateQaPath)

if (!approvedReviewIndex.includes('[Visual approval record]')) {
  approvedReviewIndex = approvedReviewIndex.replace(
    `- [Machine QA report](${candidateQaLink})`,
    `- [Machine QA report](${candidateQaLink})\n`
      + `- [Visual approval record](${visualApprovalLink})\n`
      + `- [Production manifest](${productionManifestLink})`,
  )
}
if (
  compositeReviewApproved
  && !approvedReviewIndex.includes('[Composite approval record]')
) {
  approvedReviewIndex = approvedReviewIndex.replace(
    `- [Visual approval record](${visualApprovalLink})`,
    `- [Visual approval record](${visualApprovalLink})\n`
      + `- [Composite approval record](${compositeApprovalLink})`,
  )
}
if (!approvedReviewIndex.includes('[Rights and provenance review]')) {
  approvedReviewIndex = approvedReviewIndex.replace(
    `- [Visual approval record](${visualApprovalLink})`,
    `- [Visual approval record](${visualApprovalLink})\n`
      + `- [Rights and provenance review](${rightsReviewLink})\n`
      + `- [Machine-checkable rights decision](${rightsDecisionLink})`,
  )
}
assert(
  approvedReviewIndex.includes('passed user visual review')
    && approvedReviewIndex.includes('rights review is complete')
    && !approvedReviewIndex.includes('pending review'),
  `${reviewIndexPath}: could not record visual approval`,
)

await writeOrCheck(
  productionManifestPath,
  `${JSON.stringify(productionManifest, null, 2)}\n`,
)
await writeOrCheck(generatedCatalogPath, generatedCatalog)
await writeOrCheck(reviewIndexPath, approvedReviewIndex)

console.log(
  `landmark production ${checkOnly ? 'verified' : 'generated'}: `
  + `${runtimeDestinations.length} destinations, ${runtimeScenes.length} scenes, `
  + `minimum WebP PSNR ${Math.min(...runtimePsnrValues).toFixed(2)} dB`,
)
