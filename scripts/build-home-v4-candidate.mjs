import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const candidateRoot = path.join(root, 'docs/art/candidates/home-v4')
const sourcePath = path.join(
  candidateRoot,
  'interior-foreground--candidate-v02.png',
)
const eatPatchSourcePath = path.join(
  candidateRoot,
  'source--interior-no-food-bowl--imagegen-v01.png',
)
const candidatePath = path.join(
  candidateRoot,
  'interior-foreground--candidate-v03.png',
)
const qaPath = path.join(candidateRoot, 'home-composite--candidate-v03--qa.png')
const manifestPath = path.join(candidateRoot, 'manifest.candidate.json')
const approvalPath = path.join(
  root,
  'docs/art/reviews/home-v4/approval.v1.json',
)
const runtimeRoot = path.join(root, 'public/dev-art/home-v4')
const times = ['morning', 'noon', 'dusk', 'late-night']
const lightingDefinitions = {
  morning: ['#fff4cf', 0.12, '#f2c781', 0.06],
  dusk: ['#74566c', 0.18, '#30455d', 0.3],
  'late-night': ['#102c3a', 0.48, '#162732', 0.6],
}
const integrate = process.argv.includes('--integrate')

const width = 1200
const height = 1600
const sourceCrop = { left: 0, top: 62, width: 1024, height: 1365 }

await mkdir(candidateRoot, { recursive: true })

const resized = await sharp(sourcePath)
  .extract(sourceCrop)
  .resize(width, height, { fit: 'fill' })
  .toColourspace('srgb')
  .raw()
  .toBuffer({ resolveWithObject: true })
const rgba = Buffer.alloc(width * height * 4)
const windowBounds = {
  left: width,
  top: height,
  right: 0,
  bottom: 0,
}

for (let index = 0; index < width * height; index += 1) {
  const sourceOffset = index * 3
  const targetOffset = index * 4
  const red = resized.data[sourceOffset]
  const green = resized.data[sourceOffset + 1]
  const blue = resized.data[sourceOffset + 2]
  const isWindowMask = red < 18 && green < 18 && blue < 18

  rgba[targetOffset] = isWindowMask ? 0 : red
  rgba[targetOffset + 1] = isWindowMask ? 0 : green
  rgba[targetOffset + 2] = isWindowMask ? 0 : blue
  rgba[targetOffset + 3] = isWindowMask ? 0 : 255
  if (isWindowMask) {
    const x = index % width
    const y = Math.floor(index / width)
    windowBounds.left = Math.min(windowBounds.left, x)
    windowBounds.top = Math.min(windowBounds.top, y)
    windowBounds.right = Math.max(windowBounds.right, x + 1)
    windowBounds.bottom = Math.max(windowBounds.bottom, y + 1)
  }
}

// The generated source put the right-wall corner at x=845 above the sill but
// at x=768 below it. Relocate the upper crease onto the physical lower corner
// before composing Display art; this keeps one vertical world edge instead of
// two competing wall planes.
const wallCorner = {
  x: 768,
  top: 0,
  end: 1182,
  repairLeft: 760,
  repairRight: 777,
  shadowWidth: 40,
  darkness: 20,
}
const seamRepair = { center: 845, radius: 18, sourceOffset: 38, fadeAt: 1180, end: 1240 }
const seamSource = Buffer.from(rgba)
for (let y = 0; y < seamRepair.end; y += 1) {
  const verticalWeight = y <= seamRepair.fadeAt
    ? 1
    : 1 - (y - seamRepair.fadeAt) / (seamRepair.end - seamRepair.fadeAt)
  for (
    let x = seamRepair.center - seamRepair.radius;
    x <= seamRepair.center + seamRepair.radius;
    x += 1
  ) {
    const targetOffset = (y * width + x) * 4
    const sourceOffset = (y * width + x + seamRepair.sourceOffset) * 4
    const distance = Math.abs(x - seamRepair.center) / seamRepair.radius
    const horizontalWeight = 1 - distance * distance * (3 - 2 * distance)
    const weight = horizontalWeight * verticalWeight
    for (let channel = 0; channel < 3; channel += 1) {
      rgba[targetOffset + channel] = Math.round(
        rgba[targetOffset + channel] * (1 - weight)
        + seamSource[sourceOffset + channel] * weight,
      )
    }
  }
}

// Remove the generated ridge around the physical corner first. Copying the
// old crease's signed colour delta created a dark edge followed immediately by
// a bright rebound, which reads as two wall seams. Reconstruct the paper wash
// across that narrow band, then add one dark step with a long, low-gradient
// recovery into the right wall plane.
const cornerSource = Buffer.from(rgba)
for (let y = wallCorner.top; y < wallCorner.end; y += 1) {
  for (
    let x = wallCorner.repairLeft + 1;
    x < wallCorner.repairRight;
    x += 1
  ) {
    const progress = (
      (x - wallCorner.repairLeft)
      / (wallCorner.repairRight - wallCorner.repairLeft)
    )
    const targetOffset = (y * width + x) * 4
    const leftOffset = (y * width + wallCorner.repairLeft) * 4
    const rightOffset = (y * width + wallCorner.repairRight) * 4
    for (let channel = 0; channel < 3; channel += 1) {
      rgba[targetOffset + channel] = Math.round(
        cornerSource[leftOffset + channel] * (1 - progress)
        + cornerSource[rightOffset + channel] * progress,
      )
    }
  }

  for (let dx = 0; dx < wallCorner.shadowWidth; dx += 1) {
    const targetOffset = (y * width + wallCorner.x + dx) * 4
    const recovery = 1 - dx / wallCorner.shadowWidth
    const shadow = wallCorner.darkness * recovery * recovery
    for (let channel = 0; channel < 3; channel += 1) {
      rgba[targetOffset + channel] = Math.max(
        0,
        Math.round(rgba[targetOffset + channel] - shadow),
      )
    }
  }
}

const candidate = await sharp(rgba, {
  raw: { width, height, channels: 4 },
}).png().toBuffer()

const eatPatchSource = await sharp(eatPatchSourcePath)
  .resize(width, height, { fit: 'fill' })
  .removeAlpha()
  .toColourspace('srgb')
  .raw()
  .toBuffer()
const eatPatchMask = await sharp(Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="soft"><feGaussianBlur stdDeviation="10"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="black"/>
    <ellipse cx="420" cy="1310" rx="78" ry="64" fill="white" filter="url(#soft)"/>
  </svg>
`)).greyscale().raw().toBuffer()
const eatRgba = Buffer.from(rgba)
for (let index = 0; index < width * height; index += 1) {
  const alpha = eatPatchMask[index] / 255
  const targetOffset = index * 4
  const sourceOffset = index * 3
  for (let channel = 0; channel < 3; channel += 1) {
    eatRgba[targetOffset + channel] = Math.round(
      eatRgba[targetOffset + channel] * (1 - alpha)
      + eatPatchSource[sourceOffset + channel] * alpha,
    )
  }
}
const eatCandidate = await sharp(eatRgba, {
  raw: { width, height, channels: 4 },
}).png().toBuffer()

const windowRect = {
  left: windowBounds.left,
  top: windowBounds.top,
  width: windowBounds.right - windowBounds.left,
  height: windowBounds.bottom - windowBounds.top,
}
const exteriorCandidates = Object.fromEntries(await Promise.all(times.map(
  async (time) => {
    const scene = await sharp(
      path.join(root, `public/dev-art/home-v3/exterior-${time}.png`),
    )
      .ensureAlpha()
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(windowRect.width, windowRect.height, { fit: 'fill' })
      .png()
      .toBuffer()
    const output = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).composite([{
      input: scene,
      left: windowRect.left,
      top: windowRect.top,
    }]).png().toBuffer()
    return [time, output]
  },
)))
const lightingCandidates = Object.fromEntries(await Promise.all(
  Object.entries(lightingDefinitions).map(async (
    [time, [startColor, startOpacity, endColor, endOpacity]],
  ) => {
    const svg = Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="light" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0" stop-color="${startColor}" stop-opacity="${startOpacity}"/>
            <stop offset="1" stop-color="${endColor}" stop-opacity="${endOpacity}"/>
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#light)"/>
      </svg>
    `)
    return [time, await sharp(svg).png().toBuffer()]
  }),
))
const gazeCat = await sharp(path.join(
  root,
  'public/dev-art/latest-v5/portraits/minho-watercolor-v2/portrait--minho--gaze--watercolor--v02.png',
))
  .resize(360, 360, { fit: 'contain' })
  .flop()
  .png()
  .toBuffer()
const eatCat = await sharp(path.join(
  root,
  'public/dev-art/latest-v5/portraits/minho-watercolor-v2/portrait--minho--eat--watercolor--v02.png',
))
  .resize(450, 450, { fit: 'contain' })
  .png()
  .toBuffer()
const treatPile = await sharp(
  path.join(root, 'public/assets/treat/treat-96.png'),
)
  .resize(96, 96, { fit: 'contain' })
  .png()
  .toBuffer()

const qaComposites = Object.fromEntries(await Promise.all(times.map(
  async (time) => {
    const overlays = [
      { input: exteriorCandidates[time] },
      { input: candidate },
      { input: path.join(root, 'public/assets/home/display--postcard-wall--v03.png') },
      { input: gazeCat, left: 180, top: 623 },
    ]
    if (lightingCandidates[time]) {
      overlays.push({ input: lightingCandidates[time] })
    }
    overlays.push({ input: treatPile, left: 632, top: 860 })
    const output = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).composite(overlays).png().toBuffer()
    return [time, output]
  },
)))
const qaComposite = qaComposites.noon
const eatQaComposite = await sharp({
  create: {
    width,
    height,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
}).composite([
  { input: exteriorCandidates.noon },
  { input: eatCandidate },
  { input: path.join(root, 'public/assets/home/display--postcard-wall--v03.png') },
  { input: eatCat, left: 335, top: 864 },
]).png().toBuffer()

await Promise.all([
  writeFile(candidatePath, candidate),
  writeFile(
    path.join(candidateRoot, 'interior-foreground-eat--candidate-v01.png'),
    eatCandidate,
  ),
  writeFile(qaPath, qaComposite),
  writeFile(
    path.join(candidateRoot, 'home-composite-eat--candidate-v01--qa.png'),
    eatQaComposite,
  ),
  ...times.map((time) => writeFile(
    path.join(candidateRoot, `exterior-${time}--candidate-v01.png`),
    exteriorCandidates[time],
  )),
  ...Object.entries(lightingCandidates).map(([time, output]) => writeFile(
    path.join(candidateRoot, `lighting-${time}--candidate-v01.png`),
    output,
  )),
  ...times.map((time) => writeFile(
    path.join(candidateRoot, `home-composite-${time}--candidate-v03--qa.png`),
    qaComposites[time],
  )),
])

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const manifest = {
  version: 6,
  shippingEligible: false,
  status: 'approved-for-development-preview',
  canvas: { width, height },
  source: {
    path: 'interior-foreground--candidate-v02.png',
    generatedDimensions: { width: 1024, height: 1536 },
    crop: sourceCrop,
  },
  windowRect,
  rightWallPlane: {
    cornerX: wallCorner.x,
    seamTreatment: 'single-dark-step',
    displayProjection: 'cabinet-referenced-quadrilaterals',
    physicalReferences: [
      { id: 'table-front-edge', skewY: 9.96 },
      { id: 'right-baseboard', skewY: 12.2 },
    ],
  },
  review: {
    developmentPreviewApproval: path.relative(root, approvalPath),
  },
  outputs: [
    {
      id: 'interior-foreground',
      path: path.basename(candidatePath),
      width,
      height,
      hasAlpha: true,
      sha256: sha256(candidate),
    },
    {
      id: 'interior-foreground-eat',
      path: 'interior-foreground-eat--candidate-v01.png',
      width,
      height,
      hasAlpha: true,
      sha256: sha256(eatCandidate),
    },
    {
      id: 'home-composite-eat-qa',
      path: 'home-composite-eat--candidate-v01--qa.png',
      width,
      height,
      hasAlpha: true,
      sha256: sha256(eatQaComposite),
    },
    {
      id: 'home-composite-qa',
      path: path.basename(qaPath),
      width,
      height,
      hasAlpha: true,
      sha256: sha256(qaComposite),
    },
    ...times.map((time) => ({
      id: `exterior-${time}`,
      path: `exterior-${time}--candidate-v01.png`,
      width,
      height,
      hasAlpha: true,
      sha256: sha256(exteriorCandidates[time]),
    })),
    ...Object.entries(lightingCandidates).map(([time, output]) => ({
      id: `lighting-${time}`,
      path: `lighting-${time}--candidate-v01.png`,
      width,
      height,
      hasAlpha: true,
      sha256: sha256(output),
    })),
  ],
  reviewRequired: [
    'windowsill supports both the gaze Cat and runtime Treat control',
    'right wall reads as a separate plane at a 90-degree room corner',
    'frame fixture follows the right-wall perspective',
    'window transparency preserves all four exterior time layers',
    'lighting overlays remain structurally compatible',
  ],
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

if (integrate) {
  const approval = JSON.parse(await readFile(approvalPath, 'utf8'))
  if (
    approval.decision !== 'approved-for-development-preview'
    || approval.shippingEligible !== false
  ) {
    throw new Error('Home v4 development-preview approval is missing')
  }

  await mkdir(runtimeRoot, { recursive: true })
  await Promise.all([
    writeFile(path.join(runtimeRoot, 'interior-foreground.png'), candidate),
    writeFile(
      path.join(runtimeRoot, 'interior-foreground-eat.png'),
      eatCandidate,
    ),
    ...times.map((time) => writeFile(
      path.join(runtimeRoot, `exterior-${time}.png`),
      exteriorCandidates[time],
    )),
    ...Object.entries(lightingCandidates).map(([time, output]) => writeFile(
      path.join(runtimeRoot, `lighting-${time}.png`),
      output,
    )),
  ])
}

console.log(
  `Home v4 candidate built${integrate ? ' and integrated for development' : ''}`,
)
