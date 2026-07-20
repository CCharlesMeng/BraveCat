import { createHash } from 'node:crypto'
import {
  mkdir,
  readFile,
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

const baseManifestPath = optionValue(
  '--base-manifest',
  'docs/art/candidates/landmarks/manifest.candidates.v2.json',
)
const expansionPlanPath = optionValue(
  '--expansion-plan',
  'docs/art/landmark-expansion-v3.json',
)
const outputManifestPath = optionValue(
  '--output-manifest',
  'docs/art/candidates/landmarks/manifest.candidates.v3.json',
)
const outputQaPath = optionValue(
  '--output-qa',
  'docs/art/candidates/landmarks/qa-report.v3.json',
)
const outputReviewIndexPath = optionValue(
  '--output-review-index',
  'docs/art/candidates/landmarks/review-index.candidates.v3.md',
)

const absolute = (repoPath) => path.join(root, repoPath)
const sha256 = (contents) => (
  createHash('sha256').update(contents).digest('hex')
)
const readContents = (repoPath) => readFile(absolute(repoPath))
const readJson = async (repoPath) => JSON.parse(
  await readFile(absolute(repoPath), 'utf8'),
)

const writeOrCheckText = async (repoPath, contents, command) => {
  if (checkOnly) {
    let current
    try {
      current = await readFile(absolute(repoPath), 'utf8')
    } catch {
      throw new Error(`${repoPath} is missing; run ${command}`)
    }
    if (current !== contents) {
      throw new Error(`${repoPath} is stale; run ${command}`)
    }
    return
  }
  await mkdir(path.dirname(absolute(repoPath)), { recursive: true })
  await writeFile(absolute(repoPath), contents)
}

const writeOrCheckBinary = async (repoPath, contents, command) => {
  if (checkOnly) {
    let current
    try {
      current = await readFile(absolute(repoPath))
    } catch {
      throw new Error(`${repoPath} is missing; run ${command}`)
    }
    if (sha256(current) !== sha256(contents)) {
      throw new Error(`${repoPath} is stale; run ${command}`)
    }
    return
  }
  await mkdir(path.dirname(absolute(repoPath)), { recursive: true })
  await writeFile(absolute(repoPath), contents)
}

const inspectPng = (contents, label) => {
  if (contents.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`${label}: not a PNG`)
  }
  return {
    width: contents.readUInt32BE(16),
    height: contents.readUInt32BE(20),
    bitDepth: contents[24],
    colorType: contents[25],
  }
}

const toRepoPath = (fragmentPath, imageSrc) => {
  if (imageSrc.startsWith('docs/') || imageSrc.startsWith('public/')) {
    return imageSrc
  }
  return path.posix.join(path.posix.dirname(fragmentPath), imageSrc)
}

const validateCompositionSlot = (slot, safeBounds, label, errors) => {
  if (
    slot?.units !== 'normalized'
    || slot.anchor !== 'bottom-center'
    || typeof slot.x !== 'number'
    || typeof slot.y !== 'number'
    || typeof slot.scale !== 'number'
    || slot.x < 0
    || slot.x > 1
    || slot.y < 0
    || slot.y > 1
    || slot.scale <= 0
    || slot.scale > 1
    || !['sit', 'sleep', 'walk', 'eat', 'play', 'gaze'].includes(slot.pose)
    || typeof slot.flip !== 'boolean'
  ) {
    errors.push(`${label}: invalid normalized bottom-center compositionSlot`)
    return
  }
  if (
    safeBounds
    && (
      slot.x < safeBounds.x
      || slot.x > safeBounds.x + safeBounds.width
      || slot.y < safeBounds.y
      || slot.y > safeBounds.y + safeBounds.height + 0.000001
    )
  ) {
    errors.push(`${label}: composition anchor lies outside safeBounds`)
  }
}

const validateSafeBounds = (bounds, label, errors) => {
  if (
    bounds?.units !== 'normalized'
    || !['x', 'y', 'width', 'height'].every(
      (key) => typeof bounds[key] === 'number'
        && bounds[key] >= 0
        && bounds[key] <= 1,
    )
    || bounds.x + bounds.width > 1.000001
    || bounds.y + bounds.height > 1.000001
  ) {
    errors.push(`${label}: invalid normalized safeBounds`)
  }
}

const versionFromPath = (repoPath) => {
  const match = repoPath.match(/--(v\d{2})\.png$/)
  if (!match) throw new Error(`${repoPath}: missing vNN revision`)
  return match[1]
}

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const baseContents = await readContents(baseManifestPath)
const baseManifest = JSON.parse(baseContents)
const planContents = await readContents(expansionPlanPath)
const expansionPlan = JSON.parse(planContents)
const errors = []

if (
  baseManifest.manifestKind !== 'landmark-candidate-master'
  || baseManifest.shippingEligible !== false
) {
  errors.push(`${baseManifestPath}: invalid base candidate manifest`)
}
if (
  expansionPlan.shippingEligible !== false
  || !Array.isArray(expansionPlan.destinations)
  || expansionPlan.destinations.length === 0
) {
  errors.push(`${expansionPlanPath}: invalid expansion plan`)
}

const baseDestinationIds = new Set(
  baseManifest.destinations.map(({ id }) => id),
)
const plannedIds = expansionPlan.destinations.map(({ id }) => id)
const plannedIdSet = new Set(plannedIds)
if (plannedIdSet.size !== plannedIds.length) {
  errors.push(`${expansionPlanPath}: duplicate destination ids`)
}
for (const destinationId of plannedIds) {
  if (baseDestinationIds.has(destinationId)) {
    errors.push(`${destinationId}: collides with the base candidate manifest`)
  }
}

const newDestinations = []
const newScenes = []
const newSourceFragments = []
const newRightsWarnings = []
let newSupersededCount = 0

for (const plannedDestination of expansionPlan.destinations) {
  const fragmentPath = path.posix.join(
    expansionPlan.candidateOutputRoot,
    plannedDestination.id,
    'manifest.fragment.json',
  )
  let fragmentContents
  let fragment
  try {
    fragmentContents = await readContents(fragmentPath)
    fragment = JSON.parse(fragmentContents)
  } catch (error) {
    errors.push(`${fragmentPath}: ${error.message}`)
    continue
  }

  if (
    fragment.destinationId !== plannedDestination.id
    || fragment.destinationName !== plannedDestination.name
    || fragment.shippingEligible !== false
    || fragment.sourcePlan !== expansionPlanPath
  ) {
    errors.push(`${fragmentPath}: destination, plan, or shipping state mismatch`)
  }
  if (
    fragment.sourcePlanSha256
    && fragment.sourcePlanSha256 !== sha256(planContents)
  ) {
    errors.push(`${fragmentPath}: source-plan sha256 mismatch`)
  }
  if (
    fragment.provenanceAndRights?.restrictedSourcePhotoRetained === true
    || fragment.rights?.restrictedSourcePhotosRetained === true
    || fragment.rights?.restrictedSourcePhotographsRetained === true
  ) {
    errors.push(`${fragmentPath}: restricted source photograph was retained`)
  }

  const directResearchArtifact = (
    typeof fragment.visualReferenceResearch === 'object'
      ? fragment.visualReferenceResearch
      : null
  )
  const researchArtifact = (
    Array.isArray(fragment.artifacts)
      ? fragment.artifacts.find(({ kind }) => kind === 'research')
      : fragment.artifacts?.visualReferenceResearch
  )
    ?? directResearchArtifact
    ?? fragment.rights?.visualReferenceResearch
  const researchSrc = researchArtifact?.path
    ?? researchArtifact?.src
    ?? (
      typeof fragment.visualReferenceResearch === 'string'
        ? fragment.visualReferenceResearch
        : null
    )
    ?? fragment.provenanceAndRights?.realVisualReferenceResearch
  if (!researchSrc) {
    errors.push(`${fragmentPath}: missing visual-reference research artifact`)
  } else {
    const researchPath = toRepoPath(fragmentPath, researchSrc)
    try {
      const researchContents = await readContents(researchPath)
      const expectedResearchSha256 = researchArtifact?.sha256
        ?? fragment.provenanceAndRights?.realVisualReferenceResearchSha256
        ?? fragment.rights?.visualReferenceResearch?.sha256
      if (
        expectedResearchSha256
        && expectedResearchSha256 !== sha256(researchContents)
      ) {
        errors.push(`${researchPath}: research sha256 mismatch`)
      }
    } catch (error) {
      errors.push(`${researchPath}: ${error.message}`)
    }
  }

  if (Array.isArray(fragment.artifacts)) {
    for (const artifact of fragment.artifacts) {
      try {
        const artifactPath = toRepoPath(fragmentPath, artifact.path)
        const artifactContents = await readContents(artifactPath)
        if (artifact.sha256 && sha256(artifactContents) !== artifact.sha256) {
          errors.push(`${artifactPath}: artifact sha256 mismatch`)
        }
      } catch (error) {
        errors.push(`${fragmentPath}: artifact ${error.message}`)
      }
    }
  }

  const regenerationAudit = fragment.provenance?.regenerationAudit ?? []
  for (const superseded of regenerationAudit) {
    if (!superseded.imageSrc || !superseded.sha256) continue
    try {
      const supersededPath = toRepoPath(fragmentPath, superseded.imageSrc)
      const supersededContents = await readContents(supersededPath)
      const png = inspectPng(supersededContents, supersededPath)
      if (
        sha256(supersededContents) !== superseded.sha256
        || png.width !== 1200
        || png.height !== 900
        || png.bitDepth !== 8
        || png.colorType !== 2
        || superseded.shippingEligible !== false
      ) {
        errors.push(`${supersededPath}: invalid superseded candidate record`)
      }
    } catch (error) {
      errors.push(`${fragmentPath}: superseded candidate ${error.message}`)
    }
  }
  const explicitSupersededRevisions = fragment.supersededRevisions ?? []
  for (const superseded of explicitSupersededRevisions) {
    try {
      const supersededPath = toRepoPath(fragmentPath, superseded.imageSrc)
      const supersededContents = await readContents(supersededPath)
      const png = inspectPng(supersededContents, supersededPath)
      if (
        sha256(supersededContents) !== superseded.sha256
        || png.width !== 1200
        || png.height !== 900
        || png.bitDepth !== 8
        || png.colorType !== 2
        || superseded.shippingEligible !== false
      ) {
        errors.push(`${supersededPath}: invalid superseded candidate record`)
      }
    } catch (error) {
      errors.push(`${fragmentPath}: superseded candidate ${error.message}`)
    }
  }
  const nestedSupersededRevisions = fragment.sceneVariants
    .map((scene) => scene.production?.supersededRevision)
    .filter(Boolean)
  for (const superseded of nestedSupersededRevisions) {
    try {
      const supersededPath = toRepoPath(fragmentPath, superseded.imageSrc)
      const supersededContents = await readContents(supersededPath)
      const png = inspectPng(supersededContents, supersededPath)
      if (
        sha256(supersededContents) !== superseded.sha256
        || png.width !== 1200
        || png.height !== 900
        || png.bitDepth !== 8
        || png.colorType !== 2
        || superseded.shippingEligible !== false
      ) {
        errors.push(`${supersededPath}: invalid superseded candidate record`)
      }
    } catch (error) {
      errors.push(`${fragmentPath}: superseded candidate ${error.message}`)
    }
  }

  const selectedScenes = []
  const activeIds = []
  let fragmentSupersededCount = 0
  for (const plannedVariant of plannedDestination.variants) {
    const variantCandidates = fragment.sceneVariants
      .filter(({ variantId }) => variantId === plannedVariant.id)
      .map((scene) => {
        const repoPath = toRepoPath(fragmentPath, scene.imageSrc)
        return {
          scene,
          repoPath,
          version: versionFromPath(repoPath),
        }
      })
      .sort((left, right) => right.version.localeCompare(left.version))
    const eligible = variantCandidates.filter(({ scene }) => (
      scene.status !== 'superseded' && scene.superseded !== true
    ))
    const selected = eligible[0]
    fragmentSupersededCount += Math.max(0, variantCandidates.length - 1)

    if (!selected) {
      errors.push(
        `${plannedDestination.id}: missing active ${plannedVariant.id} candidate`,
      )
      continue
    }

    const { scene, repoPath, version } = selected
    const semanticId = `${plannedDestination.id}--${plannedVariant.id}`
    const versionedId = `${semanticId}--${version}`
    const expectedFilename = `scene--${versionedId}.png`
    if (
      path.posix.basename(repoPath) !== expectedFilename
      || ![semanticId, versionedId].includes(scene.id)
    ) {
      errors.push(`${versionedId}: filename or id grammar mismatch`)
    }
    if (
      Boolean(scene.hasCompanion) !== Boolean(plannedVariant.hasCompanion)
    ) {
      errors.push(`${versionedId}: Companion plan mismatch`)
    }
    if (
      plannedVariant.hasCompanion
      && (
        !scene.companion
        || scene.companion.kind !== plannedVariant.companion.kind
        || scene.companion.count !== plannedVariant.companion.count
      )
    ) {
      errors.push(`${versionedId}: Companion species or count mismatch`)
    }

    const safeBounds = scene.safeBounds ?? scene.production?.safeBounds
    validateSafeBounds(safeBounds, versionedId, errors)
    validateCompositionSlot(
      scene.compositionSlot,
      safeBounds,
      versionedId,
      errors,
    )

    let imageContents
    try {
      imageContents = await readContents(repoPath)
      const png = inspectPng(imageContents, versionedId)
      const metadata = await sharp(imageContents).metadata()
      if (
        png.width !== 1200
        || png.height !== 900
        || png.bitDepth !== 8
        || png.colorType !== 2
        || metadata.format !== 'png'
        || metadata.width !== 1200
        || metadata.height !== 900
        || metadata.hasAlpha !== false
        || metadata.space !== 'srgb'
      ) {
        errors.push(
          `${versionedId}: expected 1200x900 8-bit opaque RGB sRGB PNG`,
        )
      }
      if (sha256(imageContents) !== scene.sha256) {
        errors.push(`${versionedId}: image sha256 mismatch`)
      }
    } catch (error) {
      errors.push(`${versionedId}: ${error.message}`)
      continue
    }

    const companion = scene.hasCompanion
      ? {
          kind: scene.companion.kind,
          count: scene.companion.count,
          role: 'scene-only Companion',
          sceneOnly: true,
          directlyPaintedIntoScene: true,
          playerPortrait: false,
          standaloneAsset: false,
          reusableAnimalAsset: false,
          maximumFrameHeight:
            scene.companion.maximumFrameHeight
            ?? plannedVariant.companion.maximumFrameHeight,
          placement: scene.companion.placement ?? null,
        }
      : null

    selectedScenes.push({
      id: versionedId,
      sourceCandidateId: semanticId,
      destinationId: plannedDestination.id,
      destinationName: plannedDestination.name,
      variantId: plannedVariant.id,
      version,
      name: scene.name
        ?? `${plannedDestination.name} · ${plannedVariant.id}`,
      status: 'candidate',
      shippingEligible: false,
      imageSrc: repoPath,
      versionedPath: repoPath,
      dimensions: {
        width: 1200,
        height: 900,
        orientation: 'landscape',
        aspectRatio: '4:3',
        format: 'png',
        mode: 'RGB',
        colorSpace: 'sRGB',
        bitDepth: 8,
        alpha: 'opaque',
      },
      sha256: sha256(imageContents),
      compositionSlot: scene.compositionSlot,
      safeBounds,
      hasCompanion: Boolean(scene.hasCompanion),
      companion,
      selectionDecision: {
        state: 'locked-for-human-review',
        basis: 'highest-non-superseded-vNN',
        activeRevision: version,
        eligibleCandidateCount: eligible.length,
        supersededEntriesExcluded: Math.max(0, variantCandidates.length - 1),
      },
      provenance: {
        summary: 'Generated under locked style intensity B, normalized without distortion to a 1200x900 8-bit opaque RGB sRGB PNG, and grounded in the primary-source research recorded by the destination fragment. No restricted source photograph is retained.',
        generationMethod: 'image-generation',
        generator: {
          tool: 'GenerateImage',
          model: 'not-exposed-by-tool',
          seed: 'not-exposed-by-tool',
        },
        promptJobId: scene.production?.promptJobId
          ?? scene.production?.provenance?.promptJobId
          ?? 'scene-variant-export',
        styleIntensity: 'B',
        source: scene.production ?? null,
      },
      review: {
        decision: 'pending',
        humanVisualReview: 'pending',
        rightsReview: 'pending',
        finalRealPortraitCompositeReview: 'pending',
        reviewer: '',
        reviewedAt: null,
      },
      sourceFragment: fragmentPath,
      sourceFragmentSha256: sha256(fragmentContents),
    })
    activeIds.push(versionedId)
  }

  const plannedVariantIds = plannedDestination.variants.map(({ id }) => id)
  const selectedVariantIds = selectedScenes.map(({ variantId }) => variantId)
  if (
    plannedVariantIds.length !== selectedVariantIds.length
    || plannedVariantIds.some((id) => !selectedVariantIds.includes(id))
  ) {
    errors.push(`${plannedDestination.id}: variant coverage differs from plan`)
  }
  newSupersededCount += Math.max(
    fragmentSupersededCount,
    fragment.inspection?.supersededRevisionCount ?? 0,
    fragment.machineInspection?.checks?.retainedSupersededSceneCount ?? 0,
    regenerationAudit.length,
    explicitSupersededRevisions.length,
    nestedSupersededRevisions.length,
  )

  const contactSheetSrc = fragment.contactSheet?.imageSrc
    ?? fragment.qa?.contactSheet
  if (!contactSheetSrc) {
    errors.push(`${fragmentPath}: missing destination contact sheet metadata`)
  } else {
    const contactSheetPath = toRepoPath(fragmentPath, contactSheetSrc)
    try {
      const contactContents = await readContents(contactSheetPath)
      const contactMetadata = await sharp(contactContents).metadata()
      if (
        contactMetadata.format !== 'png'
        || contactMetadata.hasAlpha !== false
      ) {
        errors.push(`${contactSheetPath}: expected opaque PNG contact sheet`)
      }
      const expectedContactSheetSha256 = fragment.contactSheet?.sha256
        ?? fragment.qa?.contactSheetSha256
      if (
        expectedContactSheetSha256
        && expectedContactSheetSha256 !== sha256(contactContents)
      ) {
        errors.push(`${contactSheetPath}: contact-sheet sha256 mismatch`)
      }
    } catch (error) {
      errors.push(`${contactSheetPath}: ${error.message}`)
    }
  }

  const fragmentSha256 = sha256(fragmentContents)
  newSourceFragments.push({
    path: fragmentPath,
    sha256: fragmentSha256,
  })
  newDestinations.push({
    id: plannedDestination.id,
    name: plannedDestination.name,
    status: 'candidate',
    shippingEligible: false,
    sourcePlan: expansionPlanPath,
    sourceFragment: fragmentPath,
    sourceFragmentSha256: fragmentSha256,
    activeSceneVariantIds: activeIds,
  })
  newScenes.push(...selectedScenes)

  const rightsNotes = Array.isArray(fragment.rights?.notes)
    ? fragment.rights.notes
    : []
  const destinationSpecificWarning =
    fragment.provenanceAndRights?.livingHeritageWarning
    ?? fragment.provenanceAndRights?.culturalWarning
    ?? fragment.provenanceAndRights?.conservationWarning
    ?? fragment.provenanceAndRights?.warnings?.join(' ')
    ?? fragment.rights?.shippingWarnings?.join(' ')
    ?? fragment.culturalReview?.warnings?.join(' ')
  newRightsWarnings.push({
    destinationId: plannedDestination.id,
    referenceUse: 'primary and official sources consulted for factual geometry, setting, and authorized Companion anatomy only; no restricted source photograph retained',
    shippingGate: 'reference-rights-cultural-and-adaptation-review-required',
    warning: destinationSpecificWarning
      ?? rightsNotes.at(-1)
      ?? 'Source terms, cultural context, and adaptation risk remain pending formal rights review before shipping.',
  })
}

const newOrdinarySceneCount = newScenes.filter(
  ({ hasCompanion }) => !hasCompanion,
).length
const newCompanionSceneCount = newScenes.filter(
  ({ hasCompanion }) => hasCompanion,
).length
if (
  newDestinations.length !== expansionPlan.expansion.destinationCountAdded
  || newOrdinarySceneCount !== expansionPlan.expansion.ordinaryVariantsAdded
  || newCompanionSceneCount
    !== expansionPlan.expansion.companionRareVariantsAdded
) {
  errors.push('integrated v3 destination or variant totals differ from the plan')
}

const combinedManifest = structuredClone(baseManifest)
combinedManifest.schemaVersion = Math.max(2, baseManifest.schemaVersion)
combinedManifest.planId = 'miaoyouji-landmarks-combined-v3-2026-07-20'
combinedManifest.sourcePlans = [
  ...baseManifest.sourcePlans,
  {
    path: expansionPlanPath,
    planId: expansionPlan.planId,
    sha256: sha256(planContents),
    destinationCount: expansionPlan.destinations.length,
  },
]
combinedManifest.integratedAt = '2026-07-20'
combinedManifest.status = 'candidate'
combinedManifest.shippingEligible = false
combinedManifest.approvalState = 'pending-human-approval'
combinedManifest.locks.destinationSet = {
  state: 'locked',
  count: baseManifest.destinations.length + newDestinations.length,
  orderedIds: [
    ...baseManifest.destinations.map(({ id }) => id),
    ...newDestinations.map(({ id }) => id),
  ],
  orderingRule: 'Approved v2 destination order followed by the five destinations in landmark-expansion-v3.json',
}
const rareDestinationIds = [
  ...baseManifest.locks.variantPolicy.rareCompanionDestinationIds,
  ...expansionPlan.destinations
    .filter(({ variants }) => variants.some(({ hasCompanion }) => hasCompanion))
    .map(({ id }) => id),
]
combinedManifest.locks.variantPolicy = {
  ...baseManifest.locks.variantPolicy,
  rareCompanionVariantCount: rareDestinationIds.length,
  rareCompanionDestinationIds: rareDestinationIds,
}
combinedManifest.locks.activeCandidateSelection = {
  ...baseManifest.locks.activeCandidateSelection,
  activeEntriesSelected:
    baseManifest.sceneVariants.length + newScenes.length,
  supersededEntriesExcluded:
    baseManifest.totals.supersededSceneFileCount + newSupersededCount,
}
combinedManifest.review = {
  decision: 'pending',
  humanVisualReview: 'pending',
  rightsReview: 'pending',
  finalRealPortraitCompositeReview: 'pending',
  shippingApproval: 'pending',
  note: 'The previously approved v2 scenes are preserved byte-for-byte; the expanded v3 active set requires a new exact-scope user visual decision before promotion.',
}
combinedManifest.totals = {
  destinationCount:
    baseManifest.totals.destinationCount + newDestinations.length,
  activeSceneVariantCount:
    baseManifest.totals.activeSceneVariantCount + newScenes.length,
  ordinaryVariantCount:
    baseManifest.totals.ordinaryVariantCount
      + newScenes.filter(({ hasCompanion }) => !hasCompanion).length,
  companionRareVariantCount:
    baseManifest.totals.companionRareVariantCount
      + newScenes.filter(({ hasCompanion }) => hasCompanion).length,
  supersededSceneFileCount:
    baseManifest.totals.supersededSceneFileCount + newSupersededCount,
}
combinedManifest.sourceFragments = [
  ...baseManifest.sourceFragments,
  ...newSourceFragments,
]
combinedManifest.rightsAndProvenanceWarnings = [
  ...baseManifest.rightsAndProvenanceWarnings,
  ...newRightsWarnings,
]
combinedManifest.destinations = [
  ...baseManifest.destinations,
  ...newDestinations,
]
combinedManifest.sceneVariants = [
  ...baseManifest.sceneVariants,
  ...newScenes,
]
const activeSceneSetSha256 = sha256(Buffer.from(
  combinedManifest.sceneVariants.map(({ id }) => id).sort().join('\n'),
))
const activeSceneContentSetSha256 = sha256(Buffer.from(
  combinedManifest.sceneVariants
    .map(({ id, sha256: sceneSha256 }) => `${id}\t${sceneSha256}`)
    .sort()
    .join('\n'),
))
combinedManifest.activeSet = {
  selection: 'all-active-scene-variants',
  destinationCount: combinedManifest.totals.destinationCount,
  activeSceneVariantCount: combinedManifest.totals.activeSceneVariantCount,
  activeSceneSetSha256,
  activeSceneContentSetSha256,
}

const allDestinationIds = combinedManifest.destinations.map(({ id }) => id)
const allSceneIds = combinedManifest.sceneVariants.map(({ id }) => id)
const allSemanticIds = combinedManifest.sceneVariants.map(
  ({ destinationId, variantId }) => `${destinationId}--${variantId}`,
)
if (new Set(allDestinationIds).size !== allDestinationIds.length) {
  errors.push('combined manifest has duplicate destination ids')
}
if (new Set(allSceneIds).size !== allSceneIds.length) {
  errors.push('combined manifest has duplicate versioned scene ids')
}
if (new Set(allSemanticIds).size !== allSemanticIds.length) {
  errors.push('combined manifest has duplicate semantic scene ids')
}
if (
  combinedManifest.totals.destinationCount !== allDestinationIds.length
  || combinedManifest.totals.activeSceneVariantCount !== allSceneIds.length
) {
  errors.push('combined manifest totals do not match integrated entries')
}

const outputVersion = Number(
  path.posix.basename(outputManifestPath).match(/\.v(\d+)\.json$/)?.[1] ?? 3,
)
const overviewColumns = 4
const overviewRows = 4
const overviewTileWidth = 300
const overviewSceneHeight = 225
const overviewLabelHeight = 35
const overviewTileHeight = overviewSceneHeight + overviewLabelHeight
const overviewScenesPerSheet = overviewColumns * overviewRows
const overviewSheetCount = Math.ceil(
  combinedManifest.sceneVariants.length / overviewScenesPerSheet,
)
const overviewPaths = []

for (let sheetIndex = 0; sheetIndex < overviewSheetCount; sheetIndex += 1) {
  const sheetScenes = combinedManifest.sceneVariants.slice(
    sheetIndex * overviewScenesPerSheet,
    (sheetIndex + 1) * overviewScenesPerSheet,
  )
  const tiles = []
  for (const [tileIndex, scene] of sheetScenes.entries()) {
    const sceneBuffer = await sharp(absolute(scene.imageSrc))
      .resize(overviewTileWidth, overviewSceneHeight, { fit: 'fill' })
      .png()
      .toBuffer()
    const label = `${String(
      sheetIndex * overviewScenesPerSheet + tileIndex + 1,
    ).padStart(2, '0')} · ${scene.destinationName} · ${scene.variantId} ${scene.version}`
    const labelSvg = Buffer.from(`
      <svg width="${overviewTileWidth}" height="${overviewLabelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f7f0df"/>
        <text x="9" y="22" font-family="Arial, sans-serif" font-size="10" fill="#4e5144">${escapeXml(label)}</text>
      </svg>
    `)
    tiles.push(
      await sharp({
        create: {
          width: overviewTileWidth,
          height: overviewTileHeight,
          channels: 3,
          background: '#f7f0df',
        },
      })
        .composite([
          { input: sceneBuffer, left: 0, top: 0 },
          { input: labelSvg, left: 0, top: overviewSceneHeight },
        ])
        .png()
        .toBuffer(),
    )
  }

  const sheetBuffer = await sharp({
    create: {
      width: overviewColumns * overviewTileWidth,
      height: overviewRows * overviewTileHeight,
      channels: 3,
      background: '#e7dfcc',
    },
  })
    .composite(tiles.map((input, tileIndex) => ({
      input,
      left: (tileIndex % overviewColumns) * overviewTileWidth,
      top: Math.floor(tileIndex / overviewColumns) * overviewTileHeight,
    })))
    .png()
    .toBuffer()
  const repoPath = path.posix.join(
    path.posix.dirname(outputManifestPath),
    `contact-sheet--landmarks--overview-v${outputVersion}-${String(
      sheetIndex + 1,
    ).padStart(2, '0')}-of-${String(overviewSheetCount).padStart(2, '0')}--non-final.png`,
  )
  await writeOrCheckBinary(
    repoPath,
    sheetBuffer,
    'npm run assets:integrate-landmarks',
  )
  overviewPaths.push(repoPath)
}

const manifestContents = `${JSON.stringify(combinedManifest, null, 2)}\n`
await writeOrCheckText(
  outputManifestPath,
  manifestContents,
  'npm run assets:integrate-landmarks',
)

const machineChecks = [
  {
    id: 'unique-destination-ids',
    status: new Set(allDestinationIds).size === allDestinationIds.length
      ? 'pass'
      : 'fail',
    expected: allDestinationIds.length,
    actual: new Set(allDestinationIds).size,
  },
  {
    id: 'non-colliding-v3-destinations',
    status: plannedIds.every((id) => !baseDestinationIds.has(id))
      ? 'pass'
      : 'fail',
    expected: plannedIds.length,
    actual: plannedIds.filter((id) => !baseDestinationIds.has(id)).length,
  },
  {
    id: 'source-plan-and-fragment-coverage',
    status: newSourceFragments.length === plannedIds.length ? 'pass' : 'fail',
    expected: plannedIds.length,
    actual: newSourceFragments.length,
  },
  {
    id: 'active-scene-total',
    status: combinedManifest.totals.activeSceneVariantCount
      === combinedManifest.sceneVariants.length
      ? 'pass'
      : 'fail',
    expected: combinedManifest.totals.activeSceneVariantCount,
    actual: combinedManifest.sceneVariants.length,
  },
  {
    id: 'unique-semantic-scene-ids',
    status: new Set(allSemanticIds).size === allSemanticIds.length
      ? 'pass'
      : 'fail',
    expected: allSemanticIds.length,
    actual: new Set(allSemanticIds).size,
  },
  {
    id: 'v3-image-dimensions-color-hashes-and-filenames',
    status: errors.some((error) => (
      error.includes('1200x900')
      || error.includes('sha256')
      || error.includes('filename')
      || error.includes('not a PNG')
    ))
      ? 'fail'
      : 'pass',
    expected: newScenes.length,
    actual: newScenes.length,
  },
  {
    id: 'v3-composition-slots-and-safe-bounds',
    status: errors.some((error) => (
      error.includes('compositionSlot')
      || error.includes('safeBounds')
      || error.includes('composition anchor')
    ))
      ? 'fail'
      : 'pass',
    expected: newScenes.length,
    actual: newScenes.length,
  },
  {
    id: 'v3-companion-policy',
    status: errors.some((error) => error.includes('Companion'))
      ? 'fail'
      : 'pass',
    expected: expansionPlan.expansion.companionRareVariantsAdded,
    actual: newScenes.filter(({ hasCompanion }) => hasCompanion).length,
  },
  {
    id: 'protected-base-manifest-integrity',
    status: sha256(await readContents(baseManifestPath)) === sha256(baseContents)
      ? 'pass'
      : 'fail',
    expected: sha256(baseContents),
    actual: sha256(await readContents(baseManifestPath)),
  },
  {
    id: 'destination-and-global-contact-sheets',
    status: errors.some((error) => (
      error.includes('contact sheet') || error.includes('contact-sheet')
    ))
      ? 'fail'
      : 'pass',
    expected: plannedIds.length + overviewSheetCount,
    actual: newSourceFragments.length + overviewPaths.length,
  },
]
const failedMachineChecks = machineChecks.filter(({ status }) => status === 'fail')
const qa = {
  schemaVersion: 3,
  reportKind: 'landmark-candidate-integration-qa',
  planId: combinedManifest.planId,
  sourcePlans: combinedManifest.sourcePlans.map(({ path: sourcePath }) => sourcePath),
  sourceManifest: outputManifestPath,
  sourceManifestSha256: sha256(Buffer.from(manifestContents)),
  generatedAt: '2026-07-20',
  overallStatus:
    errors.length === 0 && failedMachineChecks.length === 0 ? 'pass' : 'fail',
  shippingEligible: false,
  activeSet: combinedManifest.activeSet,
  totals: {
    ...combinedManifest.totals,
    machineCheckCount: machineChecks.length,
    machineChecksPassed: machineChecks.length - failedMachineChecks.length,
    machineChecksFailed: failedMachineChecks.length,
    pendingHumanCheckCount: 3,
  },
  machineChecks,
  pendingHumanChecks: [
    {
      id: 'human-visual-review-v3-active-set',
      status: 'pending',
      note: 'Review the new v3 destination sheets and combined overview sheets; machine QA does not authorize promotion.',
    },
    {
      id: 'final-real-minho-composite-review-v3',
      status: 'blocked-until-visual-approval-and-promotion',
      note: 'Generate combined Minho composite sheets only after the new exact active set is visually approved.',
    },
    {
      id: 'shipping-rights-review',
      status: 'pending',
      note: 'Primary-source terms, cultural context, public-monument considerations, and adaptation risk remain a separate gate.',
    },
  ],
  protectedInputs: {
    baseManifest: {
      path: baseManifestPath,
      sha256: sha256(baseContents),
    },
    expansionPlan: {
      path: expansionPlanPath,
      sha256: sha256(planContents),
    },
  },
  overviewSheets: overviewPaths,
  errors,
}
const qaContents = `${JSON.stringify(qa, null, 2)}\n`
await writeOrCheckText(
  outputQaPath,
  qaContents,
  'npm run assets:integrate-landmarks',
)

const reviewDirectory = path.posix.dirname(outputReviewIndexPath)
const relative = (repoPath) => path.posix.relative(reviewDirectory, repoPath)
const reviewLines = [
  '# Landmark candidate review index v3',
  '',
  `All ${combinedManifest.totals.activeSceneVariantCount} active scene candidates are non-shipping and pending human approval. Machine QA does not authorize promotion; human visual review, rights review, and final real-Portrait composite review remain pending.`,
  '',
  `The previously approved ${baseManifest.totals.activeSceneVariantCount}-scene v2 subset is preserved byte-for-byte. Approval v1 does not cover the ${newScenes.length} new v3 scenes or the expanded active-set hash.`,
  '',
  `- [Expansion plan](${relative(expansionPlanPath)})`,
  `- [Combined candidate manifest](${relative(outputManifestPath)})`,
  `- [Machine QA report](${relative(outputQaPath)})`,
  `- Active-set ID hash: \`${activeSceneSetSha256}\``,
  `- Active-set content hash: \`${activeSceneContentSetSha256}\``,
  '',
  '## Combined overview sheets',
  '',
  ...overviewPaths.map((repoPath, index) => (
    `${index + 1}. [Overview ${String(index + 1).padStart(2, '0')} of ${String(overviewPaths.length).padStart(2, '0')}](${relative(repoPath)})`
  )),
  '',
  '## Destination review order',
  '',
]

combinedManifest.destinations.forEach((destination, index) => {
  const isNew = plannedIdSet.has(destination.id)
  reviewLines.push(
    `${index + 1}. **${destination.name}** (\`${destination.id}\`) — `
      + `${destination.activeSceneVariantIds.length} active candidate`
      + `${destination.activeSceneVariantIds.length === 1 ? '' : 's'}`,
  )
  for (const sceneId of destination.activeSceneVariantIds) {
    const scene = combinedManifest.sceneVariants.find(({ id }) => id === sceneId)
    reviewLines.push(
      `   - [${scene.variantId} · ${scene.version}`
        + `${scene.hasCompanion ? ' · companion' : ''}`
        + ` · ${isNew ? 'pending review' : 'previously visual approved'}]`
        + `(${relative(scene.imageSrc)})`,
    )
  }
  reviewLines.push(
    `   - [destination contact sheet](${relative(path.posix.join(
      path.posix.dirname(destination.sourceFragment),
      `contact-sheet--${destination.id}--non-final.png`,
    ))})`,
  )
})

reviewLines.push(
  '',
  '## Required decisions',
  '',
  `- Visual approval is required for the ${newScenes.length} new scenes and the exact combined active set.`,
  '- Existing v1 visual and composite approvals remain preserved for their original 48-scene scope.',
  '- After visual approval, promote PNG masters, derive WebP files with PSNR ≥35 dB, and regenerate the runtime catalog.',
  '- Then generate and review combined Minho composites.',
  '- Rights review remains pending for every new destination; no v3 scene is shipping eligible.',
  '',
)
const reviewContents = `${reviewLines.join('\n')}\n`
await writeOrCheckText(
  outputReviewIndexPath,
  reviewContents,
  'npm run assets:integrate-landmarks',
)

if (qa.overallStatus !== 'pass') {
  throw new Error(`landmark integration failed:\n- ${errors.join('\n- ')}`)
}

console.log(
  `landmark candidates ${checkOnly ? 'verified' : 'integrated'}: `
    + `${combinedManifest.totals.destinationCount} destinations, `
    + `${combinedManifest.totals.activeSceneVariantCount} scenes`,
)
