/**
 * 窗外景母版新规格试点（江湾）：
 *
 * 按 docs/art/candidates/home-exteriors/README.md 的视差规格归一母版
 * （1200×1600、地平线带 y 520–640），再以 1.10 运行倍率在 ±60px
 * 视差行程两端合成到 A/F clean shell 的窗洞后，输出行程 QA 三联图。
 *
 * Usage:
 *   node scripts/build-exterior-remaster-pilot.mjs
 */
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const width = 1200
const height = 1600
const scale = 1.1
const travel = 60
const stagingRoot = '/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets'
const exteriorRoot = path.resolve(
  'docs/art/candidates/home-exteriors/approved-direction-2026-08-13/masters',
)
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)

const masterPath = path.join(
  exteriorRoot, 'ext-riverbend-embankment--master--noon-clear--candidate-v03.png',
)
// 源图等宽放大到 1200×1800 后需裁掉 200px；裁切位置向上偏置，
// 使实测地平线（放大坐标 ~776）落到带内 ~580。
const cropTop = 196
await sharp(path.join(stagingRoot, 'ext-riverbend-remaster-v03-raw.png'))
  .resize(width, 1800)
  .extract({ left: 0, top: cropTop, width, height })
  .png()
  .toFile(masterPath)

// 地平线实测：找蓝通道占比在垂直方向骤降的行（天空 → 陆地）。
const { data } = await sharp(masterPath).removeAlpha().raw()
  .toBuffer({ resolveWithObject: true })
const rowBlueness = (y) => {
  let total = 0
  for (let x = 100; x < width - 100; x += 8) {
    const offset = (y * width + x) * 3
    total += data[offset + 2] - (data[offset] + data[offset + 1]) / 2
  }
  return total
}
let horizonY = 0
let bestDrop = -Infinity
for (let y = 320; y < 900; y += 2) {
  const drop = rowBlueness(y - 12) - rowBlueness(y + 12)
  if (drop > bestDrop) {
    bestDrop = drop
    horizonY = y
  }
}
console.log(JSON.stringify({
  master: path.basename(masterPath),
  horizonY,
  horizonBand: { min: 520, max: 640 },
  inBand: horizonY >= 520 && horizonY <= 640,
}))

// 行程 QA：exterior 以 1.10 倍率置底，shell（窗洞透明）叠上。
const scaled = await sharp(masterPath)
  .resize(Math.round(width * scale), Math.round(height * scale))
  .png()
  .toBuffer()
const scaledWidth = Math.round(width * scale)
const scaledHeight = Math.round(height * scale)
const baseLeft = Math.round((width - scaledWidth) / 2)
const baseTop = Math.round((height - scaledHeight) / 2)

const qaDir = path.resolve(
  'docs/art/candidates/home-exteriors/approved-direction-2026-08-13/validation/riverbend-parallax',
)
await mkdir(qaDir, { recursive: true })

for (const slug of ['a-clear-sage', 'f-moonwhite-bluegray']) {
  const shell = await sharp(
    path.join(productionRoot, slug, 'shell--aperture-alpha--candidate-v01.png'),
  ).png().toBuffer()
  const frames = []
  for (const offset of [-travel, 0, travel]) {
    const visible = await sharp(scaled)
      .extract({
        left: -(baseLeft + offset), top: -baseTop, width, height,
      })
      .png()
      .toBuffer()
    const frame = await sharp(visible).composite([{ input: shell }]).png().toBuffer()
    frames.push(await sharp(frame).resize(384).toBuffer())
  }
  await sharp({
    create: {
      width: 384 * 3 + 32, height: 528, channels: 3, background: '#ffffff',
    },
  })
    .composite(frames.map((input, index) => ({
      input, left: 8 + index * (384 + 8), top: 8,
    })))
    .png()
    .toFile(path.join(qaDir, `qa--riverbend-v03-travel--${slug}--v01.png`))
  console.log(`${slug}: travel QA written`)
}
