import { createHash } from 'node:crypto'
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { movedRepoRelativePath } from './lib/monorepo-paths.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cliArgs = process.argv.slice(2)
const checkOnly = cliArgs.includes('--check')
const generatedAt = '2026-07-20'
const runCommand = 'npm run assets:integrate-landmark-staging'

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
  'docs/art/candidates/landmarks/manifest.candidates.v4.json',
), '--base-manifest')
const stagingPlanPath = normalizeRepoPath(optionValue(
  '--staging-plan',
  'docs/art/landmark-staging-v5.json',
), '--staging-plan')
const baseQaPath = normalizeRepoPath(optionValue(
  '--base-qa',
  'docs/art/candidates/landmarks/qa-report.v4.json',
), '--base-qa')
const baseReviewIndexPath = normalizeRepoPath(optionValue(
  '--base-review-index',
  'docs/art/candidates/landmarks/review-index.v4.md',
), '--base-review-index')
const outputManifestPath = normalizeRepoPath(optionValue(
  '--output-manifest',
  'docs/art/candidates/landmarks/manifest.candidates.v5.json',
), '--output-manifest')
const outputQaPath = normalizeRepoPath(optionValue(
  '--output-qa',
  'docs/art/candidates/landmarks/qa-report.v5.json',
), '--output-qa')
const outputReviewIndexPath = normalizeRepoPath(optionValue(
  '--output-review-index',
  'docs/art/candidates/landmarks/review-index.v5.md',
), '--output-review-index')

const absolute = (repoPath) => {
  const normalized = normalizeRepoPath(repoPath)
  const resolved = path.resolve(root, movedRepoRelativePath(normalized))
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
      throw new Error(`${repoPath} is missing; run ${runCommand}`)
    }
    if (current !== contents) {
      throw new Error(`${repoPath} is stale; run ${runCommand}`)
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
      throw new Error(`${repoPath} is missing; run ${runCommand}`)
    }
    if (sha256(current) !== sha256(contents)) {
      throw new Error(`${repoPath} is stale; run ${runCommand}`)
    }
    return
  }
  await mkdir(path.dirname(absolute(repoPath)), { recursive: true })
  await writeFile(absolute(repoPath), contents)
}

const inspectPng = (contents, label) => {
  if (
    contents.length < 26
    || contents.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
  ) {
    throw new Error(`${label}: not a PNG`)
  }
  return {
    width: contents.readUInt32BE(16),
    height: contents.readUInt32BE(20),
    bitDepth: contents[24],
    colorType: contents[25],
  }
}

const recordArray = (value) => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  for (const key of ['artifacts', 'records', 'items', 'revisions']) {
    if (Array.isArray(value[key])) return value[key]
  }
  return []
}

const rootRelativePrefixes = [
  'docs/',
  'public/',
  'scripts/',
  'src/',
]

const sourceDeclaration = (value, seen = new Set()) => {
  if (typeof value === 'string') {
    return {
      path: value,
      repoRelative: false,
      sha256: null,
      raw: value,
    }
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return null
  seen.add(value)

  const hash = value.sha256
    ?? value.hash
    ?? value.contentSha256
    ?? value.fileSha256
    ?? value.imageSha256
    ?? null
  for (const key of [
    'repoPath',
    'path',
    'imageSrc',
    'src',
    'file',
    'filename',
  ]) {
    if (typeof value[key] === 'string' && value[key].trim()) {
      return {
        path: value[key],
        repoRelative: key === 'repoPath',
        sha256: hash,
        raw: value,
      }
    }
  }
  for (const key of [
    'image',
    'sheet',
    'artifact',
    'document',
    'file',
    'source',
    'output',
  ]) {
    const nested = sourceDeclaration(value[key], seen)
    if (nested) {
      return {
        ...nested,
        sha256: nested.sha256 ?? hash,
        raw: value,
      }
    }
  }
  return null
}

const resolveDeclaredPath = (fragmentPath, declaration, label) => {
  if (
    typeof declaration.path !== 'string'
    || declaration.path.trim() === ''
  ) {
    throw new Error(`${label}: expected a path`)
  }
  const normalized = declaration.path
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '')
  if (path.posix.isAbsolute(normalized)) {
    throw new Error(`${label}: path must stay inside the repository`)
  }
  if (
    declaration.repoRelative
    || rootRelativePrefixes.some((prefix) => normalized.startsWith(prefix))
  ) {
    return normalizeRepoPath(normalized, label)
  }
  return normalizeRepoPath(
    path.posix.join(path.posix.dirname(fragmentPath), normalized),
    label,
  )
}

const normalizeKey = (value) => String(value)
  .toLowerCase()
  .replaceAll(/[^a-z0-9]/g, '')

const findValuesByKeys = (value, keys, depth = 0, values = []) => {
  if (!value || typeof value !== 'object' || depth > 8) return values
  const normalizedKeys = new Set(keys.map(normalizeKey))
  for (const [key, child] of Object.entries(value)) {
    if (normalizedKeys.has(normalizeKey(key))) values.push(child)
    if (child && typeof child === 'object') {
      findValuesByKeys(child, keys, depth + 1, values)
    }
  }
  return values
}

const textFromEvidence = (value, depth = 0) => {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object' || depth > 5) return ''
  for (const key of [
    'description',
    'evidence',
    'note',
    'reason',
    'rationale',
    'surface',
    'type',
    'value',
  ]) {
    const text = textFromEvidence(value[key], depth + 1)
    if (text) return text
  }
  for (const child of Object.values(value)) {
    const text = textFromEvidence(child, depth + 1)
    if (text) return text
  }
  return ''
}

const affirmativeEvidence = (value) => {
  if (value === true) return true
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return false
    if (
      /(^|\b)(false|fail|failed|pending|unknown|unverified|unsafe|implausible|inaccessible|unreachable|unclear|occluded|obscured)(\b|$)/
        .test(normalized)
      || /\b(no access|not accessible|not reachable|does not fit|not fit)\b/
        .test(normalized)
    ) {
      return false
    }
    if (
      ['true', 'yes', 'pass', 'passed', 'verified', 'clear', 'plausible']
        .includes(normalized)
      || normalized.startsWith('pass-')
    ) {
      return true
    }
    return normalized.length >= 8
  }
  if (!value || typeof value !== 'object') return false
  return [
    value.result,
    value.status,
    value.decision,
    value.verified,
    value.passed,
    value.plausible,
    value.present,
    value.value,
  ].some(affirmativeEvidence) || textFromEvidence(value).length >= 8
}

const negativeEvidence = (value) => {
  if (value === false) return true
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return [
      'false',
      'no',
      'absent',
      'none',
      'not present',
      'not-present',
      'not required',
      'not-required',
    ].includes(normalized)
  }
  if (!value || typeof value !== 'object') return false
  return value.present === false
    || value.required === false
    || value.needed === false
    || value.value === false
}

const evidenceFlag = (scope, positiveKeys, inverseKeys = []) => (
  findValuesByKeys(scope, positiveKeys).some(affirmativeEvidence)
  || findValuesByKeys(scope, inverseKeys).some(negativeEvidence)
)

const firstEvidence = (scope, keys) => (
  findValuesByKeys(scope, keys).find((value) => (
    textFromEvidence(value).length >= 4 || affirmativeEvidence(value)
  ))
)

const isExplicitNotApplicable = (scope) => (
  findValuesByKeys(scope, ['applicable']).some(negativeEvidence)
  || evidenceFlag(scope, ['notApplicable', 'ambientLifeNotApplicable'])
  || findValuesByKeys(scope, ['status', 'applicability']).some((value) => (
    typeof value === 'string'
    && (
      ['n/a', 'na', 'not-applicable', 'not applicable']
        .includes(value.trim().toLowerCase())
      || value.trim().toLowerCase().startsWith('not-applicable-')
    )
  ))
)

const versionFromPath = (repoPath) => {
  const match = repoPath.match(/--(v\d{2})\.png$/)
  if (!match) throw new Error(`${repoPath}: missing vNN revision`)
  return match[1]
}

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const truncate = (value, length) => {
  const text = String(value ?? '').replaceAll(/\s+/g, ' ').trim()
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`
}

const artifactEntries = (fragment) => [
  ...(Array.isArray(fragment.artifacts) ? fragment.artifacts : []),
  ...(
    fragment.artifacts
    && !Array.isArray(fragment.artifacts)
      ? Object.values(fragment.artifacts)
      : []
  ),
  ...(Array.isArray(fragment.qaArtifacts) ? fragment.qaArtifacts : []),
  ...(
    fragment.qaArtifacts
    && !Array.isArray(fragment.qaArtifacts)
      ? Object.values(fragment.qaArtifacts)
      : []
  ),
  ...(Array.isArray(fragment.qa?.artifacts) ? fragment.qa.artifacts : []),
  ...(
    fragment.qa?.artifacts
    && !Array.isArray(fragment.qa.artifacts)
      ? Object.values(fragment.qa.artifacts)
      : []
  ),
  ...(Array.isArray(fragment.sheets) ? fragment.sheets : []),
  ...(
    fragment.sheets
    && !Array.isArray(fragment.sheets)
      ? Object.values(fragment.sheets)
      : []
  ),
  ...(Array.isArray(fragment.contactSheets) ? fragment.contactSheets : []),
]

const artifactKind = (artifact) => String(
  artifact?.kind
    ?? artifact?.type
    ?? artifact?.id
    ?? artifact?.name
    ?? '',
).toLowerCase()

const pickSheetDeclaration = (fragment, kind) => {
  const artifacts = artifactEntries(fragment)
  const matchesKind = (artifact) => {
    const normalizedKind = artifactKind(artifact)
    const isPlacement = (
      normalizedKind.includes('placement')
      || normalizedKind.includes('portrait-preview')
      || normalizedKind.includes('minho')
    )
    return kind === 'placement'
      ? isPlacement
      : (
          (normalizedKind.includes('contact') || normalizedKind.includes('scene'))
          && !isPlacement
        )
  }
  const direct = kind === 'scene'
    ? [
        fragment.sceneContactSheet,
        fragment.sceneOnlyContactSheet,
        fragment.artifacts?.sceneContactSheet,
        fragment.qaArtifacts?.sceneContactSheet,
        fragment.contactSheets?.scene,
        fragment.contactSheets?.sceneOnly,
        fragment.contactSheets?.sceneContactSheet,
        fragment.contactSheets?.sceneOnlyContactSheet,
        fragment.contactSheet?.scene,
        fragment.contactSheet?.sceneOnly,
        fragment.contactSheet,
        fragment.qa?.sceneContactSheet,
        fragment.qa?.contactSheet,
        fragment.qa?.sheets?.scene,
        fragment.qa?.sheets?.sceneContactSheet,
      ]
    : [
        fragment.portraitPlacementPreviewSheet,
        fragment.placementPreviewSheet,
        fragment.placementPreviewContactSheet,
        fragment.minhoPlacementPreviewSheet,
        fragment.minhoPreviewSheet,
        fragment.portraitPlacementPreview,
        fragment.artifacts?.portraitPlacementPreview,
        fragment.artifacts?.portraitPlacementPreviewSheet,
        fragment.qaArtifacts?.portraitPlacementPreview,
        fragment.qaArtifacts?.portraitPlacementPreviewSheet,
        fragment.contactSheets?.placementPreview,
        fragment.contactSheets?.portraitPlacement,
        fragment.contactSheets?.minhoPlacementPreview,
        fragment.contactSheets?.portraitPlacementPreviewSheet,
        fragment.contactSheet?.placementPreview,
        fragment.qa?.portraitPlacementPreviewSheet,
        fragment.qa?.placementPreviewSheet,
        fragment.qa?.placementPreview,
        fragment.qa?.sheets?.placementPreview,
        fragment.qa?.sheets?.portraitPlacement,
      ]
  for (const candidate of direct) {
    const declaration = sourceDeclaration(candidate)
    if (!declaration) continue
    const matchingArtifact = artifacts
      .filter(matchesKind)
      .map((artifact) => sourceDeclaration(artifact))
      .find((artifact) => (
        artifact
        && (
          artifact.path === declaration.path
          || path.posix.basename(artifact.path)
            === path.posix.basename(declaration.path)
        )
      ))
    return {
      ...declaration,
      sha256: declaration.sha256 ?? matchingArtifact?.sha256 ?? null,
    }
  }
  for (const artifact of artifacts) {
    if (!matchesKind(artifact)) continue
    const declaration = sourceDeclaration(artifact)
    if (declaration) return declaration
  }
  return null
}

const withDeclaredHash = (declaration, ...hashes) => {
  if (!declaration) return null
  return {
    ...declaration,
    sha256: declaration.sha256
      ?? hashes.find((value) => typeof value === 'string')
      ?? null,
  }
}

const errors = []
const error = (message) => errors.push(message)
const throwIfErrors = (prefix) => {
  if (errors.length > 0) {
    throw new Error(`${prefix}:\n- ${errors.join('\n- ')}`)
  }
}

const validateRgbScene = async (contents, label, expectedSha256 = null) => {
  const png = inspectPng(contents, label)
  const metadata = await sharp(contents).metadata()
  if (
    png.width !== 1200
    || png.height !== 900
    || png.bitDepth !== 8
    || png.colorType !== 2
    || metadata.format !== 'png'
    || metadata.width !== 1200
    || metadata.height !== 900
    || metadata.hasAlpha !== false
    || metadata.channels !== 3
    || metadata.space !== 'srgb'
  ) {
    throw new Error(`${label}: expected 1200x900 8-bit opaque RGB sRGB PNG`)
  }
  if (expectedSha256 && sha256(contents) !== expectedSha256) {
    throw new Error(`${label}: image sha256 mismatch`)
  }
  return metadata
}

const protectedSnapshots = new Map()
const readProtected = async (repoPath) => {
  const normalized = normalizeRepoPath(repoPath)
  const contents = await readContents(normalized)
  if (!protectedSnapshots.has(normalized)) {
    protectedSnapshots.set(normalized, sha256(contents))
  }
  return contents
}

const baseContents = await readProtected(baseManifestPath)
const baseManifest = JSON.parse(baseContents)
const planContents = await readProtected(stagingPlanPath)
const plan = JSON.parse(planContents)
const baseQaContents = await readProtected(baseQaPath)
const baseQa = JSON.parse(baseQaContents)
const baseReviewContents = await readProtected(baseReviewIndexPath)
const baseManifestSha256 = sha256(baseContents)
const planSha256 = sha256(planContents)

const archivePath = normalizeRepoPath(optionValue(
  '--portrait-archive',
  plan.approvedPortraitPreviewSource
    ?? 'docs/art/archive/asset-archive.v2.json',
), '--portrait-archive')
const archiveContents = await readProtected(archivePath)
const archive = JSON.parse(archiveContents)
const portraitValidationPath = normalizeRepoPath(
  archive.portrait?.sourceValidation
    ?? 'docs/art/production/portraits/minho/validation.json',
  'portrait validation',
)
const portraitValidationContents = await readProtected(portraitValidationPath)
const portraitValidation = JSON.parse(portraitValidationContents)

const outputTextPaths = [
  outputManifestPath,
  outputQaPath,
  outputReviewIndexPath,
]
if (
  new Set(outputTextPaths).size !== outputTextPaths.length
  || outputTextPaths.some((outputPath) => (
    [
      baseManifestPath,
      stagingPlanPath,
      baseQaPath,
      baseReviewIndexPath,
      archivePath,
      portraitValidationPath,
    ].includes(outputPath)
  ))
) {
  error('v5 outputs must be distinct from protected inputs and each other')
}

if (
  baseManifest.manifestKind !== 'landmark-candidate-master'
  || baseManifest.planId !== plan.extendsPlanId
  || baseManifest.shippingEligible !== false
  || baseManifest.totals?.destinationCount !== 25
  || baseManifest.totals?.activeSceneVariantCount !== 71
  || baseManifest.destinations?.length !== 25
  || baseManifest.sceneVariants?.length !== 71
) {
  error(`${baseManifestPath}: expected the exact 25-destination/71-scene v4 base`)
}
if (
  baseQa.overallStatus !== 'pass'
  || baseQa.shippingEligible !== false
  || baseQa.sourceManifest !== baseManifestPath
  || baseQa.sourceManifestSha256 !== baseManifestSha256
  || baseQa.activeSet?.activeSceneSetSha256
    !== baseManifest.activeSet?.activeSceneSetSha256
  || baseQa.activeSet?.activeSceneContentSetSha256
    !== baseManifest.activeSet?.activeSceneContentSetSha256
) {
  error(`${baseQaPath}: v4 QA does not match the protected base manifest`)
}
if (
  !baseReviewContents.includes('exact 71-scene v4 active set')
  || !baseReviewContents.includes(baseManifest.activeSet?.activeSceneSetSha256)
  || !baseReviewContents.includes(
    baseManifest.activeSet?.activeSceneContentSetSha256,
  )
) {
  error(`${baseReviewIndexPath}: v4 review index does not match the base set`)
}

const staging = plan.staging ?? {}
if (
  plan.schemaVersion !== 1
  || plan.status !== 'candidate-generation'
  || plan.shippingEligible !== false
  || plan.baseCandidateManifest !== baseManifestPath
  || plan.candidateOutputRoot
    !== 'docs/art/candidates/landmarks/staging-v5'
  || !Array.isArray(plan.destinations)
  || plan.destinations.length !== 10
  || staging.destinationCountTouched !== 10
  || staging.activeVariantRevisions !== 10
  || staging.newActiveVariants !== 5
  || staging.candidateImagesToGenerate !== 15
  || staging.baseDestinationCount !== 25
  || staging.baseActiveVariantCount !== 71
  || staging.combinedDestinationCount !== 25
  || staging.combinedActiveVariantTarget !== 76
) {
  error(`${stagingPlanPath}: v5 staging plan semantics are inconsistent`)
}

const plannedVariants = plan.destinations.flatMap((destination) => (
  destination.variants.map((variant) => ({
    ...variant,
    destinationId: destination.id,
    destinationName: destination.name,
  }))
))
const plannedSemanticIds = plannedVariants.map(
  ({ destinationId, id }) => `${destinationId}--${id}`,
)
const plannedRevisions = plannedVariants.filter(
  ({ action }) => action === 'supersede-active-revision',
)
const plannedAdditions = plannedVariants.filter(
  ({ action }) => action === 'add-active-variant',
)
const plannedDayRevisions = plannedRevisions.filter(
  ({ id, version }) => id === 'day-signature' && version === 'v03',
)
const plannedNightRevisions = plannedRevisions.filter(
  ({ id, version }) => id === 'night-transit' && version === 'v02',
)
const plannedDistantAdditions = plannedAdditions.filter(
  ({ id, version, framing }) => (
    id === 'distant-overlook'
    && version === 'v01'
    && framing === 'distant'
  ),
)
if (
  new Set(plan.destinations.map(({ id }) => id)).size !== 10
  || new Set(plannedSemanticIds).size !== 15
  || plannedVariants.length !== 15
  || plannedRevisions.length !== 10
  || plannedAdditions.length !== 5
  || plannedDayRevisions.length !== 5
  || plannedNightRevisions.length !== 5
  || plannedDistantAdditions.length !== 5
  || plannedAdditions.some(({ supersedes }) => supersedes !== null)
  || plannedRevisions.some(({ supersedes }) => typeof supersedes !== 'string')
) {
  error(`${stagingPlanPath}: expected five day v03, five night v02, and five distant v01 actions`)
}

const framingBands = plan.catPlacementPolicy?.framingBands ?? {}
const expectedFramingCounts = Object.fromEntries(
  ['foreground', 'midground', 'distant'].map((framing) => [
    framing,
    plannedVariants.filter((variant) => variant.framing === framing).length,
  ]),
)
if (
  expectedFramingCounts.foreground !== 3
  || expectedFramingCounts.midground !== 4
  || expectedFramingCounts.distant !== 8
  || ['foreground', 'midground', 'distant'].some((framing) => (
    typeof framingBands[framing]?.portraitHeightScaleMin !== 'number'
    || typeof framingBands[framing]?.portraitHeightScaleMax !== 'number'
  ))
) {
  error(`${stagingPlanPath}: expected foreground/midground/distant distribution 3/4/8`)
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
const baseDestinationById = new Map(
  baseManifest.destinations.map((destination) => [destination.id, destination]),
)
const baseActiveIds = baseManifest.destinations.flatMap(
  ({ activeSceneVariantIds }) => activeSceneVariantIds,
)
if (
  baseActiveIds.length !== 71
  || new Set(baseActiveIds).size !== 71
  || baseActiveIds.some((sceneId) => !baseSceneById.has(sceneId))
  || baseManifest.sceneVariants.some((scene) => !baseActiveIds.includes(scene.id))
) {
  error(`${baseManifestPath}: v4 active IDs are inconsistent`)
}
for (const planned of plannedRevisions) {
  const baseScene = baseSceneById.get(planned.supersedes)
  if (
    !baseScene
    || baseScene.destinationId !== planned.destinationId
    || baseScene.variantId !== planned.id
    || !baseActiveIds.includes(planned.supersedes)
  ) {
    error(`${planned.destinationId}--${planned.id}: planned superseded v4 scene is not active`)
  }
}

const recomputedBaseIdHash = sha256(Buffer.from(
  baseManifest.sceneVariants.map(({ id }) => id).sort().join('\n'),
))
const recomputedBaseContentHash = sha256(Buffer.from(
  baseManifest.sceneVariants
    .map(({ id, sha256: sceneSha256 }) => `${id}\t${sceneSha256}`)
    .sort()
    .join('\n'),
))
if (
  recomputedBaseIdHash !== baseManifest.activeSet?.activeSceneSetSha256
  || recomputedBaseContentHash
    !== baseManifest.activeSet?.activeSceneContentSetSha256
) {
  error(`${baseManifestPath}: v4 active-set hashes are stale`)
}

const protectedV4Paths = new Set([
  baseManifestPath,
  baseQaPath,
  baseReviewIndexPath,
])
const baseFragmentByPath = new Map()
for (const record of baseManifest.sourceFragments ?? []) {
  try {
    const fragmentPath = normalizeRepoPath(record.path, 'v4 source fragment')
    protectedV4Paths.add(fragmentPath)
    const contents = await readProtected(fragmentPath)
    if (sha256(contents) !== record.sha256) {
      error(`${fragmentPath}: protected v4 source-fragment sha256 mismatch`)
    }
    const fragment = JSON.parse(contents)
    baseFragmentByPath.set(fragmentPath, fragment)
  } catch (caught) {
    error(`protected v4 source fragment: ${caught.message}`)
  }
}

const sceneContentsById = new Map()
for (const scene of baseManifest.sceneVariants) {
  try {
    const scenePath = normalizeRepoPath(scene.imageSrc, `${scene.id}: imageSrc`)
    protectedV4Paths.add(scenePath)
    const contents = await readProtected(scenePath)
    await validateRgbScene(contents, scene.id, scene.sha256)
    sceneContentsById.set(scene.id, contents)
  } catch (caught) {
    error(`${scene.id}: ${caught.message}`)
  }
}

for (const overviewPath of baseQa.overviewSheets ?? []) {
  try {
    const normalized = normalizeRepoPath(overviewPath, 'v4 overview sheet')
    protectedV4Paths.add(normalized)
    const contents = await readProtected(normalized)
    const metadata = await sharp(contents).metadata()
    if (metadata.format !== 'png') {
      error(`${normalized}: protected v4 overview is not a PNG`)
    }
  } catch (caught) {
    error(`protected v4 overview: ${caught.message}`)
  }
}

if (
  archive.portrait?.id !== plan.catPlacementPolicy?.previewRequirements
    ?.approvedPortrait
  || archive.portrait?.status !== 'approved'
  || archive.portrait?.shippingEligible !== true
  || archive.portrait?.machineQa !== 'pass'
  || archive.portrait?.humanReview !== 'approved'
  || portraitValidation.ok !== true
  || portraitValidation.portraitId !== archive.portrait.id
) {
  error(`${archivePath}: approved Minho portrait metadata is invalid`)
}

const portraitByPose = new Map()
const portraitContentsByPose = new Map()
for (const pose of archive.portrait?.poses ?? []) {
  try {
    const repoPath = normalizeRepoPath(pose.repoPath, `${pose.pose}: portrait`)
    const contents = await readProtected(repoPath)
    const png = inspectPng(contents, repoPath)
    const metadata = await sharp(contents).metadata()
    if (
      sha256(contents) !== pose.sha256
      || portraitValidation.poses?.[pose.pose]?.sha256 !== pose.sha256
      || png.width !== 1024
      || png.height !== 1024
      || png.bitDepth !== 8
      || png.colorType !== 6
      || metadata.format !== 'png'
      || metadata.hasAlpha !== true
      || metadata.space !== 'srgb'
    ) {
      error(`${repoPath}: approved Portrait bytes or metadata mismatch`)
    }
    portraitByPose.set(pose.pose, {
      ...pose,
      repoPath,
      bbox: portraitValidation.poses?.[pose.pose]?.bbox,
    })
    portraitContentsByPose.set(pose.pose, contents)
  } catch (caught) {
    error(`${pose.pose}: ${caught.message}`)
  }
}
for (const pose of new Set(plannedVariants.map(({ portraitPose }) => portraitPose))) {
  if (!portraitByPose.has(pose)) {
    error(`${archivePath}: missing approved Minho ${pose} pose`)
  }
}

const validateSafeBounds = (bounds, label) => {
  if (
    bounds?.units !== 'normalized'
    || !['x', 'y', 'width', 'height'].every(
      (key) => typeof bounds[key] === 'number'
        && Number.isFinite(bounds[key])
        && bounds[key] >= 0
        && bounds[key] <= 1,
    )
    || bounds.width <= 0
    || bounds.height <= 0
    || bounds.x + bounds.width > 1.000001
    || bounds.y + bounds.height > 1.000001
  ) {
    error(`${label}: invalid normalized safeBounds`)
    return null
  }
  return {
    units: 'normalized',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  }
}

const normalizeCompositionSlot = (
  slot,
  bounds,
  expectedPose,
  portrait,
  label,
) => {
  const anchor = slot?.anchor ?? slot?.anchorSemantics
  const normalizedAnchor = normalizeKey(anchor)
  if (
    slot?.units !== 'normalized'
    || normalizedAnchor !== 'bottomcenter'
    || typeof slot.x !== 'number'
    || typeof slot.y !== 'number'
    || typeof slot.scale !== 'number'
    || !Number.isFinite(slot.x)
    || !Number.isFinite(slot.y)
    || !Number.isFinite(slot.scale)
    || slot.x < 0
    || slot.x > 1
    || slot.y < 0
    || slot.y > 1
    || slot.scale <= 0
    || slot.scale > 1
    || slot.pose !== expectedPose
    || typeof slot.flip !== 'boolean'
  ) {
    error(`${label}: invalid ${expectedPose} bottom-center compositionSlot`)
    return null
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
    error(`${label}: composition anchor lies outside safeBounds`)
  }

  const bbox = portrait?.bbox
  if (Array.isArray(bbox) && bbox.length === 4) {
    const canvasWidth = slot.scale * (900 / 1200)
    const leftInCanvas = slot.flip
      ? 1 - bbox[2] / 1024
      : bbox[0] / 1024
    const rightInCanvas = slot.flip
      ? 1 - bbox[0] / 1024
      : bbox[2] / 1024
    const visible = {
      left: slot.x - canvasWidth / 2 + leftInCanvas * canvasWidth,
      right: slot.x - canvasWidth / 2 + rightInCanvas * canvasWidth,
      top: slot.y - slot.scale + (bbox[1] / 1024) * slot.scale,
      bottom: slot.y - slot.scale + (bbox[3] / 1024) * slot.scale,
    }
    if (
      visible.left < -0.000001
      || visible.right > 1.000001
      || visible.top < -0.000001
      || visible.bottom > 1.000001
    ) {
      error(`${label}: complete approved Portrait silhouette leaves the Scene`)
    }
    if (
      bounds
      && (
        visible.left < bounds.x - 0.000001
        || visible.right > bounds.x + bounds.width + 0.000001
        || visible.top < bounds.y - 0.000001
        || visible.bottom > bounds.y + bounds.height + 0.000001
      )
    ) {
      error(`${label}: approved Portrait silhouette leaves safeBounds`)
    }
  }

  return {
    units: 'normalized',
    anchor: 'bottom-center',
    x: slot.x,
    y: slot.y,
    scale: slot.scale,
    pose: slot.pose,
    flip: slot.flip,
  }
}

const validatePlacementIntent = (scene, planned, slot, label) => {
  const intent = scene.placementIntent
    ?? scene.production?.placementIntent
    ?? scene.qa?.placementIntent
    ?? scene.placement?.intent
  if (!intent || typeof intent !== 'object') {
    error(`${label}: missing placementIntent`)
    return null
  }
  const framingValue = intent.framing
    ?? intent.catFraming
    ?? intent.depthBand
    ?? intent.framingBand
  const framing = typeof framingValue === 'object'
    ? framingValue.id ?? framingValue.band ?? framingValue.value
    : framingValue
  const depthBand = intent.depthBand
  const canonicalFraming = (value) => {
    if (typeof value !== 'string') return null
    const matches = ['foreground', 'midground', 'distant'].filter(
      (candidate) => new RegExp(`(^|[^a-z])${candidate}([^a-z]|$)`, 'i')
        .test(value),
    )
    return matches.length === 1 ? matches[0] : null
  }
  const normalizedFraming = canonicalFraming(framing)
  const normalizedDepthBand = canonicalFraming(depthBand)
  if (
    normalizedFraming !== planned.framing
    || (
      normalizedDepthBand
      && normalizedDepthBand !== planned.framing
    )
  ) {
    error(`${label}: placement framing does not match ${planned.framing}`)
  }
  const narrativeWeight = intent.narrativeWeight
    ?? intent.storyWeight
    ?? intent.visualWeight
  if (narrativeWeight !== planned.narrativeWeight) {
    error(`${label}: narrativeWeight does not match ${planned.narrativeWeight}`)
  }

  const band = framingBands[planned.framing]
  const scaleTolerance = Math.max(0.01, planned.targetScale * 0.15)
  if (
    !slot
    || slot.scale < band.portraitHeightScaleMin - 0.000001
    || slot.scale > band.portraitHeightScaleMax + 0.000001
    || Math.abs(slot.scale - planned.targetScale) > scaleTolerance + 0.000001
  ) {
    error(
      `${label}: Portrait scale must be within the ${planned.framing} band `
        + `and reasonably match target ${planned.targetScale}`,
    )
  }
  for (const declaredScale of [
    intent.scale,
    intent.portraitScale,
    intent.portraitHeightScale,
  ].filter((value) => value !== undefined)) {
    if (
      typeof declaredScale !== 'number'
      || !slot
      || Math.abs(declaredScale - slot.scale) > 0.000001
    ) {
      error(`${label}: placementIntent scale differs from compositionSlot.scale`)
    }
  }
  if (
    intent.targetScale !== undefined
    && (
      typeof intent.targetScale !== 'number'
      || Math.abs(intent.targetScale - planned.targetScale) > 0.000001
    )
  ) {
    error(`${label}: placementIntent targetScale differs from the plan`)
  }

  const physicalSupport = firstEvidence(intent, [
    'physicalSupport',
    'supportSurface',
    'support',
    'perch',
    'visibleSupportPlane',
  ])
  const accessPlausibility = firstEvidence(intent, [
    'accessPlausibility',
    'accessible',
    'reachable',
    'access',
    'physicalAccess',
  ])
  const poseFit = firstEvidence(intent, [
    'poseFit',
    'poseFitEvidence',
    'poseCompatibility',
    'poseAppropriate',
  ])
  const clearSilhouette = firstEvidence(intent, [
    'clearSilhouette',
    'clearSilhouetteEvidence',
    'silhouetteClarity',
    'localContrast',
    'silhouetteReadable',
  ])
  if (
    !physicalSupport
    || textFromEvidence(physicalSupport).length < 4
  ) {
    error(`${label}: placementIntent lacks physicalSupport evidence`)
  }
  if (!accessPlausibility || !affirmativeEvidence(accessPlausibility)) {
    error(`${label}: placementIntent lacks accessPlausibility evidence`)
  }
  const poseFitMatches = (
    typeof poseFit === 'string'
    && normalizeKey(poseFit).includes(normalizeKey(planned.portraitPose))
  )
  if (
    !poseFit
    || (!affirmativeEvidence(poseFit) && !poseFitMatches)
  ) {
    error(`${label}: placementIntent lacks poseFit evidence`)
  }
  if (!clearSilhouette || !affirmativeEvidence(clearSilhouette)) {
    error(`${label}: placementIntent lacks clearSilhouette evidence`)
  }

  const noForegroundOcclusion = evidenceFlag(intent, [
    'noForegroundOcclusionNeeded',
    'foregroundOcclusionFree',
    'fullyVisibleWithoutOcclusion',
    'noOcclusionMaskNeeded',
  ], [
    'foregroundOcclusionRequired',
    'requiresForegroundOcclusion',
    'foregroundOcclusionNeeded',
    'occlusionMaskRequired',
    'requiresOcclusionMask',
    'requiresForegroundOcclusionMask',
  ]) || (
    intent.foregroundOcclusion?.required === false
    || intent.occlusion?.foregroundRequired === false
    || intent.occlusion?.maskRequired === false
  )
  if (!noForegroundOcclusion) {
    error(`${label}: placementIntent must explicitly require no foreground occlusion`)
  }
  if (
    evidenceFlag(intent, [
      'foregroundOcclusionRequired',
      'requiresForegroundOcclusion',
      'foregroundOcclusionNeeded',
      'occlusionMaskRequired',
      'requiresOcclusionMask',
      'requiresForegroundOcclusionMask',
      'hiddenFeet',
      'floatingGap',
    ])
  ) {
    error(`${label}: placementIntent declares forbidden occlusion or grounding`)
  }

  return {
    ...intent,
    framing: planned.framing,
    depthBand: planned.framing,
    depthDescription: intent.depthDescription
      ?? (
        typeof depthBand === 'string' && depthBand !== planned.framing
          ? depthBand
          : undefined
      ),
    portraitHeightScale: slot?.scale,
    targetScale: planned.targetScale,
    narrativeWeight: planned.narrativeWeight,
    physicalSupport,
    accessPlausibility,
    poseFit,
    clearSilhouette,
    foregroundOcclusionRequired: false,
    plannedPerch: planned.perch,
  }
}

const validateAmbientLife = (scene, fragment, planned, label) => {
  const ambient = scene.ambientLife
    ?? scene.ambientLifeEvidence
    ?? scene.ambientLifeQa
    ?? scene.socialStaging
    ?? scene.socialContent?.ambientLife
    ?? scene.socialContent
    ?? scene.placementIntent?.ambientLife
    ?? scene.production?.ambientLife
    ?? fragment.ambientLifeByVariant?.[planned.id]
    ?? fragment.ambientLife?.[planned.id]
  if (!ambient || typeof ambient !== 'object') {
    error(`${label}: missing Ambient Life evidence`)
    return null
  }

  const reason = firstEvidence(ambient, [
    'reason',
    'rationale',
    'note',
    'notApplicableReason',
  ])
  const intentionalNatureOmission = (
    planned.action === 'add-active-variant'
    && (
      negativeEvidence(ambient.people?.present)
      || negativeEvidence(ambient.peoplePresent)
    )
    && reason
    && textFromEvidence(reason).length >= 4
  )
  const notApplicable = isExplicitNotApplicable(ambient)
    || intentionalNatureOmission
  const evidence = {
    naturalGrouping: evidenceFlag(ambient, [
      'naturalGrouping',
      'naturalGroupings',
      'asymmetricGrouping',
      'looseGrouping',
    ]),
    depthVariation: evidenceFlag(ambient, [
      'depthVariation',
      'depthAndScaleVariation',
      'variedDepth',
      'scaleVariation',
    ], ['singleDepthPlane', 'sameSizeFigures']),
    directionVariation: evidenceFlag(ambient, [
      'directionVariation',
      'directionalVariation',
      'variedDirection',
      'mixedDirections',
    ]),
    equalSpacingAbsent: evidenceFlag(ambient, [
      'equalSpacingAbsent',
      'evenSpacingAbsent',
      'noEqualSpacing',
      'irregularSpacing',
    ], ['equalSpacing', 'evenSpacing']),
    cloneSilhouettesAbsent: evidenceFlag(ambient, [
      'cloneSilhouettesAbsent',
      'repeatedClonesAbsent',
      'noClones',
      'noCloneSilhouettes',
    ], ['cloneSilhouettes', 'repeatedCloneSilhouettes']),
    outsidePerchSafeBounds: evidenceFlag(ambient, [
      'outsidePerchSafeBounds',
      'outsideSafeBounds',
      'contentOutsideSafeBounds',
      'ambientLifeOutsideSafeBounds',
      'outsideCatSafeBounds',
      'peopleAndVehiclesOutsideSafeBounds',
    ], ['insideSafeBounds', 'overlapsSafeBounds']),
  }
  const allEvidencePresent = Object.values(evidence).every(Boolean)

  if (planned.action === 'supersede-active-revision') {
    if (notApplicable || !allEvidencePresent) {
      error(`${label}: social revision lacks all six natural-distribution checks`)
    }
  } else if (
    !allEvidencePresent
    && (
      !notApplicable
      || !reason
      || textFromEvidence(reason).length < 4
    )
  ) {
    error(`${label}: distant-overlook Ambient Life must pass or explicitly be not applicable`)
  }

  return {
    ...ambient,
    applicability: notApplicable ? 'not-applicable' : 'required',
    qaEvidence: evidence,
  }
}

const sceneIsInactive = (scene) => (
  [
    'superseded',
    'superseded-rejected',
    'rejected',
    'inactive',
  ].includes(scene.status)
  || scene.superseded === true
  || scene.rejected === true
  || scene.active === false
  || scene.selected === false
)

const fragmentSceneList = (fragment) => {
  for (const value of [
    fragment.sceneVariants,
    fragment.scenes,
    fragment.candidates,
  ]) {
    if (Array.isArray(value)) return value
    if (value && typeof value === 'object') {
      const scenes = Object.values(value)
      if (scenes.every((scene) => scene && typeof scene === 'object')) {
        return scenes
      }
    }
  }
  return []
}

const fragmentIdentity = (fragment) => ({
  id: fragment.destinationId
    ?? fragment.destination?.id
    ?? fragment.destination?.destinationId,
  name: fragment.destinationName
    ?? fragment.destination?.name
    ?? fragment.destination?.destinationName,
})

const declaredReferenceHash = (declaration, ...values) => (
  declaration?.sha256
  ?? values.find((value) => typeof value === 'string')
  ?? null
)

const validateSheet = async (
  fragmentPath,
  declaration,
  kind,
  destinationId,
) => {
  if (!declaration) {
    error(`${fragmentPath}: missing ${kind} sheet`)
    return null
  }
  let repoPath
  try {
    repoPath = resolveDeclaredPath(
      fragmentPath,
      declaration,
      `${destinationId}: ${kind} sheet`,
    )
    if (!repoPath.startsWith(`${path.posix.dirname(fragmentPath)}/`)) {
      error(`${repoPath}: v5 ${kind} sheet must stay in its destination directory`)
    }
    const contents = await readContents(repoPath)
    const png = inspectPng(contents, repoPath)
    const metadata = await sharp(contents).metadata()
    const actualSha256 = sha256(contents)
    if (
      metadata.format !== 'png'
      || png.bitDepth !== 8
      || !metadata.width
      || !metadata.height
    ) {
      error(`${repoPath}: expected an 8-bit PNG ${kind} sheet`)
    }
    if (declaration.sha256 && declaration.sha256 !== actualSha256) {
      error(`${repoPath}: declared ${kind} sheet sha256 mismatch`)
    }
    return {
      kind,
      path: repoPath,
      sha256: actualSha256,
      width: metadata.width,
      height: metadata.height,
      declaredSha256: declaration.sha256 ?? null,
      sourceMetadata: declaration.raw,
    }
  } catch (caught) {
    error(`${fragmentPath}: ${kind} sheet ${caught.message}`)
    return null
  }
}

const previewUsesApprovedMinho = (fragment, declaration, portraitHashes) => {
  const scope = {
    declaration: declaration?.raw,
    preview: fragment.placementPreview
      ?? fragment.portraitPlacementPreview
      ?? fragment.qa?.placementPreview
      ?? fragment.previewRequirements
      ?? fragment.placementPreviewPolicy
      ?? fragment.portraitPreviewPolicy,
    approvedPortraitQaSource: fragment.approvedPortraitQaSource,
    lockedPreviewPortrait:
      fragment.lockedInputs?.previewPortrait
      ?? fragment.lockedInputs?.approvedPortraitPreviewSource,
  }
  const serialized = JSON.stringify(scope).toLowerCase()
  const approvedPortraitHash = [...portraitHashes].some(
    (hash) => serialized.includes(hash),
  )
  const portraitIdentity = (
    findValuesByKeys(scope, [
      'portraitId',
      'approvedPortrait',
      'portrait',
      'portraitSource',
      'containsApprovedMinho',
      'portraitApproved',
    ]).some((value) => JSON.stringify(value).toLowerCase().includes('minho'))
    || serialized.includes('portrait--minho--')
    || evidenceFlag(scope, ['containsApprovedMinho'])
  )
  const actualPortrait = evidenceFlag(scope, [
    'usesApprovedPortrait',
    'actualPortrait',
    'actualPortraitComposite',
    'portraitComposited',
    'realPortrait',
    'rendersPortrait',
    'containsApprovedMinho',
    'portraitApproved',
  ]) || (
    serialized.includes('minho')
    && (
      serialized.includes('actual')
      || serialized.includes('composite')
      || serialized.includes('placement')
      || [...portraitHashes].some((hash) => serialized.includes(hash))
    )
  )
  const nonFinal = evidenceFlag(scope, [
    'nonFinal',
    'nonFinalQaOnly',
    'qaOnly',
  ], ['final', 'shippingEligible']) || (
    declaration
    && /non-final|non-shipping|qa-only/i.test(declaration.path)
  )
  return portraitIdentity && approvedPortraitHash && actualPortrait && nonFinal
}

const candidateImageIsCatFree = (scene, fragment) => {
  const scope = {
    scene,
    locks: fragment.locks,
    inspection: fragment.inspection,
    machineInspection: fragment.machineInspection,
    visualInspection: fragment.visualInspection,
    candidatePolicy: fragment.candidatePolicy,
    policy: fragment.policy,
    qa: fragment.qa,
  }
  const positive = evidenceFlag(scope, [
    'catFree',
    'candidateImageCatFree',
    'candidateImagesCatFree',
    'candidateImagesRemainCatFree',
    'candidateImagesMustRemainCatFree',
    'candidateSceneCatFree',
    'candidateScenesCatFree',
    'candidateSceneFileRemainsCatFree',
    'candidateSceneFilesRemainCatFree',
    'sceneFileCatFree',
    'sceneFilesCatFree',
    'allCandidateScenesCatFree',
    'sceneCandidateRemainsCatFree',
    'sourceSceneCatFree',
    'sceneOnly',
  ], [
    'catPresent',
    'playerCatPresent',
    'portraitPresent',
    'catDrawnIntoScene',
    'playerCatDrawnIntoScene',
    'containsPlayerCat',
    'containsPortrait',
  ])
  const forbidden = evidenceFlag(scope, [
    'catPresent',
    'playerCatPresent',
    'portraitPresent',
    'catDrawnIntoScene',
    'playerCatDrawnIntoScene',
    'containsPlayerCat',
    'containsPortrait',
  ])
  return positive && !forbidden
}

const combinedManifest = structuredClone(baseManifest)
const destinationById = new Map(
  combinedManifest.destinations.map((destination) => [destination.id, destination]),
)
const sceneById = new Map(
  combinedManifest.sceneVariants.map((scene) => [scene.id, scene]),
)
const selectedNewScenes = []
const selectedNewSceneIds = new Set()
const replacedSceneIds = new Set()
const newSourceFragments = []
const newRightsWarnings = []
const sceneSheetByDestinationId = new Map()
const placementSheetByDestinationId = new Map()
const fragmentPathSet = new Set()
const activeV5ImagePaths = new Set()
const rejectedV5Paths = new Set()
let socialRevisionValidationCount = 0
let perchValidationCount = 0
let catFreeValidationCount = 0
let imageValidationCount = 0

for (const plannedDestination of plan.destinations) {
  const destination = destinationById.get(plannedDestination.id)
  if (!destination) {
    error(`${plannedDestination.id}: destination is absent from v4`)
    continue
  }
  const fragmentPath = normalizeRepoPath(path.posix.join(
    plan.candidateOutputRoot,
    plannedDestination.id,
    'manifest.fragment.json',
  ))
  fragmentPathSet.add(fragmentPath)

  let fragmentContents
  let fragment
  try {
    fragmentContents = await readContents(fragmentPath)
    fragment = JSON.parse(fragmentContents)
  } catch (caught) {
    error(`${fragmentPath}: ${caught.message}`)
    continue
  }
  const fragmentSha256 = sha256(fragmentContents)
  const identity = fragmentIdentity(fragment)
  if (
    identity.id !== plannedDestination.id
    || (
      identity.name !== undefined
      && identity.name !== plannedDestination.name
    )
  ) {
    error(`${fragmentPath}: destination identity mismatch`)
  }
  const fragmentShippingEligible = fragment.shippingEligible
    ?? fragment.candidatePolicy?.shippingEligible
    ?? fragment.policy?.shippingEligible
  if (fragmentShippingEligible !== false) {
    error(`${fragmentPath}: shippingEligible must be explicitly false`)
  }
  const declaredPlanId = fragment.planId
    ?? fragment.sourcePlanId
    ?? fragment.sourcePlan?.planId
    ?? fragment.plan?.id
  if (declaredPlanId !== plan.planId) {
    error(`${fragmentPath}: source plan id mismatch`)
  }

  const planDeclaration = sourceDeclaration(
    fragment.sourcePlan
      ?? fragment.plan?.source
      ?? fragment.sourceReferences?.plan,
  )
  const fragmentPlanHash = declaredReferenceHash(
    planDeclaration,
    fragment.sourcePlanSha256,
    fragment.plan?.sha256,
  )
  if (!planDeclaration) {
    error(`${fragmentPath}: missing source-plan path`)
  } else {
    try {
      const referencedPlanPath = resolveDeclaredPath(
        fragmentPath,
        planDeclaration,
        `${fragmentPath}: sourcePlan`,
      )
      if (
        referencedPlanPath !== stagingPlanPath
        || fragmentPlanHash !== planSha256
      ) {
        error(`${fragmentPath}: source-plan path or sha256 mismatch`)
      }
    } catch (caught) {
      error(`${fragmentPath}: ${caught.message}`)
    }
  }

  const baseDeclaration = sourceDeclaration(
    fragment.baseCandidateManifest
      ?? fragment.baseManifest
      ?? fragment.baseReferences?.candidateManifest
      ?? fragment.base?.candidateManifest
      ?? fragment.baseLinkage?.baseCandidateManifest
      ?? fragment.baseLinkage?.candidateManifest
      ?? fragment.baseV4?.combinedManifest,
  )
  const fragmentBaseHash = declaredReferenceHash(
    baseDeclaration,
    fragment.baseCandidateManifestSha256,
    fragment.baseManifestSha256,
    fragment.baseLinkage?.baseCandidateManifestSha256,
    fragment.baseV4?.combinedManifestSha256,
  )
  if (!baseDeclaration) {
    error(`${fragmentPath}: missing v4 base-manifest linkage`)
  } else {
    try {
      const referencedBasePath = resolveDeclaredPath(
        fragmentPath,
        baseDeclaration,
        `${fragmentPath}: base manifest`,
      )
      if (
        referencedBasePath !== baseManifestPath
        || fragmentBaseHash !== baseManifestSha256
      ) {
        error(`${fragmentPath}: v4 base-manifest path or sha256 mismatch`)
      }
    } catch (caught) {
      error(`${fragmentPath}: ${caught.message}`)
    }
  }

  if (
    evidenceFlag(fragment, [
      'restrictedSourcePhotosRetained',
      'restrictedSourcePhotographsRetained',
      'restrictedSourcePhotoRetained',
    ])
  ) {
    error(`${fragmentPath}: restricted source photograph was retained`)
  }

  const fragmentScenes = fragmentSceneList(fragment)
  if (fragmentScenes.length === 0) {
    error(`${fragmentPath}: missing scene candidate array`)
  }
  const plannedVariantIds = new Set(
    plannedDestination.variants.map(({ id }) => id),
  )
  const unplannedActive = fragmentScenes.filter((scene) => (
    !sceneIsInactive(scene)
    && !plannedVariantIds.has(
      scene.variantId ?? scene.variant ?? scene.semanticVariant,
    )
  ))
  if (unplannedActive.length > 0) {
    error(`${fragmentPath}: contains unplanned active scene candidates`)
  }

  const selectedByVariant = new Map()
  for (const planned of plannedDestination.variants) {
    const candidates = []
    for (const scene of fragmentScenes.filter((candidate) => (
      (candidate.variantId
        ?? candidate.variant
        ?? candidate.semanticVariant) === planned.id
    ))) {
      try {
        const imageDeclaration = sourceDeclaration(
          scene.imageSrc ?? scene.image ?? scene.artifact,
        )
        if (!imageDeclaration) {
          throw new Error(`${planned.id}: missing imageSrc`)
        }
        const repoPath = resolveDeclaredPath(
          fragmentPath,
          imageDeclaration,
          `${plannedDestination.id}--${planned.id}: imageSrc`,
        )
        candidates.push({
          scene,
          imageDeclaration,
          repoPath,
          version: versionFromPath(repoPath),
        })
      } catch (caught) {
        error(`${fragmentPath}: ${caught.message}`)
      }
    }
    const activeCandidates = candidates.filter(({ scene }) => (
      !sceneIsInactive(scene)
    ))
    if (activeCandidates.length !== 1) {
      error(
        `${plannedDestination.id}--${planned.id}: expected exactly one active `
          + `candidate, got ${activeCandidates.length}`,
      )
      continue
    }

    const selected = activeCandidates[0]
    const {
      scene,
      imageDeclaration,
      repoPath,
      version,
    } = selected
    const semanticId = `${plannedDestination.id}--${planned.id}`
    const versionedId = `${semanticId}--${planned.version}`
    const expectedFilename = `scene--${versionedId}.png`
    const expectedPath = path.posix.join(
      path.posix.dirname(fragmentPath),
      expectedFilename,
    )
    const sceneId = scene.id ?? scene.sceneId ?? scene.candidateId
    const revisionId = scene.revisionId
      ?? scene.versionedId
      ?? scene.versionedSceneId
    if (
      version !== planned.version
      || scene.version !== planned.version
      || repoPath !== expectedPath
      || ![semanticId, versionedId].includes(sceneId)
      || (
        revisionId !== undefined
        && revisionId !== versionedId
      )
      || (
        scene.destinationId !== undefined
        && scene.destinationId !== plannedDestination.id
      )
    ) {
      error(`${versionedId}: image filename, version, or id mismatch`)
    }
    const action = scene.action
      ?? scene.selectionDecision?.action
      ?? scene.revision?.action
    const supersedes = scene.supersedes
      ?? scene.selectionDecision?.supersedes
      ?? scene.revision?.supersedes
      ?? null
    if (
      action !== planned.action
      || supersedes !== planned.supersedes
      || scene.status !== 'candidate'
      || scene.shippingEligible !== false
      || scene.hasCompanion !== false
      || Boolean(scene.companion)
    ) {
      error(`${versionedId}: action, supersedes, status, shipping, or Companion mismatch`)
    }
    if (!candidateImageIsCatFree(scene, fragment)) {
      error(`${versionedId}: source Scene lacks explicit Cat-free evidence`)
    } else {
      catFreeValidationCount += 1
    }

    const safeBounds = validateSafeBounds(
      scene.safeBounds
        ?? scene.production?.safeBounds
        ?? scene.placementIntent?.safeBounds,
      versionedId,
    )
    const portrait = portraitByPose.get(planned.portraitPose)
    const compositionSlot = normalizeCompositionSlot(
      scene.compositionSlot
        ?? scene.placementIntent?.compositionSlot
        ?? scene.placement?.slot,
      safeBounds,
      planned.portraitPose,
      portrait,
      versionedId,
    )
    const placementIntent = validatePlacementIntent(
      scene,
      planned,
      compositionSlot,
      versionedId,
    )
    if (placementIntent) perchValidationCount += 1
    const ambientLife = validateAmbientLife(
      scene,
      fragment,
      planned,
      versionedId,
    )
    if (
      planned.action === 'supersede-active-revision'
      && ambientLife
      && Object.values(ambientLife.qaEvidence).every(Boolean)
    ) {
      socialRevisionValidationCount += 1
    }

    let imageContents
    try {
      imageContents = await readContents(repoPath)
      const declaredSha256 = scene.sha256
        ?? imageDeclaration.sha256
        ?? scene.imageSha256
      if (
        typeof declaredSha256 !== 'string'
        || !/^[a-f0-9]{64}$/i.test(declaredSha256)
      ) {
        error(`${versionedId}: missing valid declared image sha256`)
      }
      await validateRgbScene(imageContents, versionedId, declaredSha256)
      if (
        scene.dimensions
        && (
          scene.dimensions.width !== 1200
          || scene.dimensions.height !== 900
          || (
            scene.dimensions.bitDepth !== undefined
            && scene.dimensions.bitDepth !== 8
          )
          || (
            scene.dimensions.format !== undefined
            && scene.dimensions.format.toLowerCase() !== 'png'
          )
        )
      ) {
        error(`${versionedId}: declared dimensions or format mismatch`)
      }
      sceneContentsById.set(versionedId, imageContents)
      activeV5ImagePaths.add(repoPath)
      imageValidationCount += 1
    } catch (caught) {
      error(`${versionedId}: ${caught.message}`)
      continue
    }

    const combinedScene = {
      id: versionedId,
      sourceCandidateId: semanticId,
      destinationId: plannedDestination.id,
      destinationName: plannedDestination.name,
      variantId: planned.id,
      version: planned.version,
      name: scene.name
        ?? `${plannedDestination.name} · ${planned.id}`,
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
      compositionSlot,
      safeBounds,
      placementIntent,
      ambientLife,
      hasCompanion: false,
      companion: null,
      supersedes: planned.supersedes,
      selectionDecision: {
        state: 'locked-for-human-review',
        basis: 'v5-staging-plan',
        activeRevision: planned.version,
        action: planned.action,
      },
      provenance: {
        summary: 'Generated as a Cat-free v5 staging candidate under the locked watercolor style and validated against explicit Ambient Life and physical Perch intent.',
        generationMethod: 'image-generation',
        generator: scene.provenance?.generator
          ?? scene.production?.generator
          ?? {
            tool: 'GenerateImage',
            model: 'not-exposed-by-tool',
            seed: 'not-exposed-by-tool',
          },
        source: scene.provenance ?? scene.production ?? null,
      },
      review: {
        decision: 'pending',
        humanVisualReview: 'pending',
        placementReview: 'pending',
        socialContextReview: planned.action === 'supersede-active-revision'
          ? 'pending'
          : 'not-applicable-or-pending',
        rightsReview: 'pending',
        finalRealPortraitCompositeReview: 'pending',
        reviewer: '',
        reviewedAt: null,
      },
      sourceFragment: fragmentPath,
      sourceFragmentSha256: fragmentSha256,
    }
    selectedByVariant.set(planned.id, combinedScene)
    selectedNewScenes.push(combinedScene)
    selectedNewSceneIds.add(versionedId)
  }

  if (selectedByVariant.size !== plannedDestination.variants.length) {
    error(`${plannedDestination.id}: active v5 variant coverage differs from plan`)
  }

  const sceneSheetDeclaration = withDeclaredHash(
    pickSheetDeclaration(fragment, 'scene'),
    fragment.sceneContactSheetSha256,
    fragment.contactSheetSha256,
    fragment.qa?.sceneContactSheetSha256,
    fragment.qa?.contactSheetSha256,
  )
  const placementSheetDeclaration = withDeclaredHash(
    pickSheetDeclaration(fragment, 'placement'),
    fragment.portraitPlacementPreviewSheetSha256,
    fragment.placementPreviewSheetSha256,
    fragment.placementPreviewSha256,
    fragment.qa?.portraitPlacementPreviewSheetSha256,
    fragment.qa?.placementPreviewSheetSha256,
    fragment.qa?.placementPreviewSha256,
  )
  const sceneSheet = await validateSheet(
    fragmentPath,
    sceneSheetDeclaration,
    'scene-contact-sheet',
    plannedDestination.id,
  )
  const placementSheet = await validateSheet(
    fragmentPath,
    placementSheetDeclaration,
    'minho-placement-preview-sheet',
    plannedDestination.id,
  )
  if (sceneSheet) {
    sceneSheetByDestinationId.set(plannedDestination.id, sceneSheet)
  }
  if (placementSheet) {
    const portraitHashes = new Set(
      plannedDestination.variants.map(({ portraitPose }) => (
        portraitByPose.get(portraitPose)?.sha256
      )).filter(Boolean),
    )
    if (
      !previewUsesApprovedMinho(
        fragment,
        placementSheetDeclaration,
        portraitHashes,
      )
    ) {
      error(
        `${placementSheet.path}: metadata must identify an actual approved `
          + 'Minho non-final placement preview',
      )
    }
    placementSheetByDestinationId.set(
      plannedDestination.id,
      placementSheet,
    )
  }

  for (const combinedScene of selectedByVariant.values()) {
    combinedScene.qaArtifacts = {
      sceneContactSheet: sceneSheet,
      minhoPlacementPreviewSheet: placementSheet,
      previewPolicy: {
        nonFinalQaOnly: true,
        sourceSceneRemainsCatFree: true,
        finalCompositeApprovalSatisfied: false,
      },
    }
  }

  const rejectedRecords = [
    ...recordArray(fragment.rejectedRevisions),
    ...recordArray(fragment.supersededRevisions),
    ...recordArray(fragment.retainedRejectedRevisions),
    ...recordArray(fragment.provenance?.regenerationAudit),
    ...recordArray(fragment.generationAudit),
    ...fragmentScenes.filter(sceneIsInactive),
    ...fragmentScenes
      .map((scene) => scene.production?.supersededRevision)
      .filter(Boolean),
  ]
  const fragmentRejectedPaths = new Set()
  for (const record of rejectedRecords) {
    const declaration = sourceDeclaration(
      record.imageSrc
        ?? record.image
        ?? record.artifact
        ?? record.path
        ?? record,
    )
    if (!declaration) continue
    try {
      const rejectedPath = resolveDeclaredPath(
        fragmentPath,
        declaration,
        `${fragmentPath}: rejected revision`,
      )
      if (activeV5ImagePaths.has(rejectedPath)) {
        error(`${rejectedPath}: active v5 image is also marked rejected`)
        continue
      }
      const baseScene = baseSceneByPath.get(rejectedPath)
      if (baseScene) {
        const declaredSha256 = declaration.sha256
          ?? record.sha256
          ?? record.supersededSha256
        if (
          declaredSha256
          && declaredSha256 !== baseScene.sha256
        ) {
          error(`${rejectedPath}: protected v4 supersession sha256 mismatch`)
        }
        continue
      }
      if (fragmentRejectedPaths.has(rejectedPath)) continue
      fragmentRejectedPaths.add(rejectedPath)
      rejectedV5Paths.add(rejectedPath)
      const contents = await readContents(rejectedPath)
      const expectedSha256 = declaration.sha256
        ?? record.sha256
        ?? record.supersededSha256
        ?? record.imageSha256
      if (!expectedSha256) {
        error(`${rejectedPath}: retained rejected revision lacks sha256`)
        continue
      }
      await validateRgbScene(contents, rejectedPath, expectedSha256)
    } catch (caught) {
      error(`${fragmentPath}: rejected revision ${caught.message}`)
    }
  }
  const declaredRejectedCounts = findValuesByKeys(fragment, [
    'rejectedRevisionCount',
    'retainedRejectedRevisionCount',
  ]).filter(Number.isInteger)
  if (
    declaredRejectedCounts.length > 0
    && declaredRejectedCounts.some((count) => count !== fragmentRejectedPaths.size)
  ) {
    error(
      `${fragmentPath}: declared rejected revision count differs from `
        + `${fragmentRejectedPaths.size} retained files`,
    )
  }

  const activeIds = [...destination.activeSceneVariantIds]
  for (const planned of plannedDestination.variants) {
    const selected = selectedByVariant.get(planned.id)
    if (!selected) continue
    if (planned.action === 'supersede-active-revision') {
      const oldIndex = activeIds.indexOf(planned.supersedes)
      if (oldIndex === -1) {
        error(`${planned.destinationId}: missing ${planned.supersedes} to supersede`)
      } else {
        activeIds[oldIndex] = selected.id
        sceneById.delete(planned.supersedes)
        replacedSceneIds.add(planned.supersedes)
      }
    } else if (planned.action === 'add-active-variant') {
      const semanticCollision = activeIds.some((sceneId) => {
        const activeScene = sceneById.get(sceneId)
        return activeScene?.variantId === planned.id
      })
      if (semanticCollision) {
        error(`${selected.sourceCandidateId}: active semantic ID collision`)
      }
      activeIds.push(selected.id)
    }
    if (sceneById.has(selected.id)) {
      error(`${selected.id}: duplicate active versioned ID`)
    }
    sceneById.set(selected.id, selected)
  }
  if (new Set(activeIds).size !== activeIds.length) {
    error(`${plannedDestination.id}: duplicate active IDs after v5 staging`)
  }
  destination.activeSceneVariantIds = activeIds
  destination.stagingV5 = {
    sourcePlan: stagingPlanPath,
    sourceFragment: fragmentPath,
    sourceFragmentSha256: fragmentSha256,
    qaArtifacts: {
      sceneContactSheet: sceneSheet,
      minhoPlacementPreviewSheet: placementSheet,
    },
  }

  newSourceFragments.push({
    path: fragmentPath,
    sha256: fragmentSha256,
  })
  const warning = [
    fragment.rights?.warning,
    fragment.rights?.notes,
    fragment.rights?.shippingWarnings,
    fragment.provenanceAndRights?.warnings,
    fragment.culturalReview?.warnings,
  ].flat().filter((value) => typeof value === 'string' && value.trim()).join(' ')
  newRightsWarnings.push({
    destinationId: plannedDestination.id,
    referenceUse: 'factual landmark, circulation, and Perch context only; no restricted source photograph retained',
    shippingGate: 'v5-rights-cultural-and-source-independence-review-required',
    warning: warning
      || 'Rights, cultural context, and source-independence review remain pending before shipping.',
  })
}

const allPlannedFragmentPaths = new Set(plan.destinations.map(({ id }) => (
  normalizeRepoPath(path.posix.join(
    plan.candidateOutputRoot,
    id,
    'manifest.fragment.json',
  ))
)))
if (
  fragmentPathSet.size !== 10
  || [...fragmentPathSet].some((fragmentPath) => (
    !allPlannedFragmentPaths.has(fragmentPath)
  ))
) {
  error('v5 fragment set differs from the exact ten planned destinations')
}

const unchangedActiveSceneCount = baseManifest.sceneVariants.length
  - replacedSceneIds.size
const newRevisionScenes = selectedNewScenes.filter(
  ({ selectionDecision }) => (
    selectionDecision.action === 'supersede-active-revision'
  ),
)
const newAdditionScenes = selectedNewScenes.filter(
  ({ selectionDecision }) => (
    selectionDecision.action === 'add-active-variant'
  ),
)
const actualFramingCounts = Object.fromEntries(
  ['foreground', 'midground', 'distant'].map((framing) => [
    framing,
    selectedNewScenes.filter(
      ({ placementIntent }) => placementIntent?.framing === framing,
    ).length,
  ]),
)
if (
  selectedNewScenes.length !== 15
  || replacedSceneIds.size !== 10
  || newRevisionScenes.length !== 10
  || newAdditionScenes.length !== 5
  || unchangedActiveSceneCount !== 61
  || imageValidationCount !== 15
  || catFreeValidationCount !== 15
  || perchValidationCount !== 15
  || socialRevisionValidationCount !== 10
  || JSON.stringify(actualFramingCounts) !== JSON.stringify(expectedFramingCounts)
  || sceneSheetByDestinationId.size !== 10
  || placementSheetByDestinationId.size !== 10
) {
  error('validated v5 replacements, additions, framing, evidence, or sheet coverage differs from the plan')
}

combinedManifest.schemaVersion = Math.max(3, baseManifest.schemaVersion)
combinedManifest.planId = 'miaoyouji-landmarks-combined-v5-2026-07-20'
combinedManifest.sourcePlans = [
  ...baseManifest.sourcePlans,
  {
    path: stagingPlanPath,
    planId: plan.planId,
    sha256: planSha256,
    destinationCount: plan.destinations.length,
  },
]
combinedManifest.integratedAt = generatedAt
combinedManifest.status = 'candidate'
combinedManifest.shippingEligible = false
combinedManifest.approvalState = 'pending-human-approval'
combinedManifest.review = {
  decision: 'pending',
  humanVisualReview: 'pending',
  placementReview: 'pending',
  socialContextReview: 'pending',
  rightsReview: 'pending',
  finalRealPortraitCompositeReview: 'pending',
  shippingApproval: 'pending',
  note: 'Sixty-one unchanged v4 active scenes remain. Ten v4 candidates are superseded by feedback revisions and five distant-overlook variants are added; all fifteen v5 candidates require exact-set approval.',
}
combinedManifest.sourceFragments = [
  ...baseManifest.sourceFragments,
  ...newSourceFragments,
]
combinedManifest.rightsAndProvenanceWarnings = [
  ...baseManifest.rightsAndProvenanceWarnings,
  ...newRightsWarnings,
]
combinedManifest.sceneVariants = combinedManifest.destinations.flatMap(
  ({ activeSceneVariantIds }) => activeSceneVariantIds.map(
    (sceneId) => sceneById.get(sceneId),
  ).filter(Boolean),
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
      + rejectedV5Paths.size,
  v5SupersededActiveRevisionCount: replacedSceneIds.size,
  v5RejectedRevisionFileCount: rejectedV5Paths.size,
}
combinedManifest.locks.variantPolicy = {
  ...baseManifest.locks.variantPolicy,
  stagingVariantIds: ['day-signature', 'night-transit', 'distant-overlook'],
  stagingDestinationIds: plan.destinations.map(({ id }) => id),
  distantOverlookDestinationIds: plannedAdditions.map(
    ({ destinationId }) => destinationId,
  ),
}
combinedManifest.locks.activeCandidateSelection = {
  ...baseManifest.locks.activeCandidateSelection,
  selectionRule: 'Preserve 61 unchanged v4 active scenes, replace the ten explicitly superseded v4 revisions, and append five v5 distant-overlook variants.',
  activeEntriesSelected: combinedManifest.sceneVariants.length,
  supersededEntriesExcluded: combinedManifest.totals.supersededSceneFileCount,
}

const allSceneIds = combinedManifest.sceneVariants.map(({ id }) => id)
const allSemanticIds = combinedManifest.sceneVariants.map(
  ({ destinationId, variantId }) => `${destinationId}--${variantId}`,
)
const activeIdsFromDestinations = combinedManifest.destinations.flatMap(
  ({ activeSceneVariantIds }) => activeSceneVariantIds,
)
if (
  combinedManifest.destinations.length !== 25
  || combinedManifest.sceneVariants.length !== 76
  || combinedManifest.totals.ordinaryVariantCount !== 65
  || combinedManifest.totals.companionRareVariantCount !== 11
  || new Set(allSceneIds).size !== 76
  || new Set(allSemanticIds).size !== 76
  || new Set(activeIdsFromDestinations).size !== 76
  || activeIdsFromDestinations.some((id) => !sceneById.has(id))
  || replacedSceneIds.size !== plannedRevisions.length
) {
  error('combined v5 active set is not the exact 25-destination/76-scene set')
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
const sourceFragmentSetSha256 = sha256(Buffer.from(
  combinedManifest.sourceFragments
    .map(({ path: sourcePath, sha256: sourceSha256 }) => (
      `${sourcePath}\t${sourceSha256}`
    ))
    .sort()
    .join('\n'),
))
combinedManifest.activeSet = {
  selection: 'all-active-scene-variants',
  destinationCount: 25,
  activeSceneVariantCount: 76,
  activeSceneSetSha256,
  activeSceneContentSetSha256,
}
combinedManifest.sourceSet = {
  sourceFragmentCount: combinedManifest.sourceFragments.length,
  sourceFragmentSetSha256,
}

for (const scene of combinedManifest.sceneVariants) {
  if (!sceneContentsById.has(scene.id)) {
    error(`${scene.id}: active Scene lacks a validated image snapshot`)
  }
}
for (const replacedId of replacedSceneIds) {
  const oldScene = baseSceneById.get(replacedId)
  try {
    const retainedContents = await readContents(oldScene.imageSrc)
    if (sha256(retainedContents) !== oldScene.sha256) {
      error(`${oldScene.imageSrc}: superseded v4 file was not retained byte-for-byte`)
    }
  } catch (caught) {
    error(`${replacedId}: retained superseded file ${caught.message}`)
  }
}

for (const [repoPath, initialSha256] of protectedSnapshots) {
  try {
    const current = await readContents(repoPath)
    if (sha256(current) !== initialSha256) {
      error(`${repoPath}: protected input changed during v5 integration`)
    }
  } catch (caught) {
    error(`${repoPath}: protected input ${caught.message}`)
  }
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
  (_, index) => path.posix.join(
    path.posix.dirname(outputManifestPath),
    `contact-sheet--landmarks--overview-v5-${String(index + 1).padStart(2, '0')}-of-${String(overviewSheetCount).padStart(2, '0')}--non-final.png`,
  ),
)

const placementOverviewColumns = 4
const placementOverviewRows = 4
const placementLabelHeight = 55
const placementTileHeight = overviewSceneHeight + placementLabelHeight
const placementSheetCount = Math.ceil(
  selectedNewScenes.length
    / (placementOverviewColumns * placementOverviewRows),
)
const placementOverviewPaths = Array.from(
  { length: placementSheetCount },
  (_, index) => path.posix.join(
    path.posix.dirname(outputManifestPath),
    `contact-sheet--landmarks--placement-preview-v5-${String(index + 1).padStart(2, '0')}-of-${String(placementSheetCount).padStart(2, '0')}--non-final.png`,
  ),
)

const generatedBinaryPaths = [
  ...overviewPaths,
  ...placementOverviewPaths,
]
const protectedPathSet = new Set(protectedSnapshots.keys())
if (
  new Set([...outputTextPaths, ...generatedBinaryPaths]).size
    !== outputTextPaths.length + generatedBinaryPaths.length
  || outputTextPaths.some((repoPath) => (
    protectedPathSet.has(repoPath)
    || fragmentPathSet.has(repoPath)
    || activeV5ImagePaths.has(repoPath)
  ))
  || generatedBinaryPaths.some((repoPath) => (
    protectedPathSet.has(repoPath)
    || fragmentPathSet.has(repoPath)
    || activeV5ImagePaths.has(repoPath)
  ))
) {
  error('v5 generated output path aliases a source or protected artifact')
}

throwIfErrors('landmark staging validation failed')

const makeSceneTile = async (scene, index) => {
  const sceneBuffer = await sharp(sceneContentsById.get(scene.id))
    .resize(overviewTileWidth, overviewSceneHeight, { fit: 'fill' })
    .png()
    .toBuffer()
  const label = `${String(index + 1).padStart(2, '0')} · ${scene.destinationName} · ${scene.variantId} ${scene.version}`
  const labelSvg = Buffer.from(`
    <svg width="${overviewTileWidth}" height="${overviewLabelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f7f0df"/>
      <text x="9" y="22" font-family="Arial, sans-serif" font-size="10" fill="#4e5144">${escapeXml(truncate(label, 48))}</text>
    </svg>
  `)
  return sharp({
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
    .toBuffer()
}

const makePlacementTile = async (scene, index) => {
  const slot = scene.compositionSlot
  const portraitSource = portraitContentsByPose.get(slot.pose)
  const sceneBuffer = await sharp(sceneContentsById.get(scene.id))
    .resize(overviewTileWidth, overviewSceneHeight, { fit: 'fill' })
    .png()
    .toBuffer()
  const portraitHeight = Math.max(
    1,
    Math.round(slot.scale * overviewSceneHeight),
  )
  let portraitImage = sharp(portraitSource).resize({
    height: portraitHeight,
    fit: 'inside',
    withoutEnlargement: true,
  })
  if (slot.flip) portraitImage = portraitImage.flop()
  const portraitBuffer = await portraitImage.png().toBuffer()
  const portraitMetadata = await sharp(portraitBuffer).metadata()
  const portraitWidth = portraitMetadata.width ?? portraitHeight
  const left = Math.round(
    slot.x * overviewTileWidth - portraitWidth / 2,
  )
  const top = Math.round(
    slot.y * overviewSceneHeight - portraitHeight,
  )
  if (
    left < 0
    || top < 0
    || left + portraitWidth > overviewTileWidth
    || top + portraitHeight > overviewSceneHeight
  ) {
    throw new Error(`${scene.id}: exact Portrait slot leaves placement tile`)
  }
  const compositeScene = await sharp(sceneBuffer)
    .composite([{
      input: portraitBuffer,
      left,
      top,
    }])
    .png()
    .toBuffer()
  const support = textFromEvidence(
    scene.placementIntent.physicalSupport,
  ) || scene.placementIntent.plannedPerch
  const labelSvg = Buffer.from(`
    <svg width="${overviewTileWidth}" height="${placementLabelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f7f0df"/>
      <text x="9" y="14" font-family="Arial, sans-serif" font-size="9" fill="#4e5144">${escapeXml(`${String(index + 1).padStart(2, '0')} · ${truncate(scene.destinationName, 18)} · ${scene.variantId} ${scene.version}`)}</text>
      <text x="9" y="30" font-family="Arial, sans-serif" font-size="9" fill="#64675b">${escapeXml(`${scene.placementIntent.framing} · scale ${slot.scale.toFixed(3)} · ${slot.pose}${slot.flip ? ' flip' : ''}`)}</text>
      <text x="9" y="46" font-family="Arial, sans-serif" font-size="8" fill="#78796c">${escapeXml(`support: ${truncate(support, 48)}`)}</text>
    </svg>
  `)
  return sharp({
    create: {
      width: overviewTileWidth,
      height: placementTileHeight,
      channels: 3,
      background: '#f7f0df',
    },
  })
    .composite([
      { input: compositeScene, left: 0, top: 0 },
      { input: labelSvg, left: 0, top: overviewSceneHeight },
    ])
    .png()
    .toBuffer()
}

const renderSheet = async ({
  scenes,
  startIndex,
  columns,
  rows,
  tileHeight,
  tileFactory,
}) => {
  const tiles = []
  for (const [tileIndex, scene] of scenes.entries()) {
    tiles.push(await tileFactory(scene, startIndex + tileIndex))
  }
  return sharp({
    create: {
      width: columns * overviewTileWidth,
      height: rows * tileHeight,
      channels: 3,
      background: '#e7dfcc',
    },
  })
    .composite(tiles.map((input, tileIndex) => ({
      input,
      left: (tileIndex % columns) * overviewTileWidth,
      top: Math.floor(tileIndex / columns) * tileHeight,
    })))
    .png()
    .toBuffer()
}

const generatedBinaries = []
const overviewSheets = []
for (let sheetIndex = 0; sheetIndex < overviewSheetCount; sheetIndex += 1) {
  const start = sheetIndex * overviewScenesPerSheet
  const scenes = combinedManifest.sceneVariants.slice(
    start,
    start + overviewScenesPerSheet,
  )
  const buffer = await renderSheet({
    scenes,
    startIndex: start,
    columns: overviewColumns,
    rows: overviewRows,
    tileHeight: overviewTileHeight,
    tileFactory: makeSceneTile,
  })
  const repoPath = overviewPaths[sheetIndex]
  generatedBinaries.push({ repoPath, buffer })
  overviewSheets.push({
    kind: 'combined-scene-only-overview',
    path: repoPath,
    sha256: sha256(buffer),
    width: overviewColumns * overviewTileWidth,
    height: overviewRows * overviewTileHeight,
    sceneCount: scenes.length,
    sceneIds: scenes.map(({ id }) => id),
  })
}

const placementPreviewOverviewSheets = []
const placementScenesPerSheet = placementOverviewColumns
  * placementOverviewRows
for (let sheetIndex = 0; sheetIndex < placementSheetCount; sheetIndex += 1) {
  const start = sheetIndex * placementScenesPerSheet
  const scenes = selectedNewScenes.slice(
    start,
    start + placementScenesPerSheet,
  )
  const buffer = await renderSheet({
    scenes,
    startIndex: start,
    columns: placementOverviewColumns,
    rows: placementOverviewRows,
    tileHeight: placementTileHeight,
    tileFactory: makePlacementTile,
  })
  const repoPath = placementOverviewPaths[sheetIndex]
  generatedBinaries.push({ repoPath, buffer })
  placementPreviewOverviewSheets.push({
    kind: 'combined-minho-placement-preview-overview',
    path: repoPath,
    sha256: sha256(buffer),
    width: placementOverviewColumns * overviewTileWidth,
    height: placementOverviewRows * placementTileHeight,
    sceneCount: scenes.length,
    sceneIds: scenes.map(({ id }) => id),
    portraitId: archive.portrait.id,
    nonFinalQaOnly: true,
    sourceScenesRemainCatFree: true,
  })
}

combinedManifest.stagingV5 = {
  sourcePlan: stagingPlanPath,
  sourcePlanSha256: planSha256,
  baseManifest: baseManifestPath,
  baseManifestSha256,
  unchangedActiveSceneCount,
  supersededActiveRevisionCount: replacedSceneIds.size,
  addedActiveVariantCount: newAdditionScenes.length,
  rejectedRevisionFileCount: rejectedV5Paths.size,
  exactSetApprovalRequiredSceneIds: selectedNewScenes.map(({ id }) => id),
  framingDistribution: actualFramingCounts,
  destinationArtifacts: plan.destinations.map(({ id }) => {
    const destination = destinationById.get(id)
    return {
      destinationId: id,
      sourceFragment: destination.stagingV5.sourceFragment,
      sourceFragmentSha256: destination.stagingV5.sourceFragmentSha256,
      sceneContactSheet: destination.stagingV5.qaArtifacts.sceneContactSheet,
      minhoPlacementPreviewSheet:
        destination.stagingV5.qaArtifacts.minhoPlacementPreviewSheet,
    }
  }),
  overviewSheets,
  placementPreviewOverviewSheets,
  previewPolicy: {
    approvedPortraitId: archive.portrait.id,
    nonFinalQaOnly: true,
    sourceScenesRemainCatFree: true,
    finalCompositeApprovalSatisfied: false,
  },
}

const manifestContents = `${JSON.stringify(combinedManifest, null, 2)}\n`
const manifestSha256 = sha256(Buffer.from(manifestContents))
const protectedV4ArtifactCount = protectedV4Paths.size

const machineChecks = [
  {
    id: 'protected-v4-integrity',
    status: 'pass',
    expected: protectedV4ArtifactCount,
    actual: protectedV4ArtifactCount,
    activeSceneSetSha256: recomputedBaseIdHash,
    activeSceneContentSetSha256: recomputedBaseContentHash,
  },
  {
    id: 'exact-plan-and-fragment-coverage',
    status: 'pass',
    expected: {
      destinations: 10,
      fragments: 10,
      candidates: 15,
    },
    actual: {
      destinations: plan.destinations.length,
      fragments: newSourceFragments.length,
      candidates: selectedNewScenes.length,
    },
  },
  {
    id: 'exact-active-total-and-unchanged-scope',
    status: 'pass',
    expected: {
      destinations: 25,
      activeScenes: 76,
      unchangedScenes: 61,
    },
    actual: {
      destinations: combinedManifest.destinations.length,
      activeScenes: combinedManifest.sceneVariants.length,
      unchangedScenes: unchangedActiveSceneCount,
    },
  },
  {
    id: 'exact-replacements-and-additions',
    status: 'pass',
    expected: {
      supersedingRevisions: 10,
      newDistantOverlooks: 5,
    },
    actual: {
      supersedingRevisions: newRevisionScenes.length,
      newDistantOverlooks: newAdditionScenes.length,
    },
  },
  {
    id: 'foreground-midground-distant-distribution',
    status: 'pass',
    expected: expectedFramingCounts,
    actual: actualFramingCounts,
  },
  {
    id: 'ambient-life-natural-distribution-evidence',
    status: 'pass',
    expected: 10,
    actual: socialRevisionValidationCount,
  },
  {
    id: 'physical-perch-and-placement-evidence',
    status: 'pass',
    expected: 15,
    actual: perchValidationCount,
  },
  {
    id: 'new-image-filename-format-hash-and-cat-free-policy',
    status: 'pass',
    expected: 15,
    actual: imageValidationCount,
  },
  {
    id: 'all-active-images-and-hashes',
    status: 'pass',
    expected: 76,
    actual: combinedManifest.sceneVariants.filter(
      ({ id }) => sceneContentsById.has(id),
    ).length,
  },
  {
    id: 'destination-scene-and-minho-preview-sheets',
    status: 'pass',
    expected: {
      sceneContactSheets: 10,
      placementPreviewSheets: 10,
    },
    actual: {
      sceneContactSheets: sceneSheetByDestinationId.size,
      placementPreviewSheets: placementSheetByDestinationId.size,
    },
  },
  {
    id: 'combined-overview-coverage',
    status: 'pass',
    expected: {
      sceneOnlyCandidates: 76,
      placementPreviewCandidates: 15,
    },
    actual: {
      sceneOnlyCandidates: overviewSheets.reduce(
        (count, sheet) => count + sheet.sceneCount,
        0,
      ),
      placementPreviewCandidates: placementPreviewOverviewSheets.reduce(
        (count, sheet) => count + sheet.sceneCount,
        0,
      ),
    },
  },
  {
    id: 'active-source-and-content-set-hashes',
    status: 'pass',
    expected: {
      sourceFragmentCount: combinedManifest.sourceFragments.length,
      activeSceneCount: 76,
    },
    actual: {
      sourceFragmentCount: combinedManifest.sourceSet.sourceFragmentCount,
      activeSceneCount: combinedManifest.activeSet.activeSceneVariantCount,
    },
    hashes: {
      sourceFragmentSetSha256,
      activeSceneSetSha256,
      activeSceneContentSetSha256,
    },
  },
  {
    id: 'dynamic-superseded-and-rejected-counts',
    status: 'pass',
    expected: {
      baseSuperseded: baseManifest.totals.supersededSceneFileCount,
      v5Superseded: 10,
      v5Rejected: rejectedV5Paths.size,
      totalSuperseded:
        baseManifest.totals.supersededSceneFileCount
          + 10
          + rejectedV5Paths.size,
    },
    actual: {
      totalSuperseded: combinedManifest.totals.supersededSceneFileCount,
      v5Superseded:
        combinedManifest.totals.v5SupersededActiveRevisionCount,
      v5Rejected: combinedManifest.totals.v5RejectedRevisionFileCount,
    },
  },
  {
    id: 'shipping-disabled-and-human-gates-pending',
    status: 'pass',
    expected: false,
    actual: combinedManifest.shippingEligible,
  },
]

const qa = {
  schemaVersion: 5,
  reportKind: 'landmark-staging-integration-qa',
  planId: combinedManifest.planId,
  sourcePlan: stagingPlanPath,
  sourceManifest: outputManifestPath,
  sourceManifestSha256: manifestSha256,
  generatedAt,
  overallStatus: 'pass',
  shippingEligible: false,
  activeSet: combinedManifest.activeSet,
  sourceSet: combinedManifest.sourceSet,
  totals: {
    ...combinedManifest.totals,
    unchangedActiveSceneCount,
    generatedCandidateCount: selectedNewScenes.length,
    activeSupersedingRevisionCount: newRevisionScenes.length,
    newDistantOverlookCount: newAdditionScenes.length,
    machineCheckCount: machineChecks.length,
    machineChecksPassed: machineChecks.length,
    machineChecksFailed: 0,
    pendingHumanCheckCount: 3,
  },
  framingDistribution: actualFramingCounts,
  machineChecks,
  pendingHumanChecks: [
    {
      id: 'v5-exact-set-visual-and-placement-review',
      status: 'pending',
      note: 'Review all fifteen v5 candidates, physical Perches, framing, scale, natural Ambient Life, and actual Minho placement previews as one exact active-set change.',
    },
    {
      id: 'v5-rights-cultural-and-source-independence-review',
      status: 'pending',
      note: 'Rights, cultural context, site access, protected surfaces, trademark or livery details, and source independence remain separate human gates.',
    },
    {
      id: 'v5-final-composite-and-shipping-approval',
      status: 'blocked-until-exact-set-approval',
      note: 'The placement previews are non-final QA only. Final real-Portrait composites and shipping approval remain pending.',
    },
  ],
  protectedInputs: {
    baseManifest: {
      path: baseManifestPath,
      sha256: baseManifestSha256,
    },
    baseQa: {
      path: baseQaPath,
      sha256: sha256(baseQaContents),
    },
    baseReviewIndex: {
      path: baseReviewIndexPath,
      sha256: sha256(baseReviewContents),
    },
    stagingPlan: {
      path: stagingPlanPath,
      sha256: planSha256,
    },
    approvedPortraitArchive: {
      path: archivePath,
      sha256: sha256(archiveContents),
      portraitId: archive.portrait.id,
    },
  },
  destinationArtifacts: combinedManifest.stagingV5.destinationArtifacts,
  overviewSheets,
  placementPreviewOverviewSheets,
  errors: [],
}
const qaContents = `${JSON.stringify(qa, null, 2)}\n`

const reviewDirectory = path.posix.dirname(outputReviewIndexPath)
const relative = (repoPath) => path.posix.relative(reviewDirectory, repoPath)
const reviewLines = [
  '# Landmark candidate review index v5',
  '',
  'The exact 76-scene v5 active set is non-shipping and pending human approval. 61 unchanged active scenes remain, 10 v4 candidates are superseded by feedback revisions, and 5 new distant-overlook variants are added.',
  '',
  'All 15 v5 candidates need exact-set approval. Superseded v4 files remain retained but are not active.',
  '',
  `- [Staging plan](${relative(stagingPlanPath)})`,
  `- [Combined candidate manifest](${relative(outputManifestPath)})`,
  `- [Machine QA report](${relative(outputQaPath)})`,
  `- Active-set ID hash: \`${activeSceneSetSha256}\``,
  `- Active-set content hash: \`${activeSceneContentSetSha256}\``,
  `- Source-fragment set hash: \`${sourceFragmentSetSha256}\``,
  '',
  '## Combined scene-only overview sheets',
  '',
  ...combinedManifest.stagingV5.overviewSheets.map((sheet, index) => (
    `${index + 1}. [Scene overview ${String(index + 1).padStart(2, '0')} of ${String(combinedManifest.stagingV5.overviewSheets.length).padStart(2, '0')}](${relative(sheet.path)}) — ${sheet.sceneCount} candidates`
  )),
  '',
  '## Combined Minho placement-preview overview sheets',
  '',
  ...combinedManifest.stagingV5.placementPreviewOverviewSheets.map(
    (sheet, index) => (
      `${index + 1}. [Placement preview ${String(index + 1).padStart(2, '0')} of ${String(combinedManifest.stagingV5.placementPreviewOverviewSheets.length).padStart(2, '0')}](${relative(sheet.path)}) — ${sheet.sceneCount} v5 candidates`
    ),
  ),
  '',
  'These Minho placement previews use the approved Portrait pose and exact composition slot. They are non-final QA artifacts and do not alter the Cat-free Scene files.',
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
        + ` · ${selectedNewSceneIds.has(scene.id) ? 'pending v5 exact-set review' : 'unchanged active v4 scene'}]`
        + `(${relative(scene.imageSrc)})`,
    )
  }
  const stagingMetadata = destination.stagingV5
  if (stagingMetadata) {
    const sceneSheet = stagingMetadata.qaArtifacts.sceneContactSheet
    const placementSheet =
      stagingMetadata.qaArtifacts.minhoPlacementPreviewSheet
    reviewLines.push(
      `   - [v5 Scene contact sheet](${relative(sceneSheet.path)})`,
      `   - [v5 actual Minho placement sheet](${relative(placementSheet.path)})`,
    )
  }
})

reviewLines.push(
  '',
  '## V5 destination QA sheets',
  '',
)
combinedManifest.stagingV5.destinationArtifacts.forEach(
  (artifact, index) => {
    const destination = destinationById.get(artifact.destinationId)
    reviewLines.push(
      `${index + 1}. **${destination.name}** — `
        + `[Scene contact sheet](${relative(artifact.sceneContactSheet.path)}) · `
        + `[actual Minho placement sheet](${relative(artifact.minhoPlacementPreviewSheet.path)})`,
    )
  },
)
reviewLines.push(
  '',
  '## Required decisions',
  '',
  '- Approve or reject all 15 v5 candidates as one exact active-set change.',
  '- Verify the 3 foreground, 4 midground, and 8 distant placements have believable scale, support, access, pose fit, and clear silhouettes.',
  '- Verify all 10 social revisions use natural grouping, depth and direction variation, irregular spacing, distinct silhouettes, and keep Ambient Life outside safeBounds.',
  '- Nature distant-overlook scenes may mark Ambient Life not applicable, but their Perches must still be physically plausible and safely accessible.',
  '- Existing approvals and v4 machine QA do not approve the 10 feedback revisions or 5 additions.',
  '- Rights/cultural review, final real-Portrait composite review, and shipping approval remain pending.',
  '',
)
const reviewContents = `${reviewLines.join('\n')}\n`

for (const { repoPath, buffer } of generatedBinaries) {
  await writeOrCheckBinary(repoPath, buffer)
}
await writeOrCheckText(outputManifestPath, manifestContents)
await writeOrCheckText(outputQaPath, qaContents)
await writeOrCheckText(outputReviewIndexPath, reviewContents)

console.log(
  `landmark staging ${checkOnly ? 'verified' : 'integrated'}: `
    + `${combinedManifest.totals.destinationCount} destinations, `
    + `${combinedManifest.totals.activeSceneVariantCount} active scenes, `
    + `${selectedNewScenes.length} v5 candidates`,
)
