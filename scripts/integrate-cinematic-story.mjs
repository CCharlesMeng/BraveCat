import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const unsupportedArgs = args.filter((argument) => argument !== '--check')
if (unsupportedArgs.length > 0) {
  throw new Error(`unsupported argument(s): ${unsupportedArgs.join(', ')}`)
}

const generatedAt = '2026-07-21'
const runCommand = 'npm run story:integrate-cinematic'
const storyRoot = 'docs/story/cinematic-journey-v1'
const outlinePath = `${storyRoot}/series-outline.json`
const characterReferencesPath =
  `${storyRoot}/assets/references/characters/manifest.references.json`
const propReferencesPath =
  `${storyRoot}/assets/references/props/manifest.references.json`
const portraitArchivePath = 'docs/art/archive/asset-archive.v2.json'
const chapterPaths = Array.from({ length: 10 }, (_, index) => (
  `${storyRoot}/chapters/chapter-${String(index + 1).padStart(2, '0')}.json`
))
const fragmentPaths = Array.from({ length: 10 }, (_, index) => (
  `${storyRoot}/assets/scenes/chapter-${String(index + 1).padStart(2, '0')}`
    + '/manifest.fragment.json'
))
const outputManifestPath = `${storyRoot}/manifest.candidates.json`
const outputQaPath = `${storyRoot}/qa-report.json`
const outputReviewIndexPath = `${storyRoot}/review-index.md`
const sceneOverviewPaths = Array.from({ length: 5 }, (_, index) => (
  `${storyRoot}/contact-sheet--cinematic-scenes--overview-`
    + `${String(index + 1).padStart(2, '0')}-of-05--non-final.png`
))
const previewOverviewPaths = Array.from({ length: 5 }, (_, index) => (
  `${storyRoot}/contact-sheet--cinematic-minho-effect-preview--overview-`
    + `${String(index + 1).padStart(2, '0')}-of-05--non-final.png`
))
const storyMapPath =
  `${storyRoot}/contact-sheet--cinematic-story-map--50-scenes--non-final.png`

const expectedCharacterReferenceFiles = [
  'character-reference--a-yao--v01.png',
  'character-reference--zhou-an--v01.png',
  'character-reference--lin-deng--v01.png',
  'character-reference--ensemble-scale--v01.png',
]
const expectedPropReferenceFiles = [
  'prop-reference--traveling-cinema-van--v01.png',
  'prop-reference--projector-and-film-kit--v01.png',
  'environment-reference--old-cinema-kit--v01.png',
  'mood-reference--ten-chapter-palette--v01.png',
]
const framingRanges = {
  foreground: { min: 8, max: 10 },
  midground: { min: 20, max: 24 },
  distant: { min: 18, max: 22 },
}
const defaultScaleBands = {
  foreground: { min: 0.18, max: 0.28 },
  midground: { min: 0.1, max: 0.17 },
  distant: { min: 0.055, max: 0.095 },
}
const poses = ['sit', 'sleep', 'walk', 'eat', 'play', 'gaze']
const rootPrefixes = ['docs/', 'public/', 'scripts/', 'src/']

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
const readJsonRecord = async (repoPath) => {
  const contents = await readContents(repoPath)
  return {
    path: repoPath,
    contents,
    sha256: sha256(contents),
    value: JSON.parse(contents.toString('utf8')),
  }
}
const writeOrCheck = async (repoPath, contents, encoding = null) => {
  if (checkOnly) {
    let current
    try {
      current = await readFile(absolute(repoPath), encoding ?? undefined)
    } catch {
      throw new Error(`${repoPath} is missing; run ${runCommand}`)
    }
    const equal = encoding
      ? current === contents
      : sha256(current) === sha256(contents)
    if (!equal) throw new Error(`${repoPath} is stale; run ${runCommand}`)
    return
  }
  await mkdir(path.dirname(absolute(repoPath)), { recursive: true })
  await writeFile(absolute(repoPath), contents)
}

const isObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)
const asArray = (value) => {
  if (Array.isArray(value)) return value
  return isObject(value) ? Object.values(value) : []
}
const normalizeKey = (value) => String(value)
  .toLowerCase()
  .replaceAll(/[^a-z0-9\u3400-\u9fff]/g, '')
const atPath = (value, keys) => {
  let current = value
  for (const key of keys) {
    if (!isObject(current) && !Array.isArray(current)) return undefined
    current = current[key]
  }
  return current
}
const firstDefined = (value, paths) => {
  for (const candidate of paths) {
    const result = atPath(
      value,
      Array.isArray(candidate) ? candidate : [candidate],
    )
    if (result !== undefined && result !== null) return result
  }
  return undefined
}
const isSubstantive = (value) => {
  if (typeof value === 'string') return value.trim().length >= 2
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.length > 0
  return isObject(value) && Object.keys(value).length > 0
}
const collectEntries = (value, keySet, depth = 0, result = []) => {
  if (depth > 10) return result
  if (Array.isArray(value)) {
    value.forEach((child) => collectEntries(child, keySet, depth + 1, result))
  } else if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (keySet.has(normalizeKey(key))) result.push({ key, value: child })
      if (isObject(child) || Array.isArray(child)) {
        collectEntries(child, keySet, depth + 1, result)
      }
    }
  }
  return result
}
const valuesByKeys = (value, keys) => collectEntries(
  value,
  new Set(keys.map(normalizeKey)),
).map((entry) => entry.value)
const allStrings = (value, depth = 0, result = []) => {
  if (depth > 10) return result
  if (typeof value === 'string') result.push(value)
  else if (Array.isArray(value)) {
    value.forEach((child) => allStrings(child, depth + 1, result))
  } else if (isObject(value)) {
    Object.values(value).forEach(
      (child) => allStrings(child, depth + 1, result),
    )
  }
  return result
}
const collectObjects = (value, depth = 0, result = []) => {
  if (depth > 10) return result
  if (Array.isArray(value)) {
    value.forEach((child) => collectObjects(child, depth + 1, result))
  } else if (isObject(value)) {
    result.push(value)
    Object.values(value).forEach(
      (child) => collectObjects(child, depth + 1, result),
    )
  }
  return result
}

const affirmative = (value) => {
  if (value === true) return true
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase()
    return ['true', 'yes', 'pass', 'passed', 'original-only', '原创']
      .includes(text) || text.startsWith('pass-')
  }
  return isObject(value) && [
    value.status,
    value.result,
    value.decision,
    value.value,
    value.verified,
  ].some(affirmative)
}
const negative = (value) => {
  if (value === false) return true
  if (typeof value === 'string') {
    return [
      'false',
      'no',
      'none',
      'absent',
      'not-present',
      'non-shipping',
      'not-eligible',
    ].includes(value.trim().toLowerCase())
  }
  return isObject(value) && (
    value.present === false
    || value.value === false
    || value.allowed === false
  )
}
const originalityInverseKeys = [
  'existingWorkReferences',
  'specificWorkImitation',
  'imitatesExistingWork',
  'copiedProtectableExpression',
  'actorLikeness',
  'restrictedSourcePhotosRetained',
  'sourcePixelsCopied',
]
const hasOriginalDeclaration = (scope) => (
  valuesByKeys(scope, [
    'originalOnly',
    'entirelyOriginal',
    'whollyOriginal',
    'originalExpression',
  ]).some(affirmative)
  || valuesByKeys(scope, originalityInverseKeys).some(negative)
  || collectEntries(scope, new Set([
    'originality',
    'originalitystatement',
    'originalitydeclaration',
    'originalityrestrictions',
    'originalityandrights',
    'rightsandoriginality',
  ])).some(({ value }) => /original|原创/i.test(JSON.stringify(value)))
)
const originalityContradiction = (scope) => (
  valuesByKeys(scope, originalityInverseKeys).some(affirmative)
  || valuesByKeys(scope, [
    'originalOnly',
    'entirelyOriginal',
    'whollyOriginal',
  ]).some(negative)
)
const shippingValues = (scope) => isObject(scope)
  ? [
      scope.shippingEligible,
      scope.shipping,
      scope.eligibleForShipping,
      scope.candidatePolicy?.shippingEligible,
      scope.policy?.shippingEligible,
    ].filter((value) => value !== undefined)
  : []
const explicitlyNonShipping = (scope) => (
  shippingValues(scope).some(negative)
  || [scope?.status, scope?.approvalState].some((value) => (
    typeof value === 'string' && /non-shipping|candidate/i.test(value)
  ))
)
const shippingContradiction = (scope) => shippingValues(scope).some(affirmative)

const inspectPng = (contents, label) => {
  if (
    contents.length < 26
    || contents.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
  ) throw new Error(`${label}: not a PNG`)
  return {
    width: contents.readUInt32BE(16),
    height: contents.readUInt32BE(20),
    bitDepth: contents[24],
    colorType: contents[25],
  }
}
const validateRgbScene = async (contents, label, expectedHash = null) => {
  const png = inspectPng(contents, label)
  const metadata = await sharp(contents).metadata()
  if (
    png.width !== 1200
    || png.height !== 900
    || png.bitDepth !== 8
    || png.colorType !== 2
    || metadata.format !== 'png'
    || metadata.channels !== 3
    || metadata.hasAlpha !== false
    || metadata.space !== 'srgb'
  ) {
    throw new Error(`${label}: expected 1200x900 8-bit opaque RGB sRGB PNG`)
  }
  const actualHash = sha256(contents)
  if (expectedHash && actualHash !== expectedHash) {
    throw new Error(`${label}: declared sha256 does not match file bytes`)
  }
  return actualHash
}

const sourceDeclaration = (value, seen = new Set()) => {
  if (typeof value === 'string') {
    return {
      path: value,
      repoRelative: rootPrefixes.some((prefix) => value.startsWith(prefix)),
      sha256: null,
      raw: value,
    }
  }
  if (!isObject(value) || seen.has(value)) return null
  seen.add(value)
  const declaredHash = value.sha256
    ?? value.hash
    ?? value.contentSha256
    ?? value.fileSha256
    ?? value.imageSha256
    ?? value.masterSha256
    ?? null
  for (const key of [
    'repoPath',
    'path',
    'imageSrc',
    'src',
    'file',
    'filename',
    'outputPath',
  ]) {
    if (typeof value[key] === 'string' && value[key].trim()) {
      return {
        path: value[key],
        repoRelative: key === 'repoPath'
          || rootPrefixes.some((prefix) => value[key].startsWith(prefix)),
        sha256: declaredHash,
        raw: value,
      }
    }
  }
  for (const key of [
    'master',
    'sceneMaster',
    'image',
    'artifact',
    'source',
    'output',
    'document',
  ]) {
    const nested = sourceDeclaration(value[key], seen)
    if (nested) {
      return {
        ...nested,
        sha256: nested.sha256 ?? declaredHash,
        raw: value,
      }
    }
  }
  return null
}
const resolveDeclaredPath = (basePath, declaration, label) => {
  if (!declaration || typeof declaration.path !== 'string') {
    throw new Error(`${label}: expected a file declaration`)
  }
  const declaredPath = declaration.path.replaceAll('\\', '/').replace(/^\.\/+/, '')
  if (
    declaration.repoRelative
    || rootPrefixes.some((prefix) => declaredPath.startsWith(prefix))
  ) return normalizeRepoPath(declaredPath, label)
  return normalizeRepoPath(
    path.posix.join(path.posix.dirname(basePath), declaredPath),
    label,
  )
}
const collectFileDeclarations = (value, depth = 0, result = []) => {
  if (depth > 10) return result
  if (Array.isArray(value)) {
    value.forEach((child) => collectFileDeclarations(child, depth + 1, result))
    return result
  }
  if (!isObject(value)) return result
  const objectHash = value.sha256
    ?? value.hash
    ?? value.contentSha256
    ?? value.fileSha256
    ?? value.imageSha256
    ?? value.masterSha256
    ?? null
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key)
    if (
      typeof child === 'string'
      && (
        ['repopath', 'path', 'imagesrc', 'src', 'file', 'filename']
          .includes(normalizedKey)
        || (
          /\.(json|png|md)$/i.test(child)
          && /(source|manifest|chapter|outline|reference|master|artifact)/
            .test(normalizedKey)
        )
      )
    ) {
      result.push({
        path: child,
        repoRelative: normalizedKey === 'repopath'
          || rootPrefixes.some((prefix) => child.startsWith(prefix)),
        sha256: objectHash,
        raw: value,
      })
    }
    if (isObject(child) || Array.isArray(child)) {
      collectFileDeclarations(child, depth + 1, result)
    }
  }
  return result
}

const sceneListFrom = (scope) => {
  for (const candidate of [
    scope?.scenes,
    scope?.sceneScripts,
    scope?.storyScenes,
    scope?.sceneMasters,
    scope?.sceneAssets,
    scope?.sceneVariants,
    scope?.masters,
    scope?.candidates,
  ]) {
    if (asArray(candidate).length > 0) return asArray(candidate)
  }
  for (const candidate of valuesByKeys(scope, [
    'scenes',
    'sceneScripts',
    'storyScenes',
    'sceneMasters',
    'sceneAssets',
    'sceneVariants',
    'masters',
    'candidates',
  ])) {
    const list = asArray(candidate)
    if (list.some((item) => /last-light--c\d{2}-s\d{2}/.test(
      JSON.stringify(item),
    ))) return list
  }
  return []
}
const chapterListFrom = (outline) => {
  for (const candidate of [
    outline?.chapters,
    outline?.series?.chapters,
    outline?.outline?.chapters,
    outline?.story?.chapters,
  ]) {
    if (asArray(candidate).length > 0) return asArray(candidate)
  }
  return []
}
const chapterNumberFrom = (scope, fallback) => {
  const direct = firstDefined(scope, [
    'chapterNumber',
    ['chapter', 'number'],
    ['chapter', 'index'],
    'number',
    'index',
  ])
  if (Number.isInteger(direct)) return direct
  const id = String(firstDefined(scope, [
    'chapterId',
    ['chapter', 'id'],
    'id',
  ]) ?? '')
  const match = id.match(/(?:chapter-|--c)(\d{2})/)
  return match ? Number(match[1]) : fallback
}
const recordSceneId = (record) => String(
  record?.scriptId
    ?? record?.sourceSceneId
    ?? record?.sceneId
    ?? record?.id
    ?? '',
)
const isInactive = (record) => (
  [
    record?.status,
    record?.review?.decision,
    record?.selectionDecision?.state,
    record?.selection?.state,
  ].some((value) => (
    typeof value === 'string'
    && /rejected|superseded|inactive/.test(value.toLowerCase())
  ))
  || record?.active === false
  || record?.selected === false
  || record?.candidate === false
  || record?.rejected === true
  || record?.superseded === true
)

const normalizeFraming = (value) => {
  const normalized = normalizeKey(
    isObject(value)
      ? value.id ?? value.band ?? value.value ?? value.name ?? ''
      : value,
  )
  if (
    /foreground|close|near|近景|前景/.test(normalized)
  ) return 'foreground'
  if (/midground|medium|mid|中景/.test(normalized)) return 'midground'
  if (/distant|far|wide|远景/.test(normalized)) return 'distant'
  return null
}
const normalizeScaleNumber = (value, text = '') => {
  if (!Number.isFinite(value)) return null
  return value > 1 && text.includes('%')
    ? value / 100
    : value
}
const scaleRangeFrom = (value) => {
  if (typeof value === 'number') {
    const scale = normalizeScaleNumber(value)
    return scale === null ? null : { min: scale, max: scale, target: scale }
  }
  if (Array.isArray(value) && value.length >= 2) {
    const min = normalizeScaleNumber(Number(value[0]))
    const max = normalizeScaleNumber(Number(value[1]))
    return min === null || max === null ? null : { min, max }
  }
  if (isObject(value)) {
    const min = normalizeScaleNumber(Number(
      value.min
        ?? value.minimum
        ?? value.scaleMin
        ?? value.portraitHeightScaleMin,
    ))
    const max = normalizeScaleNumber(Number(
      value.max
        ?? value.maximum
        ?? value.scaleMax
        ?? value.portraitHeightScaleMax,
    ))
    const target = normalizeScaleNumber(Number(
      value.target
        ?? value.scale
        ?? value.targetScale
        ?? value.portraitHeightScale,
    ))
    if (min !== null && max !== null) {
      return { min, max, ...(target !== null ? { target } : {}) }
    }
    if (target !== null) return { min: target, max: target, target }
  }
  if (typeof value === 'string') {
    const numbers = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []
    if (numbers.length > 0) {
      const scales = numbers.map((number) => normalizeScaleNumber(number, value))
      return {
        min: scales[0],
        max: scales[1] ?? scales[0],
        ...(scales.length === 1 ? { target: scales[0] } : {}),
      }
    }
  }
  return null
}
const countRangeFrom = (value) => {
  if (Number.isInteger(value)) return { min: value, max: value }
  if (Array.isArray(value) && value.length >= 2) {
    const [min, max] = value.map(Number)
    if (Number.isInteger(min) && Number.isInteger(max)) return { min, max }
  }
  if (isObject(value)) {
    const min = Number(value.min ?? value.minimum ?? value.atLeast)
    const max = Number(value.max ?? value.maximum ?? value.atMost)
    if (Number.isInteger(min) && Number.isInteger(max)) return { min, max }
    const exact = Number(value.count ?? value.total ?? value.target)
    if (Number.isInteger(exact)) return { min: exact, max: exact }
  }
  if (typeof value === 'string') {
    const numbers = value.match(/\d+/g)?.map(Number) ?? []
    if (numbers.length > 0) {
      return { min: numbers[0], max: numbers[1] ?? numbers[0] }
    }
  }
  return null
}
const framingValuesFromObject = (value) => {
  if (!isObject(value)) return null
  const result = {}
  for (const framing of Object.keys(framingRanges)) {
    const entry = Object.entries(value).find(
      ([key]) => normalizeFraming(key) === framing,
    )
    if (!entry) return null
    result[framing] = entry[1]
  }
  return result
}
const framingTargetsFromOutline = (outline) => {
  for (const object of collectObjects(outline)) {
    const values = framingValuesFromObject(object)
    if (!values) continue
    const ranges = Object.fromEntries(
      Object.entries(values).map(([framing, value]) => [
        framing,
        countRangeFrom(value),
      ]),
    )
    if (
      Object.values(ranges).every(Boolean)
      && Object.values(ranges).every(({ max }) => max > 1)
      && Object.values(ranges).reduce((sum, range) => sum + range.min, 0) <= 50
      && Object.values(ranges).reduce((sum, range) => sum + range.max, 0) >= 50
    ) return ranges
  }
  return null
}
const scaleBandsFromOutline = (outline) => {
  for (const object of collectObjects(outline)) {
    const values = framingValuesFromObject(object)
    if (!values) continue
    const ranges = Object.fromEntries(
      Object.entries(values).map(([framing, value]) => [
        framing,
        scaleRangeFrom(value),
      ]),
    )
    if (
      Object.values(ranges).every(Boolean)
      && Object.values(ranges).every(
        ({ min, max }) => min > 0 && max <= 1 && min <= max,
      )
    ) return ranges
  }
  return null
}

const catBlockFrom = (scene) => firstDefined(scene, [
  'cat',
  'Cat',
  'catBlock',
  'catDirection',
  'catPlacement',
  ['visualDirection', 'cat'],
]) ?? {}
const catDirectiveFrom = (scene) => {
  const cat = catBlockFrom(scene)
  const framing = normalizeFraming(
    cat.framing
      ?? cat.catFraming
      ?? cat.depthBand
      ?? scene?.catFraming,
  )
  const pose = String(
    cat.pose ?? cat.portraitPose ?? scene?.portraitPose ?? '',
  ).trim()
  const scaleBand = scaleRangeFrom(
    cat.scaleBand
      ?? cat.scaleRange
      ?? cat.allowedScaleBand
      ?? {
        min: cat.scaleMin,
        max: cat.scaleMax,
        target: cat.targetScale ?? cat.scale,
      },
  )
  return {
    raw: cat,
    framing,
    pose,
    narrativeWeight: String(
      cat.narrativeWeight
        ?? cat.narrativeWeightTarget
        ?? cat.storyWeight
        ?? cat.role
        ?? '',
    ).trim(),
    perch: cat.perch
      ?? cat.Perch
      ?? cat.physicalPerch
      ?? cat.physicalSupport
      ?? cat.supportSurface
      ?? null,
    scaleBand,
    targetScale: scaleRangeFrom(
      cat.targetScale ?? cat.scale ?? cat.portraitHeightScale,
    )?.target
      ?? scaleRangeFrom(
        cat.targetScale ?? cat.scale ?? cat.portraitHeightScale,
      )?.min
      ?? null,
  }
}
const textFromEvidence = (value, depth = 0) => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (depth > 5) return ''
  if (Array.isArray(value)) {
    return value.map((child) => textFromEvidence(child, depth + 1))
      .filter(Boolean)
      .join('; ')
  }
  if (!isObject(value)) return ''
  for (const key of [
    'description',
    'physicalSupport',
    'surface',
    'support',
    'perch',
    'value',
    'note',
    'evidence',
    'type',
  ]) {
    const text = textFromEvidence(value[key], depth + 1)
    if (text) return text
  }
  return Object.values(value)
    .map((child) => textFromEvidence(child, depth + 1))
    .find(Boolean) ?? ''
}
const supportiveEvidence = (value) => {
  if (negative(value)) return false
  const text = textFromEvidence(value)
  if (
    /(^|\b)(false|fail|failed|unsafe|inaccessible|unreachable|unknown|pending)(\b|$)/i
      .test(text)
    || /不安全|不可达|无法到达|未验证|待确认/.test(text)
  ) return false
  return affirmative(value) || text.length >= 4
}

const canonicalEntity = (value) => {
  const raw = isObject(value)
    ? value.id
      ?? value.characterId
      ?? value.propId
      ?? value.name
      ?? value.label
      ?? value.kind
      ?? value.type
      ?? ''
    : value
  const text = String(raw)
  const normalized = normalizeKey(text)
  if (!normalized) return null
  if (/阿遥|ayao/i.test(text)) return 'a-yao'
  if (/周岸|zhouan/i.test(text)) return 'zhou-an'
  if (/林灯|lindeng/i.test(text)) return 'lin-deng'
  if (/minho|小猫|猫咪|playercat|^cat$/i.test(text)) return 'cat'
  const aliases = [
    [/key|钥匙/i, 'key'],
    [/cinema.*van|van.*cinema|流动影院车|放映车|电影车/i, 'cinema-van'],
    [/projector|放映机/i, 'projector'],
    [/film.*tin|film.*can|胶片罐|片盒/i, 'film-tin'],
    [/film.*reel|胶片卷|片卷|reel/i, 'film-reel'],
    [/fold.*screen|projection.*screen|银幕|幕布/i, 'projection-screen'],
    [/satchel|帆布包/i, 'satchel'],
    [/tool.*roll|工具卷/i, 'tool-roll'],
    [/pocket.*watch|怀表/i, 'pocket-watch'],
    [/cloth.*knot|cloth.*strip|布结|布条/i, 'cloth-knot'],
    [/sound.*cylinder|wax.*cylinder|蜡筒|声筒/i, 'sound-cylinder'],
    [/projector.*lens|放映镜头/i, 'projector-lens'],
    [/compass|指南针|罗盘/i, 'compass'],
  ]
  for (const [pattern, canonical] of aliases) {
    if (pattern.test(text)) return canonical
  }
  return normalized
}
const flattenEntities = (value) => {
  if (Array.isArray(value)) return value.flatMap(flattenEntities)
  if (typeof value === 'string' || typeof value === 'number') return [value]
  if (!isObject(value)) return []
  if (
    value.id
    || value.characterId
    || value.propId
    || value.name
    || value.label
  ) return [value]
  return Object.entries(value).flatMap(([key, child]) => {
    if (child === true) return [key]
    if (child === false || child === null) return []
    return flattenEntities(child)
  })
}
const entityListFrom = (scope, kind) => {
  const candidates = kind === 'characters'
    ? [
        'requiredCharacters',
        'characters',
        'humans',
        'depictedCharacters',
        ['assets', 'requiredCharacters'],
        ['assets', 'characters'],
        ['assets', 'humans'],
        ['required', 'characters'],
        ['requirements', 'characters'],
        ['content', 'characters'],
      ]
    : [
        'requiredProps',
        'props',
        'depictedProps',
        ['assets', 'requiredProps'],
        ['assets', 'props'],
        ['required', 'props'],
        ['requirements', 'props'],
        ['content', 'props'],
      ]
  for (const candidate of candidates) {
    const value = atPath(
      scope,
      Array.isArray(candidate) ? candidate : [candidate],
    )
    if (value !== undefined) {
      const entities = flattenEntities(value)
        .map(canonicalEntity)
        .filter(Boolean)
      if (entities.length > 0) return [...new Set(entities)]
    }
  }
  return []
}
const entityCovered = (required, actual) => (
  required === actual
  || (
    required.length >= 4
    && actual.length >= 4
    && (required.includes(actual) || actual.includes(required))
  )
)

const normalizeSafeBounds = (value, label, errors) => {
  const normalized = isObject(value)
    ? {
        units: value.units ?? value.coordinateUnits ?? 'normalized',
        x: Number(value.x ?? value.left),
        y: Number(value.y ?? value.top),
        width: Number(value.width ?? value.w),
        height: Number(value.height ?? value.h),
      }
    : null
  if (
    !normalized
    || normalizeKey(normalized.units) !== 'normalized'
    || !['x', 'y', 'width', 'height'].every(
      (key) => Number.isFinite(normalized[key]),
    )
    || normalized.x < 0
    || normalized.y < 0
    || normalized.width <= 0
    || normalized.height <= 0
    || normalized.x + normalized.width > 1.000001
    || normalized.y + normalized.height > 1.000001
  ) {
    errors.push(`${label}: invalid normalized safeBounds`)
    return null
  }
  return normalized
}
const normalizeCompositionSlot = (value, fallbackPose, label, errors) => {
  const normalized = isObject(value)
    ? {
        units: value.units ?? value.coordinateUnits ?? 'normalized',
        anchor: value.anchor
          ?? value.anchorSemantics
          ?? value.portraitAnchor
          ?? 'bottom-center',
        x: Number(value.x ?? value.anchorX),
        y: Number(value.y ?? value.anchorY),
        scale: normalizeScaleNumber(Number(
          value.scale
            ?? value.portraitHeightScale
            ?? value.targetScale,
        )),
        pose: String(value.pose ?? value.portraitPose ?? fallbackPose ?? ''),
        flip: Boolean(value.flip ?? value.flipped ?? value.mirror ?? false),
      }
    : null
  if (
    !normalized
    || normalizeKey(normalized.units) !== 'normalized'
    || normalizeKey(normalized.anchor) !== 'bottomcenter'
    || !Number.isFinite(normalized.x)
    || !Number.isFinite(normalized.y)
    || !Number.isFinite(normalized.scale)
    || normalized.x < 0
    || normalized.x > 1
    || normalized.y < 0
    || normalized.y > 1
    || normalized.scale <= 0
    || normalized.scale > 1
    || !poses.includes(normalized.pose)
  ) {
    errors.push(`${label}: invalid normalized bottom-center compositionSlot`)
    return null
  }
  return normalized
}
const catFreeEvidence = (scene, fragment) => {
  const scope = {
    scene,
    catFree: fragment.catFree,
    candidateScenesCatFree: fragment.candidateScenesCatFree,
    sourceScenesCatFree: fragment.sourceScenesCatFree,
    locks: fragment.locks,
    candidatePolicy: fragment.candidatePolicy,
    sourceScenePolicy: fragment.sourceScenePolicy,
  }
  const positive = valuesByKeys(scope, [
    'catFree',
    'candidateSceneCatFree',
    'candidateScenesCatFree',
    'sourceSceneCatFree',
    'sourceScenesCatFree',
    'sceneMasterCatFree',
    'sceneMastersCatFree',
  ]).some(affirmative)
    || valuesByKeys(scope, [
      'playerCatPresent',
      'catDrawnIntoScene',
      'sourceSceneContainsCat',
      'masterContainsCat',
    ]).some(negative)
  const contradiction = valuesByKeys(scope, [
    'playerCatPresent',
    'catDrawnIntoScene',
    'sourceSceneContainsCat',
    'masterContainsCat',
  ]).some(affirmative)
    || valuesByKeys(scope, [
      'catFree',
      'candidateSceneCatFree',
      'sourceSceneCatFree',
      'sceneMasterCatFree',
    ]).some(negative)
  return positive && !contradiction
}
const sourceReferenceMatches = (basePath, scope, expectedPath, expectedHash) => {
  const pathMatches = collectFileDeclarations(scope).some((declaration) => {
    try {
      return resolveDeclaredPath(basePath, declaration, expectedPath)
        === expectedPath
    } catch {
      return false
    }
  })
  return pathMatches && allStrings(scope).includes(expectedHash)
}

const errors = []
const error = (message) => errors.push(message)
const throwIfErrors = () => {
  if (errors.length > 0) {
    throw new Error(
      `cinematic story integration failed:\n- ${errors.join('\n- ')}`,
    )
  }
}

const validateReferenceManifest = async (record, expectedFiles, label) => {
  if (!explicitlyNonShipping(record.value) || shippingContradiction(record.value)) {
    error(`${record.path}: ${label} references must be explicitly non-shipping`)
  }
  if (
    !hasOriginalDeclaration(record.value)
    || originalityContradiction(record.value)
  ) {
    error(`${record.path}: ${label} references lack original-only declarations`)
  }
  const declarations = collectFileDeclarations(record.value)
  const artifacts = []
  const seenPaths = new Set()
  for (const expectedFilename of expectedFiles) {
    const candidates = declarations.filter(({ path: declaredPath }) => (
      path.posix.basename(declaredPath.replaceAll('\\', '/'))
        === expectedFilename
    ))
    const resolved = []
    for (const declaration of candidates) {
      try {
        const repoPath = resolveDeclaredPath(
          record.path,
          declaration,
          `${label} reference ${expectedFilename}`,
        )
        if (!resolved.some((item) => item.repoPath === repoPath)) {
          resolved.push({ declaration, repoPath })
        }
      } catch (caught) {
        error(caught.message)
      }
    }
    if (resolved.length !== 1) {
      error(`${record.path}: expected one ${expectedFilename} declaration`)
      continue
    }
    const { declaration, repoPath } = resolved[0]
    if (seenPaths.has(repoPath)) {
      error(`${repoPath}: duplicate ${label} reference path`)
      continue
    }
    seenPaths.add(repoPath)
    try {
      const contents = await readContents(repoPath)
      const declaredHash = declaration.sha256
        ?? declaration.raw?.sha256
        ?? declaration.raw?.imageSha256
      if (
        typeof declaredHash !== 'string'
        || !/^[a-f0-9]{64}$/i.test(declaredHash)
      ) error(`${repoPath}: missing declared reference sha256`)
      const actualHash = await validateRgbScene(
        contents,
        repoPath,
        declaredHash,
      )
      artifacts.push({ filename: expectedFilename, repoPath, sha256: actualHash })
    } catch (caught) {
      error(`${repoPath}: ${caught.message}`)
    }
  }
  if (artifacts.length !== expectedFiles.length) {
    error(`${record.path}: incomplete ${label} reference set`)
  }
  return artifacts
}

const normalizeBbox = (value) => {
  if (
    Array.isArray(value)
    && value.length === 4
    && value.every(Number.isFinite)
  ) return value
  if (!isObject(value)) return null
  const x = Number(value.x ?? value.left)
  const y = Number(value.y ?? value.top)
  const right = Number(
    value.right ?? (Number.isFinite(value.width) ? x + value.width : NaN),
  )
  const bottom = Number(
    value.bottom ?? (Number.isFinite(value.height) ? y + value.height : NaN),
  )
  return [x, y, right, bottom].every(Number.isFinite)
    ? [x, y, right, bottom]
    : null
}
const validatePortraitArchive = async (archiveRecord) => {
  const archive = archiveRecord.value
  if (
    archive.portrait?.id !== 'minho'
    || archive.portrait?.status !== 'approved'
    || archive.portrait?.shippingEligible !== true
    || archive.portrait?.machineQa !== 'pass'
    || archive.portrait?.humanReview !== 'approved'
  ) error(`${archiveRecord.path}: approved Minho metadata is invalid`)
  const validationPath = normalizeRepoPath(
    archive.portrait?.sourceValidation
      ?? 'docs/art/production/portraits/minho/validation.json',
    'Minho validation',
  )
  let validationRecord
  try {
    validationRecord = await readJsonRecord(validationPath)
  } catch (caught) {
    error(`${validationPath}: ${caught.message}`)
    return { archive, validationRecord: null, portraits: new Map() }
  }
  if (
    validationRecord.value.ok !== true
    || validationRecord.value.portraitId !== 'minho'
  ) error(`${validationPath}: approved Minho validation did not pass`)
  const portraits = new Map()
  for (const pose of archive.portrait?.poses ?? []) {
    if (!poses.includes(pose.pose)) continue
    try {
      const repoPath = normalizeRepoPath(pose.repoPath, `${pose.pose} portrait`)
      const contents = await readContents(repoPath)
      const png = inspectPng(contents, repoPath)
      const metadata = await sharp(contents).metadata()
      const validationPose = validationRecord.value.poses?.[pose.pose]
      const bbox = normalizeBbox(validationPose?.bbox ?? pose.contentBoundsPx)
      if (
        sha256(contents) !== pose.sha256
        || validationPose?.sha256 !== pose.sha256
        || png.width !== 1024
        || png.height !== 1024
        || png.bitDepth !== 8
        || png.colorType !== 6
        || metadata.format !== 'png'
        || metadata.hasAlpha !== true
        || metadata.space !== 'srgb'
        || !bbox
      ) {
        error(`${repoPath}: approved Minho bytes or metadata mismatch`)
        continue
      }
      portraits.set(pose.pose, {
        pose: pose.pose,
        repoPath,
        sha256: pose.sha256,
        bbox,
        contents,
      })
    } catch (caught) {
      error(`${pose.pose} portrait: ${caught.message}`)
    }
  }
  if (portraits.size !== poses.length) {
    error(`${archiveRecord.path}: approved Minho pose set is incomplete`)
  }
  return { archive, validationRecord, portraits }
}

const validatePlacement = (scene) => {
  const {
    id,
    compositionSlot: slot,
    safeBounds,
    portrait,
    cat,
  } = scene
  if (!slot || !safeBounds || !portrait) return
  if (
    slot.x < safeBounds.x - 0.000001
    || slot.x > safeBounds.x + safeBounds.width + 0.000001
    || slot.y < safeBounds.y - 0.000001
    || slot.y > safeBounds.y + safeBounds.height + 0.000001
  ) error(`${id}: compositionSlot anchor lies outside safeBounds`)
  const [bboxLeft, bboxTop, bboxRight, bboxBottom] = portrait.bbox
  const canvasWidth = slot.scale * (900 / 1200)
  const visibleLeft = slot.flip ? 1 - bboxRight / 1024 : bboxLeft / 1024
  const visibleRight = slot.flip ? 1 - bboxLeft / 1024 : bboxRight / 1024
  const visible = {
    left: slot.x - canvasWidth / 2 + visibleLeft * canvasWidth,
    right: slot.x - canvasWidth / 2 + visibleRight * canvasWidth,
    top: slot.y - slot.scale + (bboxTop / 1024) * slot.scale,
    bottom: slot.y - slot.scale + (bboxBottom / 1024) * slot.scale,
  }
  if (
    visible.left < safeBounds.x - 0.000001
    || visible.right > safeBounds.x + safeBounds.width + 0.000001
    || visible.top < safeBounds.y - 0.000001
    || visible.bottom > safeBounds.y + safeBounds.height + 0.000001
  ) error(`${id}: actual approved Minho silhouette leaves safeBounds`)
  if (
    slot.x - canvasWidth / 2 < -0.000001
    || slot.x + canvasWidth / 2 > 1.000001
    || slot.y - slot.scale < -0.000001
  ) error(`${id}: approved Minho preview canvas leaves the Scene`)
  if (
    !cat.scaleBand
    || slot.scale < cat.scaleBand.min - 0.000001
    || slot.scale > cat.scaleBand.max + 0.000001
  ) error(`${id}: Cat scale is outside the ${cat.framing} scale band`)
  if (
    Number.isFinite(cat.targetScale)
    && Math.abs(slot.scale - cat.targetScale)
      > Math.max(0.01, cat.targetScale * 0.12)
  ) error(`${id}: composition scale differs materially from script target`)
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

const outputPng = (image) => image
  .withIccProfile('srgb')
  .png({ compressionLevel: 9, adaptiveFiltering: false })
  .toBuffer()
const tileWidth = 240
const sceneHeight = 180
const labelHeight = 48
const tileHeight = sceneHeight + labelHeight
const overviewColumns = 5
const overviewRows = 2
const scenesPerOverview = overviewColumns * overviewRows

const renderTile = async (scene, index, preview, mapLabel = false) => {
  const sceneBuffer = await outputPng(
    sharp(scene.imageContents).resize(tileWidth, sceneHeight, { fit: 'fill' }),
  )
  let artwork = sceneBuffer
  if (preview) {
    const portraitHeight = Math.max(
      1,
      Math.round(scene.compositionSlot.scale * sceneHeight),
    )
    let portraitImage = sharp(scene.portrait.contents).resize({
      height: portraitHeight,
      fit: 'fill',
    })
    if (scene.compositionSlot.flip) portraitImage = portraitImage.flop()
    const portraitBuffer = await portraitImage.png().toBuffer()
    const metadata = await sharp(portraitBuffer).metadata()
    const portraitWidth = metadata.width ?? portraitHeight
    const left = Math.round(
      scene.compositionSlot.x * tileWidth - portraitWidth / 2,
    )
    const top = Math.round(
      scene.compositionSlot.y * sceneHeight - portraitHeight,
    )
    if (
      left < 0
      || top < 0
      || left + portraitWidth > tileWidth
      || top + portraitHeight > sceneHeight
    ) throw new Error(`${scene.id}: Minho effect preview leaves its tile`)
    artwork = await outputPng(
      sharp(sceneBuffer).composite([{ input: portraitBuffer, left, top }]),
    )
  }
  const firstLine = mapLabel
    ? `Chapter ${String(scene.chapterNumber).padStart(2, '0')} · Plot ${String(scene.sceneNumber).padStart(2, '0')}`
    : `${String(index + 1).padStart(2, '0')} · C${String(scene.chapterNumber).padStart(2, '0')} S${String(scene.sceneNumber).padStart(2, '0')} · ${scene.cat.framing}`
  const label = Buffer.from(`
    <svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f7f0df"/>
      <text x="8" y="16" font-family="Arial, sans-serif" font-size="9" fill="#4e5144">${escapeXml(firstLine)}</text>
      <text x="8" y="34" font-family="Arial, sans-serif" font-size="8" fill="#717366">${escapeXml(truncate(scene.plotBeat, 48))}</text>
    </svg>
  `)
  return outputPng(
    sharp({
      create: {
        width: tileWidth,
        height: tileHeight,
        channels: 3,
        background: '#f7f0df',
      },
    }).composite([
      { input: artwork, left: 0, top: 0 },
      { input: label, left: 0, top: sceneHeight },
    ]),
  )
}
const renderOverview = async (scenes, startIndex, preview) => {
  const tiles = []
  for (const [index, scene] of scenes.entries()) {
    tiles.push(await renderTile(scene, startIndex + index, preview))
  }
  return outputPng(
    sharp({
      create: {
        width: overviewColumns * tileWidth,
        height: overviewRows * tileHeight,
        channels: 3,
        background: '#e7dfcc',
      },
    }).composite(tiles.map((input, index) => ({
      input,
      left: (index % overviewColumns) * tileWidth,
      top: Math.floor(index / overviewColumns) * tileHeight,
    }))),
  )
}
const renderStoryMap = async (scenes) => {
  const tiles = []
  for (const [index, scene] of scenes.entries()) {
    tiles.push(await renderTile(scene, index, false, true))
  }
  return outputPng(
    sharp({
      create: {
        width: 5 * tileWidth,
        height: 10 * tileHeight,
        channels: 3,
        background: '#e7dfcc',
      },
    }).composite(tiles.map((input, index) => ({
      input,
      left: (index % 5) * tileWidth,
      top: Math.floor(index / 5) * tileHeight,
    }))),
  )
}

const expectedSceneId = (chapterNumber, sceneNumber) => (
  `last-light--c${String(chapterNumber).padStart(2, '0')}`
    + `-s${String(sceneNumber).padStart(2, '0')}`
)
const continuityValue = (scene, direction) => firstDefined(
  scene,
  direction === 'in'
    ? [
        'continuityIn',
        ['continuity', 'in'],
        ['continuity', 'fromPrevious'],
      ]
    : [
        'continuityOut',
        ['continuity', 'out'],
        ['continuity', 'toNext'],
      ],
)
const validateContinuityLink = (
  continuity,
  expectedId,
  direction,
  sceneId,
) => {
  if (!expectedId || !isObject(continuity)) return
  const keys = direction === 'in'
    ? ['previousSceneId', 'fromSceneId', 'followsSceneId']
    : ['nextSceneId', 'toSceneId', 'leadsToSceneId']
  const declared = valuesByKeys(continuity, keys)
    .filter((value) => typeof value === 'string')
  if (declared.some((value) => value !== expectedId)) {
    error(`${sceneId}: ${direction} continuity does not link ${expectedId}`)
  }
}

const main = async () => {
  const requiredInputs = [
    outlinePath,
    ...chapterPaths,
    characterReferencesPath,
    propReferencesPath,
    ...fragmentPaths,
    portraitArchivePath,
  ]
  const missing = []
  for (const repoPath of requiredInputs) {
    try {
      await access(absolute(repoPath))
    } catch {
      missing.push(repoPath)
    }
  }
  if (missing.length > 0) {
    console.log(
      `cinematic story inputs not ready; syntax-only mode `
        + `(${missing.length} missing):`,
    )
    missing.forEach((repoPath) => console.log(`- ${repoPath}`))
    return
  }

  const [
    outlineRecord,
    characterRecord,
    propRecord,
    archiveRecord,
    chapterRecords,
    fragmentRecords,
  ] = await Promise.all([
    readJsonRecord(outlinePath),
    readJsonRecord(characterReferencesPath),
    readJsonRecord(propReferencesPath),
    readJsonRecord(portraitArchivePath),
    Promise.all(chapterPaths.map(readJsonRecord)),
    Promise.all(fragmentPaths.map(readJsonRecord)),
  ])

  if (
    !hasOriginalDeclaration(outlineRecord.value)
    || originalityContradiction(outlineRecord.value)
  ) error(`${outlinePath}: missing an original-only declaration`)
  if (shippingContradiction(outlineRecord.value)) {
    error(`${outlinePath}: story outline cannot be shipping eligible`)
  }

  const outlineChapters = chapterListFrom(outlineRecord.value)
  if (outlineChapters.length !== 10) {
    error(`${outlinePath}: expected exactly 10 chapters`)
  }
  const outlineSceneById = new Map()
  const orderedOutlineIds = []
  outlineChapters.forEach((chapter, chapterIndex) => {
    const chapterNumber = chapterIndex + 1
    if (chapterNumberFrom(chapter, chapterNumber) !== chapterNumber) {
      error(`${outlinePath}: chapter ${chapterNumber} is out of order`)
    }
    const scenes = sceneListFrom(chapter)
    if (scenes.length !== 5) {
      error(`${outlinePath}: chapter ${chapterNumber} must contain 5 scenes`)
    }
    scenes.forEach((scene, sceneIndex) => {
      const sceneId = recordSceneId(scene)
      const expectedId = expectedSceneId(chapterNumber, sceneIndex + 1)
      if (sceneId !== expectedId) {
        error(`${outlinePath}: expected ${expectedId}, got ${sceneId || 'no ID'}`)
      }
      if (outlineSceneById.has(sceneId)) {
        error(`${outlinePath}: duplicate scene ID ${sceneId}`)
      }
      outlineSceneById.set(sceneId, scene)
      orderedOutlineIds.push(sceneId)
      if (
        !isSubstantive(continuityValue(scene, 'in'))
        || !isSubstantive(continuityValue(scene, 'out'))
      ) error(`${sceneId}: outline requires continuity-in and continuity-out`)
    })
  })
  if (
    orderedOutlineIds.length !== 50
    || new Set(orderedOutlineIds).size !== 50
  ) error(`${outlinePath}: expected exactly 50 unique ordered scene IDs`)

  const declaredFramingTargets = framingTargetsFromOutline(outlineRecord.value)
  if (!declaredFramingTargets) {
    error(`${outlinePath}: missing explicit Cat framing total targets`)
  }
  const scaleBands = scaleBandsFromOutline(outlineRecord.value)
    ?? defaultScaleBands
  for (const framing of Object.keys(framingRanges)) {
    const declared = declaredFramingTargets?.[framing]
    const canonical = framingRanges[framing]
    if (
      declared
      && (declared.min < canonical.min || declared.max > canonical.max)
    ) {
      error(
        `${outlinePath}: ${framing} target must stay within `
          + `${canonical.min}-${canonical.max}`,
      )
    }
  }

  const [
    characterArtifacts,
    propArtifacts,
    portraitArchive,
  ] = await Promise.all([
    validateReferenceManifest(
      characterRecord,
      expectedCharacterReferenceFiles,
      'character',
    ),
    validateReferenceManifest(
      propRecord,
      expectedPropReferenceFiles,
      'prop',
    ),
    validatePortraitArchive(archiveRecord),
  ])

  const scriptScenes = []
  const chapterSources = []
  chapterRecords.forEach((record, chapterIndex) => {
    const chapterNumber = chapterIndex + 1
    if (chapterNumberFrom(record.value, chapterNumber) !== chapterNumber) {
      error(`${record.path}: chapter identity mismatch`)
    }
    if (originalityContradiction(record.value)) {
      error(`${record.path}: contradicts original-only policy`)
    }
    const scenes = sceneListFrom(record.value)
    if (scenes.length !== 5) {
      error(`${record.path}: expected exactly 5 scene scripts`)
    }
    chapterSources.push({
      chapterNumber,
      path: record.path,
      sha256: record.sha256,
    })
    scenes.forEach((scene, sceneIndex) => {
      const sceneNumber = sceneIndex + 1
      const id = expectedSceneId(chapterNumber, sceneNumber)
      if (recordSceneId(scene) !== id) {
        error(`${record.path}: expected ${id}, got ${recordSceneId(scene)}`)
      }
      const outlineScene = outlineSceneById.get(id)
      if (!outlineScene) {
        error(`${id}: absent from series outline`)
        return
      }
      const scriptCat = catDirectiveFrom(scene)
      const outlineCat = catDirectiveFrom(outlineScene)
      if (!scriptCat.framing) error(`${id}: script lacks Cat framing`)
      if (
        scriptCat.framing
        && outlineCat.framing
        && scriptCat.framing !== outlineCat.framing
      ) error(`${id}: script and outline Cat framing differ`)
      if (!poses.includes(scriptCat.pose)) {
        error(`${id}: script lacks a valid approved Minho pose`)
      }
      if (
        scriptCat.pose
        && outlineCat.pose
        && scriptCat.pose !== outlineCat.pose
      ) error(`${id}: script and outline Cat poses differ`)
      if (!scriptCat.narrativeWeight) {
        error(`${id}: script lacks Cat narrativeWeight`)
      }
      if (!isSubstantive(scriptCat.perch)) {
        error(`${id}: script lacks a physical Perch`)
      }

      const requiredCharacters = entityListFrom(scene, 'characters')
        .filter((entity) => entity !== 'cat')
      const requiredProps = entityListFrom(scene, 'props')
      if (requiredCharacters.length === 0) {
        error(`${id}: script lacks required human characters`)
      }
      if (requiredProps.length === 0) {
        error(`${id}: script lacks required props`)
      }
      for (
        const required of entityListFrom(outlineScene, 'characters')
          .filter((entity) => entity !== 'cat')
      ) {
        if (!requiredCharacters.some((actual) => entityCovered(required, actual))) {
          error(`${id}: script omits outline character ${required}`)
        }
      }
      for (const required of entityListFrom(outlineScene, 'props')) {
        if (!requiredProps.some((actual) => entityCovered(required, actual))) {
          error(`${id}: script omits outline prop ${required}`)
        }
      }

      const continuityIn = continuityValue(scene, 'in')
      const continuityOut = continuityValue(scene, 'out')
      if (!isSubstantive(continuityIn) || !isSubstantive(continuityOut)) {
        error(`${id}: script requires continuity-in and continuity-out`)
      }
      const globalIndex = chapterIndex * 5 + sceneIndex
      validateContinuityLink(
        continuityIn,
        globalIndex > 0 ? orderedOutlineIds[globalIndex - 1] : null,
        'in',
        id,
      )
      validateContinuityLink(
        continuityOut,
        globalIndex < 49 ? orderedOutlineIds[globalIndex + 1] : null,
        'out',
        id,
      )
      const plotBeatValue = firstDefined(scene, [
        'plotBeat',
        'beat',
        ['plot', 'beat'],
        ['beat', 'purpose'],
      ]) ?? firstDefined(outlineScene, ['beat', 'plotBeat'])
      if (!isSubstantive(plotBeatValue)) error(`${id}: missing plot beat`)

      const framing = scriptCat.framing ?? outlineCat.framing
      scriptScenes.push({
        id,
        chapterNumber,
        sceneNumber,
        globalIndex,
        raw: scene,
        plotBeat: textFromEvidence(plotBeatValue),
        dramaticTurn: textFromEvidence(firstDefined(outlineScene, [
          'dramaticTurn',
          'turn',
          ['dramatic', 'turn'],
        ])),
        requiredCharacters,
        requiredProps,
        cat: {
          framing,
          pose: scriptCat.pose || outlineCat.pose,
          narrativeWeight:
            scriptCat.narrativeWeight || outlineCat.narrativeWeight,
          perch: scriptCat.perch ?? outlineCat.perch,
          scaleBand: scriptCat.scaleBand
            ?? outlineCat.scaleBand
            ?? scaleBands[framing],
          targetScale: scriptCat.targetScale
            ?? outlineCat.targetScale
            ?? null,
        },
        continuityIn,
        continuityOut,
        scriptPath: record.path,
        scriptFileSha256: record.sha256,
        scriptRecordSha256: sha256(Buffer.from(JSON.stringify(scene))),
      })
    })
  })
  if (
    scriptScenes.length !== 50
    || new Set(scriptScenes.map(({ id }) => id)).size !== 50
  ) error('chapter scripts do not form the exact 50-scene set')
  for (let chapter = 1; chapter <= 10; chapter += 1) {
    const foregroundCount = scriptScenes.filter((scene) => (
      scene.chapterNumber === chapter && scene.cat.framing === 'foreground'
    )).length
    if (foregroundCount > 1) {
      error(`chapter ${chapter}: more than one foreground Cat scene`)
    }
  }
  const framingDistribution = Object.fromEntries(
    Object.keys(framingRanges).map((framing) => [
      framing,
      scriptScenes.filter((scene) => scene.cat.framing === framing).length,
    ]),
  )
  for (const [framing, range] of Object.entries(framingRanges)) {
    const count = framingDistribution[framing]
    if (count < range.min || count > range.max) {
      error(`${framing} Cat total ${count}; expected ${range.min}-${range.max}`)
    }
    const declared = declaredFramingTargets?.[framing]
    if (declared && (count < declared.min || count > declared.max)) {
      error(`${framing} Cat total ${count} misses outline target`)
    }
  }

  const scriptById = new Map(scriptScenes.map((scene) => [scene.id, scene]))
  const integratedScenes = []
  const sourceFragments = []
  const imagePaths = new Set()
  const imageHashes = new Set()

  for (const [fragmentIndex, fragmentRecord] of fragmentRecords.entries()) {
    const chapterNumber = fragmentIndex + 1
    const fragment = fragmentRecord.value
    if (!explicitlyNonShipping(fragment) || shippingContradiction(fragment)) {
      error(`${fragmentRecord.path}: fragment must be explicitly non-shipping`)
    }
    if (
      !hasOriginalDeclaration(fragment)
      || originalityContradiction(fragment)
    ) error(`${fragmentRecord.path}: fragment lacks original-only declarations`)
    if (chapterNumberFrom(fragment, chapterNumber) !== chapterNumber) {
      error(`${fragmentRecord.path}: chapter identity mismatch`)
    }

    for (const source of [
      outlineRecord,
      chapterRecords[fragmentIndex],
      characterRecord,
      propRecord,
    ]) {
      if (!sourceReferenceMatches(
        fragmentRecord.path,
        fragment,
        source.path,
        source.sha256,
      )) {
        error(
          `${fragmentRecord.path}: missing exact path/hash source reference `
            + `for ${source.path}`,
        )
      }
    }

    const activeScenes = sceneListFrom(fragment).filter(
      (scene) => !isInactive(scene),
    )
    if (activeScenes.length !== 5) {
      error(`${fragmentRecord.path}: expected exactly 5 active scene masters`)
    }
    const expectedIds = Array.from(
      { length: 5 },
      (_, index) => expectedSceneId(chapterNumber, index + 1),
    )
    const unplanned = activeScenes
      .map(recordSceneId)
      .filter((id) => !expectedIds.includes(id))
    if (unplanned.length > 0) {
      error(`${fragmentRecord.path}: unplanned active IDs ${unplanned.join(', ')}`)
    }

    for (const id of expectedIds) {
      const matches = activeScenes.filter((scene) => recordSceneId(scene) === id)
      if (matches.length !== 1) {
        error(`${fragmentRecord.path}: expected one active ${id}, got ${matches.length}`)
        continue
      }
      const assetScene = matches[0]
      const scriptScene = scriptById.get(id)
      if (!scriptScene) {
        error(`${id}: scene asset has no script`)
        continue
      }
      if (shippingContradiction(assetScene)) {
        error(`${id}: scene master cannot be shipping eligible`)
      }
      if (!catFreeEvidence(assetScene, fragment)) {
        error(`${id}: source master lacks explicit Cat-free evidence`)
      }
      if (originalityContradiction(assetScene)) {
        error(`${id}: source master contradicts original-only policy`)
      }

      const supplementalScopes = [
        fragment.scenesById?.[id],
        fragment.sceneMetadataById?.[id],
        fragment.requirementsByScene?.[id],
        fragment.placementsByScene?.[id],
      ].filter(isObject)
      const firstSupplement = (paths) => supplementalScopes
        .map((scope) => firstDefined(scope, paths))
        .find((value) => value !== undefined && value !== null)
      const assetCharacters = [...new Set([
        ...entityListFrom(assetScene, 'characters'),
        ...supplementalScopes.flatMap(
          (scope) => entityListFrom(scope, 'characters'),
        ),
      ])].filter((entity) => entity !== 'cat')
      const assetProps = [...new Set([
        ...entityListFrom(assetScene, 'props'),
        ...supplementalScopes.flatMap(
          (scope) => entityListFrom(scope, 'props'),
        ),
      ])]
      if (assetCharacters.length === 0) {
        error(`${id}: asset record lacks required/depicted humans`)
      }
      if (assetProps.length === 0) {
        error(`${id}: asset record lacks required/depicted props`)
      }
      for (const required of scriptScene.requiredCharacters) {
        if (!assetCharacters.some((actual) => entityCovered(required, actual))) {
          error(`${id}: scene master omits required human ${required}`)
        }
      }
      for (const required of scriptScene.requiredProps) {
        if (!assetProps.some((actual) => entityCovered(required, actual))) {
          error(`${id}: scene master omits required prop ${required}`)
        }
      }

      const imageDeclaration = sourceDeclaration(
        assetScene.sceneMaster
          ?? assetScene.master
          ?? assetScene.image
          ?? assetScene.imageSrc
          ?? assetScene.repoPath
          ?? assetScene.artifact
          ?? fragment.sceneMastersById?.[id]
          ?? fragment.imagesByScene?.[id],
      )
      if (!imageDeclaration) {
        error(`${id}: missing scene master path`)
        continue
      }
      let imageSrc
      let imageContents
      let imageHash
      try {
        imageSrc = resolveDeclaredPath(
          fragmentRecord.path,
          imageDeclaration,
          `${id} scene master`,
        )
        if (
          !imageSrc.startsWith(`${path.posix.dirname(fragmentRecord.path)}/`)
        ) error(`${id}: master must stay in its chapter asset directory`)
        if (
          path.posix.extname(imageSrc).toLowerCase() !== '.png'
          || !path.posix.basename(imageSrc).includes(id)
        ) error(`${id}: master filename does not correspond to script ID`)
        const declaredHash = imageDeclaration.sha256
          ?? assetScene.sha256
          ?? assetScene.imageSha256
          ?? assetScene.masterSha256
        if (
          typeof declaredHash !== 'string'
          || !/^[a-f0-9]{64}$/i.test(declaredHash)
        ) error(`${id}: missing declared master sha256`)
        imageContents = await readContents(imageSrc)
        imageHash = await validateRgbScene(imageContents, id, declaredHash)
        if (imagePaths.has(imageSrc)) error(`${id}: duplicate master path`)
        if (imageHashes.has(imageHash)) error(`${id}: duplicate master content`)
        imagePaths.add(imageSrc)
        imageHashes.add(imageHash)
      } catch (caught) {
        error(`${id}: ${caught.message}`)
        continue
      }

      const assetCat = catDirectiveFrom(
        supplementalScopes.find((scope) => normalizeFraming(
          catBlockFrom(scope).framing ?? scope.catFraming,
        )) ?? assetScene,
      )
      if (
        assetCat.framing
        && assetCat.framing !== scriptScene.cat.framing
      ) error(`${id}: asset and script Cat framing differ`)
      const compositionSlot = normalizeCompositionSlot(
        firstDefined(assetScene, [
          'compositionSlot',
          ['placement', 'compositionSlot'],
          ['placement', 'slot'],
          ['catPlacement', 'compositionSlot'],
          ['placementIntent', 'compositionSlot'],
        ])
          ?? fragment.compositionSlotsByScene?.[id]
          ?? firstSupplement([
            'compositionSlot',
            ['placement', 'compositionSlot'],
            ['placement', 'slot'],
          ]),
        assetCat.pose || scriptScene.cat.pose,
        id,
        errors,
      )
      const safeBounds = normalizeSafeBounds(
        firstDefined(assetScene, [
          'safeBounds',
          ['placement', 'safeBounds'],
          ['catPlacement', 'safeBounds'],
          ['placementIntent', 'safeBounds'],
        ])
          ?? fragment.safeBoundsByScene?.[id]
          ?? firstSupplement([
            'safeBounds',
            ['placement', 'safeBounds'],
          ]),
        id,
        errors,
      )
      if (
        compositionSlot
        && compositionSlot.pose !== scriptScene.cat.pose
      ) error(`${id}: compositionSlot pose differs from script`)
      const perchSource = firstDefined(assetScene, [
        'perch',
        'physicalPerch',
        ['placement', 'perch'],
        ['catPlacement', 'perch'],
        ['placementIntent', 'perch'],
        ['placementIntent', 'physicalSupport'],
        ['placementIntent', 'supportSurface'],
      ])
        ?? fragment.perchesByScene?.[id]
        ?? firstSupplement([
          'perch',
          'physicalPerch',
          ['placement', 'perch'],
          ['placementIntent', 'physicalSupport'],
        ])
      const perchText = textFromEvidence(perchSource)
      if (perchText.length < 4) {
        error(`${id}: asset record lacks physical Perch evidence`)
      }
      const placementIntent = firstDefined(assetScene, [
        'placementIntent',
        ['placement', 'intent'],
        'catPlacement',
      ])
      for (const [kind, keys] of [
        [
          'access',
          ['accessPlausibility', 'accessible', 'reachable', 'physicalAccess'],
        ],
        [
          'pose fit',
          ['poseFit', 'poseCompatibility', 'poseAppropriate'],
        ],
      ]) {
        const evidence = valuesByKeys(placementIntent ?? assetScene, keys)
        if (evidence.length === 0) {
          error(`${id}: Perch lacks ${kind} evidence`)
        } else if (!evidence.some(supportiveEvidence)) {
          error(`${id}: Perch ${kind} evidence is not affirmative`)
        }
      }

      const portrait = portraitArchive.portraits.get(
        compositionSlot?.pose ?? scriptScene.cat.pose,
      )
      const integrated = {
        ...scriptScene,
        status: 'candidate',
        shippingEligible: false,
        originalOnly: true,
        catFree: true,
        sourceFragment: fragmentRecord.path,
        sourceFragmentSha256: fragmentRecord.sha256,
        imageSrc,
        imageContents,
        sha256: imageHash,
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
        assetCharacters,
        assetProps,
        compositionSlot,
        safeBounds,
        perch: { description: perchText, source: perchSource },
        portrait,
      }
      integrated.cat.scaleBand = integrated.cat.scaleBand
        ?? scaleBands[integrated.cat.framing]
        ?? defaultScaleBands[integrated.cat.framing]
      validatePlacement(integrated)
      integratedScenes.push(integrated)
    }
    sourceFragments.push({
      chapterNumber,
      path: fragmentRecord.path,
      sha256: fragmentRecord.sha256,
    })
  }

  integratedScenes.sort((left, right) => left.globalIndex - right.globalIndex)
  if (
    integratedScenes.length !== 50
    || new Set(integratedScenes.map(({ id }) => id)).size !== 50
    || imagePaths.size !== 50
    || imageHashes.size !== 50
  ) {
    error('integrated set is not exactly 50 unique scripts and masters')
  }
  if (
    integratedScenes.some(
      (scene, index) => scene.id !== orderedOutlineIds[index],
    )
  ) error('integrated scenes are not in canonical chronological order')

  const outputPaths = [
    outputManifestPath,
    outputQaPath,
    outputReviewIndexPath,
    ...sceneOverviewPaths,
    ...previewOverviewPaths,
    storyMapPath,
  ]
  const protectedPaths = new Set([
    ...requiredInputs,
    ...imagePaths,
    portraitArchive.validationRecord?.path,
    ...[...portraitArchive.portraits.values()].map(({ repoPath }) => repoPath),
    ...characterArtifacts.map(({ repoPath }) => repoPath),
    ...propArtifacts.map(({ repoPath }) => repoPath),
  ].filter(Boolean))
  if (
    new Set(outputPaths).size !== outputPaths.length
    || outputPaths.some((repoPath) => protectedPaths.has(repoPath))
  ) error('generated output path aliases an input or another output')

  throwIfErrors()

  const binaries = []
  const sceneSheets = []
  const previewSheets = []
  for (let sheetIndex = 0; sheetIndex < 5; sheetIndex += 1) {
    const start = sheetIndex * scenesPerOverview
    const scenes = integratedScenes.slice(start, start + scenesPerOverview)
    const [sceneBuffer, previewBuffer] = await Promise.all([
      renderOverview(scenes, start, false),
      renderOverview(scenes, start, true),
    ])
    const scenePath = sceneOverviewPaths[sheetIndex]
    const previewPath = previewOverviewPaths[sheetIndex]
    binaries.push(
      { repoPath: scenePath, buffer: sceneBuffer },
      { repoPath: previewPath, buffer: previewBuffer },
    )
    sceneSheets.push({
      kind: 'scene-only-overview',
      path: scenePath,
      sha256: sha256(sceneBuffer),
      width: overviewColumns * tileWidth,
      height: overviewRows * tileHeight,
      sceneCount: scenes.length,
      sceneIds: scenes.map(({ id }) => id),
      sourceArtOverlays: false,
    })
    previewSheets.push({
      kind: 'approved-minho-effect-preview-overview',
      path: previewPath,
      sha256: sha256(previewBuffer),
      width: overviewColumns * tileWidth,
      height: overviewRows * tileHeight,
      sceneCount: scenes.length,
      sceneIds: scenes.map(({ id }) => id),
      portraitId: 'minho',
      actualApprovedPortrait: true,
      nonFinalQaOnly: true,
      sourceScenesRemainCatFree: true,
    })
  }
  const storyMapBuffer = await renderStoryMap(integratedScenes)
  binaries.push({ repoPath: storyMapPath, buffer: storyMapBuffer })
  const storyMap = {
    kind: '50-scene-chronological-story-map',
    path: storyMapPath,
    sha256: sha256(storyMapBuffer),
    width: 5 * tileWidth,
    height: 10 * tileHeight,
    sceneCount: 50,
    chapterRows: 10,
    plotColumns: 5,
    labelsOutsideSourceArt: true,
    sourceArtOverlays: false,
    sceneIds: integratedScenes.map(({ id }) => id),
  }

  const sceneIdSetSha256 = sha256(Buffer.from(
    integratedScenes.map(({ id }) => id).join('\n'),
  ))
  const sceneScriptSetSha256 = sha256(Buffer.from(
    integratedScenes.map(({ id, scriptRecordSha256 }) => (
      `${id}\t${scriptRecordSha256}`
    )).join('\n'),
  ))
  const sceneContentSetSha256 = sha256(Buffer.from(
    integratedScenes.map(({ id, sha256: imageHash }) => (
      `${id}\t${imageHash}`
    )).join('\n'),
  ))
  const sourceFragmentSetSha256 = sha256(Buffer.from(
    sourceFragments.map(({ path: sourcePath, sha256: sourceHash }) => (
      `${sourcePath}\t${sourceHash}`
    )).join('\n'),
  ))
  const referenceSetSha256 = sha256(Buffer.from([
    ...characterArtifacts,
    ...propArtifacts,
  ].map(({ repoPath, sha256: hash }) => (
    `${repoPath}\t${hash}`
  )).sort().join('\n')))
  const qaArtifactSetSha256 = sha256(Buffer.from([
    ...sceneSheets,
    ...previewSheets,
    storyMap,
  ].map(({ path: artifactPath, sha256: hash }) => (
    `${artifactPath}\t${hash}`
  )).sort().join('\n')))
  const inputRecords = [
    outlineRecord,
    ...chapterRecords,
    characterRecord,
    propRecord,
    ...fragmentRecords,
    archiveRecord,
    portraitArchive.validationRecord,
  ].filter(Boolean)
  const sourceInputSetSha256 = sha256(Buffer.from(
    inputRecords.map(({ path: sourcePath, sha256: hash }) => (
      `${sourcePath}\t${hash}`
    )).sort().join('\n'),
  ))

  const manifestScenes = integratedScenes.map((scene) => ({
    id: scene.id,
    chapterNumber: scene.chapterNumber,
    sceneNumber: scene.sceneNumber,
    globalSequence: scene.globalIndex + 1,
    plotBeat: scene.plotBeat,
    dramaticTurn: scene.dramaticTurn,
    status: 'candidate',
    shippingEligible: false,
    originalOnly: true,
    catFree: true,
    script: {
      path: scene.scriptPath,
      fileSha256: scene.scriptFileSha256,
      sceneRecordSha256: scene.scriptRecordSha256,
    },
    sourceFragment: {
      path: scene.sourceFragment,
      sha256: scene.sourceFragmentSha256,
    },
    imageSrc: scene.imageSrc,
    sha256: scene.sha256,
    dimensions: scene.dimensions,
    requiredCharacters: scene.requiredCharacters,
    requiredProps: scene.requiredProps,
    compositionSlot: scene.compositionSlot,
    safeBounds: scene.safeBounds,
    perch: scene.perch,
    cat: {
      framing: scene.cat.framing,
      pose: scene.cat.pose,
      narrativeWeight: scene.cat.narrativeWeight,
      scale: scene.compositionSlot.scale,
      scaleBand: scene.cat.scaleBand,
    },
    minhoEffectPreview: {
      portraitId: 'minho',
      pose: scene.portrait.pose,
      portraitPath: scene.portrait.repoPath,
      portraitSha256: scene.portrait.sha256,
      overviewSheet: previewSheets[
        Math.floor(scene.globalIndex / scenesPerOverview)
      ].path,
      overviewTile: (scene.globalIndex % scenesPerOverview) + 1,
      actualApprovedPortrait: true,
      nonFinalQaOnly: true,
      sourceSceneRemainsCatFree: true,
    },
    continuity: {
      in: scene.continuityIn,
      out: scene.continuityOut,
    },
  }))
  const outlineSeries = outlineRecord.value.series ?? outlineRecord.value
  const manifest = {
    schemaVersion: 1,
    manifestKind: 'cinematic-story-candidate-master',
    seriesId: outlineSeries.id
      ?? outlineRecord.value.seriesId
      ?? 'last-light',
    title: outlineSeries.title
      ?? outlineSeries.titleZh
      ?? outlineRecord.value.title
      ?? '最后一束光',
    internalEnglishTitle: outlineSeries.internalEnglishTitle
      ?? outlineSeries.titleEn
      ?? outlineRecord.value.internalEnglishTitle
      ?? 'The Last Beam',
    generatedAt,
    status: 'candidate',
    shippingEligible: false,
    approvalState: 'pending-human-review',
    originalOnly: true,
    sourceOutline: {
      path: outlineRecord.path,
      sha256: outlineRecord.sha256,
    },
    chapterSources,
    sourceFragments,
    references: {
      characters: {
        manifestPath: characterRecord.path,
        manifestSha256: characterRecord.sha256,
        artifacts: characterArtifacts,
      },
      props: {
        manifestPath: propRecord.path,
        manifestSha256: propRecord.sha256,
        artifacts: propArtifacts,
      },
      approvedMinho: {
        archivePath: archiveRecord.path,
        archiveSha256: archiveRecord.sha256,
        portraitId: 'minho',
        validationPath: portraitArchive.validationRecord.path,
        validationSha256: portraitArchive.validationRecord.sha256,
        poses: [...portraitArchive.portraits.values()].map((portrait) => ({
          pose: portrait.pose,
          repoPath: portrait.repoPath,
          sha256: portrait.sha256,
        })),
      },
    },
    totals: {
      chapterCount: 10,
      scenesPerChapter: 5,
      sceneScriptCount: 50,
      sceneMasterCount: 50,
      uniqueSceneIdCount: 50,
      uniqueScenePathCount: 50,
      uniqueSceneContentCount: 50,
      actualMinhoPreviewCount: 50,
      sceneOnlyOverviewSheetCount: 5,
      minhoEffectPreviewOverviewSheetCount: 5,
      storyMapSheetCount: 1,
    },
    catFraming: {
      distribution: framingDistribution,
      requiredRanges: framingRanges,
      scaleBands,
    },
    activeSet: {
      selection: 'all-50-chronological-candidate-scenes',
      sceneCount: 50,
      sceneIdSetSha256,
      sceneScriptSetSha256,
      sceneContentSetSha256,
    },
    sourceSet: {
      sourceInputSetSha256,
      sourceFragmentSetSha256,
      referenceSetSha256,
    },
    scenes: manifestScenes,
    qaArtifacts: {
      sceneOverviewSheets: sceneSheets,
      minhoEffectPreviewOverviewSheets: previewSheets,
      storyMap,
      qaArtifactSetSha256,
    },
    review: {
      humanVisualReview: 'pending',
      storyContinuityReview: 'pending',
      originalityAndRightsReview: 'pending',
      finalCompositeReview: 'pending',
      shippingApproval: 'not-eligible',
      note: 'All masters and previews remain non-shipping candidates. Machine QA does not authorize publication or promotion.',
    },
  }
  const manifestContents = `${JSON.stringify(manifest, null, 2)}\n`
  const manifestSha256 = sha256(Buffer.from(manifestContents))

  const machineChecks = [
    {
      id: 'exact-outline-and-script-coverage',
      status: 'pass',
      expected: { chapters: 10, scenesPerChapter: 5, scenes: 50 },
      actual: { chapters: chapterSources.length, scenesPerChapter: 5, scenes: 50 },
    },
    {
      id: 'unique-chronological-scene-ids',
      status: 'pass',
      expected: 50,
      actual: new Set(integratedScenes.map(({ id }) => id)).size,
      sceneIdSetSha256,
    },
    {
      id: 'script-to-asset-id-correspondence',
      status: 'pass',
      expected: 50,
      actual: integratedScenes.length,
    },
    {
      id: 'cat-free-rgb-scene-master-format-and-hashes',
      status: 'pass',
      expected: 50,
      actual: imageHashes.size,
      sceneContentSetSha256,
    },
    {
      id: 'original-only-and-non-shipping-declarations',
      status: 'pass',
      expected: 'all candidate inputs and outputs',
      actual: 'validated',
    },
    {
      id: 'required-human-and-prop-coverage',
      status: 'pass',
      expected: 50,
      actual: integratedScenes.filter((scene) => (
        scene.requiredCharacters.length > 0
        && scene.requiredProps.length > 0
      )).length,
    },
    {
      id: 'composition-safe-bounds-and-perch-validation',
      status: 'pass',
      expected: 50,
      actual: integratedScenes.filter((scene) => (
        scene.compositionSlot && scene.safeBounds && scene.perch.description
      )).length,
    },
    {
      id: 'cat-framing-totals-and-scales',
      status: 'pass',
      expected: framingRanges,
      actual: framingDistribution,
    },
    {
      id: 'actual-approved-minho-preview-per-scene',
      status: 'pass',
      expected: 50,
      actual: manifestScenes.filter(
        (scene) => scene.minhoEffectPreview.actualApprovedPortrait,
      ).length,
    },
    {
      id: 'character-prop-and-fragment-source-references',
      status: 'pass',
      expected: {
        characterReferences: 4,
        propReferences: 4,
        fragments: 10,
      },
      actual: {
        characterReferences: characterArtifacts.length,
        propReferences: propArtifacts.length,
        fragments: sourceFragments.length,
      },
      sourceInputSetSha256,
      sourceFragmentSetSha256,
      referenceSetSha256,
    },
    {
      id: 'deterministic-review-artifact-coverage',
      status: 'pass',
      expected: {
        sceneOnlySheets: 5,
        minhoEffectPreviewSheets: 5,
        storyMapSheets: 1,
        coveredScenes: 50,
      },
      actual: {
        sceneOnlySheets: sceneSheets.length,
        minhoEffectPreviewSheets: previewSheets.length,
        storyMapSheets: 1,
        coveredScenes: storyMap.sceneCount,
      },
      qaArtifactSetSha256,
    },
    {
      id: 'shipping-eligibility-disabled',
      status: 'pass',
      expected: false,
      actual: manifest.shippingEligible,
    },
  ]
  const qa = {
    schemaVersion: 1,
    reportKind: 'cinematic-story-integration-qa',
    seriesId: manifest.seriesId,
    generatedAt,
    sourceManifest: outputManifestPath,
    sourceManifestSha256: manifestSha256,
    overallStatus: 'pass',
    shippingEligible: false,
    totals: {
      ...manifest.totals,
      machineCheckCount: machineChecks.length,
      machineChecksPassed: machineChecks.length,
      machineChecksFailed: 0,
      pendingHumanCheckCount: 4,
    },
    activeSet: manifest.activeSet,
    sourceSet: manifest.sourceSet,
    catFraming: manifest.catFraming,
    machineChecks,
    pendingHumanChecks: [
      {
        id: '50-scene-story-and-continuity-review',
        status: 'pending',
        note: 'Review human causality, emotional progression, chapter transitions, and the exact chronological set.',
      },
      {
        id: 'scene-and-minho-effect-preview-review',
        status: 'pending',
        note: 'Review all Cat-free masters and actual approved-Minho previews for framing, scale, pose, Perch, silhouette, and continuity.',
      },
      {
        id: 'originality-rights-and-cultural-review',
        status: 'pending',
        note: 'Confirm source independence, fictional-location handling, incidental people, title/trademark, music, and global rights considerations.',
      },
      {
        id: 'final-composite-and-shipping-approval',
        status: 'blocked',
        note: 'Effect previews are non-final QA artifacts. Nothing in this package is eligible to ship.',
      },
    ],
    protectedInputs: {
      outline: manifest.sourceOutline,
      chapters: chapterSources,
      characterReferences: manifest.references.characters,
      propReferences: manifest.references.props,
      approvedMinho: manifest.references.approvedMinho,
      sourceFragments,
    },
    qaArtifacts: manifest.qaArtifacts,
    errors: [],
  }
  const qaContents = `${JSON.stringify(qa, null, 2)}\n`

  const relative = (repoPath) => path.posix.relative(storyRoot, repoPath)
  const reviewLines = [
    '# 《最后一束光》候选故事审阅索引',
    '',
    'This is the exact 10-chapter, 50-scene original candidate set. All Scene masters remain Cat-free and non-shipping; Minho sheets use the approved Portrait archive.',
    '',
    `- [Series outline](${relative(outlinePath)})`,
    `- [Candidate manifest](${relative(outputManifestPath)})`,
    `- [Machine QA report](${relative(outputQaPath)})`,
    `- Ordered scene ID hash: \`${sceneIdSetSha256}\``,
    `- Scene script hash: \`${sceneScriptSetSha256}\``,
    `- Scene master content hash: \`${sceneContentSetSha256}\``,
    `- Source input hash: \`${sourceInputSetSha256}\``,
    '',
    '## Scene-only overview sheets',
    '',
    ...sceneSheets.map((sheet, index) => (
      `${index + 1}. [Scenes ${String(index * 10 + 1).padStart(2, '0')}–${String(index * 10 + 10).padStart(2, '0')}](${relative(sheet.path)})`
    )),
    '',
    '## Actual Minho effect-preview sheets',
    '',
    ...previewSheets.map((sheet, index) => (
      `${index + 1}. [Minho previews ${String(index * 10 + 1).padStart(2, '0')}–${String(index * 10 + 10).padStart(2, '0')}](${relative(sheet.path)})`
    )),
    '',
    '## 50-scene story map',
    '',
    `- [Chronological story map](${relative(storyMap.path)}) — chapter and plot labels sit outside source artwork; source Scene art has no overlays.`,
    '',
    '## Chronological review order',
    '',
  ]
  for (let chapter = 1; chapter <= 10; chapter += 1) {
    const scenes = manifestScenes.filter(
      (scene) => scene.chapterNumber === chapter,
    )
    reviewLines.push(
      `### Chapter ${String(chapter).padStart(2, '0')}`,
      '',
      `- [Script](${relative(chapterSources[chapter - 1].path)}) · `
        + `[asset fragment](${relative(sourceFragments[chapter - 1].path)})`,
    )
    for (const scene of scenes) {
      reviewLines.push(
        `- [\`${scene.id}\`](${relative(scene.imageSrc)}) — `
          + `${scene.cat.framing}, scale ${scene.cat.scale.toFixed(3)}, `
          + `${scene.cat.pose}; ${truncate(scene.plotBeat, 90)}`,
      )
    }
    reviewLines.push('')
  }
  reviewLines.push(
    '## Required decisions',
    '',
    '- Approve or reject the exact 50-scene chronology and human-led main plot.',
    '- Verify required humans and continuity props remain consistent without logos or readable image text.',
    '- Verify every Cat placement has a believable physical Perch, intended framing, and appropriate scale.',
    '- Compare each Scene-only sheet with its approved-Minho effect-preview sheet; source masters must remain Cat-free.',
    '- Complete originality, rights, cultural, title, music, final-composite, and shipping reviews separately.',
    '- Machine QA does not grant shipping eligibility.',
    '',
  )
  const reviewContents = `${reviewLines.join('\n')}\n`

  for (const { repoPath, buffer } of binaries) {
    await writeOrCheck(repoPath, buffer)
  }
  await writeOrCheck(outputManifestPath, manifestContents, 'utf8')
  await writeOrCheck(outputQaPath, qaContents, 'utf8')
  await writeOrCheck(outputReviewIndexPath, reviewContents, 'utf8')

  console.log(
    `cinematic story ${checkOnly ? 'verified' : 'integrated'}: `
      + '10 chapters, 50 Cat-free scenes, 50 Minho previews',
  )
}

await main()
