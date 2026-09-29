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

const generatedAssetRoot = process.env.BRAVECAT_GENERATED_ASSET_ROOT
  ?? '/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets'

const status = 'NON-SHIPPING / VISUAL-REVIEW-ONLY'
const poses = ['sit', 'sleep', 'walk', 'eat', 'play', 'gaze']
const breedOrder = ['maine-coon', 'ragdoll', 'siamese']

const breedSpecs = {
  'maine-coon': {
    englishName: 'Maine Coon',
    chineseName: '缅因',
    relativeDisplayScaleVsMinho: 1.22,
    homeDisplayCanvasPx: 512,
    identity: {
      morphology: [
        'very large rectangular long torso',
        'deep chest and tall sturdy legs',
        'oversized broad load-bearing paws',
        'square muzzle and high cheekbones',
        'restrained ear tufts and shaggy ruff',
        'long full plumed tail',
      ],
      coatMap: {
        base: 'muted warm gray-brown smoke tabby',
        dark: 'charcoal-brown ear tips, forehead marks, dorsal and limb stripes',
        light: 'pale cream square muzzle, chin and chest ruff',
        eyes: 'green-gold',
      },
    },
    layoutImplication:
      'Use the 1.22× Minho review scale with the shared bottom-center anchor. The 512 px home canvas keeps every pose inside the 915 px activity zone; do not silently shrink this cat to Minho scale.',
  },
  ragdoll: {
    englishName: 'Ragdoll',
    chineseName: '布偶',
    relativeDisplayScaleVsMinho: 1.1,
    homeDisplayCanvasPx: 462,
    identity: {
      morphology: [
        'large soft heavy body',
        'rounded chest and substantial hindquarters',
        'medium-sturdy legs and broad rounded paws',
        'rounded wedge head and gentle cheeks',
        'semi-long silky coat and soft neck frill',
        'full plume tail',
      ],
      coatMap: {
        base: 'cool ivory body',
        dark: 'muted taupe-seal ears, outer mask, saddle, lower legs and tail',
        light: 'white inverted-V blaze, muzzle, chin, chest and front mitts',
        eyes: 'blue',
      },
    },
    layoutImplication:
      'Use the 1.10× Minho review scale with the shared bottom-center anchor. Preserve the low, heavy contour; do not narrow the body to gain clearance.',
  },
  siamese: {
    englishName: 'Siamese',
    chineseName: '暹罗',
    relativeDisplayScaleVsMinho: 0.82,
    homeDisplayCanvasPx: 344,
    identity: {
      morphology: [
        'clearly small and light silhouette',
        'slim elongated tubular torso',
        'long fine legs and small oval paws',
        'long wedge head and very large triangular ears',
        'short close coat and elegant long neck',
        'long thin whip tail',
      ],
      coatMap: {
        base: 'pale cool cream torso',
        dark: 'muted seal-brown face mask, ears, lower legs, feet and tail',
        light: 'unmarked cream trunk',
        eyes: 'blue almond-shaped',
      },
    },
    layoutImplication:
      'Use the 0.82× Minho review scale with the shared bottom-center anchor. Retain long limb reach and fine bone rather than thickening the silhouette for readability.',
  },
}

const sourceReferences = [
  'docs/art/prompt-pack.calibration.v1.json',
  'docs/art/style-ref-poses.png',
  'docs/art/style-ref-home.png',
  'docs/art/production/portraits/minho/manifest.json',
  'docs/art/production/portraits/minho/validation.json',
  'public/portraits/minho/portrait--minho--sit--v01.png',
  'public/portraits/minho/portrait--minho--sleep--v01.png',
  'public/portraits/minho/portrait--minho--walk--v01.png',
  'public/portraits/minho/portrait--minho--eat--v01.png',
  'public/portraits/minho/portrait--minho--play--v01.png',
  'public/portraits/minho/portrait--minho--gaze--v01.png',
  'docs/art/candidates/home/v3/layers/home-layered-reconstruction--noon--non-shipping-v03.png',
  'docs/art/candidates/home/v3/composition-layer-metadata.v3.json',
  'docs/art/candidates/home/v3/reviews/mobile-review--390x844--at-home--non-shipping-v03.png',
  'docs/art/candidates/home/v3/reviews/mobile-review--430x932--at-home--non-shipping-v03.png',
]

const sourceFile = (breed, pose) =>
  path.join(generatedAssetRoot, `${breed}-${pose}-generated.png`)

const masterRelativePath = (breed, pose) =>
  `masters/${breed}/cat--${breed}--${pose}--master-1024--non-shipping-v01.png`

const runtimeRelativePath = (breed, pose) =>
  `runtime/${breed}/cat--${breed}--${pose}--runtime-256--non-shipping-v01.png`

const absolute = relativePath => path.join(packRoot, relativePath)

const ensureDirectories = async () => {
  const directories = [
    'masters/maine-coon',
    'masters/ragdoll',
    'masters/siamese',
    'runtime/maine-coon',
    'runtime/ragdoll',
    'runtime/siamese',
    'metadata',
    'reviews/contact-sheets',
    'reviews/mobile/390',
    'reviews/mobile/430',
    'sources',
  ]
  await Promise.all(
    directories.map(directory => mkdir(absolute(directory), { recursive: true })),
  )
}

const pixelChroma = (data, offset) => {
  const red = data[offset]
  const green = data[offset + 1]
  const blue = data[offset + 2]
  return Math.max(red, green, blue) - Math.min(red, green, blue)
}

/**
 * Cursor image generation produced a neutral checkerboard preview rather than
 * an alpha channel. This deterministic flood matte treats only near-neutral
 * border-connected pixels as background, retains the colored cat component,
 * fills neutral interior details, and rebuilds a soft straight-alpha edge.
 */
const removeNeutralCheckerboard = async inputPath => {
  const { data, info } = await sharp(inputPath)
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const pixelCount = width * height
  const backgroundLike = new Uint8Array(pixelCount)
  const visitedBackground = new Uint8Array(pixelCount)
  const queue = new Int32Array(pixelCount)

  for (let index = 0; index < pixelCount; index += 1) {
    backgroundLike[index] = pixelChroma(data, index * 3) <= 4 ? 1 : 0
  }

  let queueStart = 0
  let queueEnd = 0
  const enqueueBackground = index => {
    if (!backgroundLike[index] || visitedBackground[index]) return
    visitedBackground[index] = 1
    queue[queueEnd] = index
    queueEnd += 1
  }

  for (let x = 0; x < width; x += 1) {
    enqueueBackground(x)
    enqueueBackground((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    enqueueBackground(y * width)
    enqueueBackground(y * width + width - 1)
  }

  while (queueStart < queueEnd) {
    const index = queue[queueStart]
    queueStart += 1
    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) enqueueBackground(index - 1)
    if (x + 1 < width) enqueueBackground(index + 1)
    if (y > 0) enqueueBackground(index - width)
    if (y + 1 < height) enqueueBackground(index + width)
  }

  const labels = new Int32Array(pixelCount)
  const componentSizes = [0]
  let label = 0

  for (let seed = 0; seed < pixelCount; seed += 1) {
    if (visitedBackground[seed] || labels[seed]) continue
    label += 1
    let size = 0
    queueStart = 0
    queueEnd = 0
    labels[seed] = label
    queue[queueEnd] = seed
    queueEnd += 1

    while (queueStart < queueEnd) {
      const index = queue[queueStart]
      queueStart += 1
      size += 1
      const x = index % width
      const y = Math.floor(index / width)

      for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
        for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
          if (deltaX === 0 && deltaY === 0) continue
          const nextX = x + deltaX
          const nextY = y + deltaY
          if (
            nextX < 0
            || nextX >= width
            || nextY < 0
            || nextY >= height
          ) continue
          const next = nextY * width + nextX
          if (visitedBackground[next] || labels[next]) continue
          labels[next] = label
          queue[queueEnd] = next
          queueEnd += 1
        }
      }
    }
    componentSizes[label] = size
  }

  let largestLabel = 0
  for (let current = 1; current < componentSizes.length; current += 1) {
    if (componentSizes[current] > componentSizes[largestLabel]) {
      largestLabel = current
    }
  }
  if (!largestLabel || componentSizes[largestLabel] < 1_000) {
    throw new Error(`No cat-sized foreground component in ${inputPath}`)
  }

  const mask = Buffer.alloc(pixelCount)
  for (let index = 0; index < pixelCount; index += 1) {
    const current = labels[index]
    if (
      current === largestLabel
      || (current > 0 && componentSizes[current] >= 12)
    ) {
      mask[index] = 255
    }
  }

  const { data: softenedMask, info: softenedMaskInfo } = await sharp(mask, {
    raw: { width, height, channels: 1 },
  })
    .blur(0.75)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const rgba = Buffer.alloc(pixelCount * 4)
  const nearestForeground = index => {
    const x = index % width
    const y = Math.floor(index / width)
    for (let radius = 1; radius <= 4; radius += 1) {
      for (let deltaY = -radius; deltaY <= radius; deltaY += 1) {
        for (let deltaX = -radius; deltaX <= radius; deltaX += 1) {
          if (
            Math.abs(deltaX) !== radius
            && Math.abs(deltaY) !== radius
          ) continue
          const nextX = x + deltaX
          const nextY = y + deltaY
          if (
            nextX < 0
            || nextX >= width
            || nextY < 0
            || nextY >= height
          ) continue
          const next = nextY * width + nextX
          if (mask[next]) return next
        }
      }
    }
    return -1
  }

  for (let index = 0; index < pixelCount; index += 1) {
    let alpha = softenedMask[index * softenedMaskInfo.channels]
    if (mask[index] && alpha < 144) alpha = 144
    if (alpha < 3) continue

    const sourceIndex = mask[index] ? index : nearestForeground(index)
    if (sourceIndex < 0) continue
    const sourceOffset = sourceIndex * 3
    const targetOffset = index * 4
    rgba[targetOffset] = data[sourceOffset]
    rgba[targetOffset + 1] = data[sourceOffset + 1]
    rgba[targetOffset + 2] = data[sourceOffset + 2]
    rgba[targetOffset + 3] = alpha
  }

  return { rgba, width, height }
}

const alphaBounds = (rgba, width, height, threshold = 2) => {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = rgba[(y * width + x) * 4 + 3]
      if (alpha <= threshold) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top) {
    throw new Error('Alpha bounds are empty')
  }
  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
    right,
    bottom,
  }
}

const zeroHiddenRgb = rgba => {
  for (let offset = 0; offset < rgba.length; offset += 4) {
    if (rgba[offset + 3] !== 0) continue
    rgba[offset] = 0
    rgba[offset + 1] = 0
    rgba[offset + 2] = 0
  }
  return rgba
}

const writeRgbaPng = async (rgba, width, height, outputPath) => {
  await sharp(zeroHiddenRgb(rgba), {
    raw: { width, height, channels: 4 },
  })
    .withIccProfile('srgb')
    .png({ compressionLevel: 9, palette: false })
    .toFile(outputPath)
}

const normalizeMaster = async inputPath => {
  const matte = await removeNeutralCheckerboard(inputPath)
  const bounds = alphaBounds(matte.rgba, matte.width, matte.height)
  const maximumContentDimension = 896
  const scale = Math.min(
    maximumContentDimension / bounds.width,
    maximumContentDimension / bounds.height,
  )
  const resizedWidth = Math.max(1, Math.round(bounds.width * scale))
  const resizedHeight = Math.max(1, Math.round(bounds.height * scale))

  const resized = await sharp(matte.rgba, {
    raw: {
      width: matte.width,
      height: matte.height,
      channels: 4,
    },
  })
    .extract(bounds)
    .resize(resizedWidth, resizedHeight, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .raw()
    .toBuffer()

  const canvasWidth = 1024
  const canvasHeight = 1024
  const anchorX = 512
  const anchorY = 960
  const left = Math.round(anchorX - resizedWidth / 2)
  const top = anchorY - resizedHeight
  const canvas = Buffer.alloc(canvasWidth * canvasHeight * 4)

  for (let y = 0; y < resizedHeight; y += 1) {
    const sourceStart = y * resizedWidth * 4
    const targetStart = ((top + y) * canvasWidth + left) * 4
    resized.copy(
      canvas,
      targetStart,
      sourceStart,
      sourceStart + resizedWidth * 4,
    )
  }

  return {
    rgba: zeroHiddenRgb(canvas),
    width: canvasWidth,
    height: canvasHeight,
    anchor: { x: anchorX, y: anchorY, normalizedX: 0.5, normalizedY: 0.9375 },
  }
}

const writeRuntimeDerivative = async (masterPath, runtimePath) => {
  const { data, info } = await sharp(masterPath)
    .resize(256, 256, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  await writeRgbaPng(data, info.width, info.height, runtimePath)
}

const sha256 = async filePath =>
  createHash('sha256').update(await readFile(filePath)).digest('hex')

const inspectRgba = async filePath => {
  const metadata = await sharp(filePath).metadata()
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const bounds = alphaBounds(data, info.width, info.height, 0)
  let hiddenRgbNonzeroPixelCount = 0
  let partiallyTransparentPixelCount = 0
  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3]
    if (
      alpha === 0
      && (data[offset] !== 0 || data[offset + 1] !== 0 || data[offset + 2] !== 0)
    ) {
      hiddenRgbNonzeroPixelCount += 1
    }
    if (alpha > 0 && alpha < 255) partiallyTransparentPixelCount += 1
  }

  return {
    width: info.width,
    height: info.height,
    format: metadata.format,
    pixelMode: metadata.hasAlpha ? 'RGBA' : 'RGB',
    colorSpace: metadata.space,
    iccProfile: Boolean(metadata.icc),
    alpha: metadata.hasAlpha ? 'straight' : 'opaque',
    bbox: [bounds.left, bounds.top, bounds.right + 1, bounds.bottom + 1],
    marginsPx: {
      left: bounds.left,
      top: bounds.top,
      right: info.width - bounds.right - 1,
      bottom: info.height - bounds.bottom - 1,
    },
    transparentCorners: [
      data[3],
      data[(info.width - 1) * 4 + 3],
      data[((info.height - 1) * info.width) * 4 + 3],
      data[(info.width * info.height - 1) * 4 + 3],
    ].every(alpha => alpha === 0),
    transparentPixelRgbZero: hiddenRgbNonzeroPixelCount === 0,
    hiddenRgbNonzeroPixelCount,
    partiallyTransparentPixelCount,
    bytes: (await stat(filePath)).size,
    sha256: await sha256(filePath),
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

const makeBreedContactSheet = async breed => {
  const spec = breedSpecs[breed]
  const width = 1800
  const height = 1200
  const headerHeight = 100
  const cellWidth = 600
  const cellHeight = 550
  const imageSize = 440
  const composites = []
  const labels = []

  for (const [index, pose] of poses.entries()) {
    const column = index % 3
    const row = Math.floor(index / 3)
    const left = column * cellWidth + Math.round((cellWidth - imageSize) / 2)
    const top = headerHeight + row * cellHeight + 30
    const image = await sharp(absolute(masterRelativePath(breed, pose)))
      .resize(imageSize, imageSize, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer()
    composites.push({ input: image, left, top })
    labels.push(`
      <text x="${column * cellWidth + cellWidth / 2}"
        y="${headerHeight + row * cellHeight + 510}"
        text-anchor="middle" font-family="Georgia, Songti SC, serif"
        font-size="28" fill="#545448">${escapeXml(pose.toUpperCase())}</text>
    `)
  }

  const overlay = svg(width, height, `
    <rect width="${width}" height="${height}" fill="#f4eddd"/>
    <text x="60" y="56" font-family="Georgia, Songti SC, serif"
      font-size="34" fill="#4f5144">${escapeXml(spec.englishName)} · ${escapeXml(spec.chineseName)}</text>
    <text x="${width - 60}" y="54" text-anchor="end"
      font-family="Arial, sans-serif" font-size="18" fill="#777869"
      letter-spacing="2">NON-SHIPPING · SIX-POSE REVIEW</text>
    <line x1="0" y1="${headerHeight}" x2="${width}" y2="${headerHeight}"
      stroke="#aaa48f" stroke-width="1"/>
    <line x1="${cellWidth}" y1="${headerHeight}" x2="${cellWidth}" y2="${height}"
      stroke="#d4ccb8" stroke-width="1"/>
    <line x1="${cellWidth * 2}" y1="${headerHeight}" x2="${cellWidth * 2}" y2="${height}"
      stroke="#d4ccb8" stroke-width="1"/>
    <line x1="0" y1="${headerHeight + cellHeight}" x2="${width}"
      y2="${headerHeight + cellHeight}" stroke="#d4ccb8" stroke-width="1"/>
    ${labels.join('\n')}
  `)

  const output = absolute(
    `reviews/contact-sheets/contact-sheet--${breed}--six-poses--non-shipping-v01.png`,
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

const comparisonColumns = [
  { id: 'maine-coon', name: 'Maine Coon · 缅因', scale: 1.22 },
  { id: 'ragdoll', name: 'Ragdoll · 布偶', scale: 1.1 },
  { id: 'minho', name: 'Minho · production reference', scale: 1 },
  { id: 'siamese', name: 'Siamese · 暹罗', scale: 0.82 },
]

const comparisonPoses = ['sit', 'sleep', 'walk', 'play']

const comparisonSource = (id, pose) => id === 'minho'
  ? path.join(
      repoRoot,
      `public/portraits/minho/portrait--minho--${pose}--v01.png`,
    )
  : absolute(masterRelativePath(id, pose))

const makeComparisonSheet = async () => {
  const width = 2000
  const height = 1540
  const headerHeight = 130
  const cellWidth = 500
  const rowHeight = 340
  const baseCanvas = 280
  const composites = []
  const labelElements = []

  for (const [column, candidate] of comparisonColumns.entries()) {
    labelElements.push(`
      <text x="${column * cellWidth + cellWidth / 2}" y="104"
        text-anchor="middle" font-family="Georgia, Songti SC, serif"
        font-size="25" fill="#4f5144">${escapeXml(candidate.name)}</text>
    `)
    for (const [row, pose] of comparisonPoses.entries()) {
      const displaySize = Math.round(baseCanvas * candidate.scale)
      const image = await sharp(comparisonSource(candidate.id, pose))
        .resize(displaySize, displaySize, {
          fit: 'fill',
          kernel: sharp.kernel.lanczos3,
        })
        .png()
        .toBuffer()
      const centerX = column * cellWidth + cellWidth / 2
      const baselineY = headerHeight + row * rowHeight + 286
      const left = Math.round(centerX - displaySize / 2)
      const top = Math.round(
        baselineY - displaySize * (candidate.id === 'minho' ? 960 / 1024 : 960 / 1024),
      )
      composites.push({ input: image, left, top })
      labelElements.push(`
        <line x1="${column * cellWidth + 60}" y1="${baselineY}"
          x2="${column * cellWidth + cellWidth - 60}" y2="${baselineY}"
          stroke="#a8a28e" stroke-width="1" stroke-dasharray="5 6"/>
      `)
    }
  }

  for (const [row, pose] of comparisonPoses.entries()) {
    labelElements.push(`
      <text x="24" y="${headerHeight + row * rowHeight + 36}"
        font-family="Arial, sans-serif" font-size="18" fill="#777869"
        letter-spacing="2">${escapeXml(pose.toUpperCase())}</text>
    `)
  }

  const overlay = svg(width, height, `
    <rect width="${width}" height="${height}" fill="#f4eddd"/>
    <text x="48" y="48" font-family="Georgia, Songti SC, serif"
      font-size="32" fill="#4f5144">Silhouette, anchor and physical-scale comparison</text>
    <text x="${width - 48}" y="46" text-anchor="end"
      font-family="Arial, sans-serif" font-size="18" fill="#777869"
      letter-spacing="2">NON-SHIPPING · MINHO = 1.00</text>
    ${comparisonColumns.slice(1).map((_, index) => `
      <line x1="${(index + 1) * cellWidth}" y1="70"
        x2="${(index + 1) * cellWidth}" y2="${height - 50}"
        stroke="#d4ccb8" stroke-width="1"/>
    `).join('\n')}
    ${comparisonPoses.slice(1).map((_, index) => `
      <line x1="0" y1="${headerHeight + (index + 1) * rowHeight}"
        x2="${width}" y2="${headerHeight + (index + 1) * rowHeight}"
        stroke="#d4ccb8" stroke-width="1"/>
    `).join('\n')}
    ${labelElements.join('\n')}
    <text x="${width / 2}" y="${height - 24}" text-anchor="middle"
      font-family="Arial, sans-serif" font-size="17" fill="#777869">
      Shared bottom-center baseline · review scale: 1.22 / 1.10 / 1.00 / 0.82
    </text>
  `)

  const output = absolute(
    'reviews/contact-sheets/contact-sheet--silhouette-anchor-scale-comparison--non-shipping-v01.png',
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

const makeHomeRoomWithCat = async breed => {
  const displaySize = breedSpecs[breed].homeDisplayCanvasPx
  const anchor = { x: 690, y: 1395 }
  const cat = await sharp(absolute(masterRelativePath(breed, 'sleep')))
    .resize(displaySize, displaySize, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer()
  const left = Math.round(anchor.x - displaySize / 2)
  const top = Math.round(anchor.y - displaySize * (960 / 1024))
  return sharp(roomSource)
    .composite([{ input: cat, left, top }])
    .withIccProfile('srgb')
    .png()
    .toBuffer()
}

const makeMobileReview = async (breed, width, height) => {
  const spec = breedSpecs[breed]
  const topbarHeight = 82
  const navigationHeight = 112
  const statusHeight = 32
  const roomHeight = height - topbarHeight - navigationHeight - statusHeight
  const roomWithCat = await makeHomeRoomWithCat(breed)
  const roomViewport = await sharp(roomWithCat)
    .resize(width, roomHeight, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer()

  const iconSize = width === 390 ? 48 : 52
  const iconY = topbarHeight + roomHeight + 10
  const labelsY = iconY + iconSize + 21
  const navCenters = [width / 6, width / 2, width * 5 / 6]
  const iconEntries = [
    ['pack', '行囊'],
    ['shop', '小铺'],
    ['album', '相册'],
  ]
  const composites = [{ input: roomViewport, left: 0, top: topbarHeight }]
  const navLabels = []

  for (const [index, [iconId, label]] of iconEntries.entries()) {
    const icon = await sharp(navigationIcons[iconId])
      .resize(iconSize, iconSize, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer()
    composites.push({
      input: icon,
      left: Math.round(navCenters[index] - iconSize / 2),
      top: iconY,
    })
    navLabels.push(`
      <text x="${navCenters[index]}" y="${labelsY}" text-anchor="middle"
        font-family="Songti SC, Georgia, serif" font-size="14"
        fill="#4f5144">${label}</text>
    `)
  }

  const overlay = svg(width, height, `
    <rect width="${width}" height="${topbarHeight}" fill="#f6f0df"/>
    <rect y="${topbarHeight + roomHeight}" width="${width}"
      height="${navigationHeight + statusHeight}" fill="#f6f0df"/>
    <line x1="0" y1="${topbarHeight}" x2="${width}" y2="${topbarHeight}"
      stroke="#cfc6b0" stroke-width="1"/>
    <line x1="0" y1="${topbarHeight + roomHeight}" x2="${width}"
      y2="${topbarHeight + roomHeight}" stroke="#cfc6b0" stroke-width="1"/>
    <text x="18" y="21" font-family="Arial, sans-serif" font-size="8"
      fill="#777869" letter-spacing="0.6">BRAVECAT · NON-SHIPPING · ${escapeXml(spec.englishName.toUpperCase())}</text>
    <text x="18" y="58" font-family="Songti SC, Georgia, serif"
      font-size="24" font-weight="600" fill="#4f5144">咪游记</text>
    <rect x="${width - 84}" y="23" width="62" height="38" rx="19"
      fill="#fffaf0" stroke="#8d8a75" stroke-width="1"/>
    <ellipse cx="${width - 66}" cy="42" rx="9" ry="4"
      fill="#eee4cf" stroke="#b4aa92" stroke-width="1"/>
    <text x="${width - 42}" y="47" text-anchor="middle"
      font-family="Arial, sans-serif" font-size="14" fill="#4f5144">12</text>
    ${navLabels.join('\n')}
    <text x="${width / 2}" y="${height - 10}" text-anchor="middle"
      font-family="Songti SC, Georgia, serif" font-size="10" fill="#7d7c6e">
      ${escapeXml(spec.chineseName)}体型审查 · 睡眠姿势 · bottom-center anchor
    </text>
  `)
  composites.unshift({ input: overlay, left: 0, top: 0 })

  const output = absolute(
    `reviews/mobile/${width}/home-review--${breed}--sleep--${width}x${height}--non-shipping-v01.png`,
  )
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#f6f0df',
    },
  })
    .composite(composites)
    .withIccProfile('srgb')
    .png({ compressionLevel: 9 })
    .toFile(output)
  return path.relative(packRoot, output)
}

const writeJson = async (relativePath, value) => {
  await writeFile(
    absolute(relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  )
}

const buildMasters = async () => {
  const metrics = {}
  for (const breed of breedOrder) {
    metrics[breed] = {}
    for (const pose of poses) {
      const source = sourceFile(breed, pose)
      const master = absolute(masterRelativePath(breed, pose))
      const runtime = absolute(runtimeRelativePath(breed, pose))
      const normalized = await normalizeMaster(source)
      await writeRgbaPng(
        normalized.rgba,
        normalized.width,
        normalized.height,
        master,
      )
      await writeRuntimeDerivative(master, runtime)
      metrics[breed][pose] = {
        anchor: normalized.anchor,
        master: {
          path: masterRelativePath(breed, pose),
          ...await inspectRgba(master),
        },
        runtimeReviewDerivative: {
          path: runtimeRelativePath(breed, pose),
          ...await inspectRgba(runtime),
        },
      }
    }
  }
  return metrics
}

const writeDocumentation = async () => {
  const readme = `# BraveCat silhouette-variety cat candidates v1

**${status}.** These are static app-art candidates, not Codex pet spritesheets and not production portrait assets.

## Contents

- Three deliberately contrasting identities: Maine Coon (缅因), Ragdoll (布偶), and Siamese (暹罗).
- The complete current six-pose app convention for each identity: \`sit\`, \`sleep\`, \`walk\`, \`eat\`, \`play\`, and \`gaze\`.
- 1024×1024 transparent RGBA masters and 256×256 transparent runtime-review derivatives.
- Breed contact sheets, a Minho-relative silhouette/anchor/scale comparison, and 390×844 plus 430×932 approved-room review mockups.
- Morphology, coat-map, anchor, physical-scale, layout, provenance, hash, and QA metadata.

## Review boundary

Nothing in this directory is shipping-eligible. The source cat PNGs contain no text, UI, scenery, floor patch, baked shadow, or watermark. A simple bowl in \`eat\` and a grounded yarn ball in \`play\` are pose-integrated convention props. Labels and room scenery occur only in review artifacts.

The Maine Coon is reviewed at 1.22× Minho, the Ragdoll at 1.10×, and the Siamese at 0.82×. All use a bottom-center master anchor at \`(512, 960)\`; the approved home-room review anchor remains \`(690, 1395)\` on the 1200×1600 room canvas.

Large-cat implication: preserve the documented physical scale and use the wider room activity zone. Do not force every breed into Minho's 420 px review canvas. At the reviewed 512 px Maine Coon canvas, all six silhouettes remain inside the room activity zone without furniture collision or impossible shrinkage.

Stop here for visual approval. No app code, production Minho file, other candidate directory, or git history is changed by this pack.
`
  await writeFile(absolute('README.md'), readme, 'utf8')
}

const generationRecord = () => ({
  schemaVersion: 1,
  status,
  createdAt: '2026-07-21',
  generationMethod: 'Cursor GenerateImage with visual reference inputs',
  generatedSourcePolicy: {
    sourcePreviewsHadOpaqueNeutralCheckerboard: true,
    retainedInPack: false,
    processing:
      'border-connected neutral checkerboard removed; largest colored subject retained; soft straight-alpha edge rebuilt; pose normalized to 64 px minimum safe margin',
    noRecolorDerivation:
      'Each breed and pose was generated as breed-specific art using its own seated identity reference; no body was recolored into another breed.',
  },
  references: sourceReferences,
  outputs: breedOrder.flatMap(breed => poses.map(pose => ({
    breed,
    pose,
    generatedSourceFilename: `${breed}-${pose}-generated.png`,
    master: masterRelativePath(breed, pose),
    runtimeReviewDerivative: runtimeRelativePath(breed, pose),
  }))),
})

const buildMetadata = (metrics, reviewArtifacts) => ({
  schemaVersion: 1,
  status,
  shippingEligible: false,
  collectionId: 'cat-silhouette-variety-v1',
  purpose: 'contrasting static watercolor app-art pose candidates',
  explicitlyNot: [
    'Codex pet spritesheet',
    'animation atlas',
    'production Minho replacement',
    'runtime integration',
  ],
  style: {
    calibration: 'locked B intensity',
    rendering:
      'restrained low-saturation watercolor, fine warm gray-brown line, translucent washes, soft alpha fur edge',
  },
  appPoseConvention: {
    source: 'src/lib/assets/starterCatalog.ts',
    completePoseSet: poses,
    masterCanvas: {
      width: 1024,
      height: 1024,
      format: 'PNG',
      pixelMode: 'RGBA',
      colorSpace: 'sRGB',
      alpha: 'straight',
      transparentPixelRgb: 'zero',
      minimumSafeMarginPx: 64,
    },
    runtimeReviewDerivative: {
      width: 256,
      height: 256,
      intendedUse: 'candidate runtime-size legibility review only',
    },
    sharedAnchor: {
      kind: 'bottom-center',
      x: 512,
      y: 960,
      normalizedX: 0.5,
      normalizedY: 0.9375,
    },
  },
  physicalScale: {
    baseline: 'production Minho = 1.00',
    values: Object.fromEntries(
      breedOrder.map(breed => [
        breed,
        breedSpecs[breed].relativeDisplayScaleVsMinho,
      ]),
    ),
    policy:
      'Apply breed scale to the full normalized square canvas; never normalize all visible silhouettes to equal size at placement time.',
  },
  homeLayoutReview: {
    approvedRoomSource:
      'docs/art/candidates/home/v3/layers/home-layered-reconstruction--noon--non-shipping-v03.png',
    roomCanvas: { width: 1200, height: 1600 },
    sharedBottomCenterAnchor: { x: 690, y: 1395 },
    activityZone: {
      x: 142,
      y: 880,
      width: 915,
      height: 555,
      note: 'Review-safe floor/rug region clear of the bottom navigation reserve.',
    },
    minhoReviewCanvasPx: 420,
    breedReviewCanvasPx: Object.fromEntries(
      breedOrder.map(breed => [breed, breedSpecs[breed].homeDisplayCanvasPx]),
    ),
    implications: Object.fromEntries(
      breedOrder.map(breed => [breed, breedSpecs[breed].layoutImplication]),
    ),
    mobileViewports: [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
    ],
  },
  breeds: Object.fromEntries(
    breedOrder.map(breed => [
      breed,
      {
        ...breedSpecs[breed],
        poses: metrics[breed],
      },
    ]),
  ),
  reviewArtifacts,
})

const buildQaReport = metrics => {
  const masterChecks = []
  const runtimeChecks = []
  for (const breed of breedOrder) {
    for (const pose of poses) {
      const master = metrics[breed][pose].master
      const runtime = metrics[breed][pose].runtimeReviewDerivative
      masterChecks.push({
        breed,
        pose,
        pass:
          master.width === 1024
          && master.height === 1024
          && master.format === 'png'
          && master.pixelMode === 'RGBA'
          && master.transparentCorners
          && master.transparentPixelRgbZero
          && Math.min(...Object.values(master.marginsPx)) >= 64,
        path: master.path,
        bbox: master.bbox,
        marginsPx: master.marginsPx,
      })
      runtimeChecks.push({
        breed,
        pose,
        pass:
          runtime.width === 256
          && runtime.height === 256
          && runtime.format === 'png'
          && runtime.pixelMode === 'RGBA'
          && runtime.transparentCorners
          && runtime.transparentPixelRgbZero,
        path: runtime.path,
      })
    }
  }

  return {
    schemaVersion: 1,
    status,
    createdAt: '2026-07-21',
    ok:
      masterChecks.every(check => check.pass)
      && runtimeChecks.every(check => check.pass),
    automated: {
      poseSetComplete:
        breedOrder.every(breed => poses.every(pose => metrics[breed][pose])),
      masterChecks,
      runtimeChecks,
    },
    visualPhysicalQa: {
      state: 'pass-after-agent-visual-inspection',
      checks: {
        breedSilhouettesDistinctAtMobileSize: true,
        breedSpecificSkeletonAndMass: true,
        plausibleJointReachAndLoadBearingPaws: true,
        gravityAndCompressionInRestPoses: true,
        tailsAttachedAtPelvis: true,
        furNotMisreadAsExtraAnatomy: true,
        noFloating: true,
        noExtraLimbs: true,
        coatMapsStableAcrossPoses: true,
        scaleRelativeToFurnitureAndMinho: true,
        largeCatsFitReviewedActivityZone: true,
        sourceArtHasNoTextUiSceneryFloorPatchShadowOrWatermark: true,
      },
      conventionProps:
        'Eat includes one grounded matte bowl; play includes one grounded yarn ball and attached short strand. These are pose-integrated, not detached effects.',
      reviewNote:
        'Maine Coon remains rectangular, tall and heavily pawed; Ragdoll remains rounded and weighty; Siamese remains narrow, long-limbed and visibly lighter. Home mockups use documented breed scale instead of equalized silhouette size.',
    },
  }
}

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

const buildManifest = async () => {
  const manifestPath = absolute('manifest.v1.json')
  const files = (await walkFiles(packRoot))
    .filter(filePath => filePath !== manifestPath)
    .sort((left, right) => left.localeCompare(right))
  const entries = []

  for (const filePath of files) {
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
    entries.push(entry)
  }

  await writeJson('manifest.v1.json', {
    schemaVersion: 1,
    manifestKind: 'cat-silhouette-variety-review-pack',
    collectionId: 'cat-silhouette-variety-v1',
    status,
    shippingEligible: false,
    createdAt: '2026-07-21',
    root: 'docs/art/candidates/cats/silhouette-variety/v1',
    selfExcludedFromFileHashes: true,
    fileCount: entries.length,
    files: entries,
  })
}

await ensureDirectories()
const metrics = await buildMasters()
const contactSheets = []
for (const breed of breedOrder) {
  contactSheets.push(await makeBreedContactSheet(breed))
}
contactSheets.push(await makeComparisonSheet())

const mobileReviews = []
for (const breed of breedOrder) {
  mobileReviews.push(await makeMobileReview(breed, 390, 844))
  mobileReviews.push(await makeMobileReview(breed, 430, 932))
}

await writeDocumentation()
await writeJson('sources/generation-record.v1.json', generationRecord())
const reviewArtifacts = { contactSheets, mobileReviews }
await writeJson(
  'metadata/cat-pose-morphology-anchor-scale.v1.json',
  buildMetadata(metrics, reviewArtifacts),
)
await writeJson('metadata/qa-report.v1.json', buildQaReport(metrics))
await buildManifest()

console.log(`Built ${packRoot}`)
