/**
 * PROTOTYPE — 用后即弃。
 *
 * 把 image-generation 产出的 1024×1536 Home 源图按 Home v4 的既有裁切
 * 规则规范化为 1200×1600，并把黑色窗洞恢复为透明。输出只进入候选目录，
 * 不写 public/。
 *
 * Usage:
 *   node scripts/build-wall-perspective-prototype.mjs /absolute/path/to/source.png v02
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const sourcePath = process.argv[2]
const version = process.argv[3] ?? 'v01'
if (!sourcePath) {
  throw new Error('Pass the generated source PNG as the first argument')
}
if (!/^v\d{2}$/.test(version)) {
  throw new Error(`Expected a version like v02, got ${version}`)
}

const outputRoot = path.resolve(
  'docs/art/candidates/home-wall-prototype/2026-08-13-right-recede',
)
const outputPath = path.join(
  outputRoot,
  `interior-foreground--right-recede--candidate-${version}.png`,
)
const archivedSourcePath = path.join(
  outputRoot,
  `source--interior-right-recede--imagegen-${version}.png`,
)
const width = 1200
const height = 1600
const sourceCrop = { left: 0, top: 62, width: 1024, height: 1365 }

await mkdir(outputRoot, { recursive: true })

const metadata = await sharp(sourcePath).metadata()
if (metadata.width !== 1024 || metadata.height !== 1536) {
  throw new Error(
    `Expected a 1024×1536 generated source, got ${metadata.width}×${metadata.height}`,
  )
}

await sharp(sourcePath).png().toFile(archivedSourcePath)

const resized = await sharp(sourcePath)
  .extract(sourceCrop)
  .resize(width, height, { fit: 'fill' })
  .toColourspace('srgb')
  .removeAlpha()
  .raw()
  .toBuffer()
const rgba = Buffer.alloc(width * height * 4)

for (let index = 0; index < width * height; index += 1) {
  const sourceOffset = index * 3
  const targetOffset = index * 4
  const red = resized[sourceOffset]
  const green = resized[sourceOffset + 1]
  const blue = resized[sourceOffset + 2]
  const isWindowMask = red < 18 && green < 18 && blue < 18

  rgba[targetOffset] = isWindowMask ? 0 : red
  rgba[targetOffset + 1] = isWindowMask ? 0 : green
  rgba[targetOffset + 2] = isWindowMask ? 0 : blue
  rgba[targetOffset + 3] = isWindowMask ? 0 : 255
}

await sharp(rgba, {
  raw: { width, height, channels: 4 },
}).png().toFile(outputPath)

console.log(outputPath)
