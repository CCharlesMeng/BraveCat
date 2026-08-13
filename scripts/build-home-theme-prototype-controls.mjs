/**
 * PROTOTYPE — 用后即弃。
 *
 * A/B 延续已确认的矩形房间；D/E/F 探索显著不同的 Home Theme：
 * 阁楼、日光房、错层窗台小屋。所有图只冻结空间与活动分区，不生成水彩。
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13',
)
const width = 1200
const height = 1600
const p = (values) => values.map(([x, y]) => `${x},${y}`).join(' ')
const colors = {
  paper: '#f4efdf',
  wall: '#f8f2df',
  wallShade: '#e7deca',
  roof: '#e6d4b5',
  floor: '#e3c58f',
  outline: '#6f6658',
  wood: '#9c7547',
  darkWood: '#60472f',
  glass: '#d6e7e2',
  rug: '#aab187',
  rugEdge: '#65704f',
  guideA: '#d86642',
  guideB: '#765a91',
  horizon: '#3b6f9d',
  ceramic: '#d6c99f',
}
const defs = `
  <defs>
    <pattern id="paper" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="${colors.paper}"/>
      <circle cx="2" cy="3" r="0.7" fill="#d9cfb8" opacity="0.45"/>
      <circle cx="9" cy="8" r="0.6" fill="#d9cfb8" opacity="0.32"/>
    </pattern>
  </defs>
`
const svg = (body) => `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect width="${width}" height="${height}" fill="url(#paper)"/>
  ${body}
</svg>
`
const card = (quad, index) => `
  <polygon points="${p(quad)}" fill="#faf6e9" stroke="#b78b51" stroke-width="5"/>
  <text x="${(quad[0][0] + quad[1][0]) / 2}"
    y="${(quad[0][1] + quad[2][1]) / 2}"
    text-anchor="middle" font-size="28" fill="#675a48">${index + 1}</text>
`
const rug = (cx, cy, rx = 335, ry = 120) => `
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
    fill="${colors.rug}" stroke="${colors.rugEdge}" stroke-width="6"/>
`
const scratcher = (x, top = 900, bottom = 1400) => `
  <rect x="${x}" y="${top}" width="42" height="${bottom - top}" rx="18"
    fill="#b49362" stroke="${colors.darkWood}" stroke-width="5"/>
  <ellipse cx="${x + 21}" cy="${top + 4}" rx="88" ry="30"
    fill="${colors.rug}" stroke="${colors.rugEdge}" stroke-width="5"/>
  <ellipse cx="${x + 21}" cy="${top + 270}" rx="82" ry="28"
    fill="${colors.rug}" stroke="${colors.rugEdge}" stroke-width="5"/>
`
const bowls = (firstX, secondX, y = 1310) => `
  <ellipse cx="${firstX}" cy="${y}" rx="58" ry="38"
    fill="${colors.ceramic}" stroke="${colors.outline}" stroke-width="4"/>
  <ellipse cx="${secondX}" cy="${y - 20}" rx="58" ry="38"
    fill="${colors.ceramic}" stroke="${colors.outline}" stroke-width="4"/>
`

const buildAttic = () => {
  const back = {
    left: 150,
    right: 1000,
    eaveY: 360,
    ridge: [600, 90],
    floorY: 1135,
  }
  const window = [[210, 430], [505, 430], [505, 930], [210, 930]]
  const rows = [430, 610, 790]
  const cols = [[575, 735], [760, 920]]
  const cards = rows.flatMap((top) => cols.map(([left, right]) => [
    [left, top],
    [right, top],
    [right, top + 110],
    [left, top + 110],
  ]))
  return svg(`
    <polygon points="${p([[0, 0], [600, 90], [150, 360], [0, 520]])}"
      fill="${colors.roof}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[600, 90], [1200, 0], [1200, 520], [1000, 360]])}"
      fill="#ddc69f" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[150, 360], [600, 90], [1000, 360],
      [1000, 1135], [150, 1135]])}"
      fill="${colors.wall}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[0, 520], [150, 360], [150, 1135], [0, 1300]])}"
      fill="${colors.wallShade}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[1000, 360], [1200, 520], [1200, 1300], [1000, 1135]])}"
      fill="${colors.wallShade}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[0, 1300], [150, 1135], [1000, 1135],
      [1200, 1300], [1200, 1600], [0, 1600]])}"
      fill="${colors.floor}" stroke="${colors.outline}" stroke-width="5"/>

    <line x1="600" y1="90" x2="600" y2="1135"
      stroke="${colors.guideA}" stroke-width="3" stroke-dasharray="12 9"/>
    ${[430, 610, 790, 970].map((y) => `
      <line x1="150" y1="${y}" x2="1000" y2="${y}"
        stroke="${colors.guideA}" stroke-width="3" stroke-dasharray="12 9"/>
    `).join('')}
    <line x1="150" y1="360" x2="0" y2="0"
      stroke="${colors.guideB}" stroke-width="3" stroke-dasharray="10 8"/>
    <line x1="1000" y1="360" x2="1200" y2="0"
      stroke="${colors.guideB}" stroke-width="3" stroke-dasharray="10 8"/>

    <polygon points="${p(window)}" fill="${colors.wood}"
      stroke="${colors.darkWood}" stroke-width="6"/>
    <polygon points="${p([[232, 452], [483, 452], [483, 908], [232, 908]])}"
      fill="${colors.glass}" stroke="#f1d7a8" stroke-width="4"/>
    ${cards.map(card).join('')}
    ${rows.map((top) => `
      <rect x="555" y="${top + 122}" width="390" height="12"
        fill="#8a6f4f" stroke="${colors.darkWood}" stroke-width="2"/>
    `).join('')}
    <rect x="555" y="950" width="395" height="170"
      fill="#cda66e" stroke="${colors.darkWood}" stroke-width="7"/>
    <line x1="555" y1="1010" x2="950" y2="1010"
      stroke="${colors.darkWood}" stroke-width="6"/>
    <line x1="752" y1="950" x2="752" y2="1120"
      stroke="${colors.darkWood}" stroke-width="6"/>
    ${scratcher(170, 850, 1390)}
    ${bowls(330, 455, 1305)}
    ${rug(585, 1460, 320, 115)}
  `)
}

const buildSunroom = () => {
  const vp = [600, 790]
  const backLeft = 250
  const backRight = 950
  const backTop = 260
  const backBottom = 1050
  const frontRight = 1200
  const frontScale = (frontRight - vp[0]) / (backRight - vp[0])
  const frontTop = vp[1] + (backTop - vp[1]) * frontScale
  const frontBottom = vp[1] + (backBottom - vp[1]) * frontScale
  const back = [
    [backLeft, backTop],
    [backRight, backTop],
    [backRight, backBottom],
    [backLeft, backBottom],
  ]
  const leftWall = [[0, frontTop], [backLeft, backTop],
    [backLeft, backBottom], [0, frontBottom]]
  const rightWall = [[backRight, backTop], [frontRight, frontTop],
    [frontRight, frontBottom], [backRight, backBottom]]
  const wallPoint = (depth, vertical) => {
    const x = backRight + (frontRight - backRight) * depth
    const top = backTop + (frontTop - backTop) * depth
    const bottom = backBottom + (frontBottom - backBottom) * depth
    return [x, top + (bottom - top) * vertical]
  }
  const rows = [
    { top: 0.15, bottom: 0.26, rail: 0.28 },
    { top: 0.35, bottom: 0.46, rail: 0.48 },
    { top: 0.55, bottom: 0.66, rail: 0.68 },
  ]
  const columns = [
    { left: 0.06, right: 0.34 },
    { left: 0.46, right: 0.9 },
  ]
  const cards = rows.flatMap((row) => columns.map((column) => [
    wallPoint(column.left, row.top),
    wallPoint(column.right, row.top),
    wallPoint(column.right, row.bottom),
    wallPoint(column.left, row.bottom),
  ]))
  const shelfQuads = rows.map((row) => [
    wallPoint(0.03, row.rail),
    wallPoint(0.94, row.rail),
    wallPoint(0.94, row.rail + 0.012),
    wallPoint(0.03, row.rail + 0.012),
  ])
  const yAtX = ([x1, y1], [x2, y2], x) =>
    y1 + (y2 - y1) * (x - x1) / (x2 - x1)
  for (const quad of [...cards, ...shelfQuads]) {
    for (const [from, to] of [[quad[0], quad[1]], [quad[3], quad[2]]]) {
      const error = Math.abs(yAtX(from, to, vp[0]) - vp[1])
      if (error > 0.2) {
        throw new Error(`Sunroom display edge misses vanishing point by ${error}px`)
      }
    }
  }
  return svg(`
    <polygon points="${p([[0, 0], [1200, 0],
      [backRight, backTop], [backLeft, backTop]])}"
      fill="#dce8df" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p(back)}" fill="${colors.glass}"
      stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p(leftWall)}"
      fill="#d4e4de" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p(rightWall)}" fill="${colors.wallShade}"
      stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[0, frontBottom], [backLeft, backBottom],
      [backRight, backBottom], [1200, frontBottom], [1200, 1600], [0, 1600]])}"
      fill="${colors.floor}" stroke="${colors.outline}" stroke-width="5"/>

    ${[0, 240, 480, 720, 960, 1200].map((x) => `
      <line x1="${x}" y1="0" x2="${vp[0]}" y2="${vp[1]}"
        stroke="${colors.guideA}" stroke-width="2" stroke-dasharray="10 9"/>
    `).join('')}
    ${[420, 650, 880].map((y) => `
      <line x1="${backLeft}" y1="${y}" x2="${backRight}" y2="${y}"
        stroke="${colors.horizon}" stroke-width="2" stroke-dasharray="12 9"/>
    `).join('')}
    ${[360, 480, 600, 720, 840].map((x) => `
      <line x1="${x}" y1="${backTop}" x2="${x}" y2="${backBottom}"
        stroke="#7d9c98" stroke-width="5"/>
    `).join('')}
    <line x1="${backLeft}" y1="620" x2="${backRight}" y2="620"
      stroke="#7d9c98" stroke-width="6"/>

    ${cards.map(card).join('')}
    ${shelfQuads.map((quad) => `
      <polygon points="${p(quad)}" fill="#8a6f4f"
        stroke="${colors.darkWood}" stroke-width="2"/>
    `).join('')}
    <polygon points="${p([[300, 900], [900, 900], [900, 1065], [300, 1065]])}"
      fill="#cda66e" stroke="${colors.darkWood}" stroke-width="7"/>
    ${scratcher(170, 850, 1380)}
    ${bowls(350, 485, 1315)}
    ${rug(600, 1455, 315, 110)}
  `)
}

const buildSplitLevel = () => {
  const vpX = 2750
  const horizon = 900
  const cornerX = 980
  const wallY = (yAtLeft, x) =>
    Math.round((horizon + (yAtLeft - horizon) * (vpX - x) / vpX) * 10) / 10
  const window = [
    [60, wallY(180, 60)],
    [500, wallY(180, 500)],
    [500, wallY(840, 500)],
    [60, wallY(840, 60)],
  ]
  const cards = [
    [[560, wallY(220, 560)], [690, wallY(220, 690)],
      [690, wallY(325, 690)], [560, wallY(325, 560)]],
    [[720, wallY(220, 720)], [840, wallY(220, 840)],
      [840, wallY(325, 840)], [720, wallY(325, 720)]],
    [[560, wallY(380, 560)], [690, wallY(380, 690)],
      [690, wallY(485, 690)], [560, wallY(485, 560)]],
    [[720, wallY(380, 720)], [840, wallY(380, 840)],
      [840, wallY(485, 840)], [720, wallY(485, 720)]],
    [[560, wallY(540, 560)], [690, wallY(540, 690)],
      [690, wallY(645, 690)], [560, wallY(645, 560)]],
    [[720, wallY(540, 720)], [840, wallY(540, 840)],
      [840, wallY(645, 840)], [720, wallY(645, 720)]],
  ]
  return svg(`
    <polygon points="${p([[0, 0], [cornerX, 250], [cornerX, 1120], [0, 1260]])}"
      fill="${colors.wall}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[cornerX, 250], [1200, 100], [1200, 1280], [cornerX, 1120]])}"
      fill="${colors.wallShade}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[0, 1260], [cornerX, 1120], [1200, 1280],
      [1200, 1600], [0, 1600]])}"
      fill="${colors.floor}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[0, 1010], [930, wallY(1010, 930)],
      [980, 1120], [0, 1260]])}"
      fill="#cfaa72" stroke="${colors.darkWood}" stroke-width="7"/>
    <polygon points="${p([[0, 1090], [930, wallY(1090, 930)],
      [930, wallY(1150, 930)], [0, 1180]])}"
      fill="#aa7e4f" stroke="${colors.darkWood}" stroke-width="5"/>

    ${[180, 380, 540, 760, horizon, 1010, 1090].map((y) => `
      <line x1="0" y1="${y}" x2="${cornerX}" y2="${wallY(y, cornerX)}"
        stroke="${y < horizon ? colors.guideA : colors.horizon}"
        stroke-width="3" stroke-dasharray="12 9"/>
    `).join('')}
    <line x1="${cornerX}" y1="250" x2="${cornerX}" y2="1120"
      stroke="${colors.outline}" stroke-width="8"/>

    <polygon points="${p(window)}" fill="${colors.wood}"
      stroke="${colors.darkWood}" stroke-width="6"/>
    <polygon points="${p([[82, wallY(210, 82)], [478, wallY(210, 478)],
      [478, wallY(810, 478)], [82, wallY(810, 82)]])}"
      fill="${colors.glass}" stroke="#f1d7a8" stroke-width="4"/>
    ${cards.map(card).join('')}
    ${[340, 500, 660].map((y) => `
      <polygon points="${p([[545, wallY(y, 545)], [865, wallY(y, 865)],
        [865, wallY(y + 12, 865)], [545, wallY(y + 12, 545)]])}"
        fill="#8a6f4f" stroke="${colors.darkWood}" stroke-width="2"/>
    `).join('')}
    <polygon points="${p([[570, wallY(720, 570)], [900, wallY(720, 900)],
      [900, wallY(1000, 900)], [570, wallY(1000, 570)]])}"
      fill="#cda66e" stroke="${colors.darkWood}" stroke-width="7"/>
    ${scratcher(135, 780, 1260)}
    ${bowls(330, 460, 1160)}
    ${rug(650, 1455, 330, 110)}
  `)
}

await mkdir(root, { recursive: true })
const variants = [
  {
    key: 'A',
    label: 'Shared back wall',
    source: path.resolve(
      'docs/art/candidates/home-wall-prototype/2026-08-13-right-recede',
      'perspective-control--standard-rectangular-room--v06-wide-right-wall.png',
    ),
  },
  {
    key: 'B',
    label: 'Wide wall gallery',
    source: path.resolve(
      'docs/art/candidates/home-wall-prototype/2026-08-13-room-variants',
      'room-prototype--b-wide-right-gallery--v01.png',
    ),
  },
  {
    key: 'D',
    label: 'Gable attic room',
    source: path.join(root, 'home-theme--d-attic-loft--control-v02.png'),
    content: buildAttic(),
  },
  {
    key: 'E',
    label: 'Garden sunroom',
    source: path.join(root, 'home-theme--e-garden-sunroom--control-v02.png'),
    content: buildSunroom(),
  },
  {
    key: 'F',
    label: 'Split-level window den',
    source: path.join(root, 'home-theme--f-split-level-den--control-v01.png'),
    content: buildSplitLevel(),
  },
]

for (const variant of variants) {
  if (variant.content) {
    await sharp(Buffer.from(variant.content)).png().toFile(variant.source)
  }
}

const cardWidth = 260
const cardHeight = 347
const gap = 24
const left = 28
const top = 92
const overviewWidth = left * 2 + cardWidth * variants.length + gap * (variants.length - 1)
const overviewHeight = 500
const previews = await Promise.all(variants.map(({ source }) =>
  sharp(source).resize(cardWidth, cardHeight, { fit: 'fill' }).png().toBuffer(),
))
const overviewSvg = Buffer.from(`
  <svg width="${overviewWidth}" height="${overviewHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${overviewWidth}" height="${overviewHeight}" fill="${colors.paper}"/>
    <text x="${left}" y="38" font-family="sans-serif" font-size="26"
      font-weight="700" fill="#4f493f">BraveCat Home Theme structure candidates</text>
    <text x="${left}" y="66" font-family="sans-serif" font-size="17"
      fill="#6f6658">A/B retained · D/E/F introduce distinct room experiences</text>
    ${variants.map(({ key, label }, index) => {
      const x = left + index * (cardWidth + gap)
      return `
        <text x="${x}" y="85" font-family="sans-serif" font-size="18"
          font-weight="700" fill="#4f493f">${key} — ${label}</text>
        <rect x="${x - 2}" y="${top - 2}" width="${cardWidth + 4}"
          height="${cardHeight + 4}" rx="8" fill="none"
          stroke="#9c8c70" stroke-width="3"/>
      `
    }).join('')}
    <text x="${left}" y="474" font-family="sans-serif" font-size="17"
      fill="#6f6658">Each theme reserves postcard display, souvenir storage,
      window/perch, scratch, feed, sleep and play zones.</text>
  </svg>
`)
const overviewPath = path.join(root, 'home-theme-structures--overview-v02.png')
await sharp({
  create: {
    width: overviewWidth,
    height: overviewHeight,
    channels: 4,
    background: colors.paper,
  },
}).composite([
  { input: overviewSvg, left: 0, top: 0 },
  ...previews.map((input, index) => ({
    input,
    left: left + index * (cardWidth + gap),
    top,
  })),
]).png().toFile(overviewPath)

console.log(variants.filter(({ content }) => content).map(({ source }) => source).join('\n'))
console.log(overviewPath)
