/**
 * PROTOTYPE — 用后即弃。
 *
 * 三套遵守两点透视的矩形小房间控制图：
 * A 窗户与明信片共享后墙；B 宽右墙承担画廊；C 左墙窗景、后墙集中陈列。
 * 图中同时保留窗台、抓柱、食盆、地毯和纪念品柜，验证猫猫生活动线。
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(
  'docs/art/candidates/home-wall-prototype/2026-08-13-room-variants',
)
const width = 1200
const height = 1600
const horizonY = 947
const round1 = (value) => Math.round(value * 10) / 10
const points = (values) => values.map(([x, y]) => `${x},${y}`).join(' ')

const palette = {
  paper: '#f4efdf',
  ceiling: '#eee6d4',
  backWall: '#f8f2df',
  sideWall: '#e8dfca',
  floor: '#e5c995',
  outline: '#766f62',
  backGuide: '#d86642',
  sideGuide: '#765a91',
  horizon: '#3b6f9d',
  floorGuide: '#3f8a63',
  wood: '#9c7547',
  darkWood: '#674a30',
  rug: '#aab187',
  rugEdge: '#65704f',
  ceramic: '#d6c99f',
}

const defs = `
  <defs>
    <pattern id="paper" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="${palette.paper}"/>
      <circle cx="2" cy="3" r="0.7" fill="#d9cfb8" opacity="0.45"/>
      <circle cx="9" cy="8" r="0.6" fill="#d9cfb8" opacity="0.32"/>
    </pattern>
  </defs>
`

const commonCatLife = ({
  scratchX,
  rugCx,
  bowls,
}) => `
  <ellipse cx="${rugCx}" cy="1450" rx="335" ry="125"
    fill="${palette.rug}" stroke="${palette.rugEdge}" stroke-width="6"/>
  <rect x="${scratchX}" y="900" width="42" height="505" rx="18"
    fill="#b49362" stroke="${palette.darkWood}" stroke-width="5"/>
  <ellipse cx="${scratchX + 21}" cy="905" rx="88" ry="30"
    fill="${palette.rug}" stroke="${palette.rugEdge}" stroke-width="5"/>
  <ellipse cx="${scratchX + 21}" cy="1170" rx="82" ry="28"
    fill="${palette.rug}" stroke="${palette.rugEdge}" stroke-width="5"/>
  <ellipse cx="${bowls[0]}" cy="1310" rx="58" ry="38"
    fill="${palette.ceramic}" stroke="${palette.outline}" stroke-width="4"/>
  <ellipse cx="${bowls[1]}" cy="1290" rx="58" ry="38"
    fill="${palette.ceramic}" stroke="${palette.outline}" stroke-width="4"/>
`

const cardPolygons = (quads) => quads.map((quad, index) => `
  <polygon points="${points(quad)}" fill="#faf6e9"
    stroke="#b78b51" stroke-width="5"/>
  <text x="${(quad[0][0] + quad[1][0]) / 2}"
    y="${(quad[0][1] + quad[2][1]) / 2}"
    text-anchor="middle" font-size="28" fill="#675a48">${index + 1}</text>
`).join('')

const rails = (quads) => quads.map((quad) => `
  <polygon points="${points(quad)}" fill="#8a6f4f"
    stroke="#59452f" stroke-width="3"/>
`).join('')

const roomShell = (body) => `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect width="${width}" height="${height}" fill="url(#paper)"/>
  ${body}
</svg>
`

const buildWideRightGallery = () => {
  const backVpX = 2600
  const sideVpX = -250
  const cornerX = 760
  const backY = (yAtLeft, x) => round1(
    horizonY + (yAtLeft - horizonY) * (backVpX - x) / backVpX,
  )
  const sideY = (yAtCorner, x) => round1(
    horizonY
    + (yAtCorner - horizonY) * (x - sideVpX) / (cornerX - sideVpX),
  )
  const sideFromLeft = (yAtLeft, x) => sideY(backY(yAtLeft, cornerX), x)
  const ceilingLeft = 40
  const floorLeft = 1260
  const ceilingCorner = backY(ceilingLeft, cornerX)
  const floorCorner = backY(floorLeft, cornerX)
  const ceilingRight = sideY(ceilingCorner, width)
  const floorRight = sideY(floorCorner, width)

  const window = [
    [35, backY(120, 35)],
    [520, backY(120, 520)],
    [520, backY(985, 520)],
    [35, backY(985, 35)],
  ]
  const windowInner = [
    [58, backY(150, 58)],
    [497, backY(150, 497)],
    [497, backY(955, 497)],
    [58, backY(955, 58)],
  ]
  const rows = [
    { top: 165, bottom: 270, rail: 285 },
    { top: 335, bottom: 440, rail: 455 },
    { top: 505, bottom: 610, rail: 625 },
  ]
  const columns = [
    { left: 790, right: 910 },
    { left: 940, right: 1100 },
  ]
  const cards = rows.flatMap((row) => columns.map((column) => [
    [column.left, sideFromLeft(row.top, column.left)],
    [column.right, sideFromLeft(row.top, column.right)],
    [column.right, sideFromLeft(row.bottom, column.right)],
    [column.left, sideFromLeft(row.bottom, column.left)],
  ]))
  const shelfQuads = rows.map((row) => [
    [780, sideFromLeft(row.rail, 780)],
    [1135, sideFromLeft(row.rail, 1135)],
    [1135, sideFromLeft(row.rail + 12, 1135)],
    [780, sideFromLeft(row.rail + 12, 780)],
  ])

  const cabinetY = (yAtLeft, x) => sideFromLeft(yAtLeft, x)
  const cabinet = [
    [800, cabinetY(760, 800)],
    [1170, cabinetY(760, 1170)],
    [1170, cabinetY(1375, 1170)],
    [800, cabinetY(1375, 800)],
  ]

  return roomShell(`
    <polygon points="${points([[0, 0], [width, 0], [width, ceilingRight],
      [cornerX, ceilingCorner], [0, ceilingLeft]])}"
      fill="${palette.ceiling}" stroke="${palette.outline}" stroke-width="4"/>
    <polygon points="${points([[0, ceilingLeft], [cornerX, ceilingCorner],
      [cornerX, floorCorner], [0, floorLeft]])}"
      fill="${palette.backWall}" stroke="${palette.outline}" stroke-width="4"/>
    <polygon points="${points([[cornerX, ceilingCorner], [width, ceilingRight],
      [width, floorRight], [cornerX, floorCorner]])}"
      fill="${palette.sideWall}" stroke="${palette.outline}" stroke-width="4"/>
    <polygon points="${points([[0, floorLeft], [cornerX, floorCorner],
      [width, floorRight], [width, height], [0, height]])}"
      fill="${palette.floor}" stroke="${palette.outline}" stroke-width="4"/>

    ${[120, 360, 600, horizonY, 1100, floorLeft].map((y) => `
      <line x1="0" y1="${y}" x2="${cornerX}" y2="${backY(y, cornerX)}"
        stroke="${y === horizonY ? palette.horizon
          : y < horizonY ? palette.backGuide : palette.floorGuide}"
        stroke-width="3" stroke-dasharray="12 9"/>
    `).join('')}
    ${[165, 335, 505, horizonY, 1100, floorLeft].map((y) => {
      const atCorner = backY(y, cornerX)
      return `
        <line x1="${cornerX}" y1="${atCorner}"
          x2="${width}" y2="${sideY(atCorner, width)}"
          stroke="${palette.sideGuide}" stroke-width="3" stroke-dasharray="10 8"/>
      `
    }).join('')}
    <line x1="${cornerX}" y1="${ceilingCorner}" x2="${cornerX}" y2="${floorCorner}"
      stroke="#4f493f" stroke-width="8"/>

    <polygon points="${points(window)}" fill="${palette.wood}"
      stroke="${palette.darkWood}" stroke-width="5"/>
    <polygon points="${points(windowInner)}" fill="#d9e5df"
      stroke="#f1d7a8" stroke-width="4"/>
    ${rails(shelfQuads)}
    ${cardPolygons(cards)}

    <polygon points="${points(cabinet)}" fill="#cda66e"
      stroke="${palette.darkWood}" stroke-width="7" opacity="0.72"/>
    ${[900, 1060, 1190].map((y) => `
      <line x1="800" y1="${cabinetY(y, 800)}"
        x2="1170" y2="${cabinetY(y, 1170)}"
        stroke="${palette.darkWood}" stroke-width="6"/>
    `).join('')}
    ${commonCatLife({ scratchX: 105, rugCx: 445, bowls: [245, 380] })}
  `)
}

const buildCentralMemoryWall = () => {
  const backVpX = -1400
  const leftWallVpX = 2400
  const cornerX = 300
  const ceilingCorner = 350
  const floorCorner = 1160
  const backY = (yAtCorner, x) => round1(
    horizonY
    + (yAtCorner - horizonY) * (x - backVpX) / (cornerX - backVpX),
  )
  const leftY = (yAtCorner, x) => round1(
    horizonY
    + (yAtCorner - horizonY) * (leftWallVpX - x)
      / (leftWallVpX - cornerX),
  )
  const ceilingLeft = leftY(ceilingCorner, 0)
  const floorLeft = leftY(floorCorner, 0)
  const ceilingRight = backY(ceilingCorner, width)
  const floorRight = backY(floorCorner, width)

  const window = [
    [28, leftY(410, 28)],
    [265, leftY(410, 265)],
    [265, leftY(1010, 265)],
    [28, leftY(1010, 28)],
  ]
  const windowInner = [
    [50, leftY(438, 50)],
    [243, leftY(438, 243)],
    [243, leftY(982, 243)],
    [50, leftY(982, 50)],
  ]
  const rows = [
    { top: 260, bottom: 365, rail: 380 },
    { top: 420, bottom: 525, rail: 540 },
    { top: 580, bottom: 685, rail: 700 },
  ]
  const columns = [
    { left: 520, right: 680 },
    { left: 710, right: 890 },
  ]
  const cards = rows.flatMap((row) => columns.map((column) => [
    [column.left, backY(row.top, column.left)],
    [column.right, backY(row.top, column.right)],
    [column.right, backY(row.bottom, column.right)],
    [column.left, backY(row.bottom, column.left)],
  ]))
  const shelfQuads = rows.map((row) => [
    [500, backY(row.rail, 500)],
    [920, backY(row.rail, 920)],
    [920, backY(row.rail + 12, 920)],
    [500, backY(row.rail + 12, 500)],
  ])
  const cabinet = [
    [500, backY(800, 500)],
    [1040, backY(800, 1040)],
    [1040, backY(1390, 1040)],
    [500, backY(1390, 500)],
  ]

  return roomShell(`
    <polygon points="${points([[0, 0], [width, 0], [width, ceilingRight],
      [cornerX, ceilingCorner], [0, ceilingLeft]])}"
      fill="${palette.ceiling}" stroke="${palette.outline}" stroke-width="4"/>
    <polygon points="${points([[0, ceilingLeft], [cornerX, ceilingCorner],
      [cornerX, floorCorner], [0, floorLeft]])}"
      fill="${palette.sideWall}" stroke="${palette.outline}" stroke-width="4"/>
    <polygon points="${points([[cornerX, ceilingCorner], [width, ceilingRight],
      [width, floorRight], [cornerX, floorCorner]])}"
      fill="${palette.backWall}" stroke="${palette.outline}" stroke-width="4"/>
    <polygon points="${points([[0, floorLeft], [cornerX, floorCorner],
      [width, floorRight], [width, height], [0, height]])}"
      fill="${palette.floor}" stroke="${palette.outline}" stroke-width="4"/>

    ${[410, 650, horizonY, 1050, floorCorner].map((y) => `
      <line x1="0" y1="${leftY(y, 0)}" x2="${cornerX}" y2="${y}"
        stroke="${palette.sideGuide}" stroke-width="3" stroke-dasharray="10 8"/>
    `).join('')}
    ${[260, 420, 580, horizonY, 1050, floorCorner].map((y) => `
      <line x1="${cornerX}" y1="${y}" x2="${width}" y2="${backY(y, width)}"
        stroke="${y === horizonY ? palette.horizon
          : y < horizonY ? palette.backGuide : palette.floorGuide}"
        stroke-width="3" stroke-dasharray="12 9"/>
    `).join('')}
    <line x1="${cornerX}" y1="${ceilingCorner}" x2="${cornerX}" y2="${floorCorner}"
      stroke="#4f493f" stroke-width="8"/>

    <polygon points="${points(window)}" fill="${palette.wood}"
      stroke="${palette.darkWood}" stroke-width="5"/>
    <polygon points="${points(windowInner)}" fill="#d9e5df"
      stroke="#f1d7a8" stroke-width="4"/>
    ${rails(shelfQuads)}
    ${cardPolygons(cards)}
    <polygon points="${points(cabinet)}" fill="#cda66e"
      stroke="${palette.darkWood}" stroke-width="7" opacity="0.64"/>
    ${[930, 1090, 1240].map((y) => `
      <line x1="500" y1="${backY(y, 500)}" x2="1040" y2="${backY(y, 1040)}"
        stroke="${palette.darkWood}" stroke-width="6"/>
    `).join('')}
    ${commonCatLife({ scratchX: 105, rugCx: 700, bowls: [350, 470] })}
  `)
}

await mkdir(root, { recursive: true })

const variantAPath = path.resolve(
  'docs/art/candidates/home-wall-prototype/2026-08-13-right-recede',
  'perspective-control--standard-rectangular-room--v06-wide-right-wall.png',
)
const variantBPath = path.join(root, 'room-prototype--b-wide-right-gallery--v01.png')
const variantCPath = path.join(root, 'room-prototype--c-central-memory-wall--v01.png')

await sharp(Buffer.from(buildWideRightGallery())).png().toFile(variantBPath)
await sharp(Buffer.from(buildCentralMemoryWall())).png().toFile(variantCPath)

const cardWidth = 360
const cardHeight = 480
const top = 86
const lefts = [30, 420, 810]
const labels = [
  ['A', 'Shared back wall'],
  ['B', 'Wide right-wall gallery'],
  ['C', 'Central memory wall'],
]
const sources = [variantAPath, variantBPath, variantCPath]
const resized = await Promise.all(sources.map((source) =>
  sharp(source).resize(cardWidth, cardHeight, { fit: 'fill' }).png().toBuffer(),
))
const contactSvg = Buffer.from(`
  <svg width="1200" height="620" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="620" fill="#f4efdf"/>
    <text x="30" y="38" font-family="sans-serif" font-size="25"
      font-weight="700" fill="#4f493f">BraveCat room perspective prototypes</text>
    ${labels.map(([key, label], index) => `
      <text x="${lefts[index]}" y="72" font-family="sans-serif" font-size="21"
        font-weight="700" fill="#4f493f">${key} — ${label}</text>
      <rect x="${lefts[index] - 2}" y="${top - 2}" width="${cardWidth + 4}"
        height="${cardHeight + 4}" rx="8" fill="none" stroke="#9c8c70" stroke-width="3"/>
    `).join('')}
    <text x="30" y="596" font-family="sans-serif" font-size="18" fill="#6f6658">
      All variants retain postcard display, window life, scratching, feeding,
      rug sleep/play, and souvenir storage.
    </text>
  </svg>
`)
const contactPath = path.join(root, 'room-prototypes--perspective-overview--v01.png')
await sharp({
  create: {
    width: 1200,
    height: 620,
    channels: 4,
    background: '#f4efdf',
  },
}).composite([
  { input: contactSvg, left: 0, top: 0 },
  ...resized.map((input, index) => ({ input, left: lefts[index], top })),
]).png().toFile(contactPath)

console.log(variantBPath)
console.log(variantCPath)
console.log(contactPath)
