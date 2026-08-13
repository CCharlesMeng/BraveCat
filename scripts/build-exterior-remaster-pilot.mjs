/**
 * 窗外景母版新规格重制管线（多地点）：
 *
 * 按 docs/art/candidates/home-exteriors/README.md 的视差规格归一母版
 * （1200×1600、地平线带 y 520–640，裁切偏置自动求解），再以 1.10
 * 运行倍率在 ±60px 视差行程两端合成到 A/B/F clean shell 的窗洞后，
 * 输出行程 QA 三联图。
 *
 * Usage:
 *   node scripts/build-exterior-remaster-pilot.mjs
 */
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const width = 1200
const height = 1600
const upscaledHeight = 1800
const scale = 1.1
const travel = 60
const horizonTarget = 580
const horizonBand = { min: 520, max: 640 }
const stagingRoot = '/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets'
const exteriorRoot = path.resolve(
  'docs/art/candidates/home-exteriors/approved-direction-2026-08-13/masters',
)
const validationRoot = path.resolve(
  'docs/art/candidates/home-exteriors/approved-direction-2026-08-13/validation',
)
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)

const SCENES = [
  {
    sceneId: 'ext-riverbend-embankment',
    raw: 'ext-riverbend-remaster-v03-raw.png',
    // 江湾对岸整幅是绿岸，全宽蓝度骤降检测稳定。
    measureX: { min: 100, max: width - 100 },
  },
  {
    sceneId: 'ext-quiet-sea-bay',
    raw: 'ext-quiet-sea-bay-remaster-v03-raw.png',
    // 海湾左侧是山岬，只在右半开阔海平线上检测。
    measureX: { min: 620, max: 1120 },
  },
]

/** 在给定 buffer（RGB, rowWidth 宽）里找天空→地物的最强蓝度骤降行。 */
const measureHorizon = (data, rowWidth, measureX, yMin, yMax) => {
  const rowBlueness = (y) => {
    let total = 0
    for (let x = measureX.min; x < measureX.max; x += 8) {
      const offset = (y * rowWidth + x) * 3
      total += data[offset + 2] - (data[offset] + data[offset + 1]) / 2
    }
    return total
  }
  let horizonY = 0
  let bestDrop = -Infinity
  for (let y = yMin; y < yMax; y += 2) {
    const drop = rowBlueness(y - 12) - rowBlueness(y + 12)
    if (drop > bestDrop) {
      bestDrop = drop
      horizonY = y
    }
  }
  return horizonY
}

for (const { sceneId, raw, measureX } of SCENES) {
  // 源图等宽放大到 1200×1800，先在放大稿上实测地平线，再解出
  // 让地平线落到 y≈580 的裁切偏置（受 0–200 可用范围约束）。
  const upscaled = await sharp(path.join(stagingRoot, raw))
    .resize(width, upscaledHeight)
    .removeAlpha()
    .raw()
    .toBuffer()
  const horizonUpscaled = measureHorizon(upscaled, width, measureX, 360, 1100)
  const cropTop = Math.max(
    0, Math.min(upscaledHeight - height, horizonUpscaled - horizonTarget),
  )

  const masterPath = path.join(
    exteriorRoot, `${sceneId}--master--noon-clear--candidate-v03.png`,
  )
  await sharp(path.join(stagingRoot, raw))
    .resize(width, upscaledHeight)
    .extract({ left: 0, top: cropTop, width, height })
    .png()
    .toFile(masterPath)

  const master = await sharp(masterPath).removeAlpha().raw().toBuffer()
  const horizonY = measureHorizon(master, width, measureX, 320, 900)
  console.log(JSON.stringify({
    master: path.basename(masterPath),
    cropTop,
    horizonY,
    horizonBand,
    inBand: horizonY >= horizonBand.min && horizonY <= horizonBand.max,
  }))

  // 行程 QA：exterior 以 1.10 倍率置底，shell（窗洞透明）叠上。
  const scaledWidth = Math.round(width * scale)
  const scaledHeight = Math.round(height * scale)
  const scaled = await sharp(masterPath)
    .resize(scaledWidth, scaledHeight)
    .png()
    .toBuffer()
  const baseLeft = Math.round((width - scaledWidth) / 2)
  const baseTop = Math.round((height - scaledHeight) / 2)

  const qaDir = path.join(validationRoot, `${sceneId.replace('ext-', '')}-parallax`)
  await mkdir(qaDir, { recursive: true })

  for (const slug of ['a-clear-sage', 'b-warm-walnut-gallery', 'f-moonwhite-bluegray']) {
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
      .toFile(path.join(qaDir, `qa--${sceneId.replace('ext-', '')}-v03-travel--${slug}--v01.png`))
    console.log(`${sceneId} × ${slug}: travel QA written`)
  }
}
