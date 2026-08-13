/**
 * F 正窗重制（对照签收效果图的自查修复轮）：
 *
 * 概念稿的 F 是「后墙左半直立矩形窗 + 右半陈列墙」，而 v01 shell
 * 沿用了 control 阶段的左墙透视窗，被判不符。本脚本处理正窗版
 * 生成件并重冻结窗相关几何：
 *   1. 归一化 → shell--aperture-alpha--candidate-v02.png（近黑窗洞键控）；
 *   2. 实测窗洞 bbox 与右墙角 → measurements--candidate-v02.json；
 *   3. 由 v02 几何派生 geometry--measured-freeze-v03.json：仅替换
 *      windowAperture（矩形）、walls、window-frame socket、treatAnchor
 *      （随新窗台），平台/卡位/柜/锚点全部继承 v02；
 *   4. 输出 qa--control-overlay--candidate-v02.png 复核平台与卡位
 *      是否仍然落在新 shell 的对应结构上。
 *
 * Usage:
 *   node scripts/refit-f-upright-window.mjs
 */
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const width = 1200
const height = 1600
const stagingRoot = '/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets'
const sourceFile = path.join(stagingRoot, 'f-clean-shell-upright-window-v07.png')
const outputRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production/f-moonwhite-bluegray',
)

await copyFile(sourceFile, path.join(outputRoot, 'source--clean-shell--imagegen-v02.png'))

const normalized = await sharp(sourceFile)
  .resize(width, height, { fit: 'fill' })
  .toColourspace('srgb')
  .removeAlpha()
  .raw()
  .toBuffer()

const shell = Buffer.alloc(width * height * 4)
const mask = Buffer.alloc(width * height)
let bbox = { minX: Infinity, minY: Infinity, maxX: -1, maxY: -1 }
let aperturePixels = 0
for (let index = 0; index < width * height; index += 1) {
  const s = index * 3
  const t = index * 4
  const [r, g, b] = [normalized[s], normalized[s + 1], normalized[s + 2]]
  if (r < 26 && g < 26 && b < 26) {
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

const shellPng = await sharp(shell, { raw: { width, height, channels: 4 } }).png().toBuffer()
await sharp(shellPng).toFile(path.join(outputRoot, 'shell--aperture-alpha--candidate-v02.png'))
await sharp(mask, { raw: { width, height, channels: 1 } })
  .png()
  .toFile(path.join(outputRoot, 'aperture-mask--candidate-v02.png'))

// 右墙角实测：窗右侧墙带内最强垂直边。
const lum = (x, y) => {
  const offset = (y * width + x) * 3
  return 0.299 * normalized[offset]
    + 0.587 * normalized[offset + 1]
    + 0.114 * normalized[offset + 2]
}
let corner = { x: null, score: -1 }
for (let x = bbox.maxX + 60; x <= 1180; x += 1) {
  let score = 0
  for (let y = 320; y < 780; y += 1) {
    score += Math.abs(lum(Math.min(x + 2, width - 1), y) - lum(x - 2, y))
  }
  if (score > corner.score) corner = { x, score }
}

const aperture = {
  x: bbox.minX,
  y: bbox.minY,
  width: bbox.maxX - bbox.minX,
  height: bbox.maxY - bbox.minY,
}
const report = {
  form: 'f-moonwhite-bluegray',
  reason: 'upright-window refit to match approved concept composite',
  aperturePixels,
  aperture,
  cornerMeasuredX: corner.x,
}
await writeFile(
  path.join(outputRoot, 'measurements--candidate-v02.json'),
  `${JSON.stringify(report, null, 2)}\n`,
)

// v03 几何：窗/墙/treat/window socket 重冻结，其余继承 v02。
const v02 = JSON.parse(await readFile(
  path.join(outputRoot, 'geometry--measured-freeze-v02.json'), 'utf8',
))
const v03 = {
  ...v02,
  camera: { type: 'one-point-frontal', horizonY: v02.camera.horizonY },
  walls: {
    backWall: { left: 0, right: corner.x, top: v02.walls.backWall.top, floorY: v02.walls.backWall.floorY },
    rightWall: { cornerX: corner.x, nearX: 1200 },
  },
  windowAperture: aperture,
  sockets: v02.sockets.map((socket) => (socket.id === 'window-frame'
    ? {
      ...socket,
      region: {
        x: Math.max(0, aperture.x - 45),
        y: Math.max(0, aperture.y - 45),
        width: aperture.width + 90,
        height: aperture.height + 135,
      },
    }
    : socket)),
  treatAnchor: {
    id: 'treat',
    x: aperture.x + Math.round(aperture.width * 0.55),
    y: bbox.maxY - 72,
    width: 105,
    height: 84,
  },
  freezeLevel: 'measured-freeze-v03',
  sourceShell: 'shell--aperture-alpha--candidate-v02.png',
}
await writeFile(
  path.join(outputRoot, 'geometry--measured-freeze-v03.json'),
  `${JSON.stringify(v03, null, 2)}\n`,
)

// QA 叠图：新窗洞矩形 + 继承的平台线/卡位，检查结构对齐。
const p = (points) => points.map(([x, y]) => `${x},${y}`).join(' ')
const overlay = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${aperture.x}" y="${aperture.y}" width="${aperture.width}"
    height="${aperture.height}" fill="none" stroke="#d84632" stroke-width="5"/>
  ${v02.postcardSlots.map(({ quad }) => `
    <polygon points="${p(quad)}" fill="none" stroke="#d84632" stroke-width="3"/>
  `).join('')}
  <polygon points="${p(v02.platform.top)}" fill="none" stroke="#347a48" stroke-width="4"/>
  <rect x="${v03.treatAnchor.x}" y="${v03.treatAnchor.y}" width="${v03.treatAnchor.width}"
    height="${v03.treatAnchor.height}" fill="none" stroke="#2b5c8a" stroke-width="3"/>
  <line x1="${corner.x}" y1="120" x2="${corner.x}" y2="1400"
    stroke="#5a7a52" stroke-width="3" stroke-dasharray="14 10"/>
</svg>
`)
await sharp(shellPng)
  .flatten({ background: '#9fc2d8' })
  .composite([{ input: overlay }])
  .png()
  .toFile(path.join(outputRoot, 'qa--control-overlay--candidate-v02.png'))
console.log(JSON.stringify(report, null, 2))
