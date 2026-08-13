/**
 * 把 apps/web/public 下可发布的运行时资源（scenes / portraits / assets）
 * 发布到阿里云 OSS（走 S3 兼容 API，@aws-sdk/client-s3），并生成带内容
 * 哈希的远程清单。换云只需改环境变量，不改代码。
 *
 * 用法：
 *   npm run assets:publish                 # 默认 dry-run：收集 + 门禁 + 清单 + 打印上传计划
 *   npm run assets:publish -- --upload     # 真正上传（要求凭证齐全）
 *   npm run assets:publish -- --upload --force  # 覆盖远端已存在的对象
 *
 * 环境变量（可放根目录 .env，见 .env.example）：
 *   ASSET_PUBLISH_ENDPOINT            OSS 的 S3 兼容 endpoint，如 https://oss-cn-hangzhou.aliyuncs.com
 *   ASSET_PUBLISH_REGION              区域 ID，如 oss-cn-hangzhou（缺省 auto）
 *   ASSET_PUBLISH_BUCKET              目标 bucket
 *   ASSET_PUBLISH_ACCESS_KEY_ID       访问密钥 AK
 *   ASSET_PUBLISH_SECRET_ACCESS_KEY   访问密钥 SK
 *   ASSET_PUBLISH_PREFIX              可选对象键前缀（如 prod/）
 *   ASSET_CDN_BASE_URL                公网 CDN 域名（记录进清单；也是
 *                                     VITE_ASSET_BASE_URL 应取的值）
 *
 * 版权门禁（硬要求，上传前必须全部通过）：
 *   1. scripts/check-home-display-assets.mjs 以子进程复用（深度像素 QA）。
 *   2. 地标 shipping gate 与 apps/web/vite.config.ts 同一套判定：
 *      shippingEligible + rights decision SHA-256 指纹 + shippingApproval。
 *   3. 形象/家居资产逐文件比对生产清单里的 SHA-256。
 *   不合格资产 verdict=reject 时整个发布失败；类目门禁未放行（如地标
 *   权利未清）则该类目 exclude，跳过上传，与生产构建剔除行为一致。
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildPublishManifest,
  classifyRuntimeAssets,
  collectRuntimeAssetFiles,
  evaluateHomeDisplayShippingGate,
  evaluateLandmarkShippingGate,
  evaluatePortraitShippingGate,
  homeDisplayAssetsByRuntime,
  landmarkScenesBySrc,
  portraitArtifactsBySrc,
  publishManifestKeys,
  sha256Hex,
} from './lib/asset-publish.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = path.join(root, 'apps/web/public')
const localManifestPath = path.join(root, '.asset-publish/asset-manifest.json')

const envFile = path.join(root, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const args = process.argv.slice(2)
const knownFlags = new Set(['--upload', '--dry-run', '--force'])
for (const arg of args) {
  if (!knownFlags.has(arg)) {
    console.error(`unknown flag ${arg}; expected --upload / --dry-run / --force`)
    process.exit(1)
  }
}
const wantsUpload = args.includes('--upload') && !args.includes('--dry-run')
const force = args.includes('--force')

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

// —— 门禁 1：复用既有家居展示深度检查（npm run build 同款）。 ——
try {
  execFileSync(
    process.execPath,
    [path.join(root, 'scripts/check-home-display-assets.mjs')],
    { stdio: 'pipe' },
  )
  console.log('✓ home display gate passed (scripts/check-home-display-assets.mjs)')
} catch (error) {
  console.error(String(error.stderr ?? error.message))
  fail('home display gate failed; refusing to publish')
}

// —— 门禁 2/3：加载生产清单并评估 shipping gate。 ——
const landmarkManifestRoot = path.join(root, 'docs/art/production/landmarks')
const landmarkManifestFiles = (await readdir(landmarkManifestRoot))
  .map((filename) => ({
    filename,
    version: Number(filename.match(/^manifest\.v(\d+)\.json$/)?.[1] ?? -1),
  }))
  .filter(({ version }) => version >= 0)
  .sort((left, right) => right.version - left.version)
if (landmarkManifestFiles.length === 0) {
  fail('no landmark production manifest is available')
}
const landmarkManifestName = `docs/art/production/landmarks/${landmarkManifestFiles[0].filename}`
const landmarkManifest = JSON.parse(
  await readFile(path.join(root, landmarkManifestName), 'utf8'),
)
const rightsDecisionPath = landmarkManifest.source?.rightsReview?.decisionRecord
let rightsDecision = null
let rightsDecisionSha256 = null
if (rightsDecisionPath) {
  const rightsDecisionBytes = await readFile(path.join(root, rightsDecisionPath))
  rightsDecision = JSON.parse(rightsDecisionBytes.toString('utf8'))
  rightsDecisionSha256 = sha256Hex(rightsDecisionBytes)
}

const portraitManifestName = 'docs/art/production/portraits/minho/manifest.json'
const portraitManifest = JSON.parse(
  await readFile(path.join(root, portraitManifestName), 'utf8'),
)
const homeDisplayManifestName = 'docs/art/production/home-display/manifest.v2.json'
const homeDisplayManifest = JSON.parse(
  await readFile(path.join(root, homeDisplayManifestName), 'utf8'),
)

const landmarkGate = evaluateLandmarkShippingGate({
  manifestName: landmarkManifestName,
  manifest: landmarkManifest,
  rightsDecision,
  rightsDecisionSha256,
})
const portraitGate = evaluatePortraitShippingGate({
  manifestName: portraitManifestName,
  manifest: portraitManifest,
})
const homeDisplayGate = evaluateHomeDisplayShippingGate({
  manifestName: homeDisplayManifestName,
  manifest: homeDisplayManifest,
})

const violations = [
  ...landmarkGate.violations,
  ...portraitGate.violations,
  ...homeDisplayGate.violations,
]
if (violations.length > 0) {
  for (const violation of violations) console.error(`  ✗ ${violation}`)
  fail('shipping gate integrity violations; refusing to publish')
}

// —— 收集与逐文件判定。 ——
const files = await collectRuntimeAssetFiles(publicRoot)
const classified = classifyRuntimeAssets({
  files,
  gates: {
    landmarks: { ...landmarkGate, scenesBySrc: landmarkScenesBySrc(landmarkManifest) },
    portraits: { ...portraitGate, posesBySrc: portraitArtifactsBySrc(portraitManifest) },
    homeDisplay: {
      ...homeDisplayGate,
      assetsByRuntime: homeDisplayAssetsByRuntime(homeDisplayManifest),
      removedRuntimeAssets: new Set(homeDisplayManifest.removedRuntimeAssets ?? []),
    },
  },
})

const rejected = classified.filter(({ verdict }) => verdict === 'reject')
if (rejected.length > 0) {
  for (const { publicPath, reason } of rejected) {
    console.error(`  ✗ ${publicPath}: ${reason}`)
  }
  fail(`${rejected.length} asset(s) failed the shipping gate; refusing to upload`)
}

// —— 清单生成。 ——
const keyPrefixRaw = process.env.ASSET_PUBLISH_PREFIX ?? ''
const keyPrefix = keyPrefixRaw && !keyPrefixRaw.endsWith('/')
  ? `${keyPrefixRaw}/`
  : keyPrefixRaw
const manifest = buildPublishManifest({
  classified,
  cdnBaseUrl: process.env.ASSET_CDN_BASE_URL ?? '',
  keyPrefix,
  generatedAt: new Date().toISOString(),
  gates: {
    landmarks: {
      manifest: landmarkManifestName,
      eligible: landmarkGate.eligible,
      reason: landmarkGate.reason,
    },
    portraits: {
      manifest: portraitManifestName,
      eligible: portraitGate.eligible,
      reason: portraitGate.reason,
    },
    homeDisplay: {
      manifest: homeDisplayManifestName,
      eligible: homeDisplayGate.eligible,
      reason: homeDisplayGate.reason,
      deepCheck: 'scripts/check-home-display-assets.mjs',
    },
  },
})
await mkdir(path.dirname(localManifestPath), { recursive: true })
await writeFile(localManifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

const manifestKeys = publishManifestKeys({
  contentHash: manifest.contentHash,
  keyPrefix,
})
const bucket = process.env.ASSET_PUBLISH_BUCKET || '<bucket>'
const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)}MB`

console.log(`✓ shipping gates evaluated (${landmarkManifestName})`)
for (const [name, gate] of Object.entries(manifest.gates)) {
  console.log(`    ${name}: ${gate.eligible ? 'eligible' : `excluded — ${gate.reason}`}`)
}
console.log(`✓ collected ${files.length} runtime files under apps/web/public`)
console.log(`✓ manifest written to ${path.relative(root, localManifestPath)}`)
console.log(`    contentHash ${manifest.contentHash.slice(0, 12)}, ${manifest.assetCount} assets, ${megabytes(manifest.totalBytes)}`)
if (manifest.excluded.length > 0) {
  console.log(`  excluded from upload (${manifest.excluded.length}):`)
  const reasons = new Map()
  for (const { reason } of manifest.excluded) {
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  }
  for (const [reason, count] of reasons) {
    console.log(`    ${count} file(s): ${reason}`)
  }
}
console.log('  upload plan:')
for (const asset of manifest.assets) {
  console.log(`    PUT s3://${bucket}/${asset.key} (${asset.contentType}, ${asset.bytes} bytes)`)
}
console.log(`    PUT s3://${bucket}/${manifestKeys.versioned} (application/json)`)
console.log(`    PUT s3://${bucket}/${manifestKeys.latest} (application/json)`)

const credentialNames = [
  'ASSET_PUBLISH_ENDPOINT',
  'ASSET_PUBLISH_BUCKET',
  'ASSET_PUBLISH_ACCESS_KEY_ID',
  'ASSET_PUBLISH_SECRET_ACCESS_KEY',
]
const missingCredentials = credentialNames.filter((name) => !process.env[name])

if (!wantsUpload) {
  console.log(
    missingCredentials.length > 0
      ? `dry-run complete (missing ${missingCredentials.join(', ')}); nothing uploaded`
      : 'dry-run complete; pass --upload to actually publish',
  )
  process.exit(0)
}
if (missingCredentials.length > 0) {
  fail(`--upload requires credentials; missing ${missingCredentials.join(', ')}`)
}

// —— 真正上传：S3 兼容 API 指向 OSS。 ——
const { S3Client, HeadObjectCommand, PutObjectCommand } = await import(
  '@aws-sdk/client-s3'
)
const client = new S3Client({
  endpoint: process.env.ASSET_PUBLISH_ENDPOINT,
  region: process.env.ASSET_PUBLISH_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.ASSET_PUBLISH_ACCESS_KEY_ID,
    secretAccessKey: process.env.ASSET_PUBLISH_SECRET_ACCESS_KEY,
  },
  // OSS 的 S3 兼容层用虚拟主机风格寻址 bucket。
  forcePathStyle: false,
})

const remoteExists = async (key) => {
  try {
    await client.send(new HeadObjectCommand({
      Bucket: process.env.ASSET_PUBLISH_BUCKET,
      Key: key,
    }))
    return true
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404 || error.name === 'NotFound') {
      return false
    }
    throw error
  }
}

const putObject = async (key, body, contentType, cacheControl) => {
  await client.send(new PutObjectCommand({
    Bucket: process.env.ASSET_PUBLISH_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  }))
}

const immutableCache = 'public, max-age=31536000, immutable'
let uploaded = 0
let skipped = 0
for (const asset of manifest.assets) {
  if (!force && await remoteExists(asset.key)) {
    skipped += 1
    continue
  }
  const body = await readFile(path.join(publicRoot, asset.path.slice(1)))
  await putObject(asset.key, body, asset.contentType, immutableCache)
  uploaded += 1
  console.log(`  uploaded ${asset.key}`)
}
const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`
await putObject(manifestKeys.versioned, manifestBody, 'application/json', immutableCache)
await putObject(manifestKeys.latest, manifestBody, 'application/json', 'public, max-age=300')
console.log(
  `✓ published ${uploaded} asset(s) (${skipped} already present) + manifest ${manifestKeys.versioned}`,
)
if (process.env.ASSET_CDN_BASE_URL) {
  console.log(`  latest manifest: ${process.env.ASSET_CDN_BASE_URL}/${manifestKeys.latest}`)
}
