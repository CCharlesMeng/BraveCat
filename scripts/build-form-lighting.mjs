/**
 * A/B/F 程序化光照层（还原修复轮）：
 *
 * 依据 geometry v02 的窗洞位置生成三部分光效并输出为顶层部件
 * piece--lighting--candidate-v01.png（z 带 lighting，最后叠加）：
 *   1. 窗口暖光：以窗洞中心为圆心的暖色径向光晕；
 *   2. 地面光斑：窗光投到地板上的暖色椭圆光池；
 *   3. 四周暗角：柔和的冷色 vignette 收拢视线。
 *
 * Usage:
 *   node scripts/build-form-lighting.mjs
 */
import path from 'node:path'
import sharp from 'sharp'
import { loadGeometry } from './lib/piece-utils.mjs'

const width = 1200
const height = 1600
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)

/** 地面光池中心：窗中心投到地板上的落点（按各 form 地板范围手调）。 */
const FLOOR_POOLS = {
  'a-clear-sage': { cx: 430, cy: 1250, rx: 360, ry: 130 },
  'b-warm-walnut-gallery': { cx: 450, cy: 1270, rx: 380, ry: 135 },
  'f-moonwhite-bluegray': { cx: 400, cy: 1150, rx: 380, ry: 140 },
}

const apertureCenter = (aperture) => {
  if (aperture.quad) {
    const xs = aperture.quad.map(([x]) => x)
    const ys = aperture.quad.map(([, y]) => y)
    return {
      cx: (Math.min(...xs) + Math.max(...xs)) / 2,
      cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      r: (Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)) * 0.75,
    }
  }
  return {
    cx: aperture.x + aperture.width / 2,
    cy: aperture.y + aperture.height / 2,
    r: (aperture.width + aperture.height) * 0.75,
  }
}

for (const slug of ['a-clear-sage', 'b-warm-walnut-gallery', 'f-moonwhite-bluegray']) {
  const geometry = await loadGeometry(productionRoot, slug)
  const glow = apertureCenter(geometry.windowAperture)
  const pool = FLOOR_POOLS[slug]

  const svg = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffdfae" stop-opacity="0.26"/>
      <stop offset="55%" stop-color="#ffe6bd" stop-opacity="0.13"/>
      <stop offset="100%" stop-color="#ffe6bd" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pool" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffd9a0" stop-opacity="0.2"/>
      <stop offset="65%" stop-color="#ffd9a0" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="#ffd9a0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="46%" r="72%">
      <stop offset="0%" stop-color="#2c2a3e" stop-opacity="0"/>
      <stop offset="72%" stop-color="#2c2a3e" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2c2a3e" stop-opacity="0.2"/>
    </radialGradient>
  </defs>
  <circle cx="${glow.cx}" cy="${glow.cy}" r="${Math.round(glow.r)}" fill="url(#glow)"/>
  <ellipse cx="${pool.cx}" cy="${pool.cy}" rx="${pool.rx}" ry="${pool.ry}" fill="url(#pool)"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#vignette)"/>
</svg>
  `)

  await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: svg }])
    .png()
    .toFile(path.join(productionRoot, slug, 'piece--lighting--candidate-v01.png'))
  console.log(`${slug}: lighting layer written (glow @ ${Math.round(glow.cx)},${Math.round(glow.cy)})`)
}
