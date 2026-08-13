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
const optionValue = (name, fallback) => {
  const index = cliArgs.indexOf(name)
  if (index === -1) return fallback
  const value = cliArgs[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a path`)
  }
  return value
}
const archivePath = optionValue(
  '--archive',
  'docs/art/archive/asset-archive.v1.json',
)
const outputRoot = optionValue(
  '--output-root',
  'docs/art/reviews/landmarks/composites',
)
const outputManifestPath = optionValue(
  '--output-manifest',
  `${outputRoot}/manifest.json`,
)
const approvalPath = optionValue(
  '--approval',
  `${outputRoot}/approval.v1.json`,
)
const portraitCandidateManifestPath = optionValue(
  '--portrait-candidate-manifest',
  '',
)
const sceneCandidateManifestPath = optionValue(
  '--scene-candidate-manifest',
  '',
)
const sceneVisualApprovalPath = optionValue(
  '--scene-visual-approval',
  '',
)
const columns = 4
const rows = 4
const tileWidth = 300
const sceneHeight = 225
const labelHeight = 35
const tileHeight = sceneHeight + labelHeight
const scenesPerSheet = columns * rows

const sha256 = (contents) => (
  createHash('sha256').update(contents).digest('hex')
)
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const readOptionalJson = async (repoPath) => {
  try {
    return JSON.parse(await readFile(resolveRepoPath(repoPath), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

const escapeXml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const archive = JSON.parse(
  await readFile(resolveRepoPath(archivePath), 'utf8'),
)
if (archive.review.machineQa !== 'pass') {
  throw new Error('asset archive machine QA must pass before composite QA')
}
if (
  !sceneCandidateManifestPath
  && archive.review.landmarkHumanVisualReview !== 'approved'
) {
  throw new Error('landmark visual review must be approved before composite QA')
}
if (!archive.portrait.shippingEligible) {
  throw new Error('approved portrait is required for composite QA')
}

const sceneCandidateManifest = sceneCandidateManifestPath
  ? JSON.parse(
      await readFile(resolveRepoPath(sceneCandidateManifestPath), 'utf8'),
    )
  : null
const sceneVisualApproval = sceneVisualApprovalPath
  ? JSON.parse(
      await readFile(resolveRepoPath(sceneVisualApprovalPath), 'utf8'),
    )
  : null
if (sceneCandidateManifest) {
  assert(
    sceneCandidateManifest.manifestKind === 'landmark-candidate-master'
      && sceneCandidateManifest.shippingEligible === false
      && sceneCandidateManifest.activeSet?.activeSceneVariantCount > 0,
    'scene candidate manifest is not ready for composite QA',
  )
  assert(
    sceneVisualApproval?.decision === 'approved'
      && sceneVisualApproval.reviewer === 'user'
      && sceneVisualApproval.scope?.activeSceneSetSha256
        === sceneCandidateManifest.activeSet.activeSceneSetSha256
      && sceneVisualApproval.scope?.activeSceneContentSetSha256
        === sceneCandidateManifest.activeSet.activeSceneContentSetSha256,
    'scene visual approval does not match the candidate active set',
  )
}
const candidateSceneById = new Map(
  sceneCandidateManifest?.sceneVariants.map((scene) => [scene.id, scene])
    ?? [],
)
const scenes = sceneCandidateManifest
  ? sceneCandidateManifest.destinations.flatMap((destination) => (
      destination.activeSceneVariantIds.map((sceneId) => {
        const scene = candidateSceneById.get(sceneId)
        assert(scene, `${destination.id}: missing active scene ${sceneId}`)
        return {
          ...scene,
          destinationName: destination.name,
        }
      })
    ))
  : archive.landmarks.flatMap((destination) => (
      destination.scenes.map((scene) => ({
        ...scene,
        destinationName: destination.name,
      }))
    ))
const activeSceneSetSha256 = sceneCandidateManifest
  ? sceneCandidateManifest.activeSet.activeSceneSetSha256
  : archive.landmarkSet.activeSceneSetSha256
const activeSceneContentSetSha256 = sceneCandidateManifest
  ? sceneCandidateManifest.activeSet.activeSceneContentSetSha256
  : archive.landmarkSet.activeSceneContentSetSha256
const portraitCandidateManifest = portraitCandidateManifestPath
  ? JSON.parse(
      await readFile(resolveRepoPath(portraitCandidateManifestPath), 'utf8'),
    )
  : null
if (
  portraitCandidateManifest
  && (
    portraitCandidateManifest.schemaVersion !== 2
    || portraitCandidateManifest.manifestKind
      !== 'portrait-watercolor-candidate-set'
    || portraitCandidateManifest.status
      !== 'machine-qa-pass-pending-human-review'
    || portraitCandidateManifest.shippingEligible !== false
    || portraitCandidateManifest.machineQa?.result !== 'pass'
  )
) {
  throw new Error('portrait candidate manifest is not ready for composite QA')
}
if (portraitCandidateManifest) {
  const expectedPoses = [...PORTRAIT_POSES].sort()
  const artifactPoses = portraitCandidateManifest.artifacts
    .map(({ pose }) => pose)
    .sort()
  const vocabularyPoses = [...portraitCandidateManifest.poseVocabulary.poseIds]
    .sort()
  assert(
    JSON.stringify(artifactPoses) === JSON.stringify(expectedPoses)
      && JSON.stringify(vocabularyPoses) === JSON.stringify(expectedPoses)
      && portraitCandidateManifest.poseCoverage.required
        === PORTRAIT_POSES.length
      && portraitCandidateManifest.poseCoverage.produced
        === PORTRAIT_POSES.length
      && portraitCandidateManifest.poseCoverage.missing.length === 0,
    'portrait candidate must cover the canonical ten-pose vocabulary',
  )
  for (const artifact of portraitCandidateManifest.artifacts) {
    const contents = await readFile(
      resolveRepoPath(artifact.normalized.repoPath),
    )
    assert(
      sha256(contents) === artifact.normalized.sha256,
      `${artifact.pose}: portrait candidate hash mismatch`,
    )
    assert(
      artifact.identity.identityLockSha256
        === portraitCandidateManifest.identity.metadataSha256,
      `${artifact.pose}: portrait identity metadata mismatch`,
    )
  }
}
const portraitId = portraitCandidateManifest?.candidateSetId
  ?? archive.portrait.id
const portraitContentSetSha256 = portraitCandidateManifest?.contentSetSha256
  ?? sha256(Buffer.from(
    archive.portrait.poses
      .map(({ pose, sha256: poseSha256 }) => `${pose}\t${poseSha256}`)
      .sort()
      .join('\n'),
  ))
const portraitByPose = new Map(
  portraitCandidateManifest
    ? portraitCandidateManifest.artifacts.map(({ pose, normalized }) => [
        pose,
        {
          pose,
          repoPath: normalized.repoPath,
          sha256: normalized.sha256,
        },
      ])
    : archive.portrait.poses.map((pose) => [pose.pose, pose]),
)
const scenePoseIds = [...new Set(
  scenes.map((scene) => scene.compositionSlot.pose),
)].sort()
const candidateOnlyPoseIds = portraitCandidateManifest
  ? PORTRAIT_POSES.filter((pose) => !scenePoseIds.includes(pose))
  : []

const composeTile = async (scene, index) => {
  const portrait = portraitByPose.get(scene.compositionSlot.pose)
  if (!portrait) {
    throw new Error(`${scene.id}: missing ${scene.compositionSlot.pose} portrait`)
  }

  const sceneBuffer = await sharp(resolveRepoPath(scene.imageSrc))
    .resize(tileWidth, sceneHeight, { fit: 'fill' })
    .png()
    .toBuffer()
  const portraitHeight = Math.max(
    1,
    Math.round(scene.compositionSlot.scale * sceneHeight),
  )
  let portraitImage = sharp(resolveRepoPath(portrait.repoPath))
    .trim({
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      threshold: 2,
    })
    .resize({
      height: portraitHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
  if (scene.compositionSlot.flip) portraitImage = portraitImage.flop()
  const portraitBuffer = await portraitImage.png().toBuffer()
  const portraitMetadata = await sharp(portraitBuffer).metadata()
  const portraitWidth = portraitMetadata.width ?? portraitHeight
  const left = Math.round(
    scene.compositionSlot.x * tileWidth - portraitWidth / 2,
  )
  const top = Math.round(
    scene.compositionSlot.y * sceneHeight - portraitHeight,
  )
  const label = [
    `${String(index + 1).padStart(2, '0')} · ${scene.variantId} ${scene.version}`,
    `${scene.destinationName} · ${scene.compositionSlot.pose}`
      + `${scene.compositionSlot.flip ? ' · flip' : ''}`,
  ]
  const labelSvg = Buffer.from(`
    <svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f7f0df"/>
      <text x="9" y="13" font-family="Arial, sans-serif" font-size="9" fill="#4e5144">${escapeXml(label[0])}</text>
      <text x="9" y="27" font-family="Arial, sans-serif" font-size="9" fill="#78796c">${escapeXml(label[1])}</text>
    </svg>
  `)
  const compositeScene = await sharp(sceneBuffer)
    .composite([{
      input: portraitBuffer,
      left: Math.max(0, Math.min(tileWidth - portraitWidth, left)),
      top: Math.max(0, Math.min(sceneHeight - portraitHeight, top)),
    }])
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: tileWidth,
      height: tileHeight,
      channels: 3,
      background: '#f7f0df',
    },
  })
    .composite([
      { input: compositeScene, left: 0, top: 0 },
      { input: labelSvg, left: 0, top: sceneHeight },
    ])
    .png()
    .toBuffer()
}

const tileBuffers = []
for (const [index, scene] of scenes.entries()) {
  tileBuffers.push(await composeTile(scene, index))
}

const sheetCount = Math.ceil(tileBuffers.length / scenesPerSheet)
const sheets = []
const assignments = []
for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
  const start = sheetIndex * scenesPerSheet
  const sheetTiles = tileBuffers.slice(start, start + scenesPerSheet)
  const sheetBuffer = await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 3,
      background: '#e7dfcc',
    },
  })
    .composite(sheetTiles.map((input, tileIndex) => ({
      input,
      left: (tileIndex % columns) * tileWidth,
      top: Math.floor(tileIndex / columns) * tileHeight,
    })))
    .png()
    .toBuffer()
  const filename = `contact-sheet--minho-composites--${String(sheetIndex + 1).padStart(2, '0')}-of-${String(sheetCount).padStart(2, '0')}--non-shipping.png`
  const repoPath = `${outputRoot}/${filename}`

  sheets.push({
    repoPath,
    sha256: sha256(sheetBuffer),
    width: columns * tileWidth,
    height: rows * tileHeight,
    sceneCount: sheetTiles.length,
  })
  scenes.slice(start, start + scenesPerSheet).forEach((scene, tileIndex) => {
    assignments.push({
      sceneId: scene.id,
      sheet: sheetIndex + 1,
      tile: tileIndex + 1,
    })
  })

  const absolutePath = resolveRepoPath(repoPath)
  if (checkOnly) {
    const existing = await readFile(absolutePath)
    if (sha256(existing) !== sha256(sheetBuffer)) {
      throw new Error(`${repoPath} is stale; run npm run assets:composite-qa`)
    }
  } else {
    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, sheetBuffer)
  }
}

const compositeSetSha256 = sha256(Buffer.from(
  sheets
    .map(({ repoPath, sha256: sheetSha256 }) => `${repoPath}\t${sheetSha256}`)
    .sort()
    .join('\n'),
))
const approvalRecord = await readOptionalJson(approvalPath)
const approval = (
  approvalRecord?.decision === 'approved'
  && approvalRecord.status !== 'superseded'
)
  ? approvalRecord
  : null
if (
  approval
  && (
    approval.decision !== 'approved'
    || approval.reviewer !== 'user'
    || approval.scope?.activeSceneSetSha256
      !== activeSceneSetSha256
    || approval.scope?.compositeSetSha256 !== compositeSetSha256
    || approval.scope?.portraitId !== portraitId
    || (
      approval.scope?.portraitContentSetSha256 !== undefined
      && approval.scope.portraitContentSetSha256 !== portraitContentSetSha256
    )
    || approval.scope?.sceneCount !== scenes.length
  )
) {
  throw new Error(`${approvalPath}: approval scope does not match composites`)
}
const reviewDecision = approval ? 'approved' : 'pending'

const manifest = {
  schemaVersion: 1,
  reviewKind: 'landmark-minho-composite-qa',
  generatedAt: '2026-07-20',
  status: approval ? 'approved' : 'pending-human-review',
  shippingEligible: false,
  sourceArchive: archivePath,
  activeSceneSetSha256,
  ...(activeSceneContentSetSha256
    ? {
        activeSceneContentSetSha256,
      }
    : {}),
  sceneSource: sceneCandidateManifestPath || archivePath,
  portraitId,
  portraitContentSetSha256,
  portraitSource: portraitCandidateManifestPath || archive.portrait.sourceManifest,
  ...(portraitCandidateManifest
    ? {
        portraitPoseCoverage: {
          candidatePoseCount: PORTRAIT_POSES.length,
          candidatePoses: PORTRAIT_POSES,
          sceneCompositePoseCount: scenePoseIds.length,
          sceneCompositePoses: scenePoseIds,
          pendingDedicatedScenePoses: candidateOnlyPoseIds,
        },
      }
    : {}),
  sceneCount: scenes.length,
  sheetCount,
  compositeSetSha256,
  approval: approval ? approvalPath : null,
  sheets,
  assignments,
  review: {
    decision: reviewDecision,
    reviewer: approval?.reviewer ?? '',
    reviewedAt: approval?.reviewedAt ?? null,
    checks: [
      'portrait-grounding',
      'portrait-scale',
      'portrait-landmark-separation',
      'portrait-edge-quality',
      'pose-and-flip-fit',
      ...(portraitCandidateManifest
        ? [
            'candidate-ten-pose-coverage',
            'candidate-artifact-hashes',
            'candidate-identity-metadata',
          ]
        : []),
    ],
  },
  remainingGate: approval
    ? 'shipping-rights-review'
    : 'user-composite-review-and-shipping-rights-review',
}
const manifestContents = `${JSON.stringify(manifest, null, 2)}\n`
const manifestAbsolutePath = resolveRepoPath(outputManifestPath)
if (checkOnly) {
  const existing = await readFile(manifestAbsolutePath, 'utf8')
  if (existing !== manifestContents) {
    throw new Error(
      `${outputManifestPath} is stale; run npm run assets:composite-qa`,
    )
  }
} else {
  await mkdir(path.dirname(manifestAbsolutePath), { recursive: true })
  await writeFile(manifestAbsolutePath, manifestContents)
}

console.log(
  `composite QA ${checkOnly ? 'verified' : 'generated'}: `
  + `${scenes.length} scenes across ${sheetCount} contact sheets`,
)
