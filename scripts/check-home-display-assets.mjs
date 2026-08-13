import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(
  root,
  'docs/art/production/home-display/manifest.v2.json',
)
const candidateRoot = path.join(root, 'docs/art/candidates/home-display-v2')
const candidateManifestPath = path.join(candidateRoot, 'manifest.candidate.json')
const removedTableRuntime = '/assets/home/display--souvenir-table--v01.png'

const exists = async (filePath) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

assert(await exists(manifestPath), 'home display production manifest is missing')
assert(await exists(candidateManifestPath), 'home display candidate manifest is missing')

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const candidateManifest = JSON.parse(await readFile(candidateManifestPath, 'utf8'))
assert(manifest.shippingEligible, 'home display assets are not shipping eligible')
assert(manifest.styleIntensity === 'B', 'home display style intensity is stale')
assert(candidateManifest.shippingEligible, 'home display candidate QA is not approved')
assert(
  candidateManifest.perspectiveReference
    === 'public/dev-art/home-v4/interior-foreground.png',
  'home display candidate uses the wrong perspective reference',
)
assert(
  Array.isArray(manifest.assets) && manifest.assets.length === 4,
  'home display manifest must contain wall, occlusion, and souvenir art',
)
assert(
  Array.isArray(manifest.postcardSlots) && manifest.postcardSlots.length === 6,
  'home display manifest must define six postcard slots',
)
assert(
  Array.isArray(manifest.souvenirAnchors) && manifest.souvenirAnchors.length === 3,
  'home display manifest must define three souvenir anchors',
)
assert(
  manifest.rightWallPlane?.cornerX === 768
    && manifest.rightWallPlane?.projection
      === 'cabinet-referenced-quadrilaterals'
    && manifest.tablePlane?.perspectiveSkewY === 10,
  'home display physical plane metadata is stale',
)
assert(
  manifest.removedRuntimeAssets?.includes(removedTableRuntime),
  'removed souvenir table asset is not recorded',
)

for (const asset of manifest.assets) {
  assert(typeof asset.id === 'string', 'home display asset ID is missing')
  assert(
    typeof asset.candidate === 'string' && await exists(path.join(root, asset.candidate)),
    `home display candidate is missing for ${asset.id}`,
  )
  assert(
    typeof asset.runtime === 'string' && asset.runtime.startsWith('/assets/'),
    `home display runtime path is invalid for ${asset.id}`,
  )

  const candidatePath = path.join(root, asset.candidate)
  const runtimePath = path.join(root, 'public', asset.runtime)
  assert(await exists(runtimePath), `home display runtime asset is missing for ${asset.id}`)

  const bytes = await readFile(runtimePath)
  const candidateBytes = await readFile(candidatePath)
  const metadata = await sharp(bytes).metadata()
  assert(metadata.format === 'png', `${asset.id} must be a PNG`)
  assert(metadata.space === 'srgb', `${asset.id} must be sRGB`)
  assert(metadata.hasAlpha && metadata.channels === 4, `${asset.id} must have straight alpha`)
  assert(
    metadata.width === asset.width && metadata.height === asset.height,
    `${asset.id} dimensions differ from its manifest`,
  )
  assert(
    createHash('sha256').update(bytes).digest('hex') === asset.sha256,
    `${asset.id} does not match its approved hash`,
  )
  assert(
    createHash('sha256').update(candidateBytes).digest('hex') === asset.sha256,
    `${asset.id} candidate and runtime bytes differ`,
  )

  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  })
  let transparentPixels = 0
  let visiblePixels = 0
  for (let index = 0; index < info.width * info.height; index += 1) {
    const offset = index * 4
    if (data[offset + 3] === 0) {
      transparentPixels += 1
      assert(
        data[offset] === 0 && data[offset + 1] === 0 && data[offset + 2] === 0,
        `${asset.id} has nonzero RGB in fully transparent pixels`,
      )
    } else {
      visiblePixels += 1
    }
  }
  assert(transparentPixels > 0, `${asset.id} has no transparent pixels`)
  assert(visiblePixels > 0, `${asset.id} has no visible pixels`)
}

assert(
  candidateManifest.wallFixture.cornerX === 768
    && candidateManifest.wallFixture.projection
      === 'cabinet-referenced-quadrilaterals',
  'home display wall-plane model is stale',
)
const cabinetReference = manifest.rightWallPlane.cabinetPerspectiveReference
const candidateCabinetReference = (
  candidateManifest.wallFixture.cabinetPerspectiveReference
)
assert(
  cabinetReference?.rearSlope === 65 / 262
    && cabinetReference?.frontSlope === 50 / 262
    && JSON.stringify(candidateCabinetReference)
      === JSON.stringify(cabinetReference),
  'home display does not use the cabinet perspective reference',
)
const [minimumWallSlope, maximumWallSlope] = [
  cabinetReference.frontSlope,
  cabinetReference.rearSlope,
].sort((left, right) => left - right)
const polygonArea = (quad) => Math.abs(quad.reduce(
  (sum, [x, y], index) => {
    const [nextX, nextY] = quad[(index + 1) % quad.length]
    return sum + x * nextY - nextX * y
  },
  0,
)) / 2

for (const slot of manifest.postcardSlots) {
  assert(
    Array.isArray(slot.quad) && slot.quad.length === 4,
    'postcard slot must be a projective quadrilateral',
  )
  assert(
    slot.quad.every(([x, y]) => (
      x > candidateManifest.wallFixture.cornerX
      && x <= 1200
      && y >= 0
      && y <= 1600
    )),
    'postcard slot leaves the physical right-wall plane',
  )
  const [[topLeftX, topLeftY], [topRightX, topRightY], [bottomRightX, bottomRightY], [bottomLeftX, bottomLeftY]] = slot.quad
  const topSlope = (topRightY - topLeftY) / (topRightX - topLeftX)
  const bottomSlope = (
    (bottomRightY - bottomLeftY)
    / (bottomRightX - bottomLeftX)
  )
  assert(
    topSlope >= minimumWallSlope && topSlope <= maximumWallSlope
      && bottomSlope >= minimumWallSlope
      && bottomSlope <= maximumWallSlope,
    'postcard edges disagree with the cabinet perspective',
  )
  assert(
    Math.abs(topSlope - bottomSlope) > 0.001,
    'postcard slot fell back to an affine parallelogram',
  )
}
for (let row = 0; row < manifest.postcardSlots.length; row += 2) {
  const near = manifest.postcardSlots[row]
  const far = manifest.postcardSlots[row + 1]
  assert(
    polygonArea(far.quad) < polygonArea(near.quad),
    'far postcard does not shrink along the right-wall plane',
  )
}

const tabletop = candidateManifest.souvenirDisplay.tabletopQuadrilateral
const pointInsidePolygon = ([x, y], polygon) => {
  let inside = false
  for (let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1) {
    const [currentX, currentY] = polygon[current]
    const [previousX, previousY] = polygon[previous]
    if (
      (currentY > y) !== (previousY > y)
      && x < ((previousX - currentX) * (y - currentY))
        / (previousY - currentY) + currentX
    ) inside = !inside
  }
  return inside
}

for (const anchor of manifest.souvenirAnchors) {
  assert(
    anchor.x >= 900 && anchor.x + anchor.width <= 1150,
    'souvenir anchor leaves the original table width',
  )
  assert(
    anchor.y >= 880 && anchor.y + anchor.height <= 1020,
    'souvenir anchor leaves the original tabletop depth',
  )
  const shear = Math.tan((anchor.skewY ?? 0) * Math.PI / 180)
  const supportPoint = [
    anchor.x + anchor.width / 2,
    anchor.y + anchor.height + shear * anchor.width / 2,
  ]
  assert(
    pointInsidePolygon(supportPoint, tabletop),
    'souvenir support point leaves the tabletop polygon',
  )
}

const staticQaPath = path.join(candidateRoot, candidateManifest.qa.fullComposite)
assert(await exists(staticQaPath), 'home display static QA composite is missing')
const { data: tabletopQaPixels, info: tabletopQaInfo } = await sharp(staticQaPath)
  .extract({ left: 920, top: 900, width: 280, height: 180 })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
let opaqueBlackPixels = 0
for (let index = 0; index < tabletopQaInfo.width * tabletopQaInfo.height; index += 1) {
  const offset = index * 4
  if (
    tabletopQaPixels[offset] < 8
    && tabletopQaPixels[offset + 1] < 8
    && tabletopQaPixels[offset + 2] < 8
    && tabletopQaPixels[offset + 3] > 240
  ) opaqueBlackPixels += 1
}
assert(
  opaqueBlackPixels === 0,
  'home display static QA contains opaque black souvenir padding',
)

assert(
  !await exists(path.join(root, 'public', removedTableRuntime)),
  'removed souvenir table runtime asset still exists',
)

for (const sourcePath of [
  'src/App.svelte',
  'src/app.css',
  'src/lib/homeArt.ts',
  'src/lib/homeTheme/forms/classic-v4.ts',
  'src/lib/homeTheme/pieces/index.ts',
]) {
  const source = await readFile(path.join(root, sourcePath), 'utf8')
  assert(
    !source.includes('display--souvenir-table'),
    `${sourcePath} still references the removed souvenir table`,
  )
}

const runtimeQaPaths = candidateManifest.qa?.runtimeMobile470
assert(
  Array.isArray(runtimeQaPaths) && runtimeQaPaths.length === 4,
  'home display candidate must include four mobile runtime captures',
)
for (const qaPath of runtimeQaPaths) {
  const fullPath = path.join(candidateRoot, qaPath)
  assert(await exists(fullPath), `mobile runtime QA capture is missing: ${qaPath}`)
  const metadata = await sharp(fullPath).metadata()
  assert(
    metadata.width === 470 && metadata.height === 900,
    `mobile runtime QA capture has stale dimensions: ${qaPath}`,
  )
}

const runtimeReportPath = path.join(candidateRoot, candidateManifest.qa.runtimeReport)
assert(await exists(runtimeReportPath), 'mobile runtime QA report is missing')
const runtimeReport = JSON.parse(await readFile(runtimeReportPath, 'utf8'))
assert(
  runtimeReport.viewport?.width === 470 && runtimeReport.viewport?.height === 900,
  'mobile runtime QA viewport is stale',
)
const expectedStates = {
  empty: [0, 6, 0, false],
  partial: [2, 4, 2, false],
  full: [6, 0, 3, false],
  'departure-note': [2, 4, 3, true],
}
for (const state of runtimeReport.states ?? []) {
  const actual = [
    state.postcardCount,
    state.emptySlotCount,
    state.souvenirCount,
    state.departureNoteVisible,
  ]
  assert(state.shellWidth === 470, `${state.state} runtime QA width is stale`)
  assert(state.fixtureLoaded, `${state.state} runtime QA fixture failed to load`)
  assert(!state.emptyTreatVisible, `${state.state} shows the empty Treat control`)
  assert(
    state.postcardCount === 0 || state.postcardHitTarget,
    `${state.state} postcard is covered by another Home layer`,
  )
  assert(
    state.souvenirCount === 0 || state.souvenirHitTarget,
    `${state.state} souvenir is covered by another Home layer`,
  )
  assert(
    JSON.stringify(actual) === JSON.stringify(expectedStates[state.state]),
    `${state.state} runtime QA counts are stale`,
  )
}
assert(
  runtimeReport.states?.length === Object.keys(expectedStates).length,
  'mobile runtime QA report is missing states',
)
assert(
  runtimeReport.interactions?.postcard === true
    && runtimeReport.interactions?.souvenir === true,
  'mobile runtime QA did not click both Display detail targets',
)

console.log('home display assets verified')
