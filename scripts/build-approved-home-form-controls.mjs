/**
 * A / B / F HomeForm 控制图（visual-direction-approved 后的生产顺序第 2 步）。
 *
 * 画布沿用 Home 的 1200×1600（3:4）合同（见 docs/art/candidates/
 * home-exteriors/README.md 与 packages/core/src/homeTheme 各 form）。
 * approved-direction 归档中的“16:9 控制图”表述与该合同冲突，本脚本
 * 按 3:4 执行；分辨记录见 form-controls/README.md。
 *
 * 每张控制图冻结：相机（水平线/灭点）、墙面与地面、窗洞、平台与台阶
 * （F）、全部 socket 区域、六个 slot quad、纪念品锚点、Treat 锚点、
 * 猫活动区和排除区。几何一律由公式投影并在脚本内校验；同一数据写入
 * geometry.manifest.v01.json 供后续 shell 生产与实测复核。
 *
 * Usage:
 *   node scripts/build-approved-home-form-controls.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const outputRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/form-controls',
)
const width = 1200
const height = 1600
const HORIZON = 900

const round1 = (value) => Math.round(value * 10) / 10
const p = (points) => points.map(([x, y]) => `${x},${y}`).join(' ')

const colors = {
  paper: '#f4efdf',
  wallBack: '#f8f2e2',
  wallSide: '#e9e0cc',
  floor: '#e3c58f',
  platform: '#d9b87e',
  stepFace: '#c2a068',
  outline: '#6f6658',
  aperture: '#101010',
  horizon: '#3b6f9d',
  slot: '#d84632',
  socket: '#d97c22',
  anchor: '#7650a1',
  treat: '#2b5c8a',
  zone: '#4a7a4f',
  exclusion: '#a13d5d',
}

const svgHeader = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${colors.paper}"/>`

const label = (x, y, text, fill = colors.outline, size = 24) => `
  <text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}"
    font-weight="700" fill="${fill}">${text}</text>`

const slotShapes = (slots) => slots.map(({ quad }, index) => `
  <polygon points="${p(quad)}" fill="rgba(216,70,50,0.08)"
    stroke="${colors.slot}" stroke-width="4"/>
  ${label((quad[0][0] + quad[1][0]) / 2 - 8, (quad[0][1] + quad[2][1]) / 2 + 8,
    String(index + 1), colors.slot, 30)}`).join('')

const socketBox = ({ id, region }) => `
  <rect x="${region.x}" y="${region.y}" width="${region.width}"
    height="${region.height}" fill="none" stroke="${colors.socket}"
    stroke-width="4" stroke-dasharray="14 9"/>
  ${label(region.x + 6, region.y + 28, id, colors.socket, 22)}`

const anchorBoxes = (anchors) => anchors.map((anchor) => `
  <rect x="${anchor.x}" y="${anchor.y}" width="${anchor.width}"
    height="${anchor.height}" fill="none" stroke="${colors.anchor}"
    stroke-width="3.5"/>`).join('')

const zoneShape = ({ id, polygon }) => `
  <polygon points="${p(polygon)}" fill="rgba(74,122,79,0.12)"
    stroke="${colors.zone}" stroke-width="3.5" stroke-dasharray="10 8"/>
  ${label(polygon[0][0] + 8, polygon[0][1] + 30, id, colors.zone, 22)}`

const exclusionShape = ({ id, polygon }) => `
  <polygon points="${p(polygon)}" fill="rgba(161,61,93,0.14)"
    stroke="${colors.exclusion}" stroke-width="3"
    stroke-dasharray="6 6"/>
  ${label(polygon[0][0] + 8, polygon[0][1] - 8, id, colors.exclusion, 20)}`

const horizonLine = (note) => `
  <line x1="0" y1="${HORIZON}" x2="${width}" y2="${HORIZON}"
    stroke="${colors.horizon}" stroke-width="3" stroke-dasharray="18 10"/>
  ${label(16, HORIZON - 12, note, colors.horizon, 22)}`

/** 校验四边形上/下边延长后穿过灭点（收敛容差 px）。 */
const assertConverges = (quads, vpX, tolerance, formId) => {
  for (const quad of quads) {
    for (const [from, to] of [[quad[0], quad[1]], [quad[3], quad[2]]]) {
      const [x1, y1] = from
      const [x2, y2] = to
      const yAtVp = y1 + (y2 - y1) * (vpX - x1) / (x2 - x1)
      if (Math.abs(yAtVp - HORIZON) > tolerance) {
        throw new Error(`${formId} slot edge misses VP by ${round1(yAtVp - HORIZON)}px`)
      }
    }
  }
}

const assertFrontal = (quads, formId) => {
  for (const quad of quads) {
    const [[x1, y1], [x2, y2], [, y3], [, y4]] = quad
    if (y1 !== y2 || y3 !== y4 || x1 === x2) {
      throw new Error(`${formId} frontal slot is not rectangular`)
    }
  }
}

// ---------------------------------------------------------------------------
// Form A · clear-sage：宽正面后墙（窗 + 六卡），右返回墙承柜。
// ---------------------------------------------------------------------------
const buildFormA = () => {
  const vp = [600, HORIZON]
  const cornerX = 880
  const backTop = 150
  const backFloor = 1080
  // 右墙线：过 (cornerX, h) 与 VP 的射线在 x 处的 y。
  const rightY = (hAtCorner, x) => round1(
    HORIZON + (hAtCorner - HORIZON) * (x - vp[0]) / (cornerX - vp[0]),
  )

  const windowAperture = { x: 70, y: 220, width: 530, height: 730 }
  const cols = [[630, 738], [762, 870]]
  const rowTops = [260, 418, 576]
  const slotHeight = 74
  const slots = rowTops.flatMap((top) => cols.map(([left, right]) => ({
    quad: [[left, top], [right, top], [right, top + slotHeight], [left, top + slotHeight]],
    contentSkewY: 0,
  })))
  assertFrontal(slots.map(({ quad }) => quad), 'form-a')

  const cabinet = {
    farX: 920,
    nearX: 1180,
    topAtCorner: 840,
    bottomAtCorner: backFloor,
  }
  const cabinetTopAt = (x) => rightY(cabinet.topAtCorner, x)
  const souvenirAnchors = [960, 1040, 1120].map((x, index) => ({
    x,
    y: round1(cabinetTopAt(x + 28) - 48 + 6),
    width: 56,
    height: 48,
    rotation: [-10, 7, -3][index],
    skewY: round1(Math.atan(
      (cabinetTopAt(1120) - cabinetTopAt(960)) / 160,
    ) * 180 / Math.PI * 10) / 10,
    zIndex: [2, 3, 1][index],
  }))

  const sockets = [
    { id: 'window-frame', kind: 'window-frame', region: { x: 40, y: 180, width: 600, height: 840 } },
    { id: 'postcard-display', kind: 'postcard-display', region: { x: 610, y: 240, width: 285, height: 440 } },
    { id: 'scratcher', kind: 'scratcher', region: { x: 40, y: 600, width: 260, height: 660 } },
    { id: 'feeding-set', kind: 'feeding-set', region: { x: 320, y: 1020, width: 240, height: 150 } },
    { id: 'cabinet', kind: 'cabinet', region: { x: 905, y: 770, width: 290, height: 510 } },
    { id: 'rug', kind: 'rug', region: { x: 200, y: 1215, width: 800, height: 290 } },
    { id: 'plant', kind: 'plant', region: { x: 1090, y: 700, width: 100, height: 110 } },
  ]
  const treatPlacement = { x: 470, y: 900, width: 110, height: 95 }
  const catZones = [
    { id: 'gaze', polygon: [[100, 895], [560, 895], [560, 1000], [100, 1000]] },
    { id: 'eat', polygon: [[320, 1020], [560, 1020], [560, 1170], [320, 1170]] },
    { id: 'sleep', polygon: [[240, 1250], [960, 1250], [960, 1470], [240, 1470]] },
    { id: 'play', polygon: [[640, 1180], [1060, 1180], [1060, 1420], [640, 1420]] },
  ]
  const exclusionZones = [
    { id: 'no-block-corner', polygon: [[860, 1050], [960, 1050], [1000, 1180], [860, 1180]] },
  ]

  const body = `
    <polygon points="${p([[0, backTop], [cornerX, backTop], [cornerX, backFloor], [0, backFloor]])}"
      fill="${colors.wallBack}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[cornerX, backTop], [1200, rightY(backTop, 1200)],
      [1200, rightY(backFloor, 1200)], [cornerX, backFloor]])}"
      fill="${colors.wallSide}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[0, backFloor], [cornerX, backFloor],
      [1200, rightY(backFloor, 1200)], [1200, 1600], [0, 1600]])}"
      fill="${colors.floor}" stroke="${colors.outline}" stroke-width="5"/>
    <ellipse cx="600" cy="1360" rx="400" ry="145" fill="rgba(170,177,135,0.5)"
      stroke="${colors.outline}" stroke-width="4"/>
    <rect x="${windowAperture.x}" y="${windowAperture.y}"
      width="${windowAperture.width}" height="${windowAperture.height}"
      fill="${colors.aperture}"/>
    ${label(windowAperture.x + 10, windowAperture.y + 36, 'WINDOW APERTURE', '#f4efdf', 26)}
    ${horizonLine(`horizon y=${HORIZON} · VP(600,900) 只作用于右墙`)}
    <line x1="${cornerX}" y1="${backTop}" x2="${cornerX}" y2="${backFloor}"
      stroke="${colors.outline}" stroke-width="7"/>
    ${label(cornerX - 210, backTop + 40, `corner x=${cornerX}`, colors.outline, 24)}
    ${slotShapes(slots)}
    ${sockets.map(socketBox).join('')}
    ${anchorBoxes(souvenirAnchors)}
    <rect x="${treatPlacement.x}" y="${treatPlacement.y}" width="${treatPlacement.width}"
      height="${treatPlacement.height}" fill="none" stroke="${colors.treat}" stroke-width="4"/>
    ${label(treatPlacement.x, treatPlacement.y - 8, 'treat', colors.treat, 22)}
    ${catZones.map(zoneShape).join('')}
    ${exclusionZones.map(exclusionShape).join('')}
    ${label(24, 60, 'Form A · clear-sage · 1200×1600 · frontal back wall + right return wall', colors.outline, 26)}
  `
  return {
    id: 'form-a-clear-sage',
    file: 'home-form--a-clear-sage--control-v01.png',
    svg: `${svgHeader}${body}</svg>`,
    geometry: {
      canvas: { width, height },
      horizonY: HORIZON,
      vanishingPoints: { rightWall: vp },
      cornerX,
      backWall: { top: backTop, floor: backFloor, xRange: [0, cornerX] },
      windowAperture,
      slots,
      sockets,
      souvenirAnchors,
      treatPlacement,
      catZones,
      exclusionZones,
      zBands: ['finish-shell', 'rear-pieces', 'cat', 'dynamic-display', 'piece-foreground-occlusion', 'lighting'],
    },
  }
}

// ---------------------------------------------------------------------------
// Form B · warm-walnut gallery：窄后墙大窗，宽右墙承六卡与矮柜。
// ---------------------------------------------------------------------------
const buildFormB = () => {
  const vp = [-4000, HORIZON]
  const cornerX = 620
  const backTop = 140
  const backFloor = 1040
  const wallY = (hAtCorner, x) => round1(
    HORIZON + (hAtCorner - HORIZON) * (x - vp[0]) / (cornerX - vp[0]),
  )

  const windowAperture = { x: 60, y: 200, width: 500, height: 760 }
  const cols = [[660, 800], [850, 1000]]
  const rowTops = [280, 450, 620]
  const slotHeight = 118
  const slots = rowTops.flatMap((top) => cols.map(([left, right]) => ({
    quad: [
      [left, wallY(top, left)],
      [right, wallY(top, right)],
      [right, wallY(top + slotHeight, right)],
      [left, wallY(top + slotHeight, left)],
    ],
    contentSkewY: round1(Math.atan(
      (wallY(top, right) - wallY(top, left)) / (right - left),
    ) * 180 / Math.PI * 10) / 10,
  })))
  assertConverges(slots.map(({ quad }) => quad), vp[0], 2.5, 'form-b')

  const cabinetTopAt = (x) => wallY(780, x)
  const souvenirAnchors = [700, 830, 960].map((x, index) => ({
    x,
    y: round1(cabinetTopAt(x + 28) - 48 + 6),
    width: 56,
    height: 48,
    rotation: [-10, 7, -3][index],
    skewY: round1(Math.atan(
      (cabinetTopAt(960) - cabinetTopAt(700)) / 260,
    ) * 180 / Math.PI * 10) / 10,
    zIndex: [2, 3, 1][index],
  }))

  const sockets = [
    { id: 'window-frame', kind: 'window-frame', region: { x: 30, y: 160, width: 570, height: 880 } },
    { id: 'postcard-display', kind: 'postcard-display', region: { x: 640, y: 150, width: 390, height: 640 } },
    { id: 'scratcher', kind: 'scratcher', region: { x: 30, y: 620, width: 250, height: 690 } },
    { id: 'feeding-set', kind: 'feeding-set', region: { x: 420, y: 1120, width: 250, height: 160 } },
    { id: 'cabinet', kind: 'cabinet', region: { x: 630, y: 740, width: 520, height: 340 } },
    { id: 'rug', kind: 'rug', region: { x: 240, y: 1280, width: 760, height: 280 } },
    { id: 'plant', kind: 'plant', region: { x: 1000, y: 690, width: 100, height: 110 } },
  ]
  const treatPlacement = { x: 430, y: 915, width: 110, height: 95 }
  const catZones = [
    { id: 'gaze', polygon: [[90, 905], [540, 905], [540, 1015], [90, 1015]] },
    { id: 'eat', polygon: [[420, 1120], [670, 1120], [670, 1280], [420, 1280]] },
    { id: 'sleep', polygon: [[280, 1310], [960, 1310], [960, 1530], [280, 1530]] },
    { id: 'play', polygon: [[120, 1150], [420, 1150], [420, 1420], [120, 1420]] },
  ]
  const exclusionZones = [
    { id: 'no-block-cabinet-front', polygon: [[660, 1090], [1150, 1110], [1150, 1220], [660, 1200]] },
  ]

  const body = `
    <polygon points="${p([[0, backTop], [cornerX, backTop], [cornerX, backFloor], [0, backFloor]])}"
      fill="${colors.wallBack}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[cornerX, backTop], [1200, wallY(backTop, 1200)],
      [1200, wallY(backFloor, 1200)], [cornerX, backFloor]])}"
      fill="${colors.wallSide}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[0, backFloor], [cornerX, backFloor],
      [1200, wallY(backFloor, 1200)], [1200, 1600], [0, 1600]])}"
      fill="${colors.floor}" stroke="${colors.outline}" stroke-width="5"/>
    <ellipse cx="620" cy="1420" rx="370" ry="135" fill="rgba(196,158,120,0.45)"
      stroke="${colors.outline}" stroke-width="4"/>
    <rect x="${windowAperture.x}" y="${windowAperture.y}"
      width="${windowAperture.width}" height="${windowAperture.height}"
      fill="${colors.aperture}"/>
    ${label(windowAperture.x + 10, windowAperture.y + 36, 'WINDOW APERTURE', '#f4efdf', 26)}
    ${horizonLine(`horizon y=${HORIZON} · 右墙灭点 (${vp[0]},900) 画外远左`)}
    ${[backTop, 280, 450, 620, 780, backFloor].map((h) => `
      <line x1="${cornerX}" y1="${h}" x2="1200" y2="${wallY(h, 1200)}"
        stroke="rgba(59,111,157,0.4)" stroke-width="2" stroke-dasharray="10 9"/>
    `).join('')}
    <line x1="${cornerX}" y1="${backTop}" x2="${cornerX}" y2="${backFloor}"
      stroke="${colors.outline}" stroke-width="7"/>
    ${label(cornerX - 210, backTop + 40, `corner x=${cornerX}`, colors.outline, 24)}
    ${slotShapes(slots)}
    ${sockets.map(socketBox).join('')}
    ${anchorBoxes(souvenirAnchors)}
    <rect x="${treatPlacement.x}" y="${treatPlacement.y}" width="${treatPlacement.width}"
      height="${treatPlacement.height}" fill="none" stroke="${colors.treat}" stroke-width="4"/>
    ${label(treatPlacement.x, treatPlacement.y - 8, 'treat', colors.treat, 22)}
    ${catZones.map(zoneShape).join('')}
    ${exclusionZones.map(exclusionShape).join('')}
    ${label(24, 60, 'Form B · warm-walnut gallery · 1200×1600 · wide right wall, near end enlarges', colors.outline, 26)}
  `
  return {
    id: 'form-b-warm-walnut-gallery',
    file: 'home-form--b-warm-walnut-gallery--control-v01.png',
    svg: `${svgHeader}${body}</svg>`,
    geometry: {
      canvas: { width, height },
      horizonY: HORIZON,
      vanishingPoints: { rightWall: vp },
      cornerX,
      backWall: { top: backTop, floor: backFloor, xRange: [0, cornerX] },
      windowAperture,
      slots,
      sockets,
      souvenirAnchors,
      treatPlacement,
      catZones,
      exclusionZones,
      zBands: ['finish-shell', 'rear-pieces', 'cat', 'dynamic-display', 'piece-foreground-occlusion', 'lighting'],
    },
  }
}

// ---------------------------------------------------------------------------
// Form F · moonwhite split-level v02：左墙退深（窗），正面后墙右段承
// 六卡与平台矮柜；抬高平台 + 一级台阶 + 低层地面。
// ---------------------------------------------------------------------------
const buildFormF = () => {
  const vp = [2750, HORIZON]
  const cornerX = 740
  const leftY = (hAtLeft, x) => round1(
    HORIZON + (hAtLeft - HORIZON) * (vp[0] - x) / vp[0],
  )
  const backTop = leftY(-60, cornerX)
  const platformTopH = 1030
  const stepBottomH = 1150
  const platformFrontY = leftY(platformTopH, cornerX)
  const stepBottomY = leftY(stepBottomH, cornerX)

  const windowAperture = {
    quad: [
      [50, leftY(160, 50)],
      [560, leftY(160, 560)],
      [560, leftY(860, 560)],
      [50, leftY(860, 50)],
    ],
  }
  const cols = [[790, 900], [935, 1045]]
  const rowTops = [320, 470, 620]
  const slotHeight = 100
  const slots = rowTops.flatMap((top) => cols.map(([left, right]) => ({
    quad: [[left, top], [right, top], [right, top + slotHeight], [left, top + slotHeight]],
    contentSkewY: 0,
  })))
  assertFrontal(slots.map(({ quad }) => quad), 'form-f')

  const cabinet = { x: 770, y: 770, width: 380, height: 218 }
  const souvenirAnchors = [810, 920, 1030].map((x, index) => ({
    x,
    y: 770 - 48 + 6,
    width: 56,
    height: 48,
    rotation: [-10, 7, -3][index],
    skewY: 0,
    zIndex: [2, 3, 1][index],
  }))

  const sockets = [
    { id: 'window-frame', kind: 'window-frame', region: { x: 20, y: 100, width: 590, height: 900 } },
    { id: 'postcard-display', kind: 'postcard-display', region: { x: 770, y: 300, width: 300, height: 440 } },
    { id: 'cabinet', kind: 'cabinet', region: { x: 760, y: 700, width: 400, height: 300 } },
    { id: 'scratcher', kind: 'scratcher', region: { x: 30, y: 850, width: 270, height: 640 } },
    { id: 'feeding-set', kind: 'feeding-set', region: { x: 330, y: 1180, width: 240, height: 150 } },
    { id: 'rug', kind: 'rug', region: { x: 270, y: 1315, width: 760, height: 270 } },
    { id: 'plant', kind: 'plant', region: { x: 1060, y: 630, width: 100, height: 100 } },
  ]
  const treatPlacement = { x: 470, y: 890, width: 105, height: 92 }
  const catZones = [
    { id: 'gaze-platform', polygon: [[120, 930], [470, 905], [470, 1010], [120, 1040]] },
    { id: 'eat', polygon: [[330, 1180], [570, 1180], [570, 1330], [330, 1330]] },
    { id: 'sleep', polygon: [[300, 1340], [1000, 1340], [1000, 1560], [300, 1560]] },
    { id: 'play', polygon: [[620, 1160], [1100, 1160], [1100, 1400], [620, 1400]] },
  ]
  const stepEdge = [
    [0, leftY(platformTopH, 0)],
    [cornerX, platformFrontY],
    [1200, platformFrontY],
  ]
  const exclusionZones = [
    {
      id: 'no-straddle-step-edge',
      polygon: [
        [0, leftY(platformTopH, 0) - 18],
        [cornerX, platformFrontY - 18],
        [1200, platformFrontY - 18],
        [1200, stepBottomY + 18],
        [cornerX, stepBottomY + 18],
        [0, leftY(stepBottomH, 0) + 18],
      ],
    },
  ]

  const body = `
    <polygon points="${p([[0, leftY(-60, 0)], [cornerX, backTop],
      [cornerX, platformFrontY], [0, leftY(platformTopH, 0)]])}"
      fill="${colors.wallBack}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[cornerX, backTop], [1200, backTop],
      [1200, platformFrontY], [cornerX, platformFrontY]])}"
      fill="${colors.wallSide}" stroke="${colors.outline}" stroke-width="5"/>
    <polygon points="${p([[0, leftY(platformTopH, 0)], [cornerX, platformFrontY],
      [1200, platformFrontY], [1200, stepBottomY], [cornerX, stepBottomY],
      [0, leftY(stepBottomH, 0)]])}"
      fill="${colors.platform}" stroke="${colors.outline}" stroke-width="5"/>
    ${label(30, leftY(platformTopH, 0) + 34, 'platform top', colors.outline, 22)}
    <polygon points="${p([[0, leftY(stepBottomH, 0)], [cornerX, stepBottomY],
      [1200, stepBottomY], [1200, 1600], [0, 1600]])}"
      fill="${colors.floor}" stroke="${colors.outline}" stroke-width="5"/>
    ${label(30, leftY(stepBottomH, 0) + 40, 'single step down · lower floor', colors.outline, 22)}
    <ellipse cx="650" cy="1450" rx="380" ry="135" fill="rgba(140,152,178,0.4)"
      stroke="${colors.outline}" stroke-width="4"/>
    <polygon points="${p(windowAperture.quad)}" fill="${colors.aperture}"/>
    ${label(windowAperture.quad[0][0] + 10, windowAperture.quad[0][1] + 36, 'WINDOW APERTURE', '#f4efdf', 26)}
    <rect x="${cabinet.x}" y="${cabinet.y}" width="${cabinet.width}" height="${cabinet.height}"
      fill="rgba(233,224,204,0.9)" stroke="${colors.outline}" stroke-width="5"/>
    ${label(cabinet.x + 10, cabinet.y + 34, 'low cabinet ON platform', colors.outline, 22)}
    ${horizonLine(`horizon y=${HORIZON} · 左墙灭点 (${vp[0]},900) 画外右`)}
    ${[160, 520, 860, platformTopH, stepBottomH].map((h) => `
      <line x1="0" y1="${leftY(h, 0)}" x2="${cornerX}" y2="${leftY(h, cornerX)}"
        stroke="rgba(59,111,157,0.4)" stroke-width="2" stroke-dasharray="10 9"/>
    `).join('')}
    <line x1="${cornerX}" y1="${backTop}" x2="${cornerX}" y2="${stepBottomY}"
      stroke="${colors.outline}" stroke-width="7"/>
    ${label(cornerX + 10, backTop + 40, `corner x=${cornerX}`, colors.outline, 24)}
    ${slotShapes(slots)}
    ${sockets.map(socketBox).join('')}
    ${anchorBoxes(souvenirAnchors)}
    <rect x="${treatPlacement.x}" y="${treatPlacement.y}" width="${treatPlacement.width}"
      height="${treatPlacement.height}" fill="none" stroke="${colors.treat}" stroke-width="4"/>
    ${label(treatPlacement.x, treatPlacement.y - 8, 'treat', colors.treat, 22)}
    ${catZones.map(zoneShape).join('')}
    ${exclusionZones.map(exclusionShape).join('')}
    ${label(24, 60, 'Form F · moonwhite split-level v02 · 1200×1600 · frontal display wall + one step', colors.outline, 26)}
  `
  return {
    id: 'form-f-moonwhite-split-level',
    file: 'home-form--f-moonwhite-split-level--control-v02.png',
    svg: `${svgHeader}${body}</svg>`,
    geometry: {
      canvas: { width, height },
      horizonY: HORIZON,
      vanishingPoints: { leftWall: vp },
      cornerX,
      windowAperture,
      platform: {
        topHeightAtLeft: platformTopH,
        stepBottomHeightAtLeft: stepBottomH,
        frontEdge: stepEdge,
      },
      slots,
      sockets,
      souvenirAnchors,
      treatPlacement,
      catZones,
      exclusionZones,
      zBands: ['finish-shell', 'rear-pieces', 'cat', 'dynamic-display', 'piece-foreground-occlusion', 'lighting'],
    },
  }
}

await mkdir(outputRoot, { recursive: true })
const forms = [buildFormA(), buildFormB(), buildFormF()]
const manifest = {
  status: 'geometry-freeze-proposal',
  approvalBasis: 'visual-direction-approved 2026-08-13',
  canvasContract: '1200x1600 (3:4)，沿用 Home 画布合同；16:9 表述不采用',
  note: '坐标为控制图冻结值；shell 生产后仍须按 ADR 0007 实测复核',
  forms: {},
}
for (const form of forms) {
  await sharp(Buffer.from(form.svg)).png().toFile(path.join(outputRoot, form.file))
  manifest.forms[form.id] = { file: form.file, ...form.geometry }
  console.log(form.file)
}
await writeFile(
  path.join(outputRoot, 'geometry.manifest.v01.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
console.log('geometry.manifest.v01.json')
