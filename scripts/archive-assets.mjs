import { createHash } from 'node:crypto'
import {
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BASELINE_PORTRAIT_POSES,
  isPortraitPose,
} from '../packages/core/src/assets/portraitPoseVocabulary.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
import { movedRepoRelativePath } from './lib/monorepo-paths.mjs'
// 清单里的历史仓库相对路径保持原样，文件访问时重定向到搬迁后位置。
const resolveRepoPath = (...segments) => path.join(
  root,
  movedRepoRelativePath(path.posix.join(...segments)),
)
const artRoot = resolveRepoPath('docs/art')
const landmarkRoot = path.join(artRoot, 'candidates/landmarks')
const archiveRoot = path.join(artRoot, 'archive')
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
const optionValues = (name, fallback) => {
  const values = []
  for (let index = 0; index < cliArgs.length; index += 1) {
    if (cliArgs[index] !== name) continue
    const value = cliArgs[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`${name} requires a path`)
    }
    values.push(value)
  }
  return values.length > 0 ? values : fallback
}

const firstBatchManifestPath = optionValue(
  '--first-batch-manifest',
  'docs/art/candidates/landmarks/manifest.candidates.json',
)
const firstBatchQaPath = optionValue(
  '--first-batch-qa',
  'docs/art/candidates/landmarks/qa-report.json',
)
const expansionPlanPaths = optionValues(
  '--expansion-plan',
  ['docs/art/landmark-expansion-v2.json'],
)
const portraitManifestPath = optionValue(
  '--portrait-manifest',
  'docs/art/production/portraits/minho/manifest.json',
)
const portraitValidationPath = optionValue(
  '--portrait-validation',
  'docs/art/production/portraits/minho/validation.json',
)
const landmarkVisualApprovalPath = optionValue(
  '--visual-approval',
  'docs/art/reviews/landmarks/visual-approval.v1.json',
)
const landmarkCompositeApprovalPath = optionValue(
  '--composite-approval',
  'docs/art/reviews/landmarks/composites/approval.v1.json',
)
const landmarkRightsReviewPath = optionValue(
  '--rights-review',
  'docs/art/reviews/landmarks/rights-review-v1.md',
)
const landmarkRightsDecisionPath = optionValue(
  '--rights-decision',
  'docs/art/reviews/landmarks/rights-decision.v1.json',
)
const archiveOutputPath = optionValue(
  '--archive-output',
  'docs/art/archive/asset-archive.v1.json',
)
const archiveReadmeOutputPath = optionValue(
  '--archive-readme-output',
  'docs/art/archive/README.md',
)
const reviewIndexOutputPath = optionValue(
  '--review-index-output',
  'docs/art/candidates/landmarks/review-index.md',
)

const readJson = async (repoPath) => JSON.parse(
  await readFile(resolveRepoPath(repoPath), 'utf8'),
)

const readOptionalJson = async (repoPath) => {
  try {
    return await readJson(repoPath)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

const sha256 = (contents) => (
  createHash('sha256').update(contents).digest('hex')
)

const inspectPng = (contents) => {
  const signature = contents.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') {
    throw new Error('not a PNG')
  }

  return {
    width: contents.readUInt32BE(16),
    height: contents.readUInt32BE(20),
    bitDepth: contents[24],
    colorType: contents[25],
  }
}

const toRepoPath = (sourceFragment, imageSrc) => {
  if (imageSrc.startsWith('docs/') || imageSrc.startsWith('public/')) {
    return imageSrc
  }

  return path.posix.join(path.posix.dirname(sourceFragment), imageSrc)
}

const validateCompositionSlot = (slot, label, errors) => {
  if (!slot || typeof slot !== 'object') {
    errors.push(`${label}: missing compositionSlot`)
    return
  }

  if (
    typeof slot.x !== 'number'
    || slot.x < 0
    || slot.x > 1
    || typeof slot.y !== 'number'
    || slot.y < 0
    || slot.y > 1
  ) {
    errors.push(`${label}: composition anchor outside normalized canvas`)
  }
  if (
    typeof slot.scale !== 'number'
    || slot.scale <= 0
    || slot.scale > 1
  ) {
    errors.push(`${label}: illegal portrait scale`)
  }
  if (!isPortraitPose(slot.pose)) {
    errors.push(`${label}: unsupported pose ${String(slot.pose)}`)
  }
  if (typeof slot.flip !== 'boolean') {
    errors.push(`${label}: flip must be boolean`)
  }
}

const inspectScene = async ({
  destinationId,
  destinationName,
  sourceFragment,
  semanticId,
  variantId,
  version,
  imageSrc,
  expectedSha256,
  compositionSlot,
  hasCompanion,
}) => {
  const errors = []
  const repoPath = toRepoPath(sourceFragment, imageSrc)
  let contents

  try {
    contents = await readFile(resolveRepoPath(repoPath))
  } catch {
    errors.push(`${semanticId}: missing ${repoPath}`)
    return { errors }
  }

  let png
  try {
    png = inspectPng(contents)
  } catch (error) {
    errors.push(`${semanticId}: ${error.message}`)
    return { errors }
  }

  const actualSha256 = sha256(contents)
  if (expectedSha256 && actualSha256 !== expectedSha256) {
    errors.push(`${semanticId}: sha256 mismatch`)
  }
  if (
    png.width !== 1200
    || png.height !== 900
    || png.bitDepth !== 8
    || png.colorType !== 2
  ) {
    errors.push(
      `${semanticId}: expected 1200x900 8-bit opaque RGB PNG, got `
      + `${png.width}x${png.height} depth=${png.bitDepth} colorType=${png.colorType}`,
    )
  }
  validateCompositionSlot(compositionSlot, semanticId, errors)

  return {
    errors,
    scene: {
      id: `${semanticId}--${version}`,
      semanticId,
      destinationId,
      destinationName,
      variantId,
      version,
      status: 'candidate',
      shippingEligible: false,
      imageSrc: repoPath,
      sha256: actualSha256,
      dimensions: {
        width: png.width,
        height: png.height,
        format: 'png',
        bitDepth: png.bitDepth,
        alpha: 'opaque',
        colorSpace: 'sRGB',
      },
      compositionSlot: {
        x: compositionSlot.x,
        y: compositionSlot.y,
        scale: compositionSlot.scale,
        pose: compositionSlot.pose,
        flip: compositionSlot.flip,
      },
      hasCompanion: Boolean(hasCompanion),
      sourceFragment,
      machineQa: errors.length === 0 ? 'pass' : 'fail',
    },
  }
}

const versionFromImage = (imageSrc) => {
  const match = imageSrc.match(/--(v\d+)\.png$/)
  if (!match) throw new Error(`missing vNN revision in ${imageSrc}`)
  return match[1]
}

const buildFirstBatch = async () => {
  const manifest = await readJson(firstBatchManifestPath)
  const qa = await readJson(firstBatchQaPath)
  const errors = []
  const destinations = []

  for (const destination of manifest.destinations) {
    const scenes = []
    for (const activeId of destination.activeSceneVariantIds) {
      const source = manifest.sceneVariants.find(({ id }) => id === activeId)
      if (!source) {
        errors.push(`${destination.id}: missing active scene ${activeId}`)
        continue
      }

      const inspected = await inspectScene({
        destinationId: destination.id,
        destinationName: destination.name,
        sourceFragment: destination.sourceFragment,
        semanticId: source.sourceCandidateId.endsWith(`--${source.version}`)
          ? source.sourceCandidateId.slice(0, -(`--${source.version}`.length))
          : source.sourceCandidateId,
        variantId: source.variantId,
        version: source.version,
        imageSrc: source.imageSrc,
        expectedSha256: source.sha256,
        compositionSlot: source.compositionSlot,
        hasCompanion: source.hasCompanion,
      })
      errors.push(...inspected.errors)
      if (inspected.scene) scenes.push(inspected.scene)
    }

    destinations.push({
      id: destination.id,
      name: destination.name,
      batchId: manifest.planId,
      status: 'candidate',
      shippingEligible: false,
      sourceFragment: destination.sourceFragment,
      scenes,
    })
  }

  if (qa.overallStatus !== 'pass') {
    errors.push(`${firstBatchQaPath}: existing machine QA is not pass`)
  }

  return {
    batch: {
      id: manifest.planId,
      sourcePlan: manifest.sourcePlan,
      sourceManifest: firstBatchManifestPath,
      sourceQa: firstBatchQaPath,
      destinationCount: destinations.length,
      activeSceneVariantCount: destinations.flatMap(({ scenes }) => scenes).length,
      machineQa: errors.length === 0 ? 'pass' : 'fail',
      humanReview: 'pending',
    },
    destinations,
    errors,
  }
}

const buildExpansionBatch = async (expansionPlanPath) => {
  const plan = await readJson(expansionPlanPath)
  const errors = []
  const destinations = []

  for (const plannedDestination of plan.destinations) {
    const sourceFragment = path.posix.join(
      'docs/art/candidates/landmarks',
      plannedDestination.id,
      'manifest.fragment.json',
    )
    const fragment = await readJson(sourceFragment)
    const scenes = []

    if (
      fragment.destinationId !== plannedDestination.id
      || fragment.shippingEligible !== false
    ) {
      errors.push(`${sourceFragment}: destination or shipping state mismatch`)
    }

    for (const source of fragment.sceneVariants) {
      const repoPath = toRepoPath(sourceFragment, source.imageSrc)
      const inspected = await inspectScene({
        destinationId: plannedDestination.id,
        destinationName: plannedDestination.name,
        sourceFragment,
        semanticId: source.id,
        variantId: source.variantId,
        version: versionFromImage(repoPath),
        imageSrc: source.imageSrc,
        expectedSha256: source.sha256,
        compositionSlot: source.compositionSlot,
        hasCompanion: source.hasCompanion,
      })
      errors.push(...inspected.errors)
      if (inspected.scene) scenes.push(inspected.scene)
    }

    const expectedVariantIds = plannedDestination.variants.map(({ id }) => id)
    const actualVariantIds = scenes.map(({ variantId }) => variantId)
    if (
      expectedVariantIds.length !== actualVariantIds.length
      || expectedVariantIds.some((id) => !actualVariantIds.includes(id))
    ) {
      errors.push(`${plannedDestination.id}: variant coverage differs from expansion plan`)
    }

    destinations.push({
      id: plannedDestination.id,
      name: plannedDestination.name,
      batchId: plan.planId,
      status: 'candidate',
      shippingEligible: false,
      sourceFragment,
      scenes,
    })
  }

  return {
    batch: {
      id: plan.planId,
      sourcePlan: expansionPlanPath,
      sourceManifest: null,
      sourceQa: null,
      destinationCount: destinations.length,
      activeSceneVariantCount: destinations.flatMap(({ scenes }) => scenes).length,
      machineQa: errors.length === 0 ? 'pass' : 'fail',
      humanReview: 'pending',
    },
    destinations,
    errors,
  }
}

const inspectPortrait = async () => {
  const manifest = await readJson(portraitManifestPath)
  const validation = await readJson(portraitValidationPath)
  const errors = []
  const poses = []
  const requiredPoses = BASELINE_PORTRAIT_POSES
  const artifactPoseNames = Object.keys(manifest.production.artifacts).sort()
  const runtimePoseNames = Object.keys(manifest.portrait.poses).sort()
  const validationPoseNames = Object.keys(validation.poses ?? {}).sort()
  const expectedPoseNames = [...requiredPoses].sort()

  if (
    JSON.stringify(artifactPoseNames) !== JSON.stringify(expectedPoseNames)
    || JSON.stringify(runtimePoseNames) !== JSON.stringify(expectedPoseNames)
    || JSON.stringify(validationPoseNames) !== JSON.stringify(expectedPoseNames)
  ) {
    errors.push(
      'Minho manifest, validation, and runtime pose sets must match '
        + 'the baseline Portrait vocabulary',
    )
  }

  for (const [pose, artifact] of Object.entries(manifest.production.artifacts)) {
    let contents
    try {
      contents = await readFile(resolveRepoPath(artifact.repoPath))
    } catch {
      errors.push(`${pose}: missing ${artifact.repoPath}`)
      continue
    }

    const actualSha256 = sha256(contents)
    const png = inspectPng(contents)
    if (actualSha256 !== artifact.sha256) {
      errors.push(`${pose}: sha256 mismatch`)
    }
    if (validation.poses?.[pose]?.sha256 !== actualSha256) {
      errors.push(`${pose}: validation sha256 mismatch`)
    }
    const expectedImageSrc = `/${path.posix.relative('public', artifact.repoPath)}`
    if (manifest.portrait.poses[pose] !== expectedImageSrc) {
      errors.push(`${pose}: runtime path does not match production artifact`)
    }
    const minimumMargin = manifest.production.spec.safeMarginPx
    const margins = validation.poses?.[pose]?.marginsPx
    if (
      !margins
      || ['left', 'top', 'right', 'bottom'].some(
        (side) => (
          typeof margins[side] !== 'number'
          || margins[side] < minimumMargin
        ),
      )
    ) {
      errors.push(`${pose}: validation margin is below ${minimumMargin}px`)
    }
    if (
      png.width !== 1024
      || png.height !== 1024
      || png.bitDepth !== 8
      || png.colorType !== 6
    ) {
      errors.push(`${pose}: expected 1024x1024 8-bit RGBA PNG`)
    }

    poses.push({
      pose,
      imageSrc: manifest.portrait.poses[pose],
      repoPath: artifact.repoPath,
      sha256: actualSha256,
      dimensions: {
        width: png.width,
        height: png.height,
        format: 'png',
        bitDepth: png.bitDepth,
        alpha: 'straight',
        colorSpace: 'sRGB',
      },
    })
  }

  const portraitPublicDirectory = resolveRepoPath('public/portraits/minho')
  const expectedPublicFiles = Object.values(manifest.production.artifacts)
    .map(({ repoPath }) => path.posix.basename(repoPath))
    .sort()
  const actualPublicFiles = (await readdir(portraitPublicDirectory))
    .filter((filename) => filename.endsWith('.png'))
    .sort()
  if (JSON.stringify(actualPublicFiles) !== JSON.stringify(expectedPublicFiles)) {
    errors.push('public/portraits/minho contains missing or unexpected PNG files')
  }
  try {
    inspectPng(await readFile(resolveRepoPath(manifest.portrait.identityReferenceSrc)))
  } catch {
    errors.push('Minho identity reference is missing or invalid')
  }

  if (
    manifest.portrait.status !== 'approved'
    || manifest.production.state !== 'approved'
    || manifest.production.review.decision !== 'approved'
    || validation.ok !== true
    || validation.checks?.privateSourcePhotosStoredInRepo !== false
    || poses.length !== requiredPoses.length
  ) {
    errors.push('Minho portrait approval or baseline-pose validation is incomplete')
  }

  return {
    portrait: {
      id: manifest.portrait.id,
      name: manifest.portrait.name,
      status: manifest.portrait.status,
      shippingEligible: errors.length === 0,
      sourceManifest: portraitManifestPath,
      sourceValidation: portraitValidationPath,
      privateSourcePhotosStored: false,
      poses,
      machineQa: errors.length === 0 ? 'pass' : 'fail',
      humanReview: manifest.production.review.decision,
    },
    errors,
  }
}

const buildReviewIndex = (archive) => {
  const visualReviewLabel = archive.review.landmarkHumanVisualReview === 'approved'
    ? 'visual approved'
    : 'pending review'
  const reviewIndexDirectory = path.posix.dirname(reviewIndexOutputPath)
  const archiveLink = path.posix.relative(
    reviewIndexDirectory,
    archiveOutputPath,
  )
  const firstBatchManifestLink = path.posix.relative(
    reviewIndexDirectory,
    firstBatchManifestPath,
  )
  const firstBatchQaLink = path.posix.relative(
    reviewIndexDirectory,
    firstBatchQaPath,
  )
  const rightsReviewLink = path.posix.relative(
    reviewIndexDirectory,
    landmarkRightsReviewPath,
  )
  const rightsDecisionLink = path.posix.relative(
    reviewIndexDirectory,
    landmarkRightsDecisionPath,
  )
  const expansionPlanLinks = expansionPlanPaths.map((planPath, index) => {
    const link = path.posix.relative(reviewIndexDirectory, planPath)
    const label = expansionPlanPaths.length === 1
      ? 'Expansion plan'
      : `Expansion plan ${index + 1}`
    return `- [${label}](${link})`
  })
  const lines = [
    '# Landmark candidate review index',
    '',
    `Archived candidate scope: ${archive.totals.destinationCount} destinations / `
      + `${archive.totals.activeSceneVariantCount} active scene variants. `
      + `Human visual review is ${archive.review.landmarkHumanVisualReview}; `
      + `Minho composite review is ${archive.review.finalRealPortraitCompositeReview}. `
      + 'Rights review is complete but did not clear any scene for shipping.',
    '',
    `- [Combined asset archive](${archiveLink})`,
    `- [First-batch normalized manifest](${firstBatchManifestLink})`,
    `- [First-batch machine QA](${firstBatchQaLink})`,
    `- [Rights and provenance review](${rightsReviewLink})`,
    `- [Machine-checkable rights decision](${rightsDecisionLink})`,
    ...expansionPlanLinks,
    '',
    '## First-batch QA overviews',
    '',
    '1. [Overview 01 of 03](contact-sheet--landmarks--overview-01-of-03--non-final.png)',
    '2. [Overview 02 of 03](contact-sheet--landmarks--overview-02-of-03--non-final.png)',
    '3. [Overview 03 of 03](contact-sheet--landmarks--overview-03-of-03--non-final.png)',
    '',
    '## Destination review order',
    '',
  ]

  archive.landmarks.forEach((destination, index) => {
    lines.push(
      `${index + 1}. **${destination.name}** (\`${destination.id}\`) — `
      + `${destination.scenes.length} active candidate${destination.scenes.length === 1 ? '' : 's'}; `
      + `rights risk: **${destination.scenes[0]?.rightsReview ?? 'invalid'}**`,
    )
    for (const scene of destination.scenes) {
      const relativeImage = path.posix.relative(
        'docs/art/candidates/landmarks',
        scene.imageSrc,
      )
      lines.push(
        `   - [${scene.variantId} · ${scene.version}`
        + `${scene.hasCompanion ? ' · companion' : ''}`
        + ` · ${visualReviewLabel}](${relativeImage})`,
      )
    }
    lines.push(
      `   - [destination contact sheet](${destination.id}/contact-sheet--${destination.id}--non-final.png)`,
    )
  })

  lines.push(
    '',
    '## Shipping gates',
    '',
    archive.review.landmarkHumanVisualReview === 'approved'
      ? '- User approved the complete active landmark set for visual quality.'
      : '- Human visual review is pending for every landmark scene.',
    archive.review.finalRealPortraitCompositeReview === 'approved'
      ? '- User approved all active scenes composited with the required Minho pose.'
      : '- Final composite review with the approved Minho Portrait is pending.',
    '- Rights review is complete but shipping was not cleared: 5 destinations are blocked, 2 are high-risk holds, and all 48 scenes retain open global provenance gates.',
    '- Superseded candidates remain in their source directories for provenance and are excluded from active totals.',
    '',
  )

  return `${lines.join('\n')}\n`
}

const writeOrCheck = async (repoPath, contents) => {
  const absolutePath = resolveRepoPath(repoPath)
  if (checkOnly) {
    let current
    try {
      current = await readFile(absolutePath, 'utf8')
    } catch {
      throw new Error(`${repoPath} is missing; run npm run assets:archive`)
    }
    if (current !== contents) {
      throw new Error(`${repoPath} is stale; run npm run assets:archive`)
    }
    return
  }

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, contents)
}

const firstBatch = await buildFirstBatch()
const expansionBatches = await Promise.all(
  expansionPlanPaths.map(buildExpansionBatch),
)
const portraitResult = await inspectPortrait()
const landmarks = [
  ...firstBatch.destinations,
  ...expansionBatches.flatMap(({ destinations }) => destinations),
]
const scenes = landmarks.flatMap(({ scenes: destinationScenes }) => destinationScenes)
const errors = [
  ...firstBatch.errors,
  ...expansionBatches.flatMap(({ errors: batchErrors }) => batchErrors),
  ...portraitResult.errors,
]
const activeSceneSetSha256 = sha256(Buffer.from(
  scenes.map(({ id }) => id).sort().join('\n'),
))
const activeSceneContentSetSha256 = sha256(Buffer.from(
  scenes
    .map(({ id, sha256: sceneSha256 }) => `${id}\t${sceneSha256}`)
    .sort()
    .join('\n'),
))
const landmarkVisualApproval = await readOptionalJson(
  landmarkVisualApprovalPath,
)
let landmarkHumanVisualReview = 'pending'

if (landmarkVisualApproval) {
  const scope = landmarkVisualApproval.scope
  if (
    landmarkVisualApproval.decision !== 'approved'
    || landmarkVisualApproval.reviewer !== 'user'
    || scope?.activeSceneSetSha256 !== activeSceneSetSha256
    || (
      landmarkVisualApproval.schemaVersion >= 2
      && scope?.activeSceneContentSetSha256 !== activeSceneContentSetSha256
    )
    || scope?.destinationCount !== landmarks.length
    || scope?.activeSceneVariantCount !== scenes.length
  ) {
    errors.push(`${landmarkVisualApprovalPath}: approval scope does not match active landmark set`)
  } else {
    landmarkHumanVisualReview = 'approved'
  }
}

const landmarkCompositeApproval = await readOptionalJson(
  landmarkCompositeApprovalPath,
)
let finalRealPortraitCompositeReview = 'pending'
if (
  landmarkCompositeApproval?.decision === 'approved'
  && landmarkCompositeApproval.status !== 'superseded'
) {
  const scope = landmarkCompositeApproval.scope
  if (
    landmarkCompositeApproval.decision !== 'approved'
    || landmarkCompositeApproval.reviewer !== 'user'
    || scope?.activeSceneSetSha256 !== activeSceneSetSha256
    || scope?.portraitId !== portraitResult.portrait.id
    || scope?.sceneCount !== scenes.length
  ) {
    errors.push(`${landmarkCompositeApprovalPath}: approval scope does not match active composites`)
  } else {
    finalRealPortraitCompositeReview = 'approved'
  }
}

const landmarkRightsDecision = await readOptionalJson(
  landmarkRightsDecisionPath,
)
const landmarkRightsReviewRecords = landmarkRightsDecision
  ? (
      landmarkRightsDecision.sourceReviews
      ?? [landmarkRightsDecision.sourceReview]
    ).filter(Boolean)
  : []
const landmarkRightsReviewContents = await Promise.all(
  landmarkRightsReviewRecords.map(({ path: reviewPath }) => (
    readFile(resolveRepoPath(reviewPath))
  )),
)
const rightsByDestination = new Map(
  landmarkRightsDecision?.destinations?.map((destination) => (
    [destination.id, destination]
  )) ?? [],
)
let landmarkRightsReview = 'pending'
if (landmarkRightsDecision) {
  if (
    landmarkRightsDecision.schemaVersion >= 1
    && landmarkRightsDecision.decision === 'review-complete-not-cleared'
    && landmarkRightsDecision.shippingEligible === false
    && landmarkRightsReviewRecords.length > 0
    && landmarkRightsReviewRecords.every((record, index) => (
      record?.path
      && record.sha256 === sha256(landmarkRightsReviewContents[index])
    ))
    && landmarkRightsDecision.scope?.activeSceneSetSha256
      === activeSceneSetSha256
    && landmarkRightsDecision.scope?.destinationCount === landmarks.length
    && landmarkRightsDecision.scope?.activeSceneVariantCount === scenes.length
    && (
      landmarkRightsDecision.scope?.activeSceneContentSetSha256 === undefined
      || landmarkRightsDecision.scope.activeSceneContentSetSha256
        === activeSceneContentSetSha256
    )
    && rightsByDestination.size === landmarks.length
    && landmarks.every((destination) => {
      const rights = rightsByDestination.get(destination.id)
      return rights
        && rights.sceneCount === destination.scenes.length
        && rights.shippingEligible === false
        && ['low', 'medium', 'high', 'blocked'].includes(rights.risk)
    })
  ) {
    landmarkRightsReview = 'review-complete-not-cleared'
  } else {
    landmarkRightsReview = 'invalid'
    errors.push(`${landmarkRightsDecisionPath}: decision does not match active landmarks`)
  }
}

for (const scene of scenes) {
  const rights = rightsByDestination.get(scene.destinationId)
  scene.humanVisualReview = landmarkHumanVisualReview
  scene.finalRealPortraitCompositeReview = finalRealPortraitCompositeReview
  scene.rightsReview = rights?.risk ?? 'pending'
  scene.rightsDisposition = rights?.disposition ?? 'pending'
}

const archive = {
  schemaVersion: 1,
  manifestKind: 'bravecat-asset-archive',
  generatedAt: '2026-07-20',
  status: errors.length === 0 ? 'machine-qa-pass' : 'machine-qa-fail',
  shippingPolicy: {
    portraits: 'approved-only',
    landmarks: 'non-shipping-until-explicit-rights-and-shipping-approval',
  },
  batches: [
    firstBatch.batch,
    ...expansionBatches.map(({ batch }) => batch),
  ].map((batch) => ({
    ...batch,
    humanReview: landmarkHumanVisualReview,
  })),
  landmarkSet: {
    activeSceneSetSha256,
    ...(archiveOutputPath !== 'docs/art/archive/asset-archive.v1.json'
      || landmarkVisualApproval?.schemaVersion >= 2
      ? { activeSceneContentSetSha256 }
      : {}),
    visualApproval: landmarkVisualApproval
      ? landmarkVisualApprovalPath
      : null,
    compositeApproval: landmarkCompositeApproval
      ? landmarkCompositeApprovalPath
      : null,
    rightsReviews: landmarkRightsDecision
      ? landmarkRightsReviewRecords.map(({ path: reviewPath }) => reviewPath)
      : [],
    rightsDecision: landmarkRightsDecision ? landmarkRightsDecisionPath : null,
  },
  totals: {
    destinationCount: landmarks.length,
    activeSceneVariantCount: scenes.length,
    ordinaryVariantCount: scenes.filter(({ hasCompanion }) => !hasCompanion).length,
    companionRareVariantCount: scenes.filter(({ hasCompanion }) => hasCompanion).length,
    approvedPortraitCount: portraitResult.errors.length === 0 ? 1 : 0,
    approvedPortraitPoseCount: portraitResult.portrait.poses.length,
  },
  review: {
    machineQa: errors.length === 0 ? 'pass' : 'fail',
    landmarkHumanVisualReview,
    finalRealPortraitCompositeReview,
    landmarkRightsReview,
  },
  portrait: portraitResult.portrait,
  landmarks,
  errors,
}

const archiveJson = `${JSON.stringify(archive, null, 2)}\n`
const reviewIndex = buildReviewIndex(archive)
const archiveReadme = [
  '# BraveCat asset archive',
  '',
  'This directory is the canonical cross-batch inventory. Raw generation outputs and provenance stay under `docs/art/candidates`; approved PNG masters and manifests stay under `docs/art/production`. Optimized landmark derivatives under `public/scenes` are development-only staging and must be stripped from production builds until shipping approval.',
  '',
  `- Machine QA: **${archive.review.machineQa}**`,
  `- Approved Portraits: **${archive.totals.approvedPortraitCount}** (${archive.totals.approvedPortraitPoseCount} poses)`,
  `- Landmark candidates: **${archive.totals.destinationCount} destinations / ${archive.totals.activeSceneVariantCount} active scenes**`,
  `- Landmark visual review: **${archive.review.landmarkHumanVisualReview}**`,
  `- Minho composite review: **${archive.review.finalRealPortraitCompositeReview}**`,
  `- Landmark rights review: **${archive.review.landmarkRightsReview}**`,
  landmarkHumanVisualReview === 'approved'
    && finalRealPortraitCompositeReview === 'approved'
    ? '- Landmark shipping status: **blocked; rights review completed with open global and destination gates**'
    : '- Landmark shipping status: **blocked pending visual, composite, and rights review**',
  '',
  'Regenerate with `npm run assets:archive`; verify without rewriting with `npm run assets:check`.',
  '',
].join('\n')

await writeOrCheck(archiveOutputPath, archiveJson)
await writeOrCheck(archiveReadmeOutputPath, archiveReadme)
await writeOrCheck(reviewIndexOutputPath, reviewIndex)

if (errors.length > 0) {
  throw new Error(`asset archive failed:\n- ${errors.join('\n- ')}`)
}

console.log(
  `asset archive ${checkOnly ? 'verified' : 'generated'}: `
  + `${archive.totals.destinationCount} landmarks, `
  + `${archive.totals.activeSceneVariantCount} scenes, `
  + `${archive.totals.approvedPortraitPoseCount} approved portrait poses`,
)
