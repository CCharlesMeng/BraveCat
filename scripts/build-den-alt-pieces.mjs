/**
 * split-level-den 替换部件：把绿幕生成件键控成透明 PNG，按目标尺寸
 * 缩放后锚定到画布坐标（底边中点对齐落脚点），输出整幅 1200×1600
 * 透明部件资产。键控逻辑沿用 build-home-display-v2.mjs 的绿幕规则。
 *
 * Usage:
 *   node scripts/build-den-alt-pieces.mjs \
 *     --rope-tower /abs/rope-tower-greenscreen.png \
 *     --raised-feeder /abs/raised-feeder-greenscreen.png
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const argValue = (flag) => {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

const candidateRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/split-level-den',
)
const runtimeRoot = path.resolve('public/dev-art/home-theme/split-level-den')
const width = 1200
const height = 1600

await mkdir(candidateRoot, { recursive: true })
await mkdir(runtimeRoot, { recursive: true })

/**
 * 按"绿色优势度"（green − max(red, blue)）键控：生成件背景约
 * (2, 171, 73)，优势度 ≈ 98；部件上最绿的鼠尾草色优势度 ≤ 20。
 * 优势度 ≤ 30 保留、≥ 70 抠除、之间线性过渡并做去绿溢色。
 */
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
    const greenness = green - Math.max(red, blue)
    const alpha = Math.max(0, Math.min(
      255,
      Math.round(255 * (1 - (greenness - 30) / 40)),
    ))

    if (alpha === 0) continue
    output[targetOffset] = red
    output[targetOffset + 1] = alpha < 255
      ? Math.min(green, Math.round(Math.max(red, blue) * 1.15))
      : green
    output[targetOffset + 2] = blue
    output[targetOffset + 3] = alpha
  }

  return sharp(output, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer()
}

const buildPiece = async ({
  sourcePath,
  outputName,
  archiveName,
  targetHeight,
  anchorBottomCenter,
}) => {
  await sharp(sourcePath).png().toFile(path.join(candidateRoot, archiveName))
  const keyed = await keyedPng(sourcePath)
  const trimmed = await sharp(keyed)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 12 })
    .png()
    .toBuffer()
  const scaled = await sharp(trimmed)
    .resize({ height: targetHeight })
    .png()
    .toBuffer()
  const scaledMeta = await sharp(scaled).metadata()
  const [anchorX, anchorY] = anchorBottomCenter
  const left = Math.round(anchorX - scaledMeta.width / 2)
  const top = Math.round(anchorY - scaledMeta.height)
  const piece = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: scaled, left, top }]).png().toBuffer()

  await sharp(piece).toFile(
    path.join(candidateRoot, `${outputName}--candidate-v01.png`),
  )
  await sharp(piece).toFile(path.join(runtimeRoot, `${outputName}.png`))
  console.log(
    `${outputName}: ${scaledMeta.width}×${scaledMeta.height} at (${left},${top})`,
  )
}

const ropeTowerSource = argValue('--rope-tower')
if (ropeTowerSource) {
  await buildPiece({
    sourcePath: ropeTowerSource,
    outputName: 'piece--scratcher--rope-tower',
    archiveName: 'source--rope-tower--greenscreen-v01.png',
    // 与青绒抓柱同一落脚点：平台近窗处，底边中点 (170, 1305)。
    targetHeight: 640,
    anchorBottomCenter: [170, 1305],
  })
}

const raisedFeederSource = argValue('--raised-feeder')
if (raisedFeederSource) {
  await buildPiece({
    sourcePath: raisedFeederSource,
    outputName: 'piece--feeding--raised-feeder',
    archiveName: 'source--raised-feeder--greenscreen-v01.png',
    // 与陶瓷双碗同一落脚点：平台上 (395, 1200)。
    targetHeight: 170,
    anchorBottomCenter: [395, 1200],
  })
}

console.log('done')
