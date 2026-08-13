import { createHash } from 'node:crypto'
import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const candidateRoot = path.join(root, 'docs/art/candidates/home-display-v2')
const runtimeHomeRoot = path.join(root, 'public/assets/home')
const runtimeSouvenirRoot = path.join(root, 'public/assets/souvenirs')
const productionRoot = path.join(root, 'docs/art/production/home-display')

const sourcePaths = {
  wall: path.join(candidateRoot, 'source--postcard-wall--generated-v01.png'),
  souvenirs: path.join(candidateRoot, 'source--souvenirs--generated-v01.png'),
}

const requestedSources = {
  wall: process.argv.includes('--wall-source')
    ? process.argv[process.argv.indexOf('--wall-source') + 1]
    : null,
  souvenirs: process.argv.includes('--souvenir-source')
    ? process.argv[process.argv.indexOf('--souvenir-source') + 1]
    : null,
}

const TABLE_PERSPECTIVE_SKEW_Y = 10
const RIGHT_WALL_CORNER_X = 768
const CABINET_PERSPECTIVE_REFERENCE = {
  rearSlope: 65 / 262,
  frontSlope: 50 / 262,
}

const wallComponents = [
  { source: { left: 584, top: 164, width: 159, height: 223 }, quad: [[774, 160], [992, 209], [987, 340], [774, 291]] },
  { source: { left: 788, top: 183, width: 117, height: 208 }, quad: [[996, 207], [1167, 245], [1162, 350], [995, 313]] },
  { source: { left: 582, top: 409, width: 165, height: 231 }, quad: [[772, 316], [995, 364], [990, 497], [772, 450]] },
  { source: { left: 788, top: 418, width: 118, height: 215 }, quad: [[993, 363], [1164, 400], [1159, 505], [992, 469]] },
  { source: { left: 579, top: 668, width: 169, height: 275 }, quad: [[770, 473], [997, 520], [991, 653], [770, 608]] },
  { source: { left: 786, top: 664, width: 121, height: 262 }, quad: [[990, 519], [1161, 555], [1156, 661], [989, 626]] },
]

export const postcardSlots = [
  { quad: [[792, 184], [974, 225], [970, 319], [792, 278]], contentSkewY: 12.7 },
  { quad: [[1009, 233], [1148, 264], [1144, 337], [1008, 307]], contentSkewY: 12.6 },
  { quad: [[790, 342], [972, 381], [968, 476], [790, 437]], contentSkewY: 12.1 },
  { quad: [[1006, 388], [1145, 418], [1141, 491], [1005, 462]], contentSkewY: 12.2 },
  { quad: [[788, 500], [970, 537], [966, 632], [788, 595]], contentSkewY: 11.5 },
  { quad: [[1003, 544], [1142, 573], [1138, 646], [1002, 618]], contentSkewY: 11.7 },
]

export const souvenirAnchors = [
  { x: 950, y: 934, width: 62, height: 52, rotation: -10, skewY: TABLE_PERSPECTIVE_SKEW_Y, zIndex: 2 },
  { x: 992, y: 936, width: 58, height: 50, rotation: 7, skewY: TABLE_PERSPECTIVE_SKEW_Y, zIndex: 3 },
  { x: 1024, y: 930, width: 56, height: 48, rotation: -3, skewY: TABLE_PERSPECTIVE_SKEW_Y, zIndex: 1 },
]

const ensureDirectories = async () => {
  await Promise.all([
    mkdir(candidateRoot, { recursive: true }),
    mkdir(runtimeHomeRoot, { recursive: true }),
    mkdir(runtimeSouvenirRoot, { recursive: true }),
    mkdir(productionRoot, { recursive: true }),
  ])
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

const keyedPng = async (input) => {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })
  const output = Buffer.alloc(info.width * info.height * 4)

  for (let index = 0; index < info.width * info.height; index += 1) {
    const sourceOffset = index * 3
    const targetOffset = index * 4
    const red = data[sourceOffset]
    const green = data[sourceOffset + 1]
    const blue = data[sourceOffset + 2]
    const keyLike = green > 105
      && green > red * 1.25
      && green > blue * 1.25
    const edgeAlpha = Math.max(0, Math.min(
      255,
      Math.round(((Math.max(red, blue) - 18) / 72) * 255),
    ))
    const alpha = keyLike ? edgeAlpha : 255

    if (alpha === 0) {
      output[targetOffset] = 0
      output[targetOffset + 1] = 0
      output[targetOffset + 2] = 0
      output[targetOffset + 3] = 0
      continue
    }

    output[targetOffset] = red
    output[targetOffset + 1] = keyLike
      ? Math.min(green, Math.round(Math.max(red, blue) * 1.15))
      : green
    output[targetOffset + 2] = blue
    output[targetOffset + 3] = alpha
  }

  return sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  }).png().toBuffer()
}

const invertMatrix3 = (matrix) => {
  const [a, b, c, d, e, f, g, h, i] = matrix
  const determinant = (
    a * (e * i - f * h)
    - b * (d * i - f * g)
    + c * (d * h - e * g)
  )
  if (Math.abs(determinant) < 1e-9) {
    throw new Error('projective display quad is degenerate')
  }
  return [
    (e * i - f * h) / determinant,
    (c * h - b * i) / determinant,
    (b * f - c * e) / determinant,
    (f * g - d * i) / determinant,
    (a * i - c * g) / determinant,
    (c * d - a * f) / determinant,
    (d * h - e * g) / determinant,
    (b * g - a * h) / determinant,
    (a * e - b * d) / determinant,
  ]
}

const unitSquareToQuad = (quad) => {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const dy3 = y0 - y1 + y2 - y3
  const denominator = dx1 * dy2 - dx2 * dy1
  const projectX = (dx3 * dy2 - dx2 * dy3) / denominator
  const projectY = (dx1 * dy3 - dx3 * dy1) / denominator
  return [
    x1 - x0 + projectX * x1,
    x3 - x0 + projectY * x3,
    x0,
    y1 - y0 + projectX * y1,
    y3 - y0 + projectY * y3,
    y0,
    projectX,
    projectY,
    1,
  ]
}

const projectPngToQuad = async (input, quad) => {
  const source = await sharp(input)
    .ensureAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })
  const inverse = invertMatrix3(unitSquareToQuad(quad))
  const xs = quad.map(([x]) => x)
  const ys = quad.map(([, y]) => y)
  const left = Math.floor(Math.min(...xs))
  const top = Math.floor(Math.min(...ys))
  const width = Math.ceil(Math.max(...xs)) - left + 1
  const height = Math.ceil(Math.max(...ys)) - top + 1
  const output = Buffer.alloc(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const canvasX = left + x + 0.5
      const canvasY = top + y + 0.5
      const scale = (
        inverse[6] * canvasX
        + inverse[7] * canvasY
        + inverse[8]
      )
      const unitX = (
        inverse[0] * canvasX
        + inverse[1] * canvasY
        + inverse[2]
      ) / scale
      const unitY = (
        inverse[3] * canvasX
        + inverse[4] * canvasY
        + inverse[5]
      ) / scale
      if (unitX < 0 || unitX > 1 || unitY < 0 || unitY > 1) continue

      const sourceX = unitX * (source.info.width - 1)
      const sourceY = unitY * (source.info.height - 1)
      const x0 = Math.floor(sourceX)
      const y0 = Math.floor(sourceY)
      const x1 = Math.min(source.info.width - 1, x0 + 1)
      const y1 = Math.min(source.info.height - 1, y0 + 1)
      const xWeight = sourceX - x0
      const yWeight = sourceY - y0
      const samples = [
        [x0, y0, (1 - xWeight) * (1 - yWeight)],
        [x1, y0, xWeight * (1 - yWeight)],
        [x0, y1, (1 - xWeight) * yWeight],
        [x1, y1, xWeight * yWeight],
      ]
      let alpha = 0
      const premultiplied = [0, 0, 0]
      for (const [sampleX, sampleY, weight] of samples) {
        const sourceOffset = (
          (sampleY * source.info.width + sampleX) * 4
        )
        const sampleAlpha = source.data[sourceOffset + 3] / 255
        alpha += sampleAlpha * weight
        for (let channel = 0; channel < 3; channel += 1) {
          premultiplied[channel] += (
            source.data[sourceOffset + channel]
            * sampleAlpha
            * weight
          )
        }
      }
      const targetOffset = (y * width + x) * 4
      if (alpha > 0) {
        for (let channel = 0; channel < 3; channel += 1) {
          output[targetOffset + channel] = Math.round(
            premultiplied[channel] / alpha,
          )
        }
        output[targetOffset + 3] = Math.round(alpha * 255)
      }
    }
  }

  return {
    input: await sharp(output, {
      raw: { width, height, channels: 4 },
    }).png().toBuffer(),
    left,
    top,
  }
}

const buildWall = async () => {
  const keyed = await keyedPng(sourcePaths.wall)
  const overlays = []

  for (const { source, quad } of wallComponents) {
    const padding = 8
    const extracted = await sharp(keyed)
      .extract({
        left: source.left - padding,
        top: source.top - padding,
        width: source.width + padding * 2,
        height: source.height + padding * 2,
      })
      .png()
      .toBuffer()
    overlays.push(await projectPngToQuad(extracted, quad))
  }

  return sharp({
    create: {
      width: 1200,
      height: 1600,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(overlays).png().toBuffer()
}

const buildSouvenir = async (half) => {
  const keyed = await keyedPng(sourcePaths.souvenirs)
  const metadata = await sharp(keyed).metadata()
  const halfWidth = Math.floor(metadata.width / 2)
  const halfImage = await sharp(keyed)
    .extract({
      left: half === 'left' ? 0 : halfWidth,
      top: 0,
      width: half === 'left' ? halfWidth : metadata.width - halfWidth,
      height: metadata.height,
    })
    .png()
    .toBuffer()
  const extracted = await sharp(halfImage)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(416, 416, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: extracted, gravity: 'centre' }]).png().toBuffer()
}

const buildOcclusion = async () => {
  const interiorPath = path.join(root, 'public/dev-art/home-v4/interior-foreground.png')
  const mask = Buffer.from(`
    <svg width="1200" height="1600" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="1600" fill="black"/>
      <path d="M 1065 838 C 1072 808 1089 790 1112 787 C 1140 785 1160 808 1166 841 L 1161 939 C 1158 973 1143 991 1115 993 C 1085 991 1070 974 1067 943 Z" fill="white"/>
      <path d="M 938 981 L 1200 1027 L 1200 1075 L 939 1028 Z" fill="white"/>
    </svg>
  `)
  const alpha = await sharp(mask).extractChannel('red').raw().toBuffer()
  const source = await sharp(interiorPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let index = 0; index < 1200 * 1600; index += 1) {
    source.data[index * 4 + 3] = alpha[index]
    if (alpha[index] === 0) {
      source.data[index * 4] = 0
      source.data[index * 4 + 1] = 0
      source.data[index * 4 + 2] = 0
    }
  }

  return sharp(source.data, {
    raw: {
      width: source.info.width,
      height: source.info.height,
      channels: 4,
    },
  }).png().toBuffer()
}

const placeImage = async (input, rect) => {
  const resized = await sharp(input)
    .resize(rect.width, rect.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .rotate(rect.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const metadata = await sharp(resized).metadata()
  return {
    input: resized,
    left: Math.round(rect.x + (rect.width - metadata.width) / 2),
    top: Math.round(rect.y + (rect.height - metadata.height) / 2),
  }
}

const buildQaComposite = async ({
  wall,
  pin,
  charm,
  occlusion,
}) => {
  const background = sharp({
    create: {
      width: 1200,
      height: 1600,
      channels: 4,
      background: '#f6f0df',
    },
  })
  const scenePaths = [
    path.join(root, 'public/scenes/scene--new-zealand-fiordland-milford-sound--day-signature--v01.webp'),
    path.join(root, 'public/scenes/scene--morocco-ouarzazate-ait-benhaddou--golden-hour--v01.webp'),
  ]
  const postcardOverlays = []
  for (let index = 0; index < scenePaths.length; index += 1) {
    const slot = postcardSlots[index]
    const postcard = await sharp(scenePaths[index])
      .resize(512, 320, { fit: 'cover' })
      .png()
      .toBuffer()
    postcardOverlays.push(await projectPngToQuad(postcard, slot.quad))
  }
  const souvenirInputs = [pin, charm, pin]
  const souvenirOverlays = await Promise.all(
    souvenirAnchors
      .map((anchor, index) => ({ anchor, input: souvenirInputs[index] }))
      .sort((left, right) => left.anchor.zIndex - right.anchor.zIndex)
      .map(({ anchor, input }) => placeImage(input, anchor)),
  )

  return background.composite([
    { input: path.join(root, 'public/dev-art/home-v4/exterior-noon.png') },
    { input: path.join(root, 'public/dev-art/home-v4/interior-foreground.png') },
    ...postcardOverlays,
    { input: wall },
    ...souvenirOverlays,
    { input: occlusion },
  ]).png().toBuffer()
}

const assetRecord = async ({
  id,
  candidate,
  runtime,
  bytes,
}) => {
  const metadata = await sharp(bytes).metadata()
  return {
    id,
    candidate,
    runtime,
    width: metadata.width,
    height: metadata.height,
    hasAlpha: metadata.hasAlpha,
    sha256: sha256(bytes),
  }
}

await ensureDirectories()
for (const [kind, requestedPath] of Object.entries(requestedSources)) {
  if (requestedPath) await copyFile(requestedPath, sourcePaths[kind])
}

const wall = await buildWall()
const pin = await buildSouvenir('left')
const charm = await buildSouvenir('right')
const occlusion = await buildOcclusion()
const qaComposite = await buildQaComposite({ wall, pin, charm, occlusion })
const qaMobile = await sharp(qaComposite)
  .resize(470, 627, { fit: 'fill' })
  .png()
  .toBuffer()

const outputs = {
  wallCandidate: path.join(candidateRoot, 'display--postcard-wall--candidate-v02.png'),
  pinCandidate: path.join(candidateRoot, 'souvenir--postmark-pin--candidate-v01.png'),
  charmCandidate: path.join(candidateRoot, 'souvenir--travel-charm--candidate-v01.png'),
  occlusionCandidate: path.join(candidateRoot, 'display--souvenir-occlusion--candidate-v01.png'),
  qaComposite: path.join(candidateRoot, 'display--home-composite--qa-v01.png'),
  qaMobile: path.join(candidateRoot, 'display--home-composite--mobile-470--qa-v01.png'),
  wallRuntime: path.join(runtimeHomeRoot, 'display--postcard-wall--v03.png'),
  occlusionRuntime: path.join(runtimeHomeRoot, 'display--souvenir-occlusion--v01.png'),
  pinRuntime: path.join(runtimeSouvenirRoot, 'souvenir--postmark-pin--v01.png'),
  charmRuntime: path.join(runtimeSouvenirRoot, 'souvenir--travel-charm--v01.png'),
}

await Promise.all([
  writeFile(outputs.wallCandidate, wall),
  writeFile(outputs.pinCandidate, pin),
  writeFile(outputs.charmCandidate, charm),
  writeFile(outputs.occlusionCandidate, occlusion),
  writeFile(outputs.qaComposite, qaComposite),
  writeFile(outputs.qaMobile, qaMobile),
  writeFile(outputs.wallRuntime, wall),
  writeFile(outputs.occlusionRuntime, occlusion),
  writeFile(outputs.pinRuntime, pin),
  writeFile(outputs.charmRuntime, charm),
])

const candidateManifest = {
  version: 4,
  shippingEligible: true,
  styleIntensity: 'B',
  perspectiveReference: 'public/dev-art/home-v4/interior-foreground.png',
  canvas: { width: 1200, height: 1600 },
  wallFixture: {
    path: 'display--postcard-wall--candidate-v02.png',
    structure: 'six independent thin frames with clips; no backing board',
    cornerX: RIGHT_WALL_CORNER_X,
    projection: 'cabinet-referenced-quadrilaterals',
    cabinetPerspectiveReference: CABINET_PERSPECTIVE_REFERENCE,
    slots: postcardSlots,
  },
  souvenirDisplay: {
    tableTreatment: 'reuse original right-side table; no added table fixture',
    tabletopQuadrilateral: [
      [938, 925],
      [1200, 990],
      [1200, 1065],
      [938, 1015],
    ],
    vaseExclusionZone: { x: 1058, y: 782, width: 116, height: 216 },
    anchors: souvenirAnchors,
    occlusion: 'display--souvenir-occlusion--candidate-v01.png',
  },
  qa: {
    fullComposite: 'display--home-composite--qa-v01.png',
    mobile470: 'display--home-composite--mobile-470--qa-v01.png',
    runtimeMobile470: [
      'runtime--empty--mobile-470--qa-v01.png',
      'runtime--partial--mobile-470--qa-v01.png',
      'runtime--full--mobile-470--qa-v01.png',
      'runtime--departure-note--mobile-470--qa-v01.png',
    ],
    runtimeReport: 'runtime-qa-report.v1.json',
    reviewed: [
      'wall fixtures remain coplanar with the right wall',
      'fixture scale narrows toward the right column',
      'three souvenirs stay inside the original tabletop quadrilateral',
      'vase and front table edge occlude overlapping souvenir pixels',
      'display avoids the central cat and departure-note regions',
    ],
  },
}
await writeFile(
  path.join(candidateRoot, 'manifest.candidate.json'),
  `${JSON.stringify(candidateManifest, null, 2)}\n`,
)

const productionAssets = await Promise.all([
  assetRecord({
    id: 'postcard-wall',
    candidate: 'docs/art/candidates/home-display-v2/display--postcard-wall--candidate-v02.png',
    runtime: '/assets/home/display--postcard-wall--v03.png',
    bytes: wall,
  }),
  assetRecord({
    id: 'souvenir-occlusion',
    candidate: 'docs/art/candidates/home-display-v2/display--souvenir-occlusion--candidate-v01.png',
    runtime: '/assets/home/display--souvenir-occlusion--v01.png',
    bytes: occlusion,
  }),
  assetRecord({
    id: 'postmark-pin',
    candidate: 'docs/art/candidates/home-display-v2/souvenir--postmark-pin--candidate-v01.png',
    runtime: '/assets/souvenirs/souvenir--postmark-pin--v01.png',
    bytes: pin,
  }),
  assetRecord({
    id: 'travel-charm',
    candidate: 'docs/art/candidates/home-display-v2/souvenir--travel-charm--candidate-v01.png',
    runtime: '/assets/souvenirs/souvenir--travel-charm--v01.png',
    bytes: charm,
  }),
])
const productionManifest = {
  version: 4,
  shippingEligible: true,
  styleIntensity: 'B',
  perspectiveReference: '/dev-art/home-v4/interior-foreground.png',
  rightWallPlane: {
    cornerX: RIGHT_WALL_CORNER_X,
    projection: 'cabinet-referenced-quadrilaterals',
    cabinetPerspectiveReference: CABINET_PERSPECTIVE_REFERENCE,
  },
  tablePlane: { perspectiveSkewY: TABLE_PERSPECTIVE_SKEW_Y },
  removedRuntimeAssets: ['/assets/home/display--souvenir-table--v01.png'],
  assets: productionAssets,
  postcardSlots,
  souvenirAnchors,
}
await writeFile(
  path.join(productionRoot, 'manifest.v2.json'),
  `${JSON.stringify(productionManifest, null, 2)}\n`,
)

console.log('home display v2 assets built')
