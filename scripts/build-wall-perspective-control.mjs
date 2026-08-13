/**
 * PROTOTYPE — 用后即弃。
 *
 * 生成封闭小房间的结构控制图：明信片墙向右退深，在画内形成远端内角，
 * 再由右侧返回墙朝镜头展开。它不是美术资产，而是 image generation 的
 * 几何约束输入。
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const outputRoot = path.resolve(
  'docs/art/candidates/home-wall-prototype/2026-08-13-right-recede',
)
const outputPath = path.join(
  outputRoot,
  'perspective-control--closed-room--v04.png',
)
const backgroundOutputPath = path.join(
  outputRoot,
  'perspective-control--closed-room-background--v04.png',
)

const width = 1200
const height = 1600
const horizonY = 947
const nearJambX = 675
const vanishingPointX = 2867
const returnVanishingPointX = 230
const farCornerX = 1050
const scaleAt = (x) =>
  (vanishingPointX - x) / (vanishingPointX - nearJambX)
const wallY = (yAtNear, x) =>
  Math.round((horizonY + (yAtNear - horizonY) * scaleAt(x)) * 10) / 10
const returnWallY = (yAtCorner, x) =>
  Math.round((
    horizonY
    + (yAtCorner - horizonY)
      * (x - returnVanishingPointX)
      / (farCornerX - returnVanishingPointX)
  ) * 10) / 10
const points = (values) => values.map(([x, y]) => `${x},${y}`).join(' ')

const wallRight = 1200
const floorAtNear = 1272
const floorAtCorner = wallY(floorAtNear, farCornerX)
const floorAtRight = returnWallY(floorAtCorner, wallRight)
const rightGridLevels = [80, 220, 360, 479, 700, 947, 1080, 1190, 1272]
const depthSlices = [675, 760, 860, 960, 1050]
const rows = [
  { top: 80, bottom: 185, rail: 199 },
  { top: 220, bottom: 325, rail: 339 },
  { top: 360, bottom: 465, rail: 479 },
]
const columns = [
  { left: 720, right: 850 },
  { left: 875, right: 990 },
]
const cardQuads = rows.flatMap((row) => columns.map((column) => [
  [column.left, wallY(row.top, column.left)],
  [column.right, wallY(row.top, column.right)],
  [column.right, wallY(row.bottom, column.right)],
  [column.left, wallY(row.bottom, column.left)],
]))
const railQuads = rows.map((row) => [
  [700, wallY(row.rail, 700)],
  [1020, wallY(row.rail, 1020)],
  [1020, wallY(row.rail + 12, 1020)],
  [700, wallY(row.rail + 12, 700)],
])

const cabinet = {
  left: 1060,
  right: 1190,
  top: 900,
  topFront: 940,
  drawerBottom: 1065,
  shelf: 1165,
  bottom: 1375,
}

const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrow-red" markerWidth="12" markerHeight="12" refX="10" refY="6"
      orient="auto"><path d="M0,0 L12,6 L0,12 Z" fill="#d86642"/></marker>
    <marker id="arrow-green" markerWidth="12" markerHeight="12" refX="10" refY="6"
      orient="auto"><path d="M0,0 L12,6 L0,12 Z" fill="#3f8a63"/></marker>
    <pattern id="paper" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="#f4efdf"/>
      <circle cx="2" cy="3" r="0.7" fill="#d9cfb8" opacity="0.45"/>
      <circle cx="9" cy="8" r="0.6" fill="#d9cfb8" opacity="0.32"/>
    </pattern>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#paper)"/>

  <!-- Recessed window/front plane. -->
  <polygon points="${points([[0, 0], [nearJambX, 0], [nearJambX, floorAtNear], [0, 1218]])}"
    fill="#ece8db" stroke="#857b68" stroke-width="4"/>
  <rect x="36" y="70" width="610" height="900" fill="#d9e5df"
    stroke="#9b7547" stroke-width="24"/>
  <polygon points="${points([[0, 968], [nearJambX, 1015], [nearJambX, 1080], [0, 1030]])}"
    fill="#d8b77d" stroke="#85633e" stroke-width="5"/>

  <!-- Near jamb, finite memory wall, and far closing return wall. -->
  <polygon points="${points([
    [nearJambX, 0],
    [farCornerX, 0],
    [farCornerX, floorAtCorner],
    [nearJambX, floorAtNear],
  ])}" fill="#f8f2df" stroke="#857b68" stroke-width="4"/>
  <polygon points="${points([
    [farCornerX, 0],
    [wallRight, 0],
    [wallRight, floorAtRight],
    [farCornerX, floorAtCorner],
  ])}" fill="#e8dfca" stroke="#857b68" stroke-width="4"/>
  <rect x="${nearJambX - 22}" y="0" width="44" height="${floorAtNear}"
    fill="#cda66e" stroke="#85633e" stroke-width="4"/>
  <line x1="${farCornerX}" y1="0" x2="${farCornerX}" y2="${floorAtCorner}"
    stroke="#6f6658" stroke-width="7"/>

  <!-- Floor planes. -->
  <polygon points="${points([[0, 1218], [nearJambX, floorAtNear], [nearJambX, 1600], [0, 1600]])}"
    fill="#e2c797" stroke="#857b68" stroke-width="4"/>
  <polygon points="${points([
    [nearJambX, floorAtNear],
    [farCornerX, floorAtCorner],
    [wallRight, floorAtRight],
    [wallRight, 1600],
    [nearJambX, 1600],
  ])}" fill="#e7cea0" stroke="#857b68" stroke-width="4"/>

  <!-- Exact memory-wall and closing-return perspective grids. -->
  ${rightGridLevels.map((y, index) => `
    <line x1="${nearJambX}" y1="${y}" x2="${farCornerX}" y2="${wallY(y, farCornerX)}"
      stroke="${y < horizonY ? '#d86642' : y > horizonY ? '#3f8a63' : '#3b6f9d'}"
      stroke-width="${index === rightGridLevels.length - 1 ? 6 : 3}"
      stroke-dasharray="${y === horizonY || y === floorAtNear ? 'none' : '12 9'}"
      marker-end="url(#${y < horizonY ? 'arrow-red' : 'arrow-green'})"/>
    <line x1="${farCornerX}" y1="${wallY(y, farCornerX)}"
      x2="${wallRight}" y2="${returnWallY(wallY(y, farCornerX), wallRight)}"
      stroke="#765a91" stroke-width="${index === rightGridLevels.length - 1 ? 6 : 3}"
      stroke-dasharray="${y === horizonY || y === floorAtNear ? 'none' : '10 8'}"/>
  `).join('')}
  ${depthSlices.map((x) => `
    <line x1="${x}" y1="${wallY(100, x)}" x2="${x}" y2="${wallY(floorAtNear, x)}"
      stroke="#998e79" stroke-width="2" stroke-dasharray="8 10"/>
  `).join('')}

  <!-- Three rails and six equal real-size cards projected by the same wall model. -->
  ${railQuads.map((quad) => `
    <polygon points="${points(quad)}" fill="#8a6f4f" stroke="#59452f" stroke-width="3"/>
  `).join('')}
  ${cardQuads.map((quad, index) => `
    <polygon points="${points(quad)}" fill="#faf6e9" stroke="#b78b51" stroke-width="5"/>
    <text x="${(quad[0][0] + quad[1][0]) / 2}"
      y="${(quad[0][1] + quad[2][1]) / 2}"
      text-anchor="middle" font-size="28" fill="#675a48">${index + 1}</text>
  `).join('')}

  <!-- Cabinet sits on the closing return wall and grows toward the right foreground. -->
  <polygon points="${points([
    [cabinet.left, returnWallY(wallY(cabinet.top, farCornerX), cabinet.left)],
    [cabinet.right, returnWallY(wallY(cabinet.top, farCornerX), cabinet.right)],
    [cabinet.right, returnWallY(wallY(cabinet.bottom, farCornerX), cabinet.right)],
    [cabinet.left, returnWallY(wallY(cabinet.bottom, farCornerX), cabinet.left)],
  ])}" fill="#cda66e" stroke="#765438" stroke-width="7"/>
  <polygon points="${points([
    [cabinet.left, returnWallY(wallY(cabinet.top, farCornerX), cabinet.left)],
    [cabinet.right, returnWallY(wallY(cabinet.top, farCornerX), cabinet.right)],
    [cabinet.right, returnWallY(wallY(cabinet.topFront, farCornerX), cabinet.right)],
    [cabinet.left, returnWallY(wallY(cabinet.topFront, farCornerX), cabinet.left)],
  ])}" fill="#e2c18c" stroke="#765438" stroke-width="5"/>
  ${[cabinet.drawerBottom, cabinet.shelf].map((y) => `
    <line x1="${cabinet.left}" y1="${returnWallY(wallY(y, farCornerX), cabinet.left)}"
      x2="${cabinet.right}" y2="${returnWallY(wallY(y, farCornerX), cabinet.right)}"
      stroke="#765438" stroke-width="6"/>
  `).join('')}
  <line x1="${cabinet.left + 20}"
    y1="${returnWallY(wallY(cabinet.topFront, farCornerX), cabinet.left + 20)}"
    x2="${cabinet.left + 20}"
    y2="${returnWallY(wallY(cabinet.bottom, farCornerX), cabinet.left + 20)}"
    stroke="#765438" stroke-width="8"/>
  <line x1="${cabinet.right - 18}"
    y1="${returnWallY(wallY(cabinet.topFront, farCornerX), cabinet.right - 18)}"
    x2="${cabinet.right - 18}"
    y2="${returnWallY(wallY(cabinet.bottom, farCornerX), cabinet.right - 18)}"
    stroke="#765438" stroke-width="8"/>
  <ellipse cx="1125" cy="838" rx="42" ry="80" fill="#d8c5a2"
    stroke="#765438" stroke-width="5"/>

  <!-- Composition placeholders retained from the current Home. -->
  <ellipse cx="565" cy="1465" rx="350" ry="125" fill="#aab187"
    stroke="#65704f" stroke-width="6"/>
  <rect x="120" y="900" width="42" height="505" rx="18" fill="#b49362"
    stroke="#765438" stroke-width="5"/>
  <ellipse cx="141" cy="905" rx="92" ry="30" fill="#aab187"
    stroke="#65704f" stroke-width="5"/>
  <ellipse cx="141" cy="1170" rx="86" ry="28" fill="#aab187"
    stroke="#65704f" stroke-width="5"/>
  <ellipse cx="270" cy="1310" rx="58" ry="38" fill="#d6c99f"
    stroke="#766b52" stroke-width="4"/>
  <ellipse cx="410" cy="1290" rx="58" ry="38" fill="#d6c99f"
    stroke="#766b52" stroke-width="4"/>

  <!-- Readable anchors; the actual right VP remains outside the canvas. -->
  <line x1="0" y1="${horizonY}" x2="${width}" y2="${horizonY}"
    stroke="#3b6f9d" stroke-width="4" stroke-dasharray="18 12"/>
  <line x1="${nearJambX}" y1="0" x2="${nearJambX}" y2="${floorAtNear}"
    stroke="#3b6f9d" stroke-width="5" stroke-dasharray="18 12"/>
  <line x1="${farCornerX}" y1="0" x2="${farCornerX}" y2="${floorAtCorner}"
    stroke="#765a91" stroke-width="5" stroke-dasharray="18 12"/>
</svg>
`

await mkdir(outputRoot, { recursive: true })
await sharp(Buffer.from(svg)).png().toFile(outputPath)
const backgroundSvg = svg.replace(
  /  <!-- Three rails and six equal real-size cards[\s\S]*?  <!-- Cabinet sits/,
  '  <!-- Cabinet sits',
)
await sharp(Buffer.from(backgroundSvg)).png().toFile(backgroundOutputPath)
console.log(outputPath)
console.log(backgroundOutputPath)
