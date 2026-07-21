import { createHash } from 'node:crypto'
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { PORTRAIT_POSES } from '../src/lib/assets/portraitPoseVocabulary.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')
const runCommand = 'npm run assets:integrate-latest-art'

const landmarkManifestPath =
  'docs/art/candidates/landmarks/manifest.candidates.v5.json'
const landmarkQaPath = 'docs/art/candidates/landmarks/qa-report.v5.json'
const visualApprovalPath = 'docs/art/reviews/landmarks/visual-approval.v3.json'
const portraitManifestPath =
  'docs/art/candidates/portraits/minho-watercolor-v2/manifest.candidate.json'
const compositeManifestPath =
  'docs/art/reviews/portraits/minho-watercolor-v2/composites-v5/manifest.json'
const runtimeRoot = 'public/dev-art/latest-v5'
const runtimeSceneRoot = `${runtimeRoot}/scenes`
const runtimePortraitRoot = `${runtimeRoot}/portraits/minho-watercolor-v2`
const generatedCatalogPath =
  'src/lib/assets/devLatestArtCatalog.generated.ts'

const sha256 = (contents) => (
  createHash('sha256').update(contents).digest('hex')
)
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const absolute = (repoPath) => {
  const normalized = path.posix.normalize(repoPath)
  assert(
    !path.posix.isAbsolute(normalized)
      && normalized !== '..'
      && !normalized.startsWith('../'),
    `${repoPath}: path must stay inside the repository`,
  )
  return path.join(root, normalized)
}
const readJson = async (repoPath) => JSON.parse(
  await readFile(absolute(repoPath), 'utf8'),
)
const writeOrCheck = async (repoPath, contents) => {
  if (checkOnly) {
    let current
    try {
      current = await readFile(absolute(repoPath))
    } catch {
      throw new Error(`${repoPath} is missing; run ${runCommand}`)
    }
    assert(
      sha256(current) === sha256(contents),
      `${repoPath} is stale; run ${runCommand}`,
    )
    return
  }
  await mkdir(path.dirname(absolute(repoPath)), { recursive: true })
  await writeFile(absolute(repoPath), contents)
}
const normalizeSourcePath = (repoPath, label) => {
  assert(
    typeof repoPath === 'string'
      && repoPath.startsWith('docs/art/candidates/')
      && repoPath.endsWith('.png')
      && !repoPath.includes('/../'),
    `${label}: expected a candidate PNG inside docs/art/candidates`,
  )
  return repoPath
}
const inspectScene = async (contents, label) => {
  const metadata = await sharp(contents).metadata()
  assert(
    metadata.format === 'png'
      && metadata.width === 1200
      && metadata.height === 900
      && metadata.depth === 'uchar'
      && metadata.hasAlpha === false
      && metadata.space === 'srgb',
    `${label}: expected 1200x900 opaque sRGB PNG`,
  )
}
const inspectPortrait = async (contents, label) => {
  const metadata = await sharp(contents).metadata()
  assert(
    metadata.format === 'png'
      && metadata.width === 1024
      && metadata.height === 1024
      && metadata.depth === 'uchar'
      && metadata.hasAlpha === true
      && metadata.space === 'srgb',
    `${label}: expected 1024x1024 RGBA sRGB PNG`,
  )
}
const expectedFileSet = async (repoPath) => {
  try {
    return new Set(await readdir(absolute(repoPath)))
  } catch (error) {
    if (error?.code === 'ENOENT') return new Set()
    throw error
  }
}
const removeUnexpectedFiles = async (repoPath, expectedNames) => {
  if (checkOnly) {
    const currentNames = await expectedFileSet(repoPath)
    const extras = [...currentNames].filter((name) => !expectedNames.has(name))
    assert(
      extras.length === 0,
      `${repoPath} has stale development-only artifacts: ${extras.join(', ')}`,
    )
    return
  }
  await mkdir(absolute(repoPath), { recursive: true })
  const currentNames = await expectedFileSet(repoPath)
  await Promise.all(
    [...currentNames]
      .filter((name) => !expectedNames.has(name))
      .map((name) => rm(path.join(absolute(repoPath), name), {
        force: true,
        recursive: true,
      })),
  )
}

const [
  landmarkManifestContents,
  landmarkQa,
  visualApproval,
  portraitManifest,
  compositeManifest,
] = await Promise.all([
  readFile(absolute(landmarkManifestPath)),
  readJson(landmarkQaPath),
  readJson(visualApprovalPath),
  readJson(portraitManifestPath),
  readJson(compositeManifestPath),
])
const landmarkManifest = JSON.parse(landmarkManifestContents)
const landmarkManifestSha256 = sha256(landmarkManifestContents)

assert(
  landmarkManifest.manifestKind === 'landmark-candidate-master'
    && landmarkManifest.status === 'candidate'
    && landmarkManifest.shippingEligible === false
    && landmarkManifest.approvalState === 'pending-human-approval',
  'v5 landmark manifest must remain a non-shipping candidate set',
)
assert(
  landmarkQa.overallStatus === 'pass'
    && landmarkQa.shippingEligible === false
    && landmarkQa.sourceManifest === landmarkManifestPath
    && landmarkQa.sourceManifestSha256 === landmarkManifestSha256,
  'v5 landmark machine QA must pass against the exact candidate manifest',
)
assert(
  visualApproval.decision === 'approved'
    && visualApproval.shippingEligible === false
    && visualApproval.scope?.candidateManifest === landmarkManifestPath
    && visualApproval.scope?.candidateManifestSha256 === landmarkManifestSha256
    && visualApproval.scope?.activeSceneSetSha256
      === landmarkManifest.activeSet?.activeSceneSetSha256
    && visualApproval.scope?.activeSceneContentSetSha256
      === landmarkManifest.activeSet?.activeSceneContentSetSha256,
  'v5 visual approval must be candidate-scoped and non-shipping',
)
assert(
  portraitManifest.manifestKind === 'portrait-watercolor-candidate-set'
    && portraitManifest.candidateSetId === 'minho-watercolor-v2'
    && portraitManifest.status === 'machine-qa-pass-pending-human-review'
    && portraitManifest.shippingEligible === false
    && portraitManifest.machineQa?.result === 'pass',
  'Minho watercolor v2 must remain a non-shipping machine-QA candidate',
)
assert(
  compositeManifest.status === 'pending-human-review'
    && compositeManifest.shippingEligible === false
    && compositeManifest.sceneSource === landmarkManifestPath
    && compositeManifest.activeSceneSetSha256
      === landmarkManifest.activeSet?.activeSceneSetSha256
    && compositeManifest.activeSceneContentSetSha256
      === landmarkManifest.activeSet?.activeSceneContentSetSha256
    && compositeManifest.portraitSource === portraitManifestPath
    && compositeManifest.portraitContentSetSha256
      === portraitManifest.contentSetSha256,
  'v5 composite QA must be pending and match both candidate sets',
)

const sceneById = new Map(
  landmarkManifest.sceneVariants.map((scene) => [scene.id, scene]),
)
const destinations = landmarkManifest.destinations.map((destination) => {
  const sceneVariants = destination.activeSceneVariantIds.map((sceneId) => {
    const scene = sceneById.get(sceneId)
    assert(scene, `${destination.id}: missing active scene ${sceneId}`)
    const expectedId = `${scene.destinationId}--${scene.variantId}--${scene.version}`
    assert(
      scene.id === expectedId
        && scene.destinationId === destination.id
        && scene.shippingEligible === false
        && typeof scene.sha256 === 'string'
        && /^[a-f0-9]{64}$/i.test(scene.sha256)
        && scene.compositionSlot?.pose
        && PORTRAIT_POSES.includes(scene.compositionSlot.pose),
      `${sceneId}: invalid v5 runtime scene record`,
    )
    normalizeSourcePath(scene.imageSrc, sceneId)
    assert(
      scene.imageSrc.startsWith('docs/art/candidates/landmarks/'),
      `${sceneId}: cinematic and non-landmark assets are excluded`,
    )
    return scene
  })
  assert(
    sceneVariants.length >= 2,
    `${destination.id}: v5 destination needs at least two scene variants`,
  )
  return {
    ...destination,
    sceneVariants,
  }
})
const scenes = destinations.flatMap(({ sceneVariants }) => sceneVariants)
assert(
  destinations.length === 25
    && scenes.length === 76
    && landmarkManifest.totals?.activeSceneVariantCount === 76
    && landmarkManifest.activeSet?.activeSceneVariantCount === 76
    && new Set(scenes.map(({ id }) => id)).size === 76
    && new Set(scenes.map(
      ({ destinationId, variantId }) => `${destinationId}--${variantId}`,
    )).size === 76,
  'v5 development preview must contain the exact 25-destination/76-scene set',
)

const portraitByPose = new Map(
  portraitManifest.artifacts.map((artifact) => [artifact.pose, artifact]),
)
const candidatePoseIds = [...PORTRAIT_POSES]
assert(
  portraitManifest.poseCoverage?.required === candidatePoseIds.length
    && portraitManifest.poseCoverage?.produced === candidatePoseIds.length
    && portraitManifest.poseCoverage?.missing?.length === 0
    && portraitManifest.poseVocabulary?.poseCount === candidatePoseIds.length
    && candidatePoseIds.every((pose) => portraitByPose.has(pose)),
  'Minho watercolor v2 must include all canonical poses',
)
const selectableScenePoseIds = [...new Set(
  scenes.map(({ compositionSlot }) => compositionSlot.pose),
)].sort()
const compositePoseIds = [...compositeManifest.portraitPoseCoverage.sceneCompositePoses]
  .sort()
const pendingDedicatedScenePoseIds = [
  ...compositeManifest.portraitPoseCoverage.pendingDedicatedScenePoses,
].sort()
assert(
  compositeManifest.portraitPoseCoverage.candidatePoseCount
    === candidatePoseIds.length
    && JSON.stringify(compositePoseIds) === JSON.stringify(selectableScenePoseIds)
    && JSON.stringify(pendingDedicatedScenePoseIds)
      === JSON.stringify(
        candidatePoseIds
          .filter((pose) => !selectableScenePoseIds.includes(pose))
          .sort(),
      ),
  'scene selector coverage must only expose poses covered by v5 composite QA',
)

const runtimeSceneNames = new Set()
const runtimeSceneRecords = []
for (const scene of scenes) {
  const sourceContents = await readFile(absolute(scene.imageSrc))
  await inspectScene(sourceContents, scene.id)
  assert(
    sha256(sourceContents) === scene.sha256,
    `${scene.id}: candidate source hash mismatch`,
  )
  const runtimeFilename = `scene--${scene.id}.webp`
  runtimeSceneNames.add(runtimeFilename)
  const runtimeContents = await sharp(sourceContents)
    .webp({
      quality: 88,
      effort: 6,
      smartSubsample: true,
    })
    .toBuffer()
  const runtimePath = `${runtimeSceneRoot}/${runtimeFilename}`
  await writeOrCheck(runtimePath, runtimeContents)
  runtimeSceneRecords.push({
    scene,
    runtimeFilename,
    runtimePath,
    runtimeSha256: sha256(runtimeContents),
  })
}
await removeUnexpectedFiles(runtimeSceneRoot, runtimeSceneNames)

const runtimePortraitNames = new Set()
const runtimePortraitRecords = []
for (const pose of candidatePoseIds) {
  const artifact = portraitByPose.get(pose)
  const sourcePath = normalizeSourcePath(
    artifact.normalized?.repoPath,
    `${pose}: portrait`,
  )
  assert(
    sourcePath.startsWith(
      'docs/art/candidates/portraits/minho-watercolor-v2/poses/',
    ),
    `${pose}: expected the isolated Minho watercolor v2 portrait source`,
  )
  const sourceContents = await readFile(absolute(sourcePath))
  await inspectPortrait(sourceContents, pose)
  assert(
    sha256(sourceContents) === artifact.normalized.sha256,
    `${pose}: candidate portrait hash mismatch`,
  )
  const runtimeFilename = `portrait--minho--${pose}--watercolor--v02.png`
  runtimePortraitNames.add(runtimeFilename)
  const runtimePath = `${runtimePortraitRoot}/${runtimeFilename}`
  await writeOrCheck(runtimePath, sourceContents)
  runtimePortraitRecords.push({
    pose,
    runtimeFilename,
    runtimePath,
    sourceSha256: artifact.normalized.sha256,
  })
}
await removeUnexpectedFiles(runtimePortraitRoot, runtimePortraitNames)

const runtimeRecordBySourceId = new Map(
  runtimeSceneRecords.map((record) => [record.scene.id, record]),
)
const sceneSetRevision = landmarkManifest.activeSet.activeSceneContentSetSha256
const portraitSetRevision = portraitManifest.contentSetSha256
const generatedCatalog = [
  '// Generated by scripts/integrate-latest-art.mjs. Do not edit by hand.',
  "import type { Destination, PortraitPose } from './index'",
  '',
  'export const DEV_LATEST_ART_METADATA = {',
  "  integration: 'development-preview-only',",
  '  shippingEligible: false,',
  "  productionPromotion: 'not-promoted',",
  "  runtimeAssetRoot: '/dev-art/latest-v5',",
  '  landmarkV5: {',
  `    manifest: '${landmarkManifestPath}',`,
  `    manifestSha256: '${landmarkManifestSha256}',`,
  `    sceneSetRevision: '${sceneSetRevision}',`,
  '    destinationCount: 25,',
  '    sceneCount: 76,',
  "    candidateApprovalState: 'pending-human-approval',",
  "    visualApproval: 'approved-for-v5-candidate-scope-only',",
  "    productionApproval: 'not-promoted',",
  "    rightsAndShipping: 'pending-separate-gates',",
  '  },',
  '  minhoWatercolorV2: {',
  `    manifest: '${portraitManifestPath}',`,
  `    portraitSetRevision: '${portraitSetRevision}',`,
  '    poseCount: 10,',
  "    candidateReview: 'pending-human-review',",
  "    machineQa: 'pass',",
  "    productionApproval: 'not-promoted',",
  '  },',
  '  compositeQa: {',
  `    manifest: '${compositeManifestPath}',`,
  "    status: 'pending-human-review',",
  `    selectableScenePoseIds: ${JSON.stringify(selectableScenePoseIds)},`,
  `    pendingDedicatedScenePoseIds: ${JSON.stringify(pendingDedicatedScenePoseIds)},`,
  '  },',
  '  cinematic: {',
  '    included: false,',
  "    reason: 'cinematic assets remain an isolated dormant candidate set',",
  '  },',
  '} as const',
  '',
  `export const DEV_LATEST_ART_SCENE_SET_REVISION = '${sceneSetRevision}' as const`,
  `export const DEV_LATEST_ART_PORTRAIT_SET_REVISION = '${portraitSetRevision}' as const`,
  '',
  `export const DEV_LATEST_ART_DESTINATIONS = ${JSON.stringify(
    destinations.map(({ id, name, sceneVariants }) => ({
      id,
      name,
      sceneVariants: sceneVariants.map((scene) => {
        const runtime = runtimeRecordBySourceId.get(scene.id)
        return {
          id: `${scene.destinationId}--${scene.variantId}`,
          destinationId: scene.destinationId,
          imageSrc: `/${runtime.runtimePath.replace(/^public\//, '')}`,
          compositionSlot: {
            x: scene.compositionSlot.x,
            y: scene.compositionSlot.y,
            scale: scene.compositionSlot.scale,
            pose: scene.compositionSlot.pose,
            flip: scene.compositionSlot.flip,
          },
          hasCompanion: scene.hasCompanion,
        }
      }),
    })),
    null,
    2,
  )} as const satisfies readonly Destination[]`,
  '',
  `export const DEV_LATEST_ART_SCENE_REVISIONS = ${JSON.stringify(
    Object.fromEntries(runtimeSceneRecords.map(({ scene, runtimeSha256 }) => [
      `${scene.destinationId}--${scene.variantId}`,
      `${sceneSetRevision}:${scene.sha256}:${runtimeSha256}`,
    ])),
    null,
    2,
  )} as const`,
  '',
  `export const DEV_LATEST_ART_MINHO_POSES = ${JSON.stringify(
    Object.fromEntries(runtimePortraitRecords.map((record) => [
      record.pose,
      `/${record.runtimePath.replace(/^public\//, '')}`,
    ])),
    null,
    2,
  )} as const satisfies Readonly<Record<PortraitPose, string>>`,
  '',
].join('\n')
await writeOrCheck(generatedCatalogPath, Buffer.from(generatedCatalog))

console.log(
  `latest art ${checkOnly ? 'verified' : 'integrated'}: `
    + `${destinations.length} destinations, ${scenes.length} scenes, `
    + `${runtimePortraitRecords.length} watercolor poses`,
)
