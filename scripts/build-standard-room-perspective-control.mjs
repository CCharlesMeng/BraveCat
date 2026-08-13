/**
 * PROTOTYPE — 用后即弃。
 *
 * 标准矩形小房间的两墙透视控制图。窗户与明信片在同一面后墙；后墙在
 * 画内右侧形成唯一内角，右侧墙从该内角朝镜头返回。先确认这张图，之后
 * 才允许据此生成水彩底图。
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const outputRoot = path.resolve(
  'docs/art/candidates/home-wall-prototype/2026-08-13-right-recede',
)
const outputPath = path.join(
  outputRoot,
  'perspective-control--standard-rectangular-room--v06-wide-right-wall.png',
)

const width = 1200
const height = 1600
const horizonY = 947
const backWallVanishingPointX = 3000
const sideWallVanishingPointX = -350
const farCornerX = 930

const round1 = (value) => Math.round(value * 10) / 10
const backWallY = (yAtLeft, x) => round1(
  horizonY
  + (yAtLeft - horizonY)
    * (backWallVanishingPointX - x)
    / backWallVanishingPointX,
)
const sideWallY = (yAtCorner, x) => round1(
  horizonY
  + (yAtCorner - horizonY)
    * (x - sideWallVanishingPointX)
    / (farCornerX - sideWallVanishingPointX),
)
const points = (values) => values.map(([x, y]) => `${x},${y}`).join(' ')

const ceilingAtLeft = 40
const floorAtLeft = 1270
const ceilingAtCorner = backWallY(ceilingAtLeft, farCornerX)
const floorAtCorner = backWallY(floorAtLeft, farCornerX)
const ceilingAtRight = sideWallY(ceilingAtCorner, width)
const floorAtRight = sideWallY(floorAtCorner, width)

const window = {
  left: 42,
  right: 570,
  top: 110,
  bottom: 970,
}
const windowQuad = [
  [window.left, backWallY(window.top, window.left)],
  [window.right, backWallY(window.top, window.right)],
  [window.right, backWallY(window.bottom, window.right)],
  [window.left, backWallY(window.bottom, window.left)],
]
const windowInner = [
  [window.left + 22, backWallY(window.top + 28, window.left + 22)],
  [window.right - 22, backWallY(window.top + 28, window.right - 22)],
  [window.right - 22, backWallY(window.bottom - 28, window.right - 22)],
  [window.left + 22, backWallY(window.bottom - 28, window.left + 22)],
]

const rows = [
  { top: 120, bottom: 225, rail: 240 },
  { top: 300, bottom: 405, rail: 420 },
  { top: 480, bottom: 585, rail: 600 },
]
const columns = [
  { left: 610, right: 735 },
  { left: 760, right: 870 },
]
const cardQuads = rows.flatMap((row) => columns.map((column) => [
  [column.left, backWallY(row.top, column.left)],
  [column.right, backWallY(row.top, column.right)],
  [column.right, backWallY(row.bottom, column.right)],
  [column.left, backWallY(row.bottom, column.left)],
]))
const railQuads = rows.map((row) => [
  [590, backWallY(row.rail, 590)],
  [895, backWallY(row.rail, 895)],
  [895, backWallY(row.rail + 12, 895)],
  [590, backWallY(row.rail + 12, 590)],
])

const cabinet = {
  left: 955,
  right: 1195,
  topAtLeft: 875,
  topFrontAtLeft: 930,
  shelfAtLeft: 1080,
  drawerAtLeft: 1190,
  bottomAtLeft: 1410,
}
const cabinetY = (yAtLeft, x) => sideWallY(
  backWallY(yAtLeft, farCornerX),
  x,
)

const backWallGridLevels = [
  ceilingAtLeft,
  120,
  300,
  480,
  700,
  horizonY,
  1100,
  1200,
  floorAtLeft,
]
const backWallSlices = [0, 160, 320, 480, 640, 790, farCornerX]
const sideWallGridLevels = [ceilingAtLeft, 300, 600, horizonY, 1100, floorAtLeft]

const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="paper" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="#f4efdf"/>
      <circle cx="2" cy="3" r="0.7" fill="#d9cfb8" opacity="0.45"/>
      <circle cx="9" cy="8" r="0.6" fill="#d9cfb8" opacity="0.32"/>
    </pattern>
    <marker id="arrow-back" markerWidth="12" markerHeight="12" refX="10" refY="6"
      orient="auto"><path d="M0,0 L12,6 L0,12 Z" fill="#d86642"/></marker>
    <marker id="arrow-side" markerWidth="12" markerHeight="12" refX="10" refY="6"
      orient="auto"><path d="M0,0 L12,6 L0,12 Z" fill="#765a91"/></marker>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#paper)"/>

  <!-- Ceiling, one continuous back wall, one closing right wall, and floor. -->
  <polygon points="${points([
    [0, 0],
    [width, 0],
    [width, ceilingAtRight],
    [farCornerX, ceilingAtCorner],
    [0, ceilingAtLeft],
  ])}" fill="#eee6d4" stroke="#766f62" stroke-width="4"/>
  <polygon points="${points([
    [0, ceilingAtLeft],
    [farCornerX, ceilingAtCorner],
    [farCornerX, floorAtCorner],
    [0, floorAtLeft],
  ])}" fill="#f8f2df" stroke="#766f62" stroke-width="4"/>
  <polygon points="${points([
    [farCornerX, ceilingAtCorner],
    [width, ceilingAtRight],
    [width, floorAtRight],
    [farCornerX, floorAtCorner],
  ])}" fill="#e8dfca" stroke="#766f62" stroke-width="4"/>
  <polygon points="${points([
    [0, floorAtLeft],
    [farCornerX, floorAtCorner],
    [width, floorAtRight],
    [width, height],
    [0, height],
  ])}" fill="#e5c995" stroke="#766f62" stroke-width="4"/>

  <!-- Shared back-wall grid: window and postcards must follow these same rays. -->
  ${backWallGridLevels.map((y, index) => `
    <line x1="0" y1="${y}" x2="${farCornerX}" y2="${backWallY(y, farCornerX)}"
      stroke="${y === horizonY ? '#3b6f9d' : y < horizonY ? '#d86642' : '#3f8a63'}"
      stroke-width="${index === backWallGridLevels.length - 1 ? 6 : 3}"
      stroke-dasharray="${y === horizonY || y === ceilingAtLeft || y === floorAtLeft
        ? 'none' : '12 9'}"
      marker-end="url(#arrow-back)"/>
  `).join('')}
  ${backWallSlices.map((x) => `
    <line x1="${x}" y1="${backWallY(ceilingAtLeft, x)}"
      x2="${x}" y2="${backWallY(floorAtLeft, x)}"
      stroke="#998e79" stroke-width="2" stroke-dasharray="8 10"/>
  `).join('')}

  <!-- Closing right-wall grid uses the opposite vanishing direction. -->
  ${sideWallGridLevels.map((yAtLeft) => {
    const yAtCorner = backWallY(yAtLeft, farCornerX)
    return `
      <line x1="${farCornerX}" y1="${yAtCorner}"
        x2="${width}" y2="${sideWallY(yAtCorner, width)}"
        stroke="#765a91" stroke-width="3" stroke-dasharray="10 8"
        marker-end="url(#arrow-side)"/>
    `
  }).join('')}
  <line x1="${farCornerX}" y1="${ceilingAtCorner}"
    x2="${farCornerX}" y2="${floorAtCorner}"
    stroke="#4f493f" stroke-width="8"/>

  <!-- Window and postcards occupy the same back-wall plane. -->
  <polygon points="${points(windowQuad)}" fill="#a37a45"
    stroke="#6f5132" stroke-width="5"/>
  <polygon points="${points(windowInner)}" fill="#d9e5df"
    stroke="#f1d7a8" stroke-width="4"/>
  ${railQuads.map((quad) => `
    <polygon points="${points(quad)}" fill="#8a6f4f"
      stroke="#59452f" stroke-width="3"/>
  `).join('')}
  ${cardQuads.map((quad, index) => `
    <polygon points="${points(quad)}" fill="#faf6e9"
      stroke="#b78b51" stroke-width="5"/>
    <text x="${(quad[0][0] + quad[1][0]) / 2}"
      y="${(quad[0][1] + quad[2][1]) / 2}"
      text-anchor="middle" font-size="28" fill="#675a48">${index + 1}</text>
  `).join('')}

  <!-- Cabinet sits only on the closing right wall. -->
  <polygon points="${points([
    [cabinet.left, cabinetY(cabinet.topAtLeft, cabinet.left)],
    [cabinet.right, cabinetY(cabinet.topAtLeft, cabinet.right)],
    [cabinet.right, cabinetY(cabinet.bottomAtLeft, cabinet.right)],
    [cabinet.left, cabinetY(cabinet.bottomAtLeft, cabinet.left)],
  ])}" fill="#cda66e" stroke="#765438" stroke-width="7"/>
  <polygon points="${points([
    [cabinet.left, cabinetY(cabinet.topAtLeft, cabinet.left)],
    [cabinet.right, cabinetY(cabinet.topAtLeft, cabinet.right)],
    [cabinet.right, cabinetY(cabinet.topFrontAtLeft, cabinet.right)],
    [cabinet.left, cabinetY(cabinet.topFrontAtLeft, cabinet.left)],
  ])}" fill="#e2c18c" stroke="#765438" stroke-width="5"/>
  ${[cabinet.shelfAtLeft, cabinet.drawerAtLeft].map((y) => `
    <line x1="${cabinet.left}" y1="${cabinetY(y, cabinet.left)}"
      x2="${cabinet.right}" y2="${cabinetY(y, cabinet.right)}"
      stroke="#765438" stroke-width="6"/>
  `).join('')}
  <ellipse cx="1075" cy="820" rx="42" ry="78"
    fill="#d8c5a2" stroke="#765438" stroke-width="5"/>

  <!-- Existing composition placeholders. -->
  <ellipse cx="545" cy="1460" rx="345" ry="125"
    fill="#aab187" stroke="#65704f" stroke-width="6"/>
  <rect x="110" y="900" width="42" height="505" rx="18"
    fill="#b49362" stroke="#765438" stroke-width="5"/>
  <ellipse cx="131" cy="905" rx="92" ry="30"
    fill="#aab187" stroke="#65704f" stroke-width="5"/>
  <ellipse cx="131" cy="1170" rx="86" ry="28"
    fill="#aab187" stroke="#65704f" stroke-width="5"/>
  <ellipse cx="255" cy="1320" rx="58" ry="38"
    fill="#d6c99f" stroke="#766b52" stroke-width="4"/>
  <ellipse cx="395" cy="1300" rx="58" ry="38"
    fill="#d6c99f" stroke="#766b52" stroke-width="4"/>
</svg>
`

await mkdir(outputRoot, { recursive: true })
await sharp(Buffer.from(svg)).png().toFile(outputPath)
console.log(outputPath)
