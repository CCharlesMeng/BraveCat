import {
  access,
  readFile,
  readdir,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(root, 'dist')
const productionRoot = path.join(root, 'docs/art/production/landmarks')

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const exists = async (filePath) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const manifestFiles = (await readdir(productionRoot))
  .map((filename) => ({
    filename,
    version: Number(filename.match(/^manifest\.v(\d+)\.json$/)?.[1] ?? -1),
  }))
  .filter(({ version }) => version >= 0)
  .sort((left, right) => right.version - left.version)

assert(manifestFiles.length > 0, 'production landmark manifest is missing')
const landmarkManifest = JSON.parse(
  await readFile(path.join(productionRoot, manifestFiles[0].filename), 'utf8'),
)
const portraitManifest = JSON.parse(
  await readFile(
    path.join(root, 'docs/art/production/portraits/minho/manifest.json'),
    'utf8',
  ),
)

for (const relativePath of [
  'icon.svg',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'manifest.webmanifest',
  'sw.js',
]) {
  assert(
    await exists(path.join(distRoot, relativePath)),
    `production build is missing ${relativePath}`,
  )
}

for (const imageSrc of Object.values(portraitManifest.portrait.poses)) {
  const relativePath = imageSrc.replace(/^\/+/, '')
  assert(
    await exists(path.join(distRoot, relativePath)),
    `production build is missing approved portrait ${imageSrc}`,
  )
}

const sceneOutputRoot = path.join(distRoot, 'scenes')
const developmentPreviewOutputRoot = path.join(distRoot, 'dev-art')
const developmentHomeArtPreviewOutputRoot = path.join(
  developmentPreviewOutputRoot,
  'home-v4',
)
const serviceWorker = await readFile(path.join(distRoot, 'sw.js'), 'utf8')
const applicationJavascript = (
  await Promise.all(
    (await readdir(path.join(distRoot, 'assets')))
      .filter((filename) => filename.endsWith('.js'))
      .map((filename) => readFile(
        path.join(distRoot, 'assets', filename),
        'utf8',
      )),
  )
).join('\n')
assert(
  !applicationJavascript.includes('treat-grant'),
  'development treat grant control leaked into the production build',
)
assert(
  !(await exists(developmentPreviewOutputRoot)),
  'development-only art preview leaked into the production build',
)
assert(
  !(await exists(developmentHomeArtPreviewOutputRoot)),
  'non-shipping home art preview leaked into the production build',
)
assert(
  !serviceWorker.includes('dev-art/latest-v5'),
  'service worker caches development-only art preview assets',
)
assert(
  !serviceWorker.includes('dev-art/home-v3')
    && !serviceWorker.includes('dev-art/home-v4'),
  'service worker caches non-shipping home art preview assets',
)
if (landmarkManifest.shippingEligible) {
  const expectedScenes = landmarkManifest.destinations.flatMap(
    ({ scenes }) => scenes,
  )
  const emittedScenes = (await readdir(sceneOutputRoot))
    .filter((filename) => filename.endsWith('.webp'))
  assert(
    emittedScenes.length === expectedScenes.length,
    `expected ${expectedScenes.length} shipping scenes, got ${emittedScenes.length}`,
  )
} else {
  assert(
    !(await exists(sceneOutputRoot)),
    'non-shipping landmark scenes leaked into the production build',
  )
  assert(
    !serviceWorker.includes('bravecat-landmark-scenes'),
    'service worker caches non-shipping landmark scenes',
  )
}

const webManifest = JSON.parse(
  await readFile(path.join(distRoot, 'manifest.webmanifest'), 'utf8'),
)
assert(
  webManifest.name === '咪游记' && webManifest.short_name === '咪游记',
  'PWA display name is stale',
)

console.log(
  `production build assets verified: landmarks ${
    landmarkManifest.shippingEligible ? 'included' : 'excluded'
  }, ${Object.keys(portraitManifest.portrait.poses).length} portrait poses included`,
)
