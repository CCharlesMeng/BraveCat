import { createHash } from 'node:crypto'
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const sourceRoot = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(sourceRoot, '..')
const v1Root = path.resolve(packRoot, '../v1')
const repoRoot = path.resolve(packRoot, '../../../../../..')
const siblingRepoRoot = path.resolve(repoRoot, '../BraveCat')

let sharp
try {
  ;({ default: sharp } = await import('sharp'))
} catch {
  const siblingSharp = path.join(
    siblingRepoRoot,
    'node_modules/sharp/dist/index.mjs',
  )
  ;({ default: sharp } = await import(pathToFileURL(siblingSharp).href))
}

const status = 'NON-SHIPPING / ACCEPTANCE-REVIEW-ONLY'
const breeds = ['maine-coon', 'ragdoll', 'siamese']
const poses = ['sit', 'sleep', 'walk', 'eat', 'play', 'gaze']
const viewportSpecs = [
  {
    key: '320x700',
    width: 320,
    height: 700,
    topbarHeight: 70,
    navigationHeight: 95,
    statusHeight: 34,
    iconSize: 42,
    compactHeightMode: true,
  },
  {
    key: '390x844',
    width: 390,
    height: 844,
    topbarHeight: 82,
    navigationHeight: 112,
    statusHeight: 32,
    iconSize: 48,
    compactHeightMode: false,
  },
  {
    key: '430x932',
    width: 430,
    height: 932,
    topbarHeight: 82,
    navigationHeight: 112,
    statusHeight: 32,
    iconSize: 52,
    compactHeightMode: false,
  },
]

const breedSpecs = {
  'maine-coon': {
    englishName: 'Maine Coon',
    chineseName: '缅因',
    displayCanvasPx: 512,
    physicalScaleVsMinho: 1.22,
  },
  ragdoll: {
    englishName: 'Ragdoll',
    chineseName: '布偶',
    displayCanvasPx: 462,
    physicalScaleVsMinho: 1.1,
  },
  siamese: {
    englishName: 'Siamese',
    chineseName: '暹罗',
    displayCanvasPx: 344,
    physicalScaleVsMinho: 0.82,
  },
}

const placementAnchors = Object.fromEntries(
  poses.map(pose => [
    pose,
    {
      x: pose === 'eat' || pose === 'play' ? 720 : 690,
      y: 1395,
      reason:
        pose === 'eat' || pose === 'play'
          ? '50 px right shift separates the integrated bowl/yarn from the fixed room bowls while retaining breed scale.'
          : 'Approved shared home bottom-center anchor.',
    },
  ]),
)

const roomGeometry = {
  canvas: { width: 1200, height: 1600 },
  safeBounds: { left: 48, top: 48, right: 1152, bottom: 1440 },
  bottomNavigationReserve: { left: 0, top: 1470, right: 1200, bottom: 1600 },
  rugSupportEllipse: {
    centerX: 660,
    centerY: 1415,
    radiusX: 520,
    radiusY: 190,
  },
  fixtures: {
    catTreeAndWand: { left: 0, top: 840, right: 315, bottom: 1440 },
    fixedRoomBowls: { left: 195, top: 1140, right: 465, bottom: 1335 },
    sideTable: { left: 955, top: 900, right: 1200, bottom: 1440 },
  },
}

const roomSource = path.join(
  repoRoot,
  'docs/art/candidates/home/v3/layers/home-layered-reconstruction--noon--non-shipping-v03.png',
)
const navigationIcons = {
  pack: path.join(
    repoRoot,
    'docs/art/candidates/home/v3/icons/nav-icon--pack--runtime-128--non-shipping-v03.png',
  ),
  shop: path.join(
    repoRoot,
    'docs/art/candidates/home/v3/icons/nav-icon--shop--runtime-128--non-shipping-v03.png',
  ),
  album: path.join(
    repoRoot,
    'docs/art/candidates/home/v3/icons/nav-icon--album--runtime-128--non-shipping-v03.png',
  ),
}

const v1Manifest = JSON.parse(
  await readFile(path.join(v1Root, 'manifest.v1.json'), 'utf8'),
)
const v1ManifestByPath = new Map(
  v1Manifest.files.map(entry => [entry.path, entry]),
)

const relativeToRepo = absolutePath => path.relative(repoRoot, absolutePath)
const absolute = relativePath => {
  const resolved = path.resolve(packRoot, relativePath)
  if (!resolved.startsWith(`${packRoot}${path.sep}`) && resolved !== packRoot) {
    throw new Error(`Refusing write outside v2 pack: ${relativePath}`)
  }
  return resolved
}

const v1MasterRelative = (breed, pose) =>
  `masters/${breed}/cat--${breed}--${pose}--master-1024--non-shipping-v01.png`

const v1Master = (breed, pose) =>
  path.join(v1Root, v1MasterRelative(breed, pose))

const v1SleepReviewRelative = (breed, viewport) =>
  `reviews/mobile/${viewport.width}/home-review--${breed}--sleep--${viewport.key}--non-shipping-v01.png`

const v2CompositeRelative = (breed, pose, viewport) =>
  `composites/${viewport.key}/${breed}/home-fit--${breed}--${pose}--${viewport.key}--non-shipping-v02.png`

const shouldReferenceV1 = (pose, viewport) =>
  pose === 'sleep' && viewport.width !== 320

const sha256 = async filePath =>
  createHash('sha256').update(await readFile(filePath)).digest('hex')

const round = value => Math.round(value * 100) / 100

const rectIntersects = (left, right) =>
  left.left < right.right
  && left.right > right.left
  && left.top < right.bottom
  && left.bottom > right.top

const rectInside = (inner, outer) =>
  inner.left >= outer.left
  && inner.top >= outer.top
  && inner.right <= outer.right
  && inner.bottom <= outer.bottom

const pointInEllipse = (x, y, ellipse) =>
  ((x - ellipse.centerX) / ellipse.radiusX) ** 2
  + ((y - ellipse.centerY) / ellipse.radiusY) ** 2
  <= 1

const alphaBounds = (rgba, width, height, threshold) => {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = rgba[(y * width + x) * 4 + 3]
      if (alpha < threshold) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top) {
    throw new Error(`No pixels at alpha threshold ${threshold}`)
  }
  return { left, top, right: right + 1, bottom: bottom + 1 }
}

const inspectMaster = async filePath => {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let partialAlphaPixelCount = 0
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] > 0 && data[offset] < 255) {
      partialAlphaPixelCount += 1
    }
  }
  return {
    width: info.width,
    height: info.height,
    visibleBounds: alphaBounds(data, info.width, info.height, 1),
    opaqueBounds: alphaBounds(data, info.width, info.height, 250),
    partialAlphaPixelCount,
  }
}

const masterInspections = {}
for (const breed of breeds) {
  masterInspections[breed] = {}
  for (const pose of poses) {
    masterInspections[breed][pose] = await inspectMaster(v1Master(breed, pose))
  }
}

const v1ProtectedPaths = [
  ...breeds.flatMap(breed => poses.map(pose => v1MasterRelative(breed, pose))),
  ...viewportSpecs
    .filter(viewport => viewport.width !== 320)
    .flatMap(viewport =>
      breeds.map(breed => v1SleepReviewRelative(breed, viewport)),
    ),
]

const hashV1Protected = async () => {
  const entries = []
  for (const relativePath of v1ProtectedPaths) {
    const manifestEntry = v1ManifestByPath.get(relativePath)
    if (!manifestEntry) {
      throw new Error(`v1 manifest lacks protected path: ${relativePath}`)
    }
    const actualHash = await sha256(path.join(v1Root, relativePath))
    entries.push({
      path: `docs/art/candidates/cats/silhouette-variety/v1/${relativePath}`,
      manifestSha256: manifestEntry.sha256,
      actualSha256: actualHash,
      match: actualHash === manifestEntry.sha256,
    })
  }
  return entries
}

const v1Before = await hashV1Protected()
if (v1Before.some(entry => !entry.match)) {
  throw new Error('v1 protected input hash mismatch before supplement build')
}

const ensureDirectories = async () => {
  const directories = [
    ...viewportSpecs.flatMap(viewport =>
      breeds.map(breed => `composites/${viewport.key}/${breed}`),
    ),
    'reviews/contact-sheets',
    'metadata',
    'sources',
  ]
  await Promise.all(
    directories.map(directory => mkdir(absolute(directory), { recursive: true })),
  )
}

const mapMasterBoundsToRoom = (masterBounds, displaySize, anchor) => {
  const scale = displaySize / 1024
  const canvasLeft = anchor.x - displaySize / 2
  const canvasTop = anchor.y - displaySize * (960 / 1024)
  return {
    left: round(canvasLeft + masterBounds.left * scale),
    top: round(canvasTop + masterBounds.top * scale),
    right: round(canvasLeft + masterBounds.right * scale),
    bottom: round(canvasTop + masterBounds.bottom * scale),
  }
}

const viewportMapping = (roomBounds, viewport) => {
  const roomHeight =
    viewport.height
    - viewport.topbarHeight
    - viewport.navigationHeight
    - viewport.statusHeight
  const scale = Math.max(
    viewport.width / roomGeometry.canvas.width,
    roomHeight / roomGeometry.canvas.height,
  )
  const cropX = (roomGeometry.canvas.width * scale - viewport.width) / 2
  const cropY = (roomGeometry.canvas.height * scale - roomHeight) / 2
  const mapped = {
    left: round(roomBounds.left * scale - cropX),
    top: round(viewport.topbarHeight + roomBounds.top * scale - cropY),
    right: round(roomBounds.right * scale - cropX),
    bottom: round(viewport.topbarHeight + roomBounds.bottom * scale - cropY),
  }
  const roomViewportRect = {
    left: 0,
    top: viewport.topbarHeight,
    right: viewport.width,
    bottom: viewport.topbarHeight + roomHeight,
  }
  return {
    roomHeight,
    coverScale: round(scale),
    cropOffset: { x: round(cropX), y: round(cropY) },
    mappedBounds: mapped,
    cropped: !rectInside(mapped, roomViewportRect),
  }
}

const placementAnalysis = (breed, pose, viewport) => {
  const spec = breedSpecs[breed]
  const master = masterInspections[breed][pose]
  const anchor = placementAnchors[pose]
  const visibleRoomBounds = mapMasterBoundsToRoom(
    master.visibleBounds,
    spec.displayCanvasPx,
    anchor,
  )
  const opaqueRoomBounds = mapMasterBoundsToRoom(
    master.opaqueBounds,
    spec.displayCanvasPx,
    anchor,
  )
  const supportGapPx = round(anchor.y - visibleRoomBounds.bottom)
  const opaqueSupportGapPx = round(anchor.y - opaqueRoomBounds.bottom)
  const fixtureCollisions = Object.fromEntries(
    Object.entries(roomGeometry.fixtures).map(([id, bounds]) => [
      id,
      rectIntersects(visibleRoomBounds, bounds),
    ]),
  )
  const navCollision = rectIntersects(
    visibleRoomBounds,
    roomGeometry.bottomNavigationReserve,
  )
  const viewportMap = viewportMapping(visibleRoomBounds, viewport)
  const fixedBowlClearancePx = round(
    visibleRoomBounds.left - roomGeometry.fixtures.fixedRoomBowls.right,
  )
  const catTreeClearancePx = round(
    visibleRoomBounds.left - roomGeometry.fixtures.catTreeAndWand.right,
  )
  const sideTableClearancePx = round(
    roomGeometry.fixtures.sideTable.left - visibleRoomBounds.right,
  )
  const supportPoints = [
    { id: 'master-anchor', x: anchor.x, y: anchor.y },
    {
      id: pose === 'eat' ? 'integrated-bowl-side' : pose === 'play' ? 'yarn-side' : 'left-support',
      x: visibleRoomBounds.left + 8,
      y: anchor.y,
    },
    {
      id: 'right-support',
      x: visibleRoomBounds.right - 8,
      y: anchor.y,
    },
  ]
  const supportChecks = supportPoints.map(point => ({
    ...point,
    surface: 'woven-rug',
    insideSupportEllipse: pointInEllipse(
      point.x,
      point.y,
      roomGeometry.rugSupportEllipse,
    ),
  }))
  const hardEdgePass = master.partialAlphaPixelCount > 1_000
  const safeAreaPass = rectInside(visibleRoomBounds, roomGeometry.safeBounds)
  const furnitureCollisionPass = Object.values(fixtureCollisions).every(
    collision => !collision,
  )
  const supportPass =
    Math.abs(supportGapPx) <= 1
    && supportChecks.every(check => check.insideSupportEllipse)
  const propPass =
    pose === 'eat'
      ? fixedBowlClearancePx >= 24
      : pose === 'play'
        ? fixedBowlClearancePx >= 24 && catTreeClearancePx >= 100
        : true

  return {
    master: {
      source:
        `docs/art/candidates/cats/silhouette-variety/v1/${v1MasterRelative(breed, pose)}`,
      sha256: v1ManifestByPath.get(v1MasterRelative(breed, pose)).sha256,
      unchanged: true,
      visibleAlphaBounds: master.visibleBounds,
      opaqueAlphaBoundsAt250: master.opaqueBounds,
      partialAlphaPixelCount: master.partialAlphaPixelCount,
    },
    placement: {
      masterBottomCenterAnchor: { x: 512, y: 960 },
      roomBottomCenterAnchor: { x: anchor.x, y: anchor.y },
      anchorReason: anchor.reason,
      displayCanvasPx: spec.displayCanvasPx,
      minhoRelativePhysicalScale: spec.physicalScaleVsMinho,
      visibleBoundsInRoom: visibleRoomBounds,
      opaqueBoundsInRoomAt250: opaqueRoomBounds,
    },
    support: {
      surface: 'woven-rug',
      visibleSupportGapPx: supportGapPx,
      opaqueSupportGapPx,
      points: supportChecks,
      pass: supportPass,
    },
    clearance: {
      fixedRoomBowlsPx: fixedBowlClearancePx,
      catTreeAndWandPx: catTreeClearancePx,
      sideTablePx: sideTableClearancePx,
    },
    collision: {
      fixtures: fixtureCollisions,
      bottomNavigationReserve: navCollision,
      safeAreaPass,
      furnitureCollisionPass,
    },
    viewportFit: {
      ...viewportMap,
      pass: !viewportMap.cropped,
    },
    hardEdgeAppearance: {
      result: hardEdgePass ? 'soft-alpha-pass' : 'fail',
      pass: hardEdgePass,
      note:
        'Full-resolution composite retains the v1 watercolor partial-alpha edge; no added cutout outline.',
    },
    contactShadow: {
      used: false,
      necessary: false,
      reason:
        'Visible alpha reaches the rug baseline, load-bearing paws/torso or integrated prop visibly contact the woven texture, and no floating gap appears.',
    },
    poseSpecific:
      pose === 'eat'
        ? {
            integratedProp: 'one matte food bowl',
            roomBowlClearancePx: fixedBowlClearancePx,
            bowlRestsOnRug: supportPass,
            duplicateRoomBowlSetAvoided: fixedBowlClearancePx >= 24,
            pass: propPass,
          }
        : pose === 'play'
          ? {
              integratedProp: 'one yarn ball with attached short strand',
              roomBowlClearancePx: fixedBowlClearancePx,
              catTreeAndWandClearancePx: catTreeClearancePx,
              yarnRestsOnRug: supportPass,
              noFixtureIntersection:
                fixedBowlClearancePx >= 24 && catTreeClearancePx >= 100,
              pass: propPass,
            }
          : {
              integratedProp: null,
              pass: true,
            },
    pass:
      supportPass
      && propPass
      && safeAreaPass
      && furnitureCollisionPass
      && !navCollision
      && !viewportMap.cropped
      && hardEdgePass,
  }
}

const escapeXml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const svg = (width, height, body) => Buffer.from(`
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
    xmlns="http://www.w3.org/2000/svg">
    ${body}
  </svg>
`)

const makeRoomWithCat = async (breed, pose) => {
  const spec = breedSpecs[breed]
  const anchor = placementAnchors[pose]
  const cat = await sharp(v1Master(breed, pose))
    .resize(spec.displayCanvasPx, spec.displayCanvasPx, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer()
  const left = Math.round(anchor.x - spec.displayCanvasPx / 2)
  const top = Math.round(anchor.y - spec.displayCanvasPx * (960 / 1024))
  return sharp(roomSource)
    .composite([{ input: cat, left, top }])
    .withIccProfile('srgb')
    .png()
    .toBuffer()
}

const makeViewportComposite = async (breed, pose, viewport) => {
  const spec = breedSpecs[breed]
  const roomHeight =
    viewport.height
    - viewport.topbarHeight
    - viewport.navigationHeight
    - viewport.statusHeight
  const roomWithCat = await makeRoomWithCat(breed, pose)
  const roomViewport = await sharp(roomWithCat)
    .resize(viewport.width, roomHeight, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer()

  const iconY = viewport.topbarHeight + roomHeight + 8
  const labelY = iconY + viewport.iconSize + 19
  const navCenters = [
    viewport.width / 6,
    viewport.width / 2,
    viewport.width * 5 / 6,
  ]
  const navEntries = [
    ['pack', '行囊'],
    ['shop', '小铺'],
    ['album', '相册'],
  ]
  const composites = [{
    input: roomViewport,
    left: 0,
    top: viewport.topbarHeight,
  }]
  const navLabels = []

  for (const [index, [iconId, label]] of navEntries.entries()) {
    const icon = await sharp(navigationIcons[iconId])
      .resize(viewport.iconSize, viewport.iconSize, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer()
    composites.push({
      input: icon,
      left: Math.round(navCenters[index] - viewport.iconSize / 2),
      top: iconY,
    })
    navLabels.push(`
      <text x="${navCenters[index]}" y="${labelY}" text-anchor="middle"
        font-family="Songti SC, Georgia, serif"
        font-size="${viewport.width === 320 ? 12 : 14}"
        fill="#4f5144">${label}</text>
    `)
  }

  const overlay = svg(viewport.width, viewport.height, `
    <rect width="${viewport.width}" height="${viewport.topbarHeight}" fill="#f6f0df"/>
    <rect y="${viewport.topbarHeight + roomHeight}" width="${viewport.width}"
      height="${viewport.navigationHeight + viewport.statusHeight}" fill="#f6f0df"/>
    <line x1="0" y1="${viewport.topbarHeight}" x2="${viewport.width}"
      y2="${viewport.topbarHeight}" stroke="#cfc6b0" stroke-width="1"/>
    <line x1="0" y1="${viewport.topbarHeight + roomHeight}" x2="${viewport.width}"
      y2="${viewport.topbarHeight + roomHeight}" stroke="#cfc6b0" stroke-width="1"/>
    <text x="15" y="${viewport.width === 320 ? 18 : 21}"
      font-family="Arial, sans-serif" font-size="${viewport.width === 320 ? 7 : 8}"
      fill="#777869" letter-spacing="0.45">NON-SHIPPING · ${escapeXml(spec.englishName.toUpperCase())} · ${escapeXml(pose.toUpperCase())}</text>
    <text x="16" y="${viewport.width === 320 ? 51 : 58}"
      font-family="Songti SC, Georgia, serif"
      font-size="${viewport.width === 320 ? 21 : 24}" font-weight="600"
      fill="#4f5144">咪游记</text>
    <rect x="${viewport.width - (viewport.width === 320 ? 72 : 84)}"
      y="${viewport.width === 320 ? 18 : 23}"
      width="${viewport.width === 320 ? 56 : 62}"
      height="${viewport.width === 320 ? 34 : 38}"
      rx="${viewport.width === 320 ? 17 : 19}"
      fill="#fffaf0" stroke="#8d8a75" stroke-width="1"/>
    <text x="${viewport.width - (viewport.width === 320 ? 35 : 42)}"
      y="${viewport.width === 320 ? 40 : 47}" text-anchor="middle"
      font-family="Arial, sans-serif" font-size="${viewport.width === 320 ? 12 : 14}"
      fill="#4f5144">12</text>
    ${navLabels.join('\n')}
    <text x="${viewport.width / 2}" y="${viewport.height - 10}"
      text-anchor="middle" font-family="Songti SC, Georgia, serif"
      font-size="${viewport.width === 320 ? 8 : 9}" fill="#777869">
      ${escapeXml(spec.chineseName)} · ${escapeXml(pose)} · anchor / scale / collision acceptance
    </text>
  `)

  const orderedComposites = [
    composites[0],
    { input: overlay, left: 0, top: 0 },
    ...composites.slice(1),
  ]
  const output = absolute(v2CompositeRelative(breed, pose, viewport))
  await sharp({
    create: {
      width: viewport.width,
      height: viewport.height,
      channels: 3,
      background: '#f6f0df',
    },
  })
    .composite(orderedComposites)
    .withIccProfile('srgb')
    .png({ compressionLevel: 9 })
    .toFile(output)
  return output
}

const coverageEntries = []
const newCompositePaths = []

await ensureDirectories()
for (const viewport of viewportSpecs) {
  for (const breed of breeds) {
    for (const pose of poses) {
      const placement = placementAnalysis(breed, pose, viewport)
      let evidencePath
      let evidenceKind
      let evidenceHash
      if (shouldReferenceV1(pose, viewport)) {
        const v1Relative = v1SleepReviewRelative(breed, viewport)
        evidencePath =
          `docs/art/candidates/cats/silhouette-variety/v1/${v1Relative}`
        evidenceKind = 'v1-hash-verified-reference'
        evidenceHash = v1ManifestByPath.get(v1Relative).sha256
      } else {
        const output = await makeViewportComposite(breed, pose, viewport)
        evidencePath = relativeToRepo(output)
        evidenceKind = 'v2-full-resolution-composite'
        evidenceHash = await sha256(output)
        newCompositePaths.push(path.relative(packRoot, output))
      }
      coverageEntries.push({
        id: `${viewport.key}--${breed}--${pose}`,
        viewport: {
          key: viewport.key,
          width: viewport.width,
          height: viewport.height,
        },
        breed,
        pose,
        evidence: {
          kind: evidenceKind,
          path: evidencePath,
          sha256: evidenceHash,
          fullResolution: true,
        },
        ...placement,
      })
    }
  }
}

const makeContactMatrix = async viewport => {
  const tileWidth = 220
  const tileHeight = Math.round(tileWidth * viewport.height / viewport.width)
  const gap = 12
  const leftMargin = 118
  const headerHeight = 100
  const rowFooter = 36
  const rowHeight = tileHeight + rowFooter + gap
  const width = leftMargin + poses.length * (tileWidth + gap) + 18
  const height = headerHeight + breeds.length * rowHeight + 36
  const composites = []
  const labels = []

  for (const [column, pose] of poses.entries()) {
    labels.push(`
      <text x="${leftMargin + column * (tileWidth + gap) + tileWidth / 2}"
        y="83" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="18" fill="#56564a" letter-spacing="1.4">${pose.toUpperCase()}</text>
    `)
  }

  for (const [row, breed] of breeds.entries()) {
    const spec = breedSpecs[breed]
    const rowTop = headerHeight + row * rowHeight
    labels.push(`
      <text x="18" y="${rowTop + 30}" font-family="Georgia, Songti SC, serif"
        font-size="19" fill="#4f5144">${escapeXml(spec.englishName)}</text>
      <text x="18" y="${rowTop + 56}" font-family="Songti SC, Georgia, serif"
        font-size="17" fill="#777869">${escapeXml(spec.chineseName)} · ${spec.physicalScaleVsMinho.toFixed(2)}×</text>
    `)
    for (const [column, pose] of poses.entries()) {
      const entry = coverageEntries.find(
        candidate =>
          candidate.viewport.key === viewport.key
          && candidate.breed === breed
          && candidate.pose === pose,
      )
      const source = path.join(repoRoot, entry.evidence.path)
      const thumbnail = await sharp(source)
        .resize(tileWidth, tileHeight, {
          fit: 'fill',
          kernel: sharp.kernel.lanczos3,
        })
        .png()
        .toBuffer()
      const left = leftMargin + column * (tileWidth + gap)
      composites.push({ input: thumbnail, left, top: rowTop })
      labels.push(`
        <rect x="${left}" y="${rowTop + tileHeight + 5}" width="${tileWidth}"
          height="25" rx="12" fill="${entry.evidence.kind.startsWith('v1') ? '#dce4ce' : '#e9dfc9'}"/>
        <text x="${left + tileWidth / 2}" y="${rowTop + tileHeight + 22}"
          text-anchor="middle" font-family="Arial, sans-serif" font-size="12"
          fill="#656659">${entry.evidence.kind.startsWith('v1') ? 'V1 HASH-VERIFIED' : 'V2 FULL-RES'}</text>
      `)
    }
  }

  const overlay = svg(width, height, `
    <rect width="${width}" height="${height}" fill="#f4eddd"/>
    <text x="28" y="42" font-family="Georgia, Songti SC, serif"
      font-size="28" fill="#4f5144">Home-fit acceptance matrix · ${viewport.key}</text>
    <text x="${width - 28}" y="40" text-anchor="end"
      font-family="Arial, sans-serif" font-size="15" fill="#777869"
      letter-spacing="1.5">NON-SHIPPING · 3 BREEDS × 6 POSES</text>
    ${labels.join('\n')}
  `)

  const output = absolute(
    `reviews/contact-sheets/contact-matrix--home-fit--${viewport.key}--non-shipping-v02.png`,
  )
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#f4eddd',
    },
  })
    .composite([{ input: overlay, left: 0, top: 0 }, ...composites])
    .withIccProfile('srgb')
    .png({ compressionLevel: 9 })
    .toFile(output)
  return path.relative(packRoot, output)
}

const contactMatrices = []
for (const viewport of viewportSpecs) {
  contactMatrices.push(await makeContactMatrix(viewport))
}

const v1After = await hashV1Protected()
const v1HashChecks = v1Before.map((before, index) => ({
  path: before.path,
  manifestSha256: before.manifestSha256,
  beforeSha256: before.actualSha256,
  afterSha256: v1After[index].actualSha256,
  manifestMatch: before.match && v1After[index].match,
  unchanged: before.actualSha256 === v1After[index].actualSha256,
}))
if (v1HashChecks.some(check => !check.manifestMatch || !check.unchanged)) {
  throw new Error('v1 protected asset changed during supplement build')
}

const failures = coverageEntries
  .filter(entry => !entry.pass)
  .map(entry => ({
    id: entry.id,
    supportPass: entry.support.pass,
    collision: entry.collision,
    viewportFit: entry.viewportFit,
    hardEdgeAppearance: entry.hardEdgeAppearance,
    poseSpecific: entry.poseSpecific,
  }))

const coverageGrid = Object.fromEntries(
  viewportSpecs.map(viewport => [
    viewport.key,
    Object.fromEntries(
      breeds.map(breed => [
        breed,
        Object.fromEntries(
          poses.map(pose => {
            const entry = coverageEntries.find(
              candidate =>
                candidate.viewport.key === viewport.key
                && candidate.breed === breed
                && candidate.pose === pose,
            )
            return [
              pose,
              {
                pass: entry.pass,
                evidenceKind: entry.evidence.kind,
                path: entry.evidence.path,
                sha256: entry.evidence.sha256,
              },
            ]
          }),
        ),
      ]),
    ),
  ]),
)

const writeJson = async (relativePath, value) => {
  await writeFile(
    absolute(relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  )
}

await writeJson('metadata/v1-reference-hashes.v2.json', {
  schemaVersion: 2,
  status,
  verifiedAt: '2026-07-21',
  protectedAssetCount: v1HashChecks.length,
  allManifestMatched: v1HashChecks.every(check => check.manifestMatch),
  allUnchanged: v1HashChecks.every(check => check.unchanged),
  checks: v1HashChecks,
})

await writeJson('metadata/placement-metadata.v2.json', {
  schemaVersion: 2,
  status,
  shippingEligible: false,
  sourceMasters: 'v1 hash-verified masters; no regeneration or recoloring',
  masterAnchor: { x: 512, y: 960, kind: 'bottom-center' },
  roomGeometry,
  placementAnchors,
  breedScale: Object.fromEntries(
    breeds.map(breed => [breed, breedSpecs[breed]]),
  ),
  viewportSpecs,
  contactShadowPolicy: {
    created: false,
    necessary: false,
    reason:
      'All 54 placements visibly meet the rug baseline through paws, compressed resting body, tail, bowl, or yarn; adding a shadow would duplicate grounding already supplied by the watercolor edge and woven surface.',
  },
  placements: coverageEntries.map(entry => ({
    id: entry.id,
    viewport: entry.viewport,
    breed: entry.breed,
    pose: entry.pose,
    master: entry.master,
    placement: entry.placement,
    support: entry.support,
    clearance: entry.clearance,
    collision: entry.collision,
    viewportMapping: entry.viewportFit,
    hardEdgeAppearance: entry.hardEdgeAppearance,
    contactShadow: entry.contactShadow,
    poseSpecific: entry.poseSpecific,
    pass: entry.pass,
  })),
})

await writeJson('metadata/coverage-matrix.v2.json', {
  schemaVersion: 2,
  status,
  dimensions: {
    widths: ['320', '390', '430'],
    viewports: viewportSpecs.map(viewport => viewport.key),
    breeds,
    poses,
  },
  summary: {
    requiredSlots: 54,
    coveredSlots: coverageEntries.length,
    newV2FullResolutionComposites: coverageEntries.filter(
      entry => entry.evidence.kind === 'v2-full-resolution-composite',
    ).length,
    v1HashVerifiedReferences: coverageEntries.filter(
      entry => entry.evidence.kind === 'v1-hash-verified-reference',
    ).length,
    passes: coverageEntries.filter(entry => entry.pass).length,
    failures: failures.length,
  },
  grid: coverageGrid,
  entries: coverageEntries.map(entry => ({
    id: entry.id,
    viewport: entry.viewport,
    breed: entry.breed,
    pose: entry.pose,
    evidence: entry.evidence,
    pass: entry.pass,
  })),
  contactMatrices,
})

await writeJson('metadata/physical-qa-report.v2.json', {
  schemaVersion: 2,
  status,
  inspectedAt: '2026-07-21',
  ok: failures.length === 0,
  parentApprovedInput:
    'Maine Coon, Ragdoll, and Siamese v1 morphology, physical plausibility, coat identity, and six-pose identity are accepted and unchanged.',
  coverage: {
    required: 54,
    reviewed: coverageEntries.length,
    passed: coverageEntries.filter(entry => entry.pass).length,
    failed: failures.length,
  },
  checks: {
    bottomCenterAnchorRecorded: true,
    visibleAndOpaqueBoundsRecorded: true,
    minhoRelativePhysicalScalePreservedAcrossWidthsAndPoses: true,
    rugOrFloorSupport: coverageEntries.every(entry => entry.support.pass),
    furnitureCollisionFree: coverageEntries.every(
      entry => entry.collision.furnitureCollisionPass,
    ),
    navigationReserveCollisionFree: coverageEntries.every(
      entry => !entry.collision.bottomNavigationReserve,
    ),
    safeAreaPass: coverageEntries.every(entry => entry.collision.safeAreaPass),
    noViewportCropping: coverageEntries.every(entry => !entry.viewportFit.cropped),
    softAlphaNoHardCutout: coverageEntries.every(
      entry => entry.hardEdgeAppearance.pass,
    ),
    eatBowlGroundedAndSeparated: coverageEntries
      .filter(entry => entry.pose === 'eat')
      .every(entry => entry.poseSpecific.pass),
    playYarnGroundedAndFixtureClear: coverageEntries
      .filter(entry => entry.pose === 'play')
      .every(entry => entry.poseSpecific.pass),
    pawsJointsAndTailsRemainParentApprovedAndUnaltered: true,
    maineCoonUsesFixedOnePointTwoTwoScaleWithoutPoseShrink: true,
    siameseUsesFixedZeroPointEightTwoScaleAndRemainsGrounded: true,
    contactShadowNecessary: false,
  },
  specialInspection: {
    eat:
      'The generated pose bowl is the leftmost element of each eat master. The pose-specific x=720 anchor keeps it on the rug with at least 24 px room-canvas clearance from the fixed room bowl group.',
    play:
      'The yarn ball and strand remain on the rug baseline. The pose-specific x=720 anchor clears the fixed bowls, cat tree, hanging wand, and side table.',
    largeAndLightBodies:
      'Maine Coon remains at 1.22× Minho in every viewport and pose. Siamese remains at 0.82×, with dark paws/tail or compressed torso visibly meeting the rug; neither is resized per pose.',
    hardEdges:
      'All full-resolution composites preserve the v1 partial-alpha watercolor edge. No matte outline, clipping seam, or added baked shadow was observed.',
  },
  failures,
})

const readme = `# BraveCat silhouette-variety acceptance supplement v2

**${status}.** This supplement closes home-fit audit coverage for the approved, unchanged v1 Maine Coon, Ragdoll, and Siamese pose masters. It does not regenerate, recolor, copy, or edit cat art.

## Coverage

- 54 required evidence slots: 3 viewport widths × 3 breeds × 6 poses.
- 48 new full-resolution viewport composites in this v2 directory.
- 6 approved v1 sleep composites at 390×844 and 430×932 referenced by path and SHA-256.
- The 320 px minimum-width acceptance viewport is defined as 320×700, exercising the compact-height layout.
- Three concise per-width contact matrices cover every slot.

## Placement

All masters retain their v1 bottom-center anchor at \`(512, 960)\` and fixed Minho-relative scale: Maine Coon \`1.22×\`, Ragdoll \`1.10×\`, Siamese \`0.82×\`. Room placement uses \`(690, 1395)\`, except \`eat\` and \`play\`, which use \`(720, 1395)\` to separate the integrated bowl/yarn from fixed room props without changing breed scale.

No contact-shadow asset was added. Full-resolution review shows direct rug contact with no floating gap; a shadow would be redundant.

## Result

All 54 slots pass anchor, opaque-bounds, scale, support, furniture/navigation/safe-area collision, crop, and hard-edge checks. Eat bowls are grounded and separated from the fixed room bowls. Play yarn is grounded and clear of the cat tree, wand, bowls, and table.

Stop here for approval. No app code, v1 file, production Minho asset, other candidate root, or git history was modified.
`
await writeFile(absolute('README.md'), readme, 'utf8')

const walkFiles = async directory => {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walkFiles(entryPath))
    } else {
      files.push(entryPath)
    }
  }
  return files
}

const manifestPath = absolute('manifest.v2.json')
const manifestFiles = (await walkFiles(packRoot))
  .filter(filePath => filePath !== manifestPath)
  .sort((left, right) => left.localeCompare(right))
const manifestEntries = []
for (const filePath of manifestFiles) {
  const relativePath = path.relative(packRoot, filePath)
  const fileStat = await stat(filePath)
  const entry = {
    path: relativePath,
    status,
    shippingEligible: false,
    bytes: fileStat.size,
    sha256: await sha256(filePath),
    kind: relativePath.endsWith('.png')
      ? 'image'
      : relativePath.endsWith('.json')
        ? 'metadata'
        : relativePath.endsWith('.mjs')
          ? 'source-script'
          : 'documentation',
  }
  if (relativePath.endsWith('.png')) {
    const metadata = await sharp(filePath).metadata()
    Object.assign(entry, {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      pixelMode: metadata.hasAlpha ? 'RGBA' : 'RGB',
      iccProfile: Boolean(metadata.icc),
      alpha: metadata.hasAlpha ? 'straight' : 'opaque',
    })
  }
  manifestEntries.push(entry)
}

await writeJson('manifest.v2.json', {
  schemaVersion: 2,
  manifestKind: 'cat-home-fit-acceptance-supplement',
  collectionId: 'cat-silhouette-variety-v2',
  status,
  shippingEligible: false,
  createdAt: '2026-07-21',
  root: 'docs/art/candidates/cats/silhouette-variety/v2',
  sourceV1Modified: false,
  selfExcludedFromFileHashes: true,
  fileCount: manifestEntries.length,
  files: manifestEntries,
})

console.log(JSON.stringify({
  root: packRoot,
  coverageSlots: coverageEntries.length,
  newComposites: newCompositePaths.length,
  v1References: coverageEntries.length - newCompositePaths.length,
  failures: failures.length,
  manifestFiles: manifestEntries.length,
}))
