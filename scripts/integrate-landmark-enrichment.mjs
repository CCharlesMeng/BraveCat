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

const normalizeRepoPath = (value, label = 'path') => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label}: expected a repository-relative path`)
  }
  const normalized = path.posix.normalize(
    value.replaceAll('\\', '/').replace(/^\.\/+/, ''),
  )
  if (
    path.posix.isAbsolute(normalized)
    || normalized === '..'
    || normalized.startsWith('../')
  ) {
    throw new Error(`${label}: path must stay inside the repository`)
  }
  return normalized
}

const baseManifestPath = normalizeRepoPath(optionValue(
  '--base-manifest',
  'docs/art/candidates/landmarks/manifest.candidates.v3.json',
), '--base-manifest')
const enrichmentPlanPath = normalizeRepoPath(optionValue(
  '--enrichment-plan',
  'docs/art/landmark-enrichment-v4.json',
), '--enrichment-plan')
const outputManifestPath = normalizeRepoPath(optionValue(
  '--output-manifest',
  'docs/art/candidates/landmarks/manifest.candidates.v4.json',
), '--output-manifest')
const outputQaPath = normalizeRepoPath(optionValue(
  '--output-qa',
  'docs/art/candidates/landmarks/qa-report.v4.json',
), '--output-qa')
const outputReviewIndexPath = normalizeRepoPath(optionValue(
  '--output-review-index',
  'docs/art/candidates/landmarks/review-index.v4.md',
), '--output-review-index')

const absolute = (repoPath) => {
  const normalized = normalizeRepoPath(repoPath)
  const resolved = path.resolve(root, normalized)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${repoPath}: path must stay inside the repository`)
  }
  return resolved
}
const sha256 = (contents) => (
  createHash('sha256').update(contents).digest('hex')
)
const readContents = (repoPath) => readFile(absolute(repoPath))

const writeOrCheckText = async (repoPath, contents) => {
  if (checkOnly) {
    let current
    try {
      current = await readFile(absolute(repoPath), 'utf8')
    } catch {
      throw new Error(`${repoPath} is missing; run npm run assets:integrate-landmark-enrichment`)
    }
    if (current !== contents) {
      throw new Error(`${repoPath} is stale; run npm run assets:integrate-landmark-enrichment`)
    }
    return
  }
  await mkdir(path.dirname(absolute(repoPath)), { recursive: true })
  await writeFile(absolute(repoPath), contents)
}

const writeOrCheckBinary = async (repoPath, contents) => {
  if (checkOnly) {
    let current
    try {
      current = await readFile(absolute(repoPath))
    } catch {
      throw new Error(`${repoPath} is missing; run npm run assets:integrate-landmark-enrichment`)
    }
    if (sha256(current) !== sha256(contents)) {
      throw new Error(`${repoPath} is stale; run npm run assets:integrate-landmark-enrichment`)
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

const toRepoPath = (fragmentPath, sourcePath, repoRelative = false) => {
  const normalizedSource = normalizeRepoPath(sourcePath, fragmentPath)
  if (
    repoRelative
    || normalizedSource.startsWith('docs/')
    || normalizedSource.startsWith('public/')
    || normalizedSource.startsWith('src/')
  ) {
    return normalizedSource
  }
  return normalizeRepoPath(
    path.posix.join(path.posix.dirname(fragmentPath), normalizedSource),
    fragmentPath,
  )
}

const sourceDeclaration = (value) => {
  if (typeof value === 'string') {
    return {
      path: value,
      repoRelative: false,
      sha256: null,
    }
  }
  if (!value || typeof value !== 'object') return null
  const nested = value.document ?? value.artifact
  const source = nested && typeof nested === 'object' ? nested : value
  const sourcePath = source.repoPath
    ?? source.path
    ?? source.src
    ?? source.imageSrc
  if (!sourcePath) return null
  return {
    path: sourcePath,
    repoRelative: Boolean(source.repoPath),
    sha256: source.sha256 ?? value.sha256 ?? null,
  }
}

const versionFromPath = (repoPath) => {
  const match = repoPath.match(/--(v\d{2})\.png$/)
  if (!match) throw new Error(`${repoPath}: missing vNN revision`)
  return match[1]
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

const validateCompositionSlot = (slot, bounds, expectedPose, label, errors) => {
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
    || slot.pose !== expectedPose
    || typeof slot.flip !== 'boolean'
  ) {
    errors.push(`${label}: invalid ${expectedPose} bottom-center compositionSlot`)
    return
  }
  if (
    bounds
    && (
      slot.x < bounds.x
      || slot.x > bounds.x + bounds.width
      || slot.y < bounds.y
      || slot.y > bounds.y + bounds.height + 0.000001
    )
  ) {
    errors.push(`${label}: composition anchor lies outside safeBounds`)
  }
}

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const isPass = (value) => {
  if (value === true) return true
  if (typeof value === 'string') {
    return value === 'passed' || value === 'pass' || value.startsWith('pass-')
  }
  if (!value || typeof value !== 'object' || value.performed === false) {
    return false
  }
  return [value.result, value.decision, value.status].some(isPass)
}

const anyTrue = (...values) => values.some((value) => value === true)
const anyPass = (...values) => values.some(isPass)

const normalizeAndValidateSocialContent = (
  scene,
  fragment,
  label,
  errors,
) => {
  const declared = scene.socialContent
    ?? scene.production?.socialContent
    ?? scene.policy
    ?? {}
  const people = declared.people ?? scene.people
  const peopleDeclared = people && typeof people === 'object' && (
    people.present === true
    || people.count !== undefined
    || people.countEstimate !== undefined
    || people.approximateVisibleCount !== undefined
    || typeof people.presentation === 'string'
    || typeof people.behavior === 'string'
  )
  const peopleDescription = [
    people?.faces,
    people?.presentation,
    people?.distance,
  ].filter(Boolean).join(' ').toLowerCase()
  const facesNonIdentifiable = (
    people?.identifiableFaces === false
    || people?.facesIdentifiable === false
    || peopleDescription.includes('non-identifiable')
    || peopleDescription.includes('distant')
  )
  const peopleOutsideSafeBounds = (
    people?.outsideSafeBounds === true
    && declared.peopleAndVehiclesOutsideSafeBounds !== false
  )
  const socialInspectionPassed = anyPass(
    declared.visualInspection,
    scene.inspection?.socialPlacement,
    scene.inspection?.landmarkAndSocialContext,
    scene.production?.inspection,
    fragment.visualInspection?.socialPlacement,
    fragment.visualInspection,
    fragment.inspection?.visualChecks,
    fragment.inspection?.internalVisualQa,
  )
  if (
    !peopleDeclared
    || !facesNonIdentifiable
    || !peopleOutsideSafeBounds
    || !socialInspectionPassed
  ) {
    errors.push(
      `${label}: missing explicit, reviewed social-content placement policy`,
    )
  }

  const movingObjects = [
    declared.vehicles,
    declared.boat,
    declared.riverCraft,
    declared.ferry,
  ].filter((value) => value && typeof value === 'object')
  for (const movingObject of movingObjects) {
    const absent = (
      movingObject.present === false
      || movingObject.count === 0
    )
    if (
      !absent
      && movingObject.outsideSafeBounds !== true
      && declared.peopleAndVehiclesOutsideSafeBounds !== true
      && scene.compositionLegality?.overlapsVehicleOrVessel !== false
    ) {
      errors.push(`${label}: vehicle or vessel safeBounds separation is unverified`)
      break
    }
  }
  if (anyTrue(
    declared.playerCatPresent,
    declared.otherAnimalsPresent,
    declared.animalsPresent,
    scene.animalsPresent,
    scene.policy?.animalsPresent,
    declared.readableTextOrPseudoTextPresent,
  )) {
    errors.push(`${label}: social policy declares forbidden content`)
  }

  const normalized = {
    policy: 'v4-lived-in-context',
    ...declared,
  }
  if (!normalized.people && people) normalized.people = people
  if (
    normalized.vehiclesPresent === undefined
    && scene.vehiclesPresent !== undefined
  ) {
    normalized.vehiclesPresent = scene.vehiclesPresent
  }
  if (
    normalized.animalsPresent === undefined
    && scene.animalsPresent !== undefined
  ) {
    normalized.animalsPresent = scene.animalsPresent
  }
  return normalized
}

const validateNight = (scene, fragment, label, errors) => {
  const night = scene.night
    ?? scene.policy?.night
    ?? scene.production?.night
  const routeReadable = anyTrue(
    night?.routeReadable,
    night?.routeLegible,
    night?.groundPlaneReadable,
    night?.groundPlaneLegible,
    night?.stepsReadable,
    night?.walkSlot?.legibleAtNight,
  )
  const reviewPassed = anyPass(
    night?.visualInspection,
    scene.inspection?.nightReadability,
    fragment.visualInspection?.nightReadability,
    fragment.visualInspection?.checks?.nightRouteAndStepsReadable,
    fragment.inspection?.visualChecks?.nightRouteReadability,
    fragment.inspection?.nightSceneReviewed,
  )
  const prohibitedLighting = anyTrue(
    night?.neon,
    night?.neonDominant,
    night?.neonDominance,
    night?.lighting?.neonDominance,
    night?.blownHighlights,
    night?.highlightsBlown,
    night?.crushedShadows,
    night?.shadowsCrushed,
    night?.dynamicMediaOrLaserEffects,
    night?.lighting?.specialEventLighting,
  )
  if (
    !night
    || typeof night !== 'object'
    || !routeReadable
    || !reviewPassed
    || prohibitedLighting
  ) {
    errors.push(`${label}: incomplete or failed night-scene validation`)
  }
  return night ?? null
}

const validateShelter = (scene, fragment, label, errors) => {
  const shelter = scene.shelter
    ?? scene.policy?.shelter
    ?? scene.production?.shelter
  const sleepSurface = shelter?.sleepSurface
  const protectionDescription = [
    shelter?.type,
    shelter?.weatherProtection,
    typeof sleepSurface === 'string' ? sleepSurface : sleepSurface?.type,
  ].filter(Boolean).join(' ').toLowerCase()
  const protectedAndDry = anyTrue(
    shelter?.dry,
    shelter?.protected,
    shelter?.weatherProtected,
    scene.compositionLegality?.dryShelteredSurface,
  ) || (
    protectionDescription.includes('dry')
    && (
      protectionDescription.includes('covered')
      || protectionDescription.includes('shelter')
      || protectionDescription.includes('arcade')
      || protectionDescription.includes('pavilion')
      || protectionDescription.includes('veranda')
    )
  )
  const destinationVisible = anyTrue(
    shelter?.landmarkVisibleOutside,
    shelter?.destinationVisibleOutside,
    shelter?.toriiVisibleBeyond,
    shelter?.merlionAndBayVisible,
    shelter?.landmarkRelationship?.towerBridgeVisibleOutside,
  )
  const reviewPassed = anyPass(
    shelter?.visualInspection,
    scene.inspection?.shelterBelievability,
    scene.inspection?.shelterPlausibility,
    fragment.visualInspection?.shelterBelievability,
    fragment.visualInspection?.checks
      ?.shelterIsPublicFacingAndNotSacredOrPrivateInterior,
    fragment.inspection?.visualChecks?.shelterBelievabilityAndSleepSlot,
    fragment.inspection?.shelterSceneReviewed,
  )
  const prohibitedShelterClaim = anyTrue(
    shelter?.namedVenueInteriorCopied,
    shelter?.logoOrLuxuryProductPlacement,
    shelter?.privateResidenceIdentity,
    shelter?.privateResidenceDepicted,
    shelter?.brandedTradeDressPresent,
    shelter?.privateInterior,
    shelter?.sacredInterior,
    shelter?.permissionToSleepClaimed,
    shelter?.sleepPermissionClaimed,
  )
  if (
    !shelter
    || typeof shelter !== 'object'
    || !sleepSurface
    || !protectedAndDry
    || !destinationVisible
    || !reviewPassed
    || prohibitedShelterClaim
  ) {
    errors.push(`${label}: incomplete or failed shelter-scene validation`)
  }
  return shelter ?? null
}

const baseContents = await readContents(baseManifestPath)
const baseManifest = JSON.parse(baseContents)
const planContents = await readContents(enrichmentPlanPath)
const plan = JSON.parse(planContents)
const errors = []
const baseManifestSha256 = sha256(baseContents)

const outputPaths = [
  outputManifestPath,
  outputQaPath,
  outputReviewIndexPath,
]
if (
  new Set(outputPaths).size !== outputPaths.length
  || outputPaths.includes(baseManifestPath)
  || outputPaths.includes(enrichmentPlanPath)
) {
  errors.push('v4 outputs must be distinct from each other and protected inputs')
}

if (
  baseManifest.manifestKind !== 'landmark-candidate-master'
  || baseManifest.planId !== plan.extendsPlanId
  || baseManifest.shippingEligible !== false
  || baseManifest.totals?.destinationCount !== 25
  || baseManifest.totals?.activeSceneVariantCount !== 61
  || baseManifest.sceneVariants?.length !== 61
  || baseManifest.destinations?.length !== 25
) {
  errors.push(`${baseManifestPath}: expected the approved-scope v3 candidate base`)
}
if (
  plan.shippingEligible !== false
  || !Array.isArray(plan.destinations)
  || plan.destinations.length !== plan.enrichment.destinationCountTouched
  || plan.baseCandidateManifest !== baseManifestPath
) {
  errors.push(`${enrichmentPlanPath}: invalid enrichment plan`)
}

const plannedVariants = plan.destinations.flatMap(
  (destination) => destination.variants.map((variant) => ({
    ...variant,
    destinationId: destination.id,
  })),
)
const plannedSemanticIds = plannedVariants.map(
  ({ destinationId, id }) => `${destinationId}--${id}`,
)
const plannedRevisionCount = plannedVariants.filter(
  ({ action }) => action === 'supersede-active-revision',
).length
const plannedAdditionCount = plannedVariants.filter(
  ({ action }) => action === 'add-active-variant',
).length
if (
  new Set(plan.destinations.map(({ id }) => id)).size !== plan.destinations.length
  || new Set(plannedSemanticIds).size !== plannedSemanticIds.length
  || plannedVariants.length !== plan.enrichment.candidateImagesToGenerate
  || plannedRevisionCount !== plan.enrichment.activeVariantRevisions
  || plannedAdditionCount !== plan.enrichment.newActiveVariants
) {
  errors.push(`${enrichmentPlanPath}: enrichment actions or IDs are inconsistent`)
}
for (const destination of plan.destinations) {
  const variants = new Set(destination.variants.map(({ id }) => id))
  if (
    variants.size !== 3
    || !['day-signature', 'night-transit', 'sheltered-rest'].every(
      (variantId) => variants.has(variantId),
    )
  ) {
    errors.push(`${destination.id}: expected exact day, night, and shelter variants`)
  }
}

const baseSceneById = new Map(
  baseManifest.sceneVariants.map((scene) => [scene.id, scene]),
)
const baseSceneByPath = new Map(
  baseManifest.sceneVariants.map((scene) => [
    normalizeRepoPath(scene.imageSrc, `${scene.id}: imageSrc`),
    scene,
  ]),
)
const baseFragmentRecordByPath = new Map(
  baseManifest.sourceFragments.map((record) => [record.path, record]),
)
const baseFragmentByDestinationId = new Map()
const baseContactSheetByDestinationId = new Map()
const sceneContentsById = new Map()
const protectedV3Paths = new Set([baseManifestPath])
let protectedV3InputsVerified = 1
let protectedV3InputsExpected = 1

const baseActiveIds = baseManifest.destinations.flatMap(
  ({ activeSceneVariantIds }) => activeSceneVariantIds,
)
if (
  baseActiveIds.length !== baseManifest.sceneVariants.length
  || new Set(baseActiveIds).size !== baseActiveIds.length
  || baseActiveIds.some((sceneId) => !baseSceneById.has(sceneId))
) {
  errors.push(`${baseManifestPath}: base active scene IDs are inconsistent`)
}

for (const destination of baseManifest.destinations) {
  const fragmentPath = normalizeRepoPath(
    destination.sourceFragment,
    `${destination.id}: sourceFragment`,
  )
  protectedV3Paths.add(fragmentPath)
  protectedV3InputsExpected += 1
  try {
    const fragmentContents = await readContents(fragmentPath)
    const actualSha256 = sha256(fragmentContents)
    const sourceRecord = baseFragmentRecordByPath.get(fragmentPath)
    if (
      actualSha256 !== destination.sourceFragmentSha256
      || actualSha256 !== sourceRecord?.sha256
    ) {
      errors.push(`${fragmentPath}: protected v3 fragment sha256 mismatch`)
    } else {
      protectedV3InputsVerified += 1
    }
    const fragment = JSON.parse(fragmentContents)
    baseFragmentByDestinationId.set(destination.id, {
      path: fragmentPath,
      sha256: actualSha256,
      fragment,
    })

    const contactArtifact = Array.isArray(fragment.qaArtifacts)
      ? fragment.qaArtifacts.find(({ kind }) => kind === 'contact-sheet')
      : null
    const contactDeclaration = sourceDeclaration(
      fragment.contactSheet
        ?? fragment.qa?.contactSheet
        ?? contactArtifact
        ?? path.posix.join(
          path.posix.dirname(fragmentPath),
          `contact-sheet--${destination.id}--non-final.png`,
        ),
    )
    const contactPath = toRepoPath(
      fragmentPath,
      contactDeclaration.path,
      contactDeclaration.repoRelative,
    )
    baseContactSheetByDestinationId.set(destination.id, contactPath)
    protectedV3Paths.add(contactPath)
    const contactContents = await readContents(contactPath)
    if (contactDeclaration.sha256) {
      protectedV3InputsExpected += 1
      if (contactDeclaration.sha256 !== sha256(contactContents)) {
        errors.push(`${contactPath}: protected v3 contact-sheet sha256 mismatch`)
      } else {
        protectedV3InputsVerified += 1
      }
    }
  } catch (error) {
    errors.push(`${fragmentPath}: ${error.message}`)
  }
}

for (const scene of baseManifest.sceneVariants) {
  const scenePath = normalizeRepoPath(scene.imageSrc, `${scene.id}: imageSrc`)
  protectedV3Paths.add(scenePath)
  protectedV3InputsExpected += 1
  try {
    const contents = await readContents(scenePath)
    if (sha256(contents) !== scene.sha256) {
      errors.push(`${scenePath}: protected v3 scene sha256 mismatch`)
    } else {
      protectedV3InputsVerified += 1
    }
    sceneContentsById.set(scene.id, contents)
  } catch (error) {
    errors.push(`${scenePath}: ${error.message}`)
  }
}

if (outputPaths.some((outputPath) => protectedV3Paths.has(outputPath))) {
  errors.push('v4 output path aliases a protected v3 artifact')
}

const combinedManifest = structuredClone(baseManifest)
const destinationById = new Map(
  combinedManifest.destinations.map((destination) => [destination.id, destination]),
)
const sceneById = new Map(
  combinedManifest.sceneVariants.map((scene) => [scene.id, scene]),
)
const newScenes = []
const newSceneIds = new Set()
const replacedSceneIds = new Set()
const enrichmentFragments = []
const enrichmentRightsWarnings = []
const enrichmentContactSheetByDestinationId = new Map()
const socialValidatedSceneIds = new Set()
const nightValidatedSceneIds = new Set()
const shelterValidatedSceneIds = new Set()
let rejectedEnrichmentRevisionCount = 0

for (const plannedDestination of plan.destinations) {
  const destination = destinationById.get(plannedDestination.id)
  if (!destination) {
    errors.push(`${plannedDestination.id}: destination is absent from the base manifest`)
    continue
  }
  const fragmentPath = path.posix.join(
    plan.candidateOutputRoot,
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

  const declaredPlanId = fragment.planId ?? fragment.sourcePlanId
  if (
    fragment.destinationId !== plannedDestination.id
    || fragment.destinationName !== plannedDestination.name
    || fragment.sourcePlan !== enrichmentPlanPath
    || declaredPlanId !== plan.planId
    || fragment.shippingEligible !== false
    || !Array.isArray(fragment.sceneVariants)
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
    fragment.restrictedSourcePhotosRetained === true
    || fragment.rights?.restrictedSourcePhotosRetained === true
    || fragment.rights?.restrictedSourcePhotographsRetained === true
    || fragment.provenanceAndRights?.restrictedSourcePhotoRetained === true
    || fragment.provenanceAndRights?.restrictedSourcePhotographsRetained === true
    || fragment.research?.restrictedSourcePhotographsRetained === true
    || fragment.socialContextResearch?.restrictedSourceImagesRetained === true
  ) {
    errors.push(`${fragmentPath}: restricted source photograph was retained`)
  }

  const baseManifestDeclaration =
    fragment.baseReferences?.candidateManifest
    ?? fragment.baseManifest
    ?? fragment.base?.candidateManifest
    ?? fragment.baseLinkage?.baseCandidateManifest
    ?? fragment.baseLinkage?.candidateManifest
  const baseManifestReference = sourceDeclaration(baseManifestDeclaration)
  const declaredBaseManifestSha256 = baseManifestReference?.sha256
    ?? fragment.baseLinkage?.baseCandidateManifestSha256
  if (!baseManifestReference) {
    errors.push(`${fragmentPath}: missing protected v3 manifest linkage`)
  } else {
    const referencedPath = toRepoPath(
      fragmentPath,
      baseManifestReference.path,
      baseManifestReference.repoRelative,
    )
    if (
      referencedPath !== baseManifestPath
      || (
        declaredBaseManifestSha256
        && declaredBaseManifestSha256 !== baseManifestSha256
      )
    ) {
      errors.push(`${fragmentPath}: protected v3 manifest linkage mismatch`)
    }
  }

  const baseDestinationDeclaration =
    fragment.baseReferences?.destinationFragment
    ?? fragment.baseDestinationFragment
    ?? fragment.base?.destinationFragment
    ?? fragment.baseLinkage?.baseDestinationFragment
    ?? fragment.baseLinkage?.destinationFragment
  const baseDestinationReference = sourceDeclaration(baseDestinationDeclaration)
  const baseDestinationRecord = baseFragmentByDestinationId.get(
    plannedDestination.id,
  )
  const declaredBaseDestinationSha256 = baseDestinationReference?.sha256
    ?? fragment.baseLinkage?.baseDestinationFragmentSha256
  if (!baseDestinationReference || !baseDestinationRecord) {
    errors.push(`${fragmentPath}: missing protected v3 destination linkage`)
  } else {
    const referencedPath = toRepoPath(
      fragmentPath,
      baseDestinationReference.path,
      baseDestinationReference.repoRelative,
    )
    if (
      referencedPath !== baseDestinationRecord.path
      || (
        declaredBaseDestinationSha256
        && declaredBaseDestinationSha256 !== baseDestinationRecord.sha256
      )
    ) {
      errors.push(`${fragmentPath}: protected v3 destination linkage mismatch`)
    }
  }

  const researchDeclaration =
    fragment.artifacts?.socialContextResearch
    ?? fragment.socialContextResearch
    ?? fragment.research
    ?? (
      Array.isArray(fragment.artifacts)
        ? fragment.artifacts.find(({ kind }) => (
            kind === 'research' || kind === 'social-context-research'
          ))
        : null
    )
  const researchReference = sourceDeclaration(researchDeclaration)
  if (!researchReference) {
    errors.push(`${fragmentPath}: missing social-context research`)
  } else {
    const researchPath = toRepoPath(
      fragmentPath,
      researchReference.path,
      researchReference.repoRelative,
    )
    try {
      const researchContents = await readContents(researchPath)
      if (
        !researchPath.startsWith(`${path.posix.dirname(fragmentPath)}/`)
        || !researchReference.sha256
        || researchReference.sha256 !== sha256(researchContents)
      ) {
        errors.push(`${researchPath}: research sha256 mismatch`)
      }
    } catch (error) {
      errors.push(`${researchPath}: ${error.message}`)
    }
  }

  const selectedByVariant = new Map()
  const fragmentScenes = Array.isArray(fragment.sceneVariants)
    ? fragment.sceneVariants
    : []
  const plannedVariantIds = new Set(
    plannedDestination.variants.map(({ id }) => id),
  )
  const isInactiveScene = (scene) => (
    scene.status === 'superseded'
    || scene.status === 'superseded-rejected'
    || scene.superseded === true
  )
  const unplannedActiveScenes = fragmentScenes.filter((scene) => (
    !isInactiveScene(scene) && !plannedVariantIds.has(scene.variantId)
  ))
  if (unplannedActiveScenes.length > 0) {
    errors.push(`${fragmentPath}: contains unplanned active scene variants`)
  }

  for (const plannedVariant of plannedDestination.variants) {
    const variantCandidates = []
    for (const scene of fragmentScenes.filter(
      ({ variantId }) => variantId === plannedVariant.id,
    )) {
      try {
        const repoPath = toRepoPath(fragmentPath, scene.imageSrc)
        variantCandidates.push({
          scene,
          repoPath,
          version: versionFromPath(repoPath),
        })
      } catch (error) {
        errors.push(`${fragmentPath}: ${error.message}`)
      }
    }
    const activeCandidates = variantCandidates.filter(
      ({ scene }) => !isInactiveScene(scene),
    )
    if (activeCandidates.length !== 1) {
      errors.push(
        `${plannedDestination.id}: expected exactly one active `
          + `${plannedVariant.id} candidate, got ${activeCandidates.length}`,
      )
      continue
    }
    const [selected] = activeCandidates
    if (selected.version !== plannedVariant.version) {
      errors.push(
        `${plannedDestination.id}--${plannedVariant.id}: expected `
          + `${plannedVariant.version}, got ${selected.version}`,
      )
    }

    const { scene, repoPath, version } = selected
    const semanticId = `${plannedDestination.id}--${plannedVariant.id}`
    const versionedId = `${semanticId}--${version}`
    const expectedFilename = `scene--${versionedId}.png`
    const expectedRepoPath = path.posix.join(
      path.posix.dirname(fragmentPath),
      expectedFilename,
    )
    if (
      repoPath !== expectedRepoPath
      || ![semanticId, versionedId].includes(scene.id)
      || (
        scene.revisionId !== undefined
        && scene.revisionId !== versionedId
      )
      || (
        scene.destinationId !== undefined
        && scene.destinationId !== plannedDestination.id
      )
      || scene.version !== plannedVariant.version
      || scene.action !== plannedVariant.action
      || (scene.supersedes ?? null) !== (plannedVariant.supersedes ?? null)
      || scene.status !== 'candidate'
      || scene.shippingEligible !== false
      || scene.hasCompanion !== false
      || scene.companion
    ) {
      errors.push(
        `${versionedId}: fragment identity, action, path, or candidate policy mismatch`,
      )
    }

    const safeBounds = scene.safeBounds ?? scene.production?.safeBounds
    validateSafeBounds(safeBounds, versionedId, errors)
    validateCompositionSlot(
      scene.compositionSlot,
      safeBounds,
      plannedVariant.portraitPose,
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
        errors.push(`${versionedId}: expected 1200x900 8-bit opaque RGB sRGB PNG`)
      }
      if (sha256(imageContents) !== scene.sha256) {
        errors.push(`${versionedId}: image sha256 mismatch`)
      }
      sceneContentsById.set(versionedId, imageContents)
    } catch (error) {
      errors.push(`${versionedId}: ${error.message}`)
      continue
    }

    const socialErrorCount = errors.length
    const socialContent = normalizeAndValidateSocialContent(
      scene,
      fragment,
      versionedId,
      errors,
    )
    if (errors.length === socialErrorCount) {
      socialValidatedSceneIds.add(versionedId)
    }

    let night = scene.night
      ?? scene.policy?.night
      ?? scene.production?.night
      ?? null
    if (plannedVariant.id === 'night-transit') {
      const nightErrorCount = errors.length
      night = validateNight(scene, fragment, versionedId, errors)
      if (errors.length === nightErrorCount) {
        nightValidatedSceneIds.add(versionedId)
      }
    }

    let shelter = scene.shelter
      ?? scene.policy?.shelter
      ?? scene.production?.shelter
      ?? null
    if (plannedVariant.id === 'sheltered-rest') {
      const shelterErrorCount = errors.length
      shelter = validateShelter(scene, fragment, versionedId, errors)
      if (errors.length === shelterErrorCount) {
        shelterValidatedSceneIds.add(versionedId)
      }
    }

    const combinedScene = {
      id: versionedId,
      sourceCandidateId: semanticId,
      destinationId: plannedDestination.id,
      destinationName: plannedDestination.name,
      variantId: plannedVariant.id,
      version,
      name: scene.name ?? `${plannedDestination.name} · ${plannedVariant.id}`,
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
      hasCompanion: false,
      companion: null,
      socialContent,
      night,
      shelter,
      supersedes: plannedVariant.supersedes ?? null,
      selectionDecision: {
        state: 'locked-for-human-review',
        basis: 'v4-enrichment-plan',
        activeRevision: version,
        action: plannedVariant.action,
      },
      provenance: {
        summary: 'Generated under the v4 lived-in, night-transit, and sheltered-rest policy with locked-B watercolor styling; official sources supplied factual circulation and shelter context, and no restricted source photograph is retained.',
        generationMethod: 'image-generation',
        generator: {
          tool: 'GenerateImage',
          model: 'not-exposed-by-tool',
          seed: 'not-exposed-by-tool',
        },
        source: scene.production ?? scene.provenance ?? null,
      },
      review: {
        decision: scene.review?.decision ?? 'pending',
        humanVisualReview: scene.review?.humanVisualReview ?? 'pending',
        socialContextReview: scene.review?.socialContextReview ?? 'pending',
        rightsReview: scene.review?.rightsReview ?? 'pending',
        finalRealPortraitCompositeReview:
          scene.review?.finalRealPortraitCompositeReview ?? 'pending',
        reviewer: scene.review?.reviewer ?? '',
        reviewedAt: scene.review?.reviewedAt ?? null,
      },
      sourceFragment: fragmentPath,
      sourceFragmentSha256: sha256(fragmentContents),
    }
    selectedByVariant.set(plannedVariant.id, combinedScene)
    newScenes.push(combinedScene)
    newSceneIds.add(versionedId)
  }

  const activeIds = [...destination.activeSceneVariantIds]
  if (selectedByVariant.size !== plannedDestination.variants.length) {
    errors.push(`${plannedDestination.id}: v4 variant coverage differs from plan`)
  }
  for (const plannedVariant of plannedDestination.variants) {
    const selected = selectedByVariant.get(plannedVariant.id)
    if (!selected) continue
    if (plannedVariant.action === 'supersede-active-revision') {
      const oldIndex = activeIds.indexOf(plannedVariant.supersedes)
      if (oldIndex === -1 || !baseSceneById.has(plannedVariant.supersedes)) {
        errors.push(
          `${plannedDestination.id}: missing active revision `
            + `${plannedVariant.supersedes} to supersede`,
        )
      } else {
        activeIds[oldIndex] = selected.id
        sceneById.delete(plannedVariant.supersedes)
        replacedSceneIds.add(plannedVariant.supersedes)
      }
    } else if (plannedVariant.action === 'add-active-variant') {
      const semanticCollision = activeIds.some((sceneId) => {
        const activeScene = sceneById.get(sceneId)
        return activeScene?.destinationId === plannedDestination.id
          && activeScene?.variantId === plannedVariant.id
      })
      if (semanticCollision) {
        errors.push(`${selected.sourceCandidateId}: active semantic ID collision`)
      }
      activeIds.push(selected.id)
    } else {
      errors.push(`${selected.id}: unsupported enrichment action`)
    }
    if (sceneById.has(selected.id)) {
      errors.push(`${selected.id}: duplicate versioned scene ID`)
    }
    sceneById.set(selected.id, selected)
  }
  if (new Set(activeIds).size !== activeIds.length) {
    errors.push(`${plannedDestination.id}: duplicate active scene IDs`)
  }
  destination.activeSceneVariantIds = activeIds
  destination.enrichmentSourcePlan = enrichmentPlanPath
  destination.enrichmentSourceFragment = fragmentPath
  destination.enrichmentSourceFragmentSha256 = sha256(fragmentContents)

  const rejectedPaths = new Set()
  const rejectedRecords = [
    ...(fragment.supersededRevisions ?? []),
    ...(fragment.supersededBaseRevisions ?? []),
    ...(fragment.rejectedRevisions ?? []),
    ...fragmentScenes
      .map((scene) => scene.production?.supersededRevision)
      .filter(Boolean),
    ...(fragment.provenance?.regenerationAudit ?? []),
  ]
  for (const rejected of rejectedRecords) {
    const imageSrc = rejected.imageSrc
      ?? rejected.supersededImageSrc
      ?? rejected.path
    if (!imageSrc) continue
    try {
      const rejectedPath = toRepoPath(fragmentPath, imageSrc)
      const expectedSha256 = rejected.sha256
        ?? rejected.supersededSha256
        ?? rejected.supersededImageSha256
      const baseScene = baseSceneByPath.get(rejectedPath)
      if (baseScene) {
        if (
          expectedSha256 !== baseScene.sha256
          || rejected.modified === true
          || rejected.retained === false
        ) {
          errors.push(`${rejectedPath}: protected v3 supersession record mismatch`)
        }
        continue
      }
      if (rejectedPaths.has(rejectedPath)) continue
      rejectedPaths.add(rejectedPath)
      if (!expectedSha256) {
        errors.push(`${rejectedPath}: retained rejected revision lacks sha256`)
        continue
      }
      const rejectedContents = await readContents(rejectedPath)
      const png = inspectPng(rejectedContents, rejectedPath)
      if (
        sha256(rejectedContents) !== expectedSha256
        || png.width !== 1200
        || png.height !== 900
        || png.bitDepth !== 8
        || png.colorType !== 2
      ) {
        errors.push(`${rejectedPath}: invalid retained rejected revision`)
      }
    } catch (error) {
      errors.push(`${fragmentPath}: rejected revision ${error.message}`)
    }
  }
  const declaredRejectedCounts = [
    fragment.inspection?.supersededRevisionCount,
    fragment.inspection?.rejectedRevisionCount,
    fragment.generationSummary?.retainedRejectedRevisionCount,
    fragment.machineInspection?.checks?.retainedRejectedSceneCount,
  ].filter(Number.isInteger)
  const declaredRejectedCount = Math.max(0, ...declaredRejectedCounts)
  if (declaredRejectedCount !== rejectedPaths.size) {
    errors.push(
      `${fragmentPath}: retained rejected revision count mismatch `
        + `(declared ${declaredRejectedCount}, found ${rejectedPaths.size})`,
    )
  }
  rejectedEnrichmentRevisionCount += rejectedPaths.size

  const contactDeclaration = sourceDeclaration(
    fragment.contactSheet ?? fragment.qa?.contactSheet,
  )
  if (!contactDeclaration) {
    errors.push(`${fragmentPath}: missing enrichment contact sheet`)
  } else {
    const contactSheetPath = toRepoPath(
      fragmentPath,
      contactDeclaration.path,
      contactDeclaration.repoRelative,
    )
    enrichmentContactSheetByDestinationId.set(
      plannedDestination.id,
      contactSheetPath,
    )
    try {
      const contactContents = await readContents(contactSheetPath)
      const metadata = await sharp(contactContents).metadata()
      const expectedSha256 = contactDeclaration.sha256
        ?? fragment.qa?.contactSheetSha256
      if (
        !contactSheetPath.startsWith(`${path.posix.dirname(fragmentPath)}/`)
        || metadata.format !== 'png'
        || metadata.hasAlpha !== false
        || !expectedSha256
      ) {
        errors.push(`${contactSheetPath}: expected opaque PNG contact sheet`)
      }
      if (expectedSha256 && expectedSha256 !== sha256(contactContents)) {
        errors.push(`${contactSheetPath}: contact-sheet sha256 mismatch`)
      }
      if (
        fragment.contactSheet?.candidateImagesContainQaOverlays === true
        || fragment.contactSheet?.candidateImagesContainOverlays === true
      ) {
        errors.push(`${fragmentPath}: candidate scenes contain QA overlays`)
      }
    } catch (error) {
      errors.push(`${contactSheetPath}: ${error.message}`)
    }
  }

  enrichmentFragments.push({
    path: fragmentPath,
    sha256: sha256(fragmentContents),
  })
  const warningText = (value) => {
    if (Array.isArray(value)) return value.join(' ')
    return typeof value === 'string' ? value : null
  }
  const rightsWarning = [
    warningText(fragment.provenanceAndRights?.warnings),
    warningText(fragment.rights?.shippingWarnings),
    warningText(fragment.rights?.warning),
    warningText(fragment.rights?.notes),
    warningText(fragment.socialContextResearch?.warnings),
    warningText(fragment.culturalReview?.warnings),
  ].find((value) => value?.trim())
    ?? 'Social-context, night-lighting, interior/shelter, trademark, and source-independence review remain pending.'
  enrichmentRightsWarnings.push({
    destinationId: plannedDestination.id,
    referenceUse: 'primary and official sources consulted for circulation, night, shelter, and landmark context only; no restricted source photograph retained',
    shippingGate: 'v4-social-night-shelter-rights-review-required',
    warning: rightsWarning,
  })
}

combinedManifest.schemaVersion = Math.max(2, baseManifest.schemaVersion)
combinedManifest.planId = 'miaoyouji-landmarks-combined-v4-2026-07-20'
combinedManifest.sourcePlans = [
  ...baseManifest.sourcePlans,
  {
    path: enrichmentPlanPath,
    planId: plan.planId,
    sha256: sha256(planContents),
    destinationCount: plan.destinations.length,
  },
]
combinedManifest.integratedAt = '2026-07-20'
combinedManifest.status = 'candidate'
combinedManifest.shippingEligible = false
combinedManifest.approvalState = 'pending-human-approval'
combinedManifest.review = {
  decision: 'pending',
  humanVisualReview: 'pending',
  socialContextReview: 'pending',
  rightsReview: 'pending',
  finalRealPortraitCompositeReview: 'pending',
  shippingApproval: 'pending',
  note: 'The approved v3 files remain immutable. Five active day revisions and ten new lived-in/night/rest variants require a new exact-scope user visual decision.',
}
combinedManifest.sourceFragments = [
  ...baseManifest.sourceFragments,
  ...enrichmentFragments,
]
combinedManifest.rightsAndProvenanceWarnings = [
  ...baseManifest.rightsAndProvenanceWarnings,
  ...enrichmentRightsWarnings,
]
combinedManifest.sceneVariants = combinedManifest.destinations.flatMap(
  ({ activeSceneVariantIds }) => activeSceneVariantIds
    .map((sceneId) => sceneById.get(sceneId))
    .filter(Boolean),
)
combinedManifest.totals = {
  destinationCount: combinedManifest.destinations.length,
  activeSceneVariantCount: combinedManifest.sceneVariants.length,
  ordinaryVariantCount: combinedManifest.sceneVariants.filter(
    ({ hasCompanion }) => !hasCompanion,
  ).length,
  companionRareVariantCount: combinedManifest.sceneVariants.filter(
    ({ hasCompanion }) => hasCompanion,
  ).length,
  supersededSceneFileCount:
    baseManifest.totals.supersededSceneFileCount
      + replacedSceneIds.size
      + rejectedEnrichmentRevisionCount,
}
combinedManifest.locks.variantPolicy = {
  ...baseManifest.locks.variantPolicy,
  ordinaryVariantsPerDestination: 'at-least-2',
  enrichmentVariantIds: ['night-transit', 'sheltered-rest'],
  enrichedDestinationIds: plan.destinations.map(({ id }) => id),
}
combinedManifest.locks.activeCandidateSelection = {
  ...baseManifest.locks.activeCandidateSelection,
  selectionRule: 'Preserve the approved v3 active set except for explicit v4 superseding revisions, then append v4 night-transit and sheltered-rest variants.',
  activeEntriesSelected: combinedManifest.sceneVariants.length,
  supersededEntriesExcluded: combinedManifest.totals.supersededSceneFileCount,
}

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

const allSceneIds = combinedManifest.sceneVariants.map(({ id }) => id)
const allSemanticIds = combinedManifest.sceneVariants.map(
  ({ destinationId, variantId }) => `${destinationId}--${variantId}`,
)
const activeIdsFromDestinations = combinedManifest.destinations.flatMap(
  ({ activeSceneVariantIds }) => activeSceneVariantIds,
)
const newRevisionScenes = newScenes.filter(
  ({ selectionDecision }) => (
    selectionDecision.action === 'supersede-active-revision'
  ),
)
const newAdditionScenes = newScenes.filter(
  ({ selectionDecision }) => selectionDecision.action === 'add-active-variant',
)
const expectedSupersededSceneFileCount =
  baseManifest.totals.supersededSceneFileCount
    + plan.enrichment.activeVariantRevisions
    + rejectedEnrichmentRevisionCount
if (
  combinedManifest.totals.destinationCount
    !== plan.enrichment.combinedDestinationCount
  || combinedManifest.totals.activeSceneVariantCount
    !== plan.enrichment.combinedActiveVariantTarget
  || newScenes.length !== plan.enrichment.candidateImagesToGenerate
  || newRevisionScenes.length !== plan.enrichment.activeVariantRevisions
  || newAdditionScenes.length !== plan.enrichment.newActiveVariants
  || replacedSceneIds.size !== plan.enrichment.activeVariantRevisions
  || newScenes.filter(({ variantId }) => (
    variantId === 'night-transit' || variantId === 'sheltered-rest'
  )).length !== plan.enrichment.newActiveVariants
  || combinedManifest.totals.ordinaryVariantCount
    !== baseManifest.totals.ordinaryVariantCount
      + plan.enrichment.newActiveVariants
  || combinedManifest.totals.companionRareVariantCount
    !== baseManifest.totals.companionRareVariantCount
  || combinedManifest.totals.supersededSceneFileCount
    !== expectedSupersededSceneFileCount
) {
  errors.push('integrated totals differ from the v4 plan')
}
if (
  new Set(allSceneIds).size !== allSceneIds.length
  || new Set(allSemanticIds).size !== allSemanticIds.length
  || new Set(activeIdsFromDestinations).size !== activeIdsFromDestinations.length
  || activeIdsFromDestinations.length !== allSceneIds.length
  || activeIdsFromDestinations.some((id) => !sceneById.has(id))
  || allSceneIds.some((id) => !activeIdsFromDestinations.includes(id))
) {
  errors.push('combined v4 active scene IDs are duplicate or inconsistent')
}
if (
  socialValidatedSceneIds.size !== plan.enrichment.candidateImagesToGenerate
  || nightValidatedSceneIds.size !== plan.destinations.length
  || shelterValidatedSceneIds.size !== plan.destinations.length
) {
  errors.push('social, night, or shelter validation coverage is incomplete')
}

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
const overviewPaths = Array.from(
  { length: overviewSheetCount },
  (_, sheetIndex) => path.posix.join(
    path.posix.dirname(outputManifestPath),
    `contact-sheet--landmarks--overview-v4-${String(
      sheetIndex + 1,
    ).padStart(2, '0')}-of-${String(overviewSheetCount).padStart(2, '0')}--non-final.png`,
  ),
)
if (
  overviewPaths.some((repoPath) => protectedV3Paths.has(repoPath))
  || overviewPaths.some((repoPath) => outputPaths.includes(repoPath))
) {
  errors.push('v4 overview path aliases another output or protected v3 artifact')
}
if (
  protectedV3InputsVerified !== protectedV3InputsExpected
  || sha256(await readContents(baseManifestPath)) !== baseManifestSha256
) {
  errors.push('protected v3 inputs changed or failed integrity validation')
}
if (
  combinedManifest.sceneVariants.some(
    ({ id }) => !sceneContentsById.has(id),
  )
) {
  errors.push('an active scene is missing its validated image snapshot')
}
if (errors.length > 0) {
  throw new Error(`landmark enrichment integration failed:\n- ${errors.join('\n- ')}`)
}

for (let sheetIndex = 0; sheetIndex < overviewSheetCount; sheetIndex += 1) {
  const sheetScenes = combinedManifest.sceneVariants.slice(
    sheetIndex * overviewScenesPerSheet,
    (sheetIndex + 1) * overviewScenesPerSheet,
  )
  const tiles = []
  for (const [tileIndex, scene] of sheetScenes.entries()) {
    const sceneBuffer = await sharp(sceneContentsById.get(scene.id))
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
  const repoPath = overviewPaths[sheetIndex]
  await writeOrCheckBinary(repoPath, sheetBuffer)
}

const manifestContents = `${JSON.stringify(combinedManifest, null, 2)}\n`
await writeOrCheckText(outputManifestPath, manifestContents)

const machineChecks = [
  {
    id: 'protected-v3-input-integrity',
    status: (
      protectedV3InputsVerified === protectedV3InputsExpected
      && sha256(await readContents(baseManifestPath)) === baseManifestSha256
    ) ? 'pass' : 'fail',
    expected: protectedV3InputsExpected,
    actual: protectedV3InputsVerified,
  },
  {
    id: 'enrichment-destination-and-fragment-coverage',
    status: enrichmentFragments.length === plan.destinations.length
      ? 'pass'
      : 'fail',
    expected: plan.destinations.length,
    actual: enrichmentFragments.length,
  },
  {
    id: 'generated-candidate-count',
    status: newScenes.length === plan.enrichment.candidateImagesToGenerate
      ? 'pass'
      : 'fail',
    expected: plan.enrichment.candidateImagesToGenerate,
    actual: newScenes.length,
  },
  {
    id: 'explicit-day-revisions',
    status: replacedSceneIds.size === plan.enrichment.activeVariantRevisions
      ? 'pass'
      : 'fail',
    expected: plan.enrichment.activeVariantRevisions,
    actual: replacedSceneIds.size,
  },
  {
    id: 'exact-new-active-variants',
    status: newAdditionScenes.length === plan.enrichment.newActiveVariants
      ? 'pass'
      : 'fail',
    expected: plan.enrichment.newActiveVariants,
    actual: newAdditionScenes.length,
  },
  {
    id: 'night-transit-coverage',
    status: newScenes.filter(({ variantId }) => variantId === 'night-transit').length
      === plan.destinations.length
      ? 'pass'
      : 'fail',
    expected: plan.destinations.length,
    actual: newScenes.filter(({ variantId }) => variantId === 'night-transit').length,
  },
  {
    id: 'sheltered-rest-coverage',
    status: newScenes.filter(({ variantId }) => variantId === 'sheltered-rest').length
      === plan.destinations.length
      ? 'pass'
      : 'fail',
    expected: plan.destinations.length,
    actual: newScenes.filter(({ variantId }) => variantId === 'sheltered-rest').length,
  },
  {
    id: 'social-night-and-shelter-validation',
    status: (
      socialValidatedSceneIds.size === plan.enrichment.candidateImagesToGenerate
      && nightValidatedSceneIds.size === plan.destinations.length
      && shelterValidatedSceneIds.size === plan.destinations.length
    ) ? 'pass' : 'fail',
    expected: {
      social: plan.enrichment.candidateImagesToGenerate,
      night: plan.destinations.length,
      shelter: plan.destinations.length,
    },
    actual: {
      social: socialValidatedSceneIds.size,
      night: nightValidatedSceneIds.size,
      shelter: shelterValidatedSceneIds.size,
    },
  },
  {
    id: 'combined-active-scene-total',
    status: combinedManifest.sceneVariants.length
      === plan.enrichment.combinedActiveVariantTarget
      ? 'pass'
      : 'fail',
    expected: plan.enrichment.combinedActiveVariantTarget,
    actual: combinedManifest.sceneVariants.length,
  },
  {
    id: 'unique-semantic-and-versioned-ids',
    status: new Set(allSceneIds).size === allSceneIds.length
      && new Set(allSemanticIds).size === allSemanticIds.length
      ? 'pass'
      : 'fail',
    expected: allSceneIds.length,
    actual: Math.min(
      new Set(allSceneIds).size,
      new Set(allSemanticIds).size,
    ),
  },
  {
    id: 'superseded-and-rejected-file-count',
    status: combinedManifest.totals.supersededSceneFileCount
      === expectedSupersededSceneFileCount
      ? 'pass'
      : 'fail',
    expected: expectedSupersededSceneFileCount,
    actual: combinedManifest.totals.supersededSceneFileCount,
  },
  {
    id: 'image-format-hash-filename-and-slot-policy',
    status: errors.some((error) => (
      error.includes('1200x900')
      || error.includes('sha256')
      || error.includes('filename')
      || error.includes('compositionSlot')
      || error.includes('safeBounds')
      || error.includes('Companion')
    ))
      ? 'fail'
      : 'pass',
    expected: newScenes.length,
    actual: newScenes.length,
  },
  {
    id: 'destination-and-global-contact-sheets',
    status: errors.some((error) => (
      error.includes('contact sheet') || error.includes('contact-sheet')
    ))
      ? 'fail'
      : 'pass',
    expected: plan.destinations.length + overviewSheetCount,
    actual: enrichmentContactSheetByDestinationId.size + overviewPaths.length,
  },
]
const failedChecks = machineChecks.filter(({ status }) => status === 'fail')
const qa = {
  schemaVersion: 4,
  reportKind: 'landmark-enrichment-integration-qa',
  planId: combinedManifest.planId,
  sourcePlan: enrichmentPlanPath,
  sourceManifest: outputManifestPath,
  sourceManifestSha256: sha256(Buffer.from(manifestContents)),
  generatedAt: '2026-07-20',
  overallStatus:
    errors.length === 0 && failedChecks.length === 0 ? 'pass' : 'fail',
  shippingEligible: false,
  activeSet: combinedManifest.activeSet,
  totals: {
    ...combinedManifest.totals,
    generatedCandidateCount: newScenes.length,
    activeDayRevisionCount: replacedSceneIds.size,
    newNightTransitCount: newScenes.filter(
      ({ variantId }) => variantId === 'night-transit',
    ).length,
    newShelteredRestCount: newScenes.filter(
      ({ variantId }) => variantId === 'sheltered-rest',
    ).length,
    machineCheckCount: machineChecks.length,
    machineChecksPassed: machineChecks.length - failedChecks.length,
    machineChecksFailed: failedChecks.length,
  },
  machineChecks,
  pendingHumanChecks: [
    {
      id: 'v4-social-context-and-visual-review',
      status: 'pending',
      note: 'Review people/vehicle plausibility, non-identifiability, night readability, shelter believability, landmark fidelity, and Portrait-slot separation.',
    },
    {
      id: 'v4-minho-composite-review',
      status: 'blocked-until-visual-approval',
      note: 'Composite the five day revisions plus ten new night/rest scenes only after the exact v4 active set is visually approved.',
    },
    {
      id: 'v4-rights-cultural-and-trademark-review',
      status: 'pending',
      note: 'Social context, transport liveries, night lighting, interiors, venue identity, shrine context, and source-independence require separate review.',
    },
  ],
  protectedInputs: {
    baseManifest: {
      path: baseManifestPath,
      sha256: sha256(baseContents),
    },
    enrichmentPlan: {
      path: enrichmentPlanPath,
      sha256: sha256(planContents),
    },
  },
  overviewSheets: overviewPaths,
  errors,
}
await writeOrCheckText(outputQaPath, `${JSON.stringify(qa, null, 2)}\n`)

const reviewDirectory = path.posix.dirname(outputReviewIndexPath)
const relative = (repoPath) => path.posix.relative(reviewDirectory, repoPath)
const enrichedDestinationIds = new Set(plan.destinations.map(({ id }) => id))
const reviewLines = [
  '# Landmark candidate review index v4',
  '',
  `The exact ${combinedManifest.totals.activeSceneVariantCount}-scene v4 active set is non-shipping and pending human approval. It preserves ${baseManifest.sceneVariants.length - replacedSceneIds.size} unchanged v3 scenes, supersedes ${replacedSceneIds.size} day revisions without deleting them, and adds ${newScenes.filter(({ variantId }) => variantId === 'night-transit').length} night-transit plus ${newScenes.filter(({ variantId }) => variantId === 'sheltered-rest').length} sheltered-rest variants.`,
  '',
  `- [Enrichment plan](${relative(enrichmentPlanPath)})`,
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
  reviewLines.push(
    `${index + 1}. **${destination.name}** (\`${destination.id}\`) — `
      + `${destination.activeSceneVariantIds.length} active candidates`,
  )
  for (const sceneId of destination.activeSceneVariantIds) {
    const scene = sceneById.get(sceneId)
    reviewLines.push(
      `   - [${scene.variantId} · ${scene.version}`
        + `${scene.hasCompanion ? ' · companion' : ''}`
        + ` · ${newSceneIds.has(scene.id) ? 'pending v4 review' : 'previously visually approved'}]`
        + `(${relative(scene.imageSrc)})`,
    )
  }
  reviewLines.push(
    `   - [existing destination sheet](${relative(
      baseContactSheetByDestinationId.get(destination.id),
    )})`,
  )
  if (enrichedDestinationIds.has(destination.id)) {
    reviewLines.push(
      `   - [v4 enrichment sheet](${relative(
        enrichmentContactSheetByDestinationId.get(destination.id),
      )})`,
    )
  }
})

reviewLines.push(
  '',
  '## Required decisions',
  '',
  '- Review and approve or reject all 15 v4 candidates as one exact active-set change.',
  '- Verify people and vehicles make the place feel lived-in without becoming the subject.',
  '- Verify each night scene reads as safe travel rather than an empty or neon-heavy set.',
  '- Verify each sheltered-rest scene offers a genuinely plausible dry sleep location while retaining destination identity.',
  '- Existing approvals remain valid only for their immutable files; they do not approve the five replacement revisions or ten new variants.',
  '- Rights, cultural, venue/interior, transport-livery, composite, and shipping gates remain pending.',
  '',
)
await writeOrCheckText(
  outputReviewIndexPath,
  `${reviewLines.join('\n')}\n`,
)

if (qa.overallStatus !== 'pass') {
  const failureMessages = [
    ...errors,
    ...failedChecks.map(({ id }) => `machine check failed: ${id}`),
  ]
  throw new Error(
    `landmark enrichment integration failed:\n- ${failureMessages.join('\n- ')}`,
  )
}

console.log(
  `landmark enrichment ${checkOnly ? 'verified' : 'integrated'}: `
    + `${combinedManifest.totals.destinationCount} destinations, `
    + `${combinedManifest.totals.activeSceneVariantCount} scenes`,
)
