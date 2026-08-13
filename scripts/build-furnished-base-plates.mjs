/**
 * Build furnished base-plate candidates and their QA evidence.
 *
 * Unlike the retired piece-assembly pipeline, each room is a single generated
 * painting. This script only normalizes that painting, keys its black exterior
 * aperture, records measurements taken from the new painting, and demonstrates
 * the explicitly dynamic exterior/photo/cat/Cat Item layers.
 *
 * Usage:
 *   node scripts/build-furnished-base-plates.mjs [a-clear-sage ...]
 */
import {
  copyFile, mkdir, readFile, writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const WIDTH = 1200
const HEIGHT = 1600
const projectRoot = path.resolve('.')
const stagingRoot = '/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets'
const productionRoot = path.join(
  projectRoot,
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)
const exteriorRoot = path.join(
  projectRoot,
  'docs/art/candidates/home-exteriors/approved-direction-2026-08-13/masters',
)
const catRoot = path.join(projectRoot, 'apps/web/public/dev-art/home-v4/cat-animations')
const catItemRoot = path.join(
  projectRoot,
  'docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources',
)

const forms = {
  'a-clear-sage': {
    version: 'v01',
    sourceStaging: 'bravecat-home-theme-a-clear-sage--furnished-base-plate-source--candidate-v01.png',
    reference: path.join(
      projectRoot,
      'docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/composites',
      'bravecat-home-theme-a-clear-sage--assembled-room-review--candidate-v01.png',
    ),
    exterior: 'ext-riverbend-embankment--master--noon-clear--candidate-v03.png',
    catSheet: 'cat--minho--sleep--ambient--v01.webp',
    catItem: path.join(
      catItemRoot,
      'rest-cloud-bed/a-clear-sage/cat-item--rest-cloud-bed--a-clear-sage--base--candidate-v01.png',
    ),
    windowSeed: [290, 570],
    geometry: {
      postcardInnerQuads: [
        [[589, 337], [677, 337], [677, 413], [589, 413]],
        [[703, 337], [790, 337], [790, 413], [703, 413]],
        [[589, 458], [677, 458], [677, 535], [589, 535]],
        [[703, 458], [790, 458], [790, 535], [703, 535]],
        [[589, 583], [677, 583], [677, 660], [589, 660]],
        [[703, 583], [790, 583], [790, 660], [703, 660]],
      ],
      catItemReserveBBoxes: {
        scratch: { x: 35, y: 795, width: 220, height: 430 },
        feed: { x: 225, y: 1035, width: 300, height: 205 },
      },
      fixedFurnitureBBoxes: {
        cabinet: { x: 918, y: 835, width: 282, height: 460 },
        rug: { x: 183, y: 1170, width: 884, height: 385 },
      },
    },
    dress: {
      itemBox: { x: 55, y: 1045, width: 385, height: 245 },
      catBox: { x: 155, y: 1030, width: 190, height: 190 },
    },
  },
  'b-warm-walnut-gallery': {
    version: 'v01',
    sourceStaging: 'bravecat-home-theme-b-warm-walnut-gallery--furnished-base-plate-source--candidate-v01.png',
    reference: path.join(
      projectRoot,
      'docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/composites/b',
      'bravecat-home-theme-b-warm-walnut-travel-gallery--assembled-room-review--candidate-v03-unified-grade.png',
    ),
    exterior: 'ext-cedar-creek--master--noon-clear--candidate-v01.png',
    catSheet: 'cat--minho--play--ambient--v01.webp',
    catItem: path.join(
      catItemRoot,
      'play-soft-tunnel/b-warm-walnut/cat-item--play-soft-tunnel--b-warm-walnut--base--candidate-v01.png',
    ),
    windowSeed: [340, 555],
    geometry: {
      postcardInnerQuads: [
        [[831, 236], [908, 210], [908, 322], [831, 333]],
        [[969, 173], [1099, 131], [1099, 294], [969, 327]],
        [[831, 395], [908, 375], [908, 480], [831, 489]],
        [[969, 355], [1099, 329], [1099, 478], [969, 487]],
        [[831, 575], [908, 566], [908, 665], [831, 661]],
        [[969, 573], [1099, 568], [1099, 704], [969, 678]],
      ],
      catItemReserveBBoxes: {
        scratch: { x: 35, y: 855, width: 250, height: 420 },
        feed: { x: 230, y: 1075, width: 300, height: 195 },
      },
      fixedFurnitureBBoxes: {
        cabinet: { x: 696, y: 858, width: 484, height: 562 },
        rug: { x: 123, y: 1230, width: 785, height: 365 },
      },
    },
    dress: {
      itemBox: { x: 35, y: 1050, width: 430, height: 275 },
      catBox: { x: 125, y: 1050, width: 200, height: 200 },
    },
  },
  'f-moonwhite-bluegray': {
    version: 'v01',
    sourceStaging: 'bravecat-home-theme-f-moonwhite-bluegray--furnished-base-plate-source--candidate-v01.png',
    reference: path.join(
      projectRoot,
      'docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/composites',
      'bravecat-home-theme-f-moonwhite-bluegray--assembled-room-review--candidate-v01.png',
    ),
    exterior: 'ext-quiet-sea-bay--master--noon-clear--candidate-v03.png',
    catSheet: 'cat--minho--sleep--ambient--v01.webp',
    catItem: path.join(
      catItemRoot,
      'rest-cloud-bed/f-moonwhite-bluegray/cat-item--rest-cloud-bed--f-moonwhite-bluegray--base--candidate-v01.png',
    ),
    windowSeed: [300, 490],
    geometry: {
      postcardInnerQuads: [
        [[700, 280], [790, 280], [790, 362], [700, 362]],
        [[870, 280], [960, 280], [960, 362], [870, 362]],
        [[700, 432], [790, 432], [790, 509], [700, 509]],
        [[870, 432], [960, 432], [960, 509], [870, 509]],
        [[700, 583], [790, 583], [790, 654], [700, 654]],
        [[870, 583], [960, 583], [960, 654], [870, 654]],
      ],
      catItemReserveBBoxes: {
        scratch: { x: 75, y: 770, width: 255, height: 285 },
        feed: { x: 330, y: 900, width: 300, height: 145 },
      },
      fixedFurnitureBBoxes: {
        cabinet: { x: 672, y: 760, width: 455, height: 235 },
        rug: { x: 232, y: 1165, width: 790, height: 372 },
      },
    },
    dress: {
      itemBox: { x: 45, y: 820, width: 395, height: 245 },
      catBox: { x: 155, y: 805, width: 185, height: 185 },
    },
  },
}

const normalize = async (input) => sharp(input)
  .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const floodAperture = (data, channels, seed) => {
  const pixelCount = WIDTH * HEIGHT
  const visited = new Uint8Array(pixelCount)
  const queue = new Int32Array(pixelCount)
  const start = seed[1] * WIDTH + seed[0]
  const isDark = (index) => {
    const offset = index * channels
    return data[offset + 3] > 0
      && data[offset] <= 64
      && data[offset + 1] <= 64
      && data[offset + 2] <= 64
  }
  if (!isDark(start)) {
    throw new Error(`Aperture seed ${seed.join(',')} is not in the black opening`)
  }

  let read = 0
  let write = 0
  queue[write++] = start
  visited[start] = 1
  let minX = WIDTH
  let minY = HEIGHT
  let maxX = 0
  let maxY = 0

  while (read < write) {
    const index = queue[read++]
    const x = index % WIDTH
    const y = Math.floor(index / WIDTH)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)

    const neighbors = [
      x > 0 ? index - 1 : -1,
      x < WIDTH - 1 ? index + 1 : -1,
      y > 0 ? index - WIDTH : -1,
      y < HEIGHT - 1 ? index + WIDTH : -1,
    ]
    for (const next of neighbors) {
      if (next >= 0 && !visited[next] && isDark(next)) {
        visited[next] = 1
        queue[write++] = next
      }
    }
  }

  if (write < 10000) {
    throw new Error(`Detected aperture is unexpectedly small: ${write} pixels`)
  }
  return {
    pixels: visited,
    pixelCount: write,
    bbox: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      right: maxX,
      bottom: maxY,
    },
  }
}

const rawPng = (data) => sharp(data, {
  raw: { width: WIDTH, height: HEIGHT, channels: 4 },
}).png().toBuffer()

const keyAperture = async (normalized, aperture) => {
  const black = Buffer.from(normalized)
  const alpha = Buffer.from(normalized)
  const mask = Buffer.alloc(WIDTH * HEIGHT)

  for (let index = 0; index < aperture.pixels.length; index += 1) {
    if (!aperture.pixels[index]) continue
    const offset = index * 4
    black[offset] = 0
    black[offset + 1] = 0
    black[offset + 2] = 0
    black[offset + 3] = 255
    alpha[offset + 3] = 0
    mask[index] = 255
  }

  return {
    black: await rawPng(black),
    alpha: await rawPng(alpha),
    mask: await sharp(mask, {
      raw: { width: WIDTH, height: HEIGHT, channels: 1 },
    }).png().toBuffer(),
  }
}

const normalizePng = async (input) => sharp(input)
  .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
  .png()
  .toBuffer()

const points = (quad) => quad.map(([x, y]) => `${x},${y}`).join(' ')

const buildOverlay = async (base, geometry) => {
  const { windowAperture, postcardInnerQuads, catItemReserveBBoxes, fixedFurnitureBBoxes } = geometry
  const rect = (box, color, label) => `
    <rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}"
      fill="${color}" fill-opacity=".08" stroke="${color}" stroke-width="5"/>
    <text x="${box.x + 8}" y="${Math.max(28, box.y - 10)}"
      font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${color}">${label}</text>`
  const postcardSvg = postcardInnerQuads.map((quad, index) => `
    <polygon points="${points(quad)}" fill="#ffd84d" fill-opacity=".12"
      stroke="#ffd84d" stroke-width="4"/>
    <text x="${quad[0][0] + 6}" y="${quad[0][1] + 25}"
      font-family="Arial, sans-serif" font-size="20" font-weight="700"
      fill="#8a6500">P${index + 1}</text>`).join('')
  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${rect(windowAperture, '#00e5ff', 'WINDOW APERTURE')}
      ${postcardSvg}
      ${rect(catItemReserveBBoxes.scratch, '#ff4f81', 'SCRATCH RESERVE')}
      ${rect(catItemReserveBBoxes.feed, '#ff8a30', 'FEED RESERVE')}
      ${rect(fixedFurnitureBBoxes.cabinet, '#4dff88', 'CABINET')}
      ${rect(fixedFurnitureBBoxes.rug, '#cf67ff', 'RUG')}
    </svg>`
  return sharp(base).composite([{ input: Buffer.from(svg) }]).png().toBuffer()
}

const solve = (matrix, vector) => {
  const size = vector.length
  const augmented = matrix.map((row, index) => [...row, vector[index]])
  for (let column = 0; column < size; column += 1) {
    let pivot = column
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row
    }
    ;[augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]]
    const divisor = augmented[column][column]
    if (Math.abs(divisor) < 1e-9) throw new Error('Cannot solve perspective transform')
    for (let x = column; x <= size; x += 1) augmented[column][x] /= divisor
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue
      const factor = augmented[row][column]
      for (let x = column; x <= size; x += 1) {
        augmented[row][x] -= factor * augmented[column][x]
      }
    }
  }
  return augmented.map((row) => row[size])
}

const homography = (source, destination) => {
  const matrix = []
  const vector = []
  for (let index = 0; index < 4; index += 1) {
    const [x, y] = source[index]
    const [u, v] = destination[index]
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    vector.push(u)
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    vector.push(v)
  }
  return [...solve(matrix, vector), 1]
}

const invert3 = (h) => {
  const [a, b, c, d, e, f, g, i, j] = h
  const determinant = a * (e * j - f * i) - b * (d * j - f * g) + c * (d * i - e * g)
  return [
    (e * j - f * i) / determinant,
    (c * i - b * j) / determinant,
    (b * f - c * e) / determinant,
    (f * g - d * j) / determinant,
    (a * j - c * g) / determinant,
    (c * d - a * f) / determinant,
    (d * i - e * g) / determinant,
    (b * g - a * i) / determinant,
    (a * e - b * d) / determinant,
  ]
}

const renderPhotoLayer = async (quad, imagePath) => {
  const sourceWidth = 320
  const sourceHeight = 240
  const { data } = await sharp(imagePath)
    .resize(sourceWidth, sourceHeight, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const transform = invert3(homography(
    [[0, 0], [sourceWidth - 1, 0], [sourceWidth - 1, sourceHeight - 1], [0, sourceHeight - 1]],
    quad,
  ))
  const output = Buffer.alloc(WIDTH * HEIGHT * 4)
  const minX = Math.max(0, Math.floor(Math.min(...quad.map(([x]) => x))))
  const maxX = Math.min(WIDTH - 1, Math.ceil(Math.max(...quad.map(([x]) => x))))
  const minY = Math.max(0, Math.floor(Math.min(...quad.map(([, y]) => y))))
  const maxY = Math.min(HEIGHT - 1, Math.ceil(Math.max(...quad.map(([, y]) => y))))

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const denominator = transform[6] * x + transform[7] * y + transform[8]
      const sourceX = (transform[0] * x + transform[1] * y + transform[2]) / denominator
      const sourceY = (transform[3] * x + transform[4] * y + transform[5]) / denominator
      if (sourceX < 0 || sourceX >= sourceWidth || sourceY < 0 || sourceY >= sourceHeight) continue
      const sampleX = Math.min(sourceWidth - 1, Math.round(sourceX))
      const sampleY = Math.min(sourceHeight - 1, Math.round(sourceY))
      const sourceOffset = (sampleY * sourceWidth + sampleX) * 4
      const outputOffset = (y * WIDTH + x) * 4
      data.copy(output, outputOffset, sourceOffset, sourceOffset + 4)
    }
  }
  return rawPng(output)
}

const placedAsset = async (input, box) => {
  const trimmed = await sharp(input).trim({ threshold: 8 }).png().toBuffer()
  const metadata = await sharp(trimmed).metadata()
  const scale = Math.min(box.width / metadata.width, box.height / metadata.height)
  const width = Math.round(metadata.width * scale)
  const height = Math.round(metadata.height * scale)
  return {
    input: await sharp(trimmed).resize(width, height).png().toBuffer(),
    left: Math.round(box.x + (box.width - width) / 2),
    top: Math.round(box.y + box.height - height),
  }
}

const buildDressedProof = async (form, alphaBase) => {
  const exterior = await normalizePng(path.join(exteriorRoot, form.exterior))
  const photoFiles = [
    'ext-reed-lake--master--noon-clear--candidate-v02.png',
    'ext-irrigated-fields--master--noon-clear--candidate-v02.png',
    'ext-cedar-creek--master--noon-clear--candidate-v01.png',
    'ext-orchard-slope--master--noon-clear--candidate-v01.png',
    'ext-quiet-sea-bay--master--noon-clear--candidate-v03.png',
    'ext-riverbend-embankment--master--noon-clear--candidate-v03.png',
  ]
  const photoLayers = await Promise.all(form.geometry.postcardInnerQuads.map(
    (quad, index) => renderPhotoLayer(quad, path.join(exteriorRoot, photoFiles[index])),
  ))
  const catFrame = await sharp(path.join(catRoot, form.catSheet))
    .extract({ left: 0, top: 0, width: 512, height: 512 })
    .png()
    .toBuffer()
  const itemLayer = await placedAsset(form.catItem, form.dress.itemBox)
  const catLayer = await placedAsset(catFrame, form.dress.catBox)
  return sharp(exterior).composite([
    { input: alphaBase },
    ...photoLayers.map((input) => ({ input })),
    itemLayer,
    catLayer,
  ]).png().toBuffer()
}

const buildForm = async (slug, form) => {
  const target = path.join(productionRoot, slug)
  await mkdir(target, { recursive: true })
  const source = path.join(stagingRoot, form.sourceStaging)
  const archivedSource = path.join(target, `source--furnished-base-plate--imagegen-${form.version}.png`)
  await copyFile(source, archivedSource)

  const sourceMetadata = await sharp(source).metadata()
  const { data, info } = await normalize(source)
  const aperture = floodAperture(data, info.channels, form.windowSeed)
  const keyed = await keyAperture(data, aperture)
  const geometry = {
    formId: slug,
    assetRole: 'furnished-base-plate',
    freezeLevel: `furnished-base-plate-measured-freeze-${form.version}`,
    runtimeEligible: false,
    canvas: { width: WIDTH, height: HEIGHT },
    source: path.basename(archivedSource),
    normalization: {
      method: 'cover-center-crop',
      sourceWidth: sourceMetadata.width,
      sourceHeight: sourceMetadata.height,
      outputWidth: WIDTH,
      outputHeight: HEIGHT,
    },
    windowAperture: aperture.bbox,
    aperturePixels: aperture.pixelCount,
    ...form.geometry,
  }

  const blackName = `furnished-base-plate--black-aperture--candidate-${form.version}.png`
  const alphaName = `furnished-base-plate--aperture-alpha--candidate-${form.version}.png`
  const maskName = `aperture-mask--furnished-base-plate--candidate-${form.version}.png`
  await Promise.all([
    writeFile(path.join(target, blackName), keyed.black),
    writeFile(path.join(target, alphaName), keyed.alpha),
    writeFile(path.join(target, maskName), keyed.mask),
    writeFile(
      path.join(target, `geometry--furnished-base-plate--measured-freeze-${form.version}.json`),
      `${JSON.stringify(geometry, null, 2)}\n`,
    ),
    buildOverlay(keyed.black, geometry).then((buffer) => writeFile(
      path.join(target, `qa--furnished-base-plate-control-overlay--candidate-${form.version}.png`),
      buffer,
    )),
    normalizePng(form.reference).then((reference) => sharp({
      create: {
        width: WIDTH * 2 + 12,
        height: HEIGHT,
        channels: 4,
        background: '#201d1a',
      },
    }).composite([
      { input: reference, left: 0, top: 0 },
      { input: keyed.black, left: WIDTH + 12, top: 0 },
    ]).png().toBuffer()).then((buffer) => writeFile(
      path.join(target, `qa--furnished-base-plate-comparison--candidate-${form.version}.png`),
      buffer,
    )),
    buildDressedProof(form, keyed.alpha).then((buffer) => writeFile(
      path.join(target, `qa--furnished-base-plate-dressed--candidate-${form.version}.png`),
      buffer,
    )),
  ])
  console.log(`${slug}: ${aperture.pixelCount} aperture px, bbox ${JSON.stringify(aperture.bbox)}`)
}

const requested = process.argv.slice(2)
const selected = requested.length ? requested : Object.keys(forms)
for (const slug of selected) {
  if (!forms[slug]) throw new Error(`Unknown form: ${slug}`)
  await buildForm(slug, forms[slug])
}
