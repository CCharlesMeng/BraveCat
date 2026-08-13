/**
 * split-level-den 部件拆分：
 *
 * 1. 把"无家具"重生成源图按既有规则归一化为 1200×1600。
 * 2. 最终干净 shell = v01 原图 + 家具区内羽化混入 v02 的干净背景，
 *    保证家具区外与 v01 逐像素一致（书架/卡位实测数据继续有效）。
 * 3. 默认部件（青绒抓柱、陶瓷双碗）= v01 与干净 shell 的差分 alpha ×
 *    v01 像素，自带投影与阴影，叠回干净 shell 即还原 v01。
 *
 * Usage:
 *   node scripts/build-den-piece-split.mjs /absolute/path/to/clean-source.png
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const cleanSourcePath = process.argv[2]
if (!cleanSourcePath) {
  throw new Error('Pass the regenerated clean-shell source PNG as the first argument')
}

const candidateRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/split-level-den',
)
const runtimeRoot = path.resolve('public/dev-art/home-theme/split-level-den')
const width = 1200
const height = 1600
const sourceCrop = { left: 0, top: 62, width: 1024, height: 1365 }

/** 家具所在的画布区域；区域外的最终 shell 必须与 v01 完全一致。 */
const furnitureRegions = {
  scratcher: { left: 30, top: 600, right: 310, bottom: 1360 },
  bowls: { left: 250, top: 1040, right: 550, bottom: 1230 },
}
const featherPx = 18
/** 差分小于该值视为水彩纹理噪声，不算部件像素。 */
const diffThreshold = 26

await mkdir(candidateRoot, { recursive: true })
await mkdir(runtimeRoot, { recursive: true })

const metadata = await sharp(cleanSourcePath).metadata()
if (metadata.width !== 1024 || metadata.height !== 1536) {
  throw new Error(
    `Expected a 1024×1536 generated source, got ${metadata.width}×${metadata.height}`,
  )
}
await sharp(cleanSourcePath)
  .png()
  .toFile(path.join(candidateRoot, 'source--clean-shell--imagegen-v02.png'))

const readRgba = async (input) => (
  sharp(input).ensureAlpha().toColourspace('srgb').raw()
    .toBuffer({ resolveWithObject: true })
)

const v02Normalized = await sharp(cleanSourcePath)
  .extract(sourceCrop)
  .resize(width, height, { fit: 'fill' })
  .toColourspace('srgb')
  .ensureAlpha()
  .raw()
  .toBuffer()
const { data: v01 } = await readRgba(
  path.join(candidateRoot, 'shell--candidate-v01.png'),
)

const insideRegion = (x, y, region) => (
  x >= region.left && x <= region.right && y >= region.top && y <= region.bottom
)

/** 0 在区域外，1 在羽化带内侧；用于把 v02 干净背景混入 v01。 */
const regionWeight = (x, y) => {
  let weight = 0
  for (const region of Object.values(furnitureRegions)) {
    const dx = Math.min(x - region.left, region.right - x)
    const dy = Math.min(y - region.top, region.bottom - y)
    const inside = Math.min(dx, dy)
    if (inside < 0) continue
    weight = Math.max(weight, Math.min(1, inside / featherPx))
  }
  return weight
}

const cleanShell = Buffer.alloc(width * height * 4)
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * 4
    const weight = regionWeight(x, y)
    for (let channel = 0; channel < 3; channel += 1) {
      cleanShell[offset + channel] = Math.round(
        v01[offset + channel] * (1 - weight)
        + v02Normalized[offset + channel] * weight,
      )
    }
    cleanShell[offset + 3] = 255
  }
}

const cleanShellPng = await sharp(cleanShell, {
  raw: { width, height, channels: 4 },
}).png().toBuffer()
await sharp(cleanShellPng).toFile(
  path.join(candidateRoot, 'shell--candidate-v02-clean.png'),
)
await sharp(cleanShellPng).toFile(path.join(runtimeRoot, 'shell.png'))

/** 差分 alpha：阈值内平滑过渡，并做 3×3 多数投票去噪。 */
const rawAlpha = new Uint8Array(width * height)
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * 4
    const diff = Math.max(
      Math.abs(v01[offset] - cleanShell[offset]),
      Math.abs(v01[offset + 1] - cleanShell[offset + 1]),
      Math.abs(v01[offset + 2] - cleanShell[offset + 2]),
    )
    rawAlpha[y * width + x] = Math.max(0, Math.min(
      255,
      Math.round(((diff - diffThreshold) / diffThreshold) * 255),
    ))
  }
}
const votedAlpha = new Uint8Array(width * height)
for (let y = 1; y < height - 1; y += 1) {
  for (let x = 1; x < width - 1; x += 1) {
    let sum = 0
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        sum += rawAlpha[(y + dy) * width + x + dx]
      }
    }
    votedAlpha[y * width + x] = Math.round(sum / 9)
  }
}

const writePiece = async (regionKey, outputName) => {
  const region = furnitureRegions[regionKey]
  const piece = Buffer.alloc(width * height * 4)
  let visible = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!insideRegion(x, y, region)) continue
      const index = y * width + x
      const alpha = votedAlpha[index]
      if (alpha === 0) continue
      const offset = index * 4
      piece[offset] = v01[offset]
      piece[offset + 1] = v01[offset + 1]
      piece[offset + 2] = v01[offset + 2]
      piece[offset + 3] = alpha
      visible += 1
    }
  }
  if (visible < 2_000) {
    throw new Error(`${regionKey} piece extraction is nearly empty (${visible}px)`)
  }
  const png = await sharp(piece, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer()
  await sharp(png).toFile(path.join(candidateRoot, `${outputName}--candidate-v01.png`))
  await sharp(png).toFile(path.join(runtimeRoot, `${outputName}.png`))
  console.log(`${outputName}: ${visible}px`)
}

await writePiece('scratcher', 'piece--scratcher--green-post')
await writePiece('bowls', 'piece--feeding--ceramic-bowls')

// 还原校验：干净 shell + 两个部件应基本还原 v01（羽化带内允许小残差）。
const { data: greenPost } = await readRgba(
  path.join(runtimeRoot, 'piece--scratcher--green-post.png'),
)
const { data: bowls } = await readRgba(
  path.join(runtimeRoot, 'piece--feeding--ceramic-bowls.png'),
)
let maxResidual = 0
let bigResiduals = 0
for (let index = 0; index < width * height; index += 1) {
  const offset = index * 4
  const composed = [0, 1, 2].map((channel) => {
    let value = cleanShell[offset + channel]
    for (const layer of [greenPost, bowls]) {
      const alpha = layer[offset + 3] / 255
      value = layer[offset + channel] * alpha + value * (1 - alpha)
    }
    return value
  })
  for (let channel = 0; channel < 3; channel += 1) {
    const residual = Math.abs(composed[channel] - v01[offset + channel])
    if (residual > maxResidual) maxResidual = residual
    if (residual > 40) bigResiduals += 1
  }
}
console.log(`restore check: maxResidual=${Math.round(maxResidual)} bigResiduals=${bigResiduals}`)
if (bigResiduals > width * height * 0.002 * 3) {
  throw new Error('clean shell + default pieces no longer restore v01')
}
console.log('done')
