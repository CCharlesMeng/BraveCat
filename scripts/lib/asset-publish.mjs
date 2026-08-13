/**
 * 资源发布（OSS + CDN）的版权门禁评估、文件分类与远程清单生成。
 *
 * 门禁语义与既有构建门禁保持一致：
 * - 地标场景：apps/web/vite.config.ts 的 shipping gate（shippingEligible +
 *   rights decision SHA-256 指纹 + shippingApproval + remainingGates）。
 * - 形象姿势：docs/art/production/portraits/minho/manifest.json 的
 *   approved/pass 状态 + 每文件 SHA-256。
 * - 家居展示：docs/art/production/home-display/manifest.v2.json 的
 *   shippingEligible + 每文件 SHA-256（深度像素 QA 由
 *   scripts/check-home-display-assets.mjs 负责，发布脚本以子进程复用）。
 *
 * 三种判定结果：
 * - publish：通过门禁，进入上传计划。
 * - exclude：所属类目门禁未放行（如地标权利未清），跳过上传但不算错误，
 *   与生产构建剔除 dist/scenes 的行为一致。
 * - reject：完整性违规（哈希不符、未列入清单、已下架资产复活），
 *   整个发布流程必须失败，禁止任何上传。
 *
 * 本文件只导出纯函数与只读 IO（收集文件），供 publish-assets-oss.mjs
 * 与单元测试复用。
 */
import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

export const PUBLISHABLE_CATEGORIES = ['scenes', 'portraits', 'assets']

const CONTENT_TYPES = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

export const contentTypeFor = (filePath) => (
  CONTENT_TYPES[path.extname(filePath).toLowerCase()]
    ?? 'application/octet-stream'
)

export const sha256Hex = (bytes) => (
  createHash('sha256').update(bytes).digest('hex')
)

/**
 * 地标 shipping gate，逐条对齐 apps/web/vite.config.ts 里的构建期校验。
 * violations 非空表示清单自相矛盾或指纹过期——发布必须硬失败；
 * eligible=false 且无 violations 表示权利尚未清算的正常关闸状态。
 */
export const evaluateLandmarkShippingGate = ({
  manifestName,
  manifest,
  rightsDecision,
  rightsDecisionSha256,
}) => {
  const violations = []
  if (typeof manifest.shippingEligible !== 'boolean') {
    violations.push(`${manifestName}: missing shippingEligible gate`)
  }
  const rightsReview = manifest.source?.rightsReview
  if (
    rightsReview?.decisionRecord
    && rightsReview?.decisionRecordSha256 !== rightsDecisionSha256
  ) {
    violations.push(`${manifestName}: stale rights decision fingerprint`)
  }
  if (
    manifest.shippingEligible === true
    && (
      rightsDecision?.shippingEligible !== true
      || rightsDecision?.decision !== 'cleared-for-shipping'
      || (rightsDecision?.remainingGates?.length ?? 0) > 0
      || manifest.review?.shippingApproval !== 'approved'
      || (manifest.remainingGates?.length ?? 0) > 0
    )
  ) {
    violations.push(`${manifestName}: shipping gate is not fully approved`)
  }
  const eligible = manifest.shippingEligible === true && violations.length === 0
  return {
    eligible,
    violations,
    reason: eligible
      ? null
      : `landmark rights decision is ${rightsDecision?.decision ?? 'missing'}`,
  }
}

export const evaluatePortraitShippingGate = ({ manifestName, manifest }) => {
  const violations = []
  const eligible = manifest.portrait?.status === 'approved'
    && manifest.production?.state === 'approved'
    && manifest.production?.validationResult === 'pass'
  const poses = manifest.portrait?.poses ?? {}
  for (const pose of Object.keys(poses)) {
    if (!manifest.production?.artifacts?.[pose]?.sha256) {
      violations.push(
        `${manifestName}: pose "${pose}" has no approved artifact hash`,
      )
    }
  }
  return {
    eligible: eligible && violations.length === 0,
    violations,
    reason: eligible ? null : `${manifestName}: portrait is not approved`,
  }
}

export const evaluateHomeDisplayShippingGate = ({ manifestName, manifest }) => {
  const violations = []
  for (const asset of manifest.assets ?? []) {
    if (typeof asset.runtime !== 'string' || typeof asset.sha256 !== 'string') {
      violations.push(
        `${manifestName}: asset "${asset.id}" lacks runtime path or hash`,
      )
    }
  }
  const eligible = manifest.shippingEligible === true
  return {
    eligible: eligible && violations.length === 0,
    violations,
    reason: eligible
      ? null
      : `${manifestName}: home display assets are not shipping eligible`,
  }
}

/** imageSrc（`/scenes/…`）→ 经审批的 SHA-256。 */
export const landmarkScenesBySrc = (manifest) => new Map(
  (manifest.destinations ?? [])
    .flatMap(({ scenes }) => scenes ?? [])
    .map((scene) => [scene.imageSrc, scene.sha256]),
)

/** 姿势 imageSrc（`/portraits/…`）→ 经审批的 SHA-256。 */
export const portraitArtifactsBySrc = (manifest) => new Map(
  Object.entries(manifest.portrait?.poses ?? {}).map(([pose, src]) => [
    src,
    manifest.production?.artifacts?.[pose]?.sha256,
  ]),
)

/** runtime 路径（`/assets/…`）→ 经审批的 SHA-256。 */
export const homeDisplayAssetsByRuntime = (manifest) => new Map(
  (manifest.assets ?? []).map((asset) => [asset.runtime, asset.sha256]),
)

/**
 * 对收集到的运行时文件逐个做门禁判定。
 * files: [{ publicPath, sha256, bytes }]，publicPath 以 `/` 开头。
 */
export const classifyRuntimeAssets = ({ files, gates }) => files.map((file) => {
  const category = file.publicPath.split('/')[1]
  const verdictOf = (verdict, gate, reason = null) => ({
    ...file,
    category,
    verdict,
    gate,
    reason,
  })

  if (category === 'scenes') {
    if (!gates.landmarks.eligible) {
      return verdictOf('exclude', 'landmark-production-manifest', gates.landmarks.reason)
    }
    const approvedSha = gates.landmarks.scenesBySrc.get(file.publicPath)
    if (!approvedSha) {
      return verdictOf(
        'reject',
        'landmark-production-manifest',
        'not listed in the landmark production manifest',
      )
    }
    if (approvedSha !== file.sha256) {
      return verdictOf(
        'reject',
        'landmark-production-manifest',
        'content hash differs from the approved landmark manifest',
      )
    }
    return verdictOf('publish', 'landmark-production-manifest')
  }

  if (category === 'portraits') {
    if (!gates.portraits.eligible) {
      return verdictOf('exclude', 'portrait-production-manifest', gates.portraits.reason)
    }
    const approvedSha = gates.portraits.posesBySrc.get(file.publicPath)
    if (!approvedSha) {
      return verdictOf(
        'reject',
        'portrait-production-manifest',
        'not an approved portrait artifact',
      )
    }
    if (approvedSha !== file.sha256) {
      return verdictOf(
        'reject',
        'portrait-production-manifest',
        'content hash differs from the approved portrait manifest',
      )
    }
    return verdictOf('publish', 'portrait-production-manifest')
  }

  if (category === 'assets') {
    if (gates.homeDisplay.removedRuntimeAssets.has(file.publicPath)) {
      return verdictOf(
        'reject',
        'home-display-production-manifest',
        'removed runtime asset must not be republished',
      )
    }
    const approvedSha = gates.homeDisplay.assetsByRuntime.get(file.publicPath)
    if (approvedSha !== undefined) {
      if (!gates.homeDisplay.eligible) {
        return verdictOf(
          'exclude',
          'home-display-production-manifest',
          gates.homeDisplay.reason,
        )
      }
      if (approvedSha !== file.sha256) {
        return verdictOf(
          'reject',
          'home-display-production-manifest',
          'content hash differs from the approved home display manifest',
        )
      }
      return verdictOf('publish', 'home-display-production-manifest')
    }
    // 其余 /assets/ 文件是首发 UI 素材（图标、道具、行囊等），
    // 一直随生产构建整目录发布，视为基线放行。
    return verdictOf('publish', 'baseline-ui')
  }

  return verdictOf(
    'reject',
    'publishable-categories',
    `category "${category}" is outside the publishable runtime categories`,
  )
})

/**
 * 生成远程清单。assets 按路径排序保证确定性；contentHash 是对 assets
 * 数组规范 JSON 的 SHA-256，用作清单对象键里的版本号。
 */
export const buildPublishManifest = ({
  classified,
  cdnBaseUrl,
  keyPrefix = '',
  generatedAt,
  gates,
}) => {
  const byPath = (left, right) => left.path.localeCompare(right.path)
  const assets = classified
    .filter(({ verdict }) => verdict === 'publish')
    .map(({ publicPath, sha256, bytes, gate }) => ({
      path: publicPath,
      key: `${keyPrefix}${publicPath.slice(1)}`,
      sha256,
      bytes,
      contentType: contentTypeFor(publicPath),
      gate,
    }))
    .sort(byPath)
  const excluded = classified
    .filter(({ verdict }) => verdict === 'exclude')
    .map(({ publicPath, reason }) => ({ path: publicPath, reason }))
    .sort(byPath)
  return {
    schemaVersion: 1,
    manifestKind: 'published-runtime-assets',
    generatedAt,
    cdnBaseUrl,
    contentHash: sha256Hex(JSON.stringify(assets)),
    gates,
    assetCount: assets.length,
    totalBytes: assets.reduce((sum, { bytes }) => sum + bytes, 0),
    assets,
    excluded,
  }
}

export const publishManifestKeys = ({ contentHash, keyPrefix = '' }) => ({
  versioned: `${keyPrefix}manifests/assets.${contentHash.slice(0, 12)}.json`,
  latest: `${keyPrefix}manifests/assets.latest.json`,
})

/** 收集 apps/web/public 三个可发布类目下的全部文件并计算内容哈希。 */
export const collectRuntimeAssetFiles = async (publicRoot) => {
  const files = []
  for (const category of PUBLISHABLE_CATEGORIES) {
    const categoryRoot = path.join(publicRoot, category)
    try {
      await stat(categoryRoot)
    } catch {
      continue
    }
    const entries = await readdir(categoryRoot, {
      recursive: true,
      withFileTypes: true,
    })
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue
      const absolutePath = path.join(entry.parentPath, entry.name)
      const bytes = await readFile(absolutePath)
      files.push({
        publicPath: `/${path.relative(publicRoot, absolutePath).split(path.sep).join('/')}`,
        absolutePath,
        bytes: bytes.byteLength,
        sha256: sha256Hex(bytes),
      })
    }
  }
  return files.sort((left, right) => left.publicPath.localeCompare(right.publicPath))
}
