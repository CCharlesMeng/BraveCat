/**
 * A/B/F 实测冻结（生产顺序第 3 步收尾）：
 *
 * 以 clean shell 候选的实测（窗洞 mask、墙角、平台沿）为准，重排
 * 卡位、轨道、柜体、纪念品/Treat 锚点，输出 geometry v02
 * （measured-freeze）manifest 与按 v02 绘制的 QA 叠图。
 * 部件生产与运行时集成一律消费 v02，不再引用 v01 控制值。
 *
 * Usage:
 *   node scripts/freeze-form-geometry.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const width = 1200
const height = 1600
const round1 = (value) => Math.round(value * 10) / 10
const controlsRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/form-controls',
)
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)

const loadMask = async (slug) => {
  const { data } = await sharp(
    path.join(productionRoot, slug, 'aperture-mask--candidate-v01.png'),
  ).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return (x, y) => data[(y * width + x) * 4] > 128
}
const loadShellRaw = async (slug) => {
  const { data } = await sharp(
    path.join(productionRoot, slug, 'shell--aperture-alpha--candidate-v01.png'),
  ).flatten({ background: '#9fc2d8' }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true })
  return (x, y) => {
    const offset = (y * width + x) * 3
    return 0.299 * data[offset] + 0.587 * data[offset + 1]
      + 0.114 * data[offset + 2]
  }
}
const maskColumnSpan = (mask, x) => {
  let top = null
  let bottom = null
  for (let y = 0; y < height; y += 1) {
    if (!mask(x, y)) continue
    if (top === null) top = y
    bottom = y
  }
  return { top, bottom }
}
const loadMeasurements = async (slug) => JSON.parse(await readFile(
  path.join(productionRoot, slug, 'measurements--candidate-v01.json'), 'utf8',
))
const loadControl = async (name) => JSON.parse(await readFile(
  path.join(controlsRoot, name), 'utf8',
))

const writeFreeze = async (slug, manifest) => {
  await writeFile(
    path.join(productionRoot, slug, 'geometry--measured-freeze-v02.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  const p = (points) => points.map(([x, y]) => `${x},${y}`).join(' ')
  const rect = (r, color) => `<rect x="${r.x}" y="${r.y}" width="${r.width}"
    height="${r.height}" fill="none" stroke="${color}" stroke-width="4"/>`
  const overlay = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${manifest.windowAperture.quad
    ? `<polygon points="${p(manifest.windowAperture.quad)}" fill="none"
        stroke="#d84632" stroke-width="5"/>`
    : rect(manifest.windowAperture, '#d84632')}
  ${manifest.postcardSlots.map(({ quad }) => `
    <polygon points="${p(quad)}" fill="none" stroke="#d84632" stroke-width="3"/>
  `).join('')}
  ${(manifest.rails ?? []).map((rail) => rail.quad
    ? `<polygon points="${p(rail.quad)}" fill="none" stroke="#8a6f4f" stroke-width="3"/>`
    : rect({ ...rail, height: 10 }, '#8a6f4f')).join('')}
  ${manifest.cabinetFrontQuad
    ? `<polygon points="${p(manifest.cabinetFrontQuad)}" fill="none"
        stroke="#765a91" stroke-width="4"/>` : ''}
  ${manifest.cabinetFrontRect ? rect(manifest.cabinetFrontRect, '#765a91') : ''}
  ${manifest.platform ? `<polygon points="${p(manifest.platform.top)}"
      fill="none" stroke="#347a48" stroke-width="4"/>` : ''}
  ${manifest.souvenirAnchors.map((anchor) => rect(anchor, '#1f6f86')).join('')}
  ${rect(manifest.treatAnchor, '#2b5c8a')}
  <line x1="${manifest.cornerX}" y1="100" x2="${manifest.cornerX}" y2="1420"
    stroke="#5a7a52" stroke-width="3" stroke-dasharray="14 10"/>
</svg>
  `)
  await sharp(path.join(productionRoot, slug, 'shell--aperture-alpha--candidate-v01.png'))
    .flatten({ background: '#9fc2d8' })
    .composite([{ input: overlay }])
    .png()
    .toFile(path.join(productionRoot, slug, 'qa--measured-freeze-overlay--v02.png'))
  console.log(`${slug}: geometry v02 + QA overlay written`)
}

/* A · 转角 906，右墙射线以 (600,880) 为 VP。 */
{
  const slug = 'a-clear-sage'
  const control = await loadControl('home-form--a-clear-sage--geometry-v01.json')
  const measured = await loadMeasurements(slug)
  const cornerX = measured.cornerMeasuredX
  const rayY = (y0, x) => round1(880 + (y0 - 880) * (x - 600) / (cornerX - 600))
  const bbox = measured.apertureBBox
  const columns = [[618, 738], [768, 888]]
  const rows = control.postcardSlots.length
    ? [[320, 425], [480, 585], [640, 745]]
    : []
  const slots = rows.flatMap(([top, bottom]) => columns.map(([l, r]) => ({
    quad: [[l, top], [r, top], [r, bottom], [l, bottom]],
  })))
  const cabinetFrontQuad = [
    [930, rayY(893, 930)], [1150, rayY(893, 1150)],
    [1150, rayY(1070, 1150)], [930, rayY(1070, 930)],
  ]
  await writeFreeze(slug, {
    ...control,
    freezeLevel: 'measured-freeze-v02',
    sourceShell: 'shell--aperture-alpha--candidate-v01.png',
    cornerX,
    walls: { ...control.walls, rightWall: { cornerX, nearX: 1200 } },
    windowAperture: {
      x: bbox.minX, y: bbox.minY,
      width: bbox.maxX - bbox.minX, height: bbox.maxY - bbox.minY,
    },
    postcardSlots: slots,
    rails: [432, 592, 752].map((y) => ({ x: 603, y, width: 295 })),
    cabinetFrontQuad,
    sockets: control.sockets.map((socket) => (
      socket.id === 'cabinet'
        ? { ...socket, region: { x: 920, y: 840, width: 245, height: 385 } }
        : socket.id === 'plant'
          ? { ...socket, region: { x: 1080, y: 690, width: 105, height: 212 } }
          : socket
    )),
    souvenirAnchors: [
      { id: 'souvenir-1', x: 950, y: 852, width: 54, height: 46 },
      { id: 'souvenir-2', x: 1012, y: 854, width: 56, height: 48 },
      { id: 'souvenir-3', x: 1075, y: 858, width: 52, height: 44 },
    ],
    treatAnchor: { id: 'treat', x: 455, y: 830, width: 105, height: 84 },
  })
}

/* B · 转角 783，右墙射线以 (150,880) 为 VP；画廊整体右移到实测右墙。 */
{
  const slug = 'b-warm-walnut-gallery'
  const control = await loadControl('home-form--b-warm-walnut-gallery--geometry-v01.json')
  const measured = await loadMeasurements(slug)
  const cornerX = measured.cornerMeasuredX
  const rayY = (y0, x) => round1(880 + (y0 - 880) * (x - 150) / (cornerX - 150))
  const bbox = measured.apertureBBox
  const columns = [[800, 915], [950, 1105]]
  const rows = [
    { top: 470, bottom: 565, rail: 572 },
    { top: 610, bottom: 705, rail: 712 },
    { top: 750, bottom: 845, rail: 852 },
  ]
  const slots = rows.flatMap(({ top, bottom }) => columns.map(([l, r]) => ({
    quad: [
      [l, rayY(top, l)], [r, rayY(top, r)],
      [r, rayY(bottom, r)], [l, rayY(bottom, l)],
    ],
  })))
  const rails = rows.map(({ rail }) => ({
    quad: [
      [790, rayY(rail, 790)], [1120, rayY(rail, 1120)],
      [1120, rayY(rail + 12, 1120)], [790, rayY(rail + 12, 790)],
    ],
  }))
  const cabinetFrontQuad = [
    [800, rayY(900, 800)], [1160, rayY(900, 1160)],
    [1160, rayY(1080, 1160)], [800, rayY(1080, 800)],
  ]
  await writeFreeze(slug, {
    ...control,
    freezeLevel: 'measured-freeze-v02',
    sourceShell: 'shell--aperture-alpha--candidate-v01.png',
    cornerX,
    walls: { ...control.walls, rightWall: { cornerX, nearX: 1200 } },
    windowAperture: {
      x: bbox.minX, y: bbox.minY,
      width: bbox.maxX - bbox.minX, height: bbox.maxY - bbox.minY,
    },
    postcardSlots: slots,
    rails,
    cabinetFrontQuad,
    sockets: control.sockets.map((socket) => (
      socket.id === 'postcard-display'
        ? { ...socket, region: { x: 790, y: 250, width: 340, height: 620 } }
        : socket.id === 'cabinet'
          ? { ...socket, region: { x: 790, y: 850, width: 380, height: 360 } }
          : socket.id === 'plant'
            ? { ...socket, region: { x: 1080, y: 730, width: 95, height: 185 } }
            : socket
    )),
    souvenirAnchors: [
      { id: 'souvenir-1', x: 830, y: 858, width: 54, height: 46 },
      { id: 'souvenir-2', x: 900, y: 860, width: 56, height: 48 },
      { id: 'souvenir-3', x: 975, y: 862, width: 58, height: 50 },
    ],
    treatAnchor: { id: 'treat', x: 545, y: 850, width: 105, height: 84 },
  })
}

/* F · 转角 652；窗洞 quad 与平台沿按像素实测。 */
{
  const slug = 'f-moonwhite-bluegray'
  const control = await loadControl('home-form--f-moonwhite-bluegray--geometry-v01.json')
  const measured = await loadMeasurements(slug)
  const cornerX = measured.cornerMeasuredX
  const mask = await loadMask(slug)
  const lum = await loadShellRaw(slug)
  const bbox = measured.apertureBBox
  const leftSpan = maskColumnSpan(mask, bbox.minX + 6)
  const rightSpan = maskColumnSpan(mask, bbox.maxX - 6)
  const windowQuad = [
    [bbox.minX, leftSpan.top], [bbox.maxX, rightSpan.top],
    [bbox.maxX, rightSpan.bottom], [bbox.minX, leftSpan.bottom],
  ]
  // 平台沿实测：在两列上找 y 950–1300 的两条最强水平边。
  const edgePeaks = (x) => {
    const scores = []
    for (let y = 955; y < 1295; y += 1) {
      let score = 0
      for (let dx = -8; dx <= 8; dx += 1) {
        score += Math.abs(lum(x + dx, y + 3) - lum(x + dx, y - 3))
      }
      scores.push({ y, score })
    }
    scores.sort((a, b) => b.score - a.score)
    const peaks = []
    for (const { y } of scores) {
      if (peaks.every((peak) => Math.abs(peak - y) > 40)) peaks.push(y)
      if (peaks.length === 2) break
    }
    return peaks.sort((a, b) => a - b)
  }
  const [frontLeft, stepLeft] = edgePeaks(140)
  const [frontRight, stepRight] = edgePeaks(1060)
  const platform = {
    top: [
      [0, windowQuad[3][1]], [cornerX, 985], [1200, 985],
      [1200, frontRight], [0, frontLeft],
    ],
    frontEdge: { leftY: frontLeft, rightY: frontRight },
    stepBottomEdge: { leftY: stepLeft, rightY: stepRight },
    stepCount: 1,
  }
  const treatX = 352
  const treatSpan = maskColumnSpan(mask, treatX)
  await writeFreeze(slug, {
    ...control,
    freezeLevel: 'measured-freeze-v02',
    sourceShell: 'shell--aperture-alpha--candidate-v01.png',
    cornerX,
    walls: {
      leftWall: { nearX: 0, cornerX },
      backWall: { left: cornerX, right: 1200, top: 200, floorY: 985 },
    },
    windowAperture: { quad: windowQuad },
    platform,
    cabinetFrontRect: { x: 665, y: 765, width: 405, height: 245 },
    sockets: control.sockets.map((socket) => (
      socket.id === 'cabinet'
        ? { ...socket, region: { x: 650, y: 745, width: 435, height: 290 } }
        : socket
    )),
    souvenirAnchors: [
      { id: 'souvenir-1', x: 705, y: 723, width: 54, height: 46 },
      { id: 'souvenir-2', x: 773, y: 721, width: 56, height: 48 },
      { id: 'souvenir-3', x: 843, y: 723, width: 54, height: 46 },
    ],
    treatAnchor: {
      id: 'treat', x: treatX - 52,
      y: (treatSpan.bottom ?? 940) - 82, width: 105, height: 84,
    },
  })
}
