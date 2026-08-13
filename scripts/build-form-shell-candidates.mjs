/**
 * A/F clean shell 候选生产（生产顺序第 3 步）：
 *
 * 1. 归一化 1024×1536 生成件为 1200×1600（沿用既有裁切规则）。
 * 2. 纯黑窗洞键控为透明（aperture alpha），另导出独立 mask。
 * 3. 依据 form-controls 的几何 manifest 叠加控制线做对齐 QA。
 * 4. 实测窗洞 bbox 与墙角位置，输出测量报告供冻结复核。
 *
 * Usage:
 *   node scripts/build-form-shell-candidates.mjs \
 *     --form a --source /abs/form-a-clean-shell-imagegen-v01.png
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const argValue = (flag) => {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}
const formKey = argValue('--form')
const sourcePath = argValue('--source')
const FORMS = {
  a: {
    slug: 'a-clear-sage',
    geometry: 'home-form--a-clear-sage--geometry-v01.json',
  },
  f: {
    slug: 'f-moonwhite-bluegray',
    geometry: 'home-form--f-moonwhite-bluegray--geometry-v01.json',
  },
}
if (!FORMS[formKey] || !sourcePath) {
  throw new Error('Usage: --form a|f --source /abs/source.png')
}
const { slug, geometry } = FORMS[formKey]

const controlsRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/form-controls',
)
const outputRoot = path.resolve(
  `docs/art/candidates/home-theme-prototypes/2026-08-13/production/${slug}`,
)
const width = 1200
const height = 1600
const sourceCrop = { left: 0, top: 62, width: 1024, height: 1365 }

await mkdir(outputRoot, { recursive: true })
const manifest = JSON.parse(
  await readFile(path.join(controlsRoot, geometry), 'utf8'),
)

const sourceMeta = await sharp(sourcePath).metadata()
if (sourceMeta.width !== 1024 || sourceMeta.height !== 1536) {
  throw new Error(
    `Expected 1024×1536 source, got ${sourceMeta.width}×${sourceMeta.height}`,
  )
}
await sharp(sourcePath).png().toFile(
  path.join(outputRoot, 'source--clean-shell--imagegen-v01.png'),
)

const normalized = await sharp(sourcePath)
  .extract(sourceCrop)
  .resize(width, height, { fit: 'fill' })
  .toColourspace('srgb')
  .removeAlpha()
  .raw()
  .toBuffer()

// 键控：近黑像素 → 透明窗洞；同时构建 mask 与实测 bbox。
const shell = Buffer.alloc(width * height * 4)
const mask = Buffer.alloc(width * height)
let bbox = { minX: Infinity, minY: Infinity, maxX: -1, maxY: -1 }
let aperturePixels = 0
for (let index = 0; index < width * height; index += 1) {
  const s = index * 3
  const t = index * 4
  const [r, g, b] = [normalized[s], normalized[s + 1], normalized[s + 2]]
  const isAperture = r < 26 && g < 26 && b < 26
  if (isAperture) {
    mask[index] = 255
    aperturePixels += 1
    const x = index % width
    const y = Math.floor(index / width)
    if (x < bbox.minX) bbox.minX = x
    if (x > bbox.maxX) bbox.maxX = x
    if (y < bbox.minY) bbox.minY = y
    if (y > bbox.maxY) bbox.maxY = y
    continue
  }
  shell[t] = r
  shell[t + 1] = g
  shell[t + 2] = b
  shell[t + 3] = 255
}
if (aperturePixels < 30_000) {
  throw new Error(`aperture keying found only ${aperturePixels}px of black`)
}

const shellPng = await sharp(shell, {
  raw: { width, height, channels: 4 },
}).png().toBuffer()
await sharp(shellPng).toFile(
  path.join(outputRoot, 'shell--aperture-alpha--candidate-v01.png'),
)
await sharp(mask, { raw: { width, height, channels: 1 } })
  .png()
  .toFile(path.join(outputRoot, 'aperture-mask--candidate-v01.png'))

// 墙角实测：在窗洞右侧的墙带内找最强垂直边。
const lum = (x, y) => {
  const offset = (y * width + x) * 3
  return 0.299 * normalized[offset]
    + 0.587 * normalized[offset + 1]
    + 0.114 * normalized[offset + 2]
}
const cornerSearch = { fromX: bbox.maxX + 60, toX: 1160, fromY: 320, toY: 780 }
let corner = { x: null, score: -1 }
for (let x = cornerSearch.fromX; x <= cornerSearch.toX; x += 1) {
  let score = 0
  for (let y = cornerSearch.fromY; y < cornerSearch.toY; y += 1) {
    score += Math.abs(lum(x + 2, y) - lum(x - 2, y))
  }
  score /= cornerSearch.toY - cornerSearch.fromY
  if (score > corner.score) corner = { x, score }
}

// QA 叠图：控制几何（窗洞/卡位/柜/锚点）画在候选上。
const p = (points) => points.map(([x, y]) => `${x},${y}`).join(' ')
const rect = (r, color) => `<rect x="${r.x}" y="${r.y}" width="${r.width}"
  height="${r.height}" fill="none" stroke="${color}" stroke-width="4"/>`
const windowSvg = manifest.windowAperture.quad
  ? `<polygon points="${p(manifest.windowAperture.quad)}" fill="none"
      stroke="#d84632" stroke-width="5"/>`
  : rect(manifest.windowAperture, '#d84632')
const overlaySvg = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${windowSvg}
  ${manifest.postcardSlots.map(({ quad }) => `
    <polygon points="${p(quad)}" fill="none" stroke="#d84632" stroke-width="3"/>
  `).join('')}
  ${manifest.cabinetFrontQuad
    ? `<polygon points="${p(manifest.cabinetFrontQuad)}" fill="none"
        stroke="#765a91" stroke-width="4"/>`
    : ''}
  ${manifest.cabinetFrontRect ? rect(manifest.cabinetFrontRect, '#765a91') : ''}
  ${manifest.platform ? `<polygon points="${p(manifest.platform.top)}"
      fill="none" stroke="#347a48" stroke-width="4"/>` : ''}
  ${manifest.souvenirAnchors.map((anchor) => rect(anchor, '#1f6f86')).join('')}
  ${rect(manifest.treatAnchor, '#2b5c8a')}
  ${corner.x ? `<line x1="${corner.x}" y1="120" x2="${corner.x}" y2="1400"
      stroke="#5a7a52" stroke-width="3" stroke-dasharray="14 10"/>` : ''}
</svg>
`)
await sharp(shellPng)
  .flatten({ background: '#9fc2d8' })
  .composite([{ input: overlaySvg }])
  .png()
  .toFile(path.join(outputRoot, 'qa--control-overlay--candidate-v01.png'))

const control = manifest.windowAperture.quad
  ? (() => {
    const xs = manifest.windowAperture.quad.map(([x]) => x)
    const ys = manifest.windowAperture.quad.map(([, y]) => y)
    return {
      x: Math.min(...xs), y: Math.min(...ys),
      right: Math.max(...xs), bottom: Math.max(...ys),
    }
  })()
  : {
    x: manifest.windowAperture.x,
    y: manifest.windowAperture.y,
    right: manifest.windowAperture.x + manifest.windowAperture.width,
    bottom: manifest.windowAperture.y + manifest.windowAperture.height,
  }
const controlCornerX = manifest.walls.rightWall?.cornerX
  ?? manifest.walls.leftWall?.cornerX
const report = {
  form: slug,
  aperturePixels,
  apertureBBox: bbox,
  apertureControl: control,
  apertureDelta: {
    left: bbox.minX - control.x,
    top: bbox.minY - control.y,
    right: bbox.maxX - control.right,
    bottom: bbox.maxY - control.bottom,
  },
  cornerMeasuredX: corner.x,
  cornerControlX: controlCornerX,
  cornerDeltaX: corner.x === null ? null : corner.x - controlCornerX,
}
await writeFile(
  path.join(outputRoot, 'measurements--candidate-v01.json'),
  `${JSON.stringify(report, null, 2)}\n`,
)
console.log(JSON.stringify(report, null, 2))
