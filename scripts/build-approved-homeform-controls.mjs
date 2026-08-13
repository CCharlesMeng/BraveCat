/**
 * A/B/F HomeForm 控制图与几何冻结（生产顺序第 2 步）。
 *
 * 依据 approved-direction 概念图推导三套房间的相机、墙面、窗洞、
 * 平台/台阶、全部 socket、slot quad、锚点、活动区与排除区，输出：
 *   1. 每套一张 1200×1600 标注控制图（PNG）
 *   2. 每套一份几何 manifest（JSON），后续 clean shell / piece 生产
 *      与实测复核均以此为准
 *
 * 画布合同沿用运行时 3:4（1200×1600）。art-production-status.md 中的
 * "16:9 相机"表述与 home-exteriors 归档的 3:4 合同矛盾，本脚本按 3:4
 * 执行；如需改判 16:9 须先更新画布合同 ADR。
 *
 * Usage:
 *   node scripts/build-approved-homeform-controls.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/form-controls',
)
const width = 1200
const height = 1600
const round1 = (value) => Math.round(value * 10) / 10

const colors = {
  paper: '#f4efdf',
  wall: '#f8f2df',
  wallShade: '#e7deca',
  floor: '#e3c58f',
  platform: '#d9b87e',
  stepFace: '#c2a065',
  outline: '#6f6658',
  glass: '#d6e7e2',
  window: '#9c7547',
  card: '#faf6e9',
  cardEdge: '#b78b51',
  rail: '#8a6f4f',
  horizon: '#3b6f9d',
  guide: '#d86642',
  socket: '#765a91',
  zone: '#347a48',
  exclusion: '#b03a3a',
  anchor: '#1f6f86',
}

const p = (points) => points.map(([x, y]) => `${x},${y}`).join(' ')

const svgDoc = (body) => `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${colors.paper}"/>
  ${body}
  <rect width="${width}" height="${height}" fill="none"
    stroke="${colors.outline}" stroke-width="4"/>
</svg>
`

const cardSvg = (quad, index) => `
  <polygon points="${p(quad)}" fill="${colors.card}"
    stroke="${colors.cardEdge}" stroke-width="4"/>
  <text x="${(quad[0][0] + quad[1][0]) / 2}" y="${(quad[0][1] + quad[2][1]) / 2 + 8}"
    text-anchor="middle" font-size="26" fill="#675a48">${index + 1}</text>
`

const socketSvg = ({ id, region }) => `
  <rect x="${region.x}" y="${region.y}" width="${region.width}"
    height="${region.height}" fill="rgba(118,90,145,0.07)"
    stroke="${colors.socket}" stroke-width="3" stroke-dasharray="12 8"/>
  <text x="${region.x + 6}" y="${region.y + 24}" font-size="20"
    fill="${colors.socket}">${id}</text>
`

const zoneSvg = ({ label, polygon }, color = colors.zone) => `
  <polygon points="${p(polygon)}" fill="none"
    stroke="${color}" stroke-width="3" stroke-dasharray="6 6"/>
  <text x="${polygon[0][0] + 6}" y="${polygon[0][1] + 22}" font-size="19"
    fill="${color}">${label}</text>
`

const anchorSvg = ({ id, x, y, width: w, height: h }) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none"
    stroke="${colors.anchor}" stroke-width="3"/>
  <text x="${x}" y="${y - 6}" font-size="16" fill="${colors.anchor}">${id}</text>
`

const horizonSvg = (y) => `
  <line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${colors.horizon}"
    stroke-width="2.5" stroke-dasharray="18 10"/>
  <text x="16" y="${y - 8}" font-size="20" fill="${colors.horizon}">horizon y=${y}</text>
`

/* ------------------------------------------------------------------ */
/* A · 清润鼠尾草：后墙（窗 + 六卡）+ 右墙（柜），单点透视           */
/* ------------------------------------------------------------------ */
const buildFormA = () => {
  const horizon = 880
  const vp = [600, horizon]
  const cornerX = 930
  const backWall = { left: 70, top: 210, right: cornerX, floorY: 1070 }
  // 右墙横线：从 VP 过转角高度射向画布右缘。
  const rayY = (yAtCorner, x) => round1(
    horizon + (yAtCorner - horizon) * (x - vp[0]) / (cornerX - vp[0]),
  )
  const window = { x: 130, y: 290, width: 430, height: 560, sillY: 850 }
  const columns = [[630, 750], [780, 900]]
  const rows = [
    { top: 320, bottom: 425, rail: 432 },
    { top: 480, bottom: 585, rail: 592 },
    { top: 640, bottom: 745, rail: 752 },
  ]
  const slots = rows.flatMap(({ top, bottom }) => columns.map(([l, r]) => [
    [l, top], [r, top], [r, bottom], [l, bottom],
  ]))
  const cabinet = {
    nearX: 1165, farX: 955, topAtWall: 893, floorAtWall: backWall.floorY,
  }
  const cabinetQuad = [
    [cabinet.farX, rayY(cabinet.topAtWall, cabinet.farX)],
    [cabinet.nearX, rayY(cabinet.topAtWall, cabinet.nearX)],
    [cabinet.nearX, rayY(cabinet.floorAtWall, cabinet.nearX)],
    [cabinet.farX, rayY(cabinet.floorAtWall, cabinet.farX)],
  ]
  const sockets = [
    { id: 'window-frame', kind: 'window-frame', region: { x: 100, y: 250, width: 500, height: 660 } },
    { id: 'postcard-display', kind: 'postcard-display', region: { x: 615, y: 300, width: 305, height: 475 } },
    { id: 'scratcher', kind: 'scratcher', region: { x: 55, y: 620, width: 185, height: 620 } },
    { id: 'feeding-set', kind: 'feeding-set', region: { x: 295, y: 1120, width: 250, height: 145 } },
    { id: 'cabinet', kind: 'cabinet', region: { x: 945, y: 840, width: 235, height: 380 } },
    { id: 'rug', kind: 'rug', region: { x: 255, y: 1265, width: 690, height: 275 } },
    { id: 'plant', kind: 'plant', region: { x: 1080, y: 690, width: 105, height: 212 } },
  ]
  // 锚点底边落在柜顶沿（rayY(893, x) ≈ 896–901）。
  const souvenirAnchors = [
    { id: 'souvenir-1', x: 975, y: 858, width: 54, height: 46 },
    { id: 'souvenir-2', x: 1038, y: 858, width: 56, height: 48 },
    { id: 'souvenir-3', x: 1100, y: 865, width: 52, height: 44 },
  ]
  const treatAnchor = { id: 'treat', x: 455, y: 780, width: 105, height: 84 }
  const catZones = [
    { label: 'gaze（窗台/爬架顶）', polygon: [[70, 640], [330, 640], [330, 900], [70, 900]] },
    { label: 'eat', polygon: [[280, 1080], [560, 1080], [560, 1290], [280, 1290]] },
    { label: 'sleep（rug）', polygon: [[300, 1290], [900, 1290], [900, 1520], [300, 1520]] },
    { label: 'play', polygon: [[70, 1290], [295, 1290], [295, 1560], [70, 1560]] },
  ]
  const exclusionZones = [
    { label: 'plant 独占', polygon: [[1080, 690], [1185, 690], [1185, 902], [1080, 902]] },
  ]

  const svg = svgDoc(`
    <polygon points="${p([[0, 140], [backWall.left, backWall.top],
      [backWall.left, backWall.floorY], [0, 1120]])}"
      fill="${colors.wallShade}" stroke="${colors.outline}" stroke-width="4"/>
    <rect x="${backWall.left}" y="${backWall.top}"
      width="${backWall.right - backWall.left}"
      height="${backWall.floorY - backWall.top}"
      fill="${colors.wall}" stroke="${colors.outline}" stroke-width="4"/>
    <polygon points="${p([[cornerX, backWall.top], [1200, rayY(backWall.top, 1200)],
      [1200, rayY(backWall.floorY, 1200)], [cornerX, backWall.floorY]])}"
      fill="${colors.wallShade}" stroke="${colors.outline}" stroke-width="4"/>
    <polygon points="${p([[0, 1120], [backWall.left, backWall.floorY],
      [cornerX, backWall.floorY], [1200, rayY(backWall.floorY, 1200)],
      [1200, 1600], [0, 1600]])}"
      fill="${colors.floor}" stroke="${colors.outline}" stroke-width="4"/>
    <rect x="${window.x}" y="${window.y}" width="${window.width}"
      height="${window.height}" fill="${colors.glass}"
      stroke="${colors.window}" stroke-width="10"/>
    <rect x="${window.x - 18}" y="${window.sillY}" width="${window.width + 36}"
      height="26" fill="${colors.window}" stroke="${colors.outline}" stroke-width="3"/>
    ${rows.map(({ rail }) => `
      <rect x="615" y="${rail}" width="305" height="10" fill="${colors.rail}"/>
    `).join('')}
    ${slots.map(cardSvg).join('')}
    <polygon points="${p(cabinetQuad)}" fill="#cda66e"
      stroke="${colors.outline}" stroke-width="5"/>
    ${[backWall.top, 560, horizon, backWall.floorY].map((y) => `
      <line x1="${cornerX}" y1="${y}" x2="1200" y2="${rayY(y, 1200)}"
        stroke="${colors.guide}" stroke-width="2.5" stroke-dasharray="10 8"/>
    `).join('')}
    ${horizonSvg(horizon)}
    <line x1="${cornerX}" y1="150" x2="${cornerX}" y2="1250"
      stroke="${colors.outline}" stroke-width="5"/>
    <text x="${cornerX - 210}" y="180" font-size="22"
      fill="${colors.outline}">corner x=${cornerX} · VP(${vp[0]},${vp[1]})</text>
    ${sockets.map(socketSvg).join('')}
    ${souvenirAnchors.map(anchorSvg).join('')}
    ${anchorSvg(treatAnchor)}
    ${catZones.map((zone) => zoneSvg(zone)).join('')}
    ${exclusionZones.map((zone) => zoneSvg(zone, colors.exclusion)).join('')}
    <text x="24" y="46" font-size="30" fill="#4f493f">A · 清润鼠尾草 · HomeForm control v01 · 1200×1600</text>
    <text x="24" y="80" font-size="20" fill="#6f6658">后墙：窗 + 三轨六卡（frontal）；右墙：藤面柜 + plant socket；z: shell→rear pieces→cat→dynamic→occlusion→lighting</text>
  `)

  return {
    key: 'a-clear-sage',
    title: 'A · 清润鼠尾草',
    svg,
    manifest: {
      formId: 'clear-sage',
      approvedDirection: 'bravecat-home-theme-a--clear-sage--concept-v01.png',
      canvas: { width, height },
      camera: { type: 'one-point', horizonY: horizon, vanishingPoint: vp },
      walls: { backWall, rightWall: { cornerX, nearX: 1200 } },
      windowAperture: window,
      postcardSlots: slots.map((quad) => ({ quad })),
      rails: rows.map(({ rail }) => ({ x: 615, y: rail, width: 305 })),
      cabinetFrontQuad: cabinetQuad,
      sockets,
      souvenirAnchors,
      treatAnchor,
      catZones,
      exclusionZones,
      zBands: ['shell', 'rear-pieces', 'cat', 'dynamic-content', 'piece-occlusion', 'lighting'],
    },
  }
}

/* ------------------------------------------------------------------ */
/* B · 暖胡桃旅行画廊：大窗独占后墙，宽右墙承载六卡与矮柜             */
/* ------------------------------------------------------------------ */
const buildFormB = () => {
  const horizon = 880
  const vp = [150, horizon]
  const cornerX = 690
  const backWall = { left: 60, top: 230, right: cornerX, floorY: 1080 }
  const rayY = (yAtCorner, x) => round1(
    horizon + (yAtCorner - horizon) * (x - vp[0]) / (cornerX - vp[0]),
  )
  const window = { x: 95, y: 270, width: 560, height: 635, sillY: 905 }
  // 右墙 2×3：列为墙面深度（x 越大越近），行高随射线投影。
  const columns = [[720, 845], [885, 1035]]
  const rows = [
    { top: 470, bottom: 565, rail: 572 },
    { top: 610, bottom: 705, rail: 712 },
    { top: 750, bottom: 845, rail: 852 },
  ]
  const slots = rows.flatMap(({ top, bottom }) => columns.map(([l, r]) => [
    [l, rayY(top, l)], [r, rayY(top, r)], [r, rayY(bottom, r)], [l, rayY(bottom, l)],
  ]))
  const railQuads = rows.map(({ rail }) => [
    [705, rayY(rail, 705)], [1050, rayY(rail, 1050)],
    [1050, rayY(rail + 12, 1050)], [705, rayY(rail + 12, 705)],
  ])
  const sideboard = { farX: 705, nearX: 1145, topAtWall: 900, floorAtWall: backWall.floorY }
  const sideboardQuad = [
    [sideboard.farX, rayY(sideboard.topAtWall, sideboard.farX)],
    [sideboard.nearX, rayY(sideboard.topAtWall, sideboard.nearX)],
    [sideboard.nearX, rayY(sideboard.floorAtWall, sideboard.nearX)],
    [sideboard.farX, rayY(sideboard.floorAtWall, sideboard.farX)],
  ]
  const sockets = [
    { id: 'window-frame', kind: 'window-frame', region: { x: 60, y: 230, width: 640, height: 730 } },
    { id: 'postcard-display', kind: 'postcard-display', region: { x: 705, y: 200, width: 350, height: 665 } },
    { id: 'scratcher', kind: 'scratcher', region: { x: 55, y: 860, width: 210, height: 500 } },
    { id: 'feeding-set', kind: 'feeding-set', region: { x: 300, y: 1140, width: 220, height: 145 } },
    { id: 'cabinet', kind: 'cabinet', region: { x: 700, y: 850, width: 455, height: 420 } },
    { id: 'rug', kind: 'rug', region: { x: 350, y: 1290, width: 660, height: 265 } },
    { id: 'plant', kind: 'plant', region: { x: 1060, y: 738, width: 95, height: 185 } },
  ]
  // 锚点底边落在柜顶沿（rayY(900, x) ≈ 904–909）。
  const souvenirAnchors = [
    { id: 'souvenir-1', x: 760, y: 866, width: 54, height: 46 },
    { id: 'souvenir-2', x: 830, y: 866, width: 56, height: 48 },
    { id: 'souvenir-3', x: 905, y: 867, width: 58, height: 50 },
  ]
  const treatAnchor = { id: 'treat', x: 540, y: 838, width: 105, height: 84 }
  const catZones = [
    { label: 'gaze（深窗台）', polygon: [[110, 700], [420, 700], [420, 960], [110, 960]] },
    { label: 'eat', polygon: [[285, 1100], [535, 1100], [535, 1305], [285, 1305]] },
    { label: 'sleep（rug）', polygon: [[400, 1310], [960, 1310], [960, 1540], [400, 1540]] },
    { label: 'play', polygon: [[70, 1370], [390, 1370], [390, 1580], [70, 1580]] },
  ]
  const exclusionZones = [
    { label: 'plant 独占', polygon: [[1060, 738], [1155, 738], [1155, 923], [1060, 923]] },
  ]

  const svg = svgDoc(`
    <polygon points="${p([[0, 160], [backWall.left, backWall.top],
      [backWall.left, backWall.floorY], [0, 1130]])}"
      fill="${colors.wallShade}" stroke="${colors.outline}" stroke-width="4"/>
    <rect x="${backWall.left}" y="${backWall.top}"
      width="${backWall.right - backWall.left}"
      height="${backWall.floorY - backWall.top}"
      fill="${colors.wall}" stroke="${colors.outline}" stroke-width="4"/>
    <polygon points="${p([[cornerX, backWall.top], [1200, rayY(backWall.top, 1200)],
      [1200, rayY(backWall.floorY, 1200)], [cornerX, backWall.floorY]])}"
      fill="${colors.wallShade}" stroke="${colors.outline}" stroke-width="4"/>
    <polygon points="${p([[0, 1130], [backWall.left, backWall.floorY],
      [cornerX, backWall.floorY], [1200, rayY(backWall.floorY, 1200)],
      [1200, 1600], [0, 1600]])}"
      fill="${colors.floor}" stroke="${colors.outline}" stroke-width="4"/>
    <rect x="${window.x}" y="${window.y}" width="${window.width}"
      height="${window.height}" fill="${colors.glass}"
      stroke="${colors.window}" stroke-width="12"/>
    <rect x="${window.x - 22}" y="${window.sillY}" width="${window.width + 44}"
      height="34" fill="${colors.window}" stroke="${colors.outline}" stroke-width="3"/>
    ${railQuads.map((quad) => `
      <polygon points="${p(quad)}" fill="${colors.rail}"/>
    `).join('')}
    ${slots.map(cardSvg).join('')}
    <polygon points="${p(sideboardQuad)}" fill="#b98a54"
      stroke="${colors.outline}" stroke-width="5"/>
    ${[backWall.top, 560, horizon, backWall.floorY].map((y) => `
      <line x1="${cornerX}" y1="${y}" x2="1200" y2="${rayY(y, 1200)}"
        stroke="${colors.guide}" stroke-width="2.5" stroke-dasharray="10 8"/>
    `).join('')}
    ${horizonSvg(horizon)}
    <line x1="${cornerX}" y1="170" x2="${cornerX}" y2="1260"
      stroke="${colors.outline}" stroke-width="5"/>
    <text x="${cornerX - 250}" y="200" font-size="22"
      fill="${colors.outline}">corner x=${cornerX} · 右墙 VP(${vp[0]},${vp[1]})</text>
    ${sockets.map(socketSvg).join('')}
    ${souvenirAnchors.map(anchorSvg).join('')}
    ${anchorSvg(treatAnchor)}
    ${catZones.map((zone) => zoneSvg(zone)).join('')}
    ${exclusionZones.map((zone) => zoneSvg(zone, colors.exclusion)).join('')}
    <text x="24" y="46" font-size="30" fill="#4f493f">B · 暖胡桃旅行画廊 · HomeForm control v01 · 1200×1600</text>
    <text x="24" y="80" font-size="20" fill="#6f6658">后墙：大窗独占；宽右墙：三轨六卡 + 藤面矮柜；卡与轨收敛右墙 VP；z 序同 A</text>
  `)

  return {
    key: 'b-warm-walnut-gallery',
    title: 'B · 暖胡桃旅行画廊',
    svg,
    manifest: {
      formId: 'warm-walnut-gallery',
      approvedDirection: 'bravecat-home-theme-b-warm-walnut-travel-gallery-v02.png',
      canvas: { width, height },
      camera: {
        type: 'one-point-with-right-wall-vp',
        horizonY: horizon,
        rightWallVanishingPoint: vp,
      },
      walls: { backWall, rightWall: { cornerX, nearX: 1200 } },
      windowAperture: window,
      postcardSlots: slots.map((quad) => ({ quad })),
      rails: railQuads.map((quad) => ({ quad })),
      cabinetFrontQuad: sideboardQuad,
      sockets,
      souvenirAnchors,
      treatAnchor,
      catZones,
      exclusionZones,
      zBands: ['shell', 'rear-pieces', 'cat', 'dynamic-content', 'piece-occlusion', 'lighting'],
    },
  }
}

/* ------------------------------------------------------------------ */
/* F · 月白蓝灰错层：左墙窗（退深）+ 后墙六卡与低柜 + 平台一级台阶    */
/* ------------------------------------------------------------------ */
const buildFormF = () => {
  const horizon = 870
  const vpX = 2600
  const cornerX = 560
  // 左墙横线向画外右灭点退深。
  const wallY = (yAtLeft, x) => round1(
    horizon + (yAtLeft - horizon) * (vpX - x) / vpX,
  )
  const window = {
    xLeft: 40, xRight: 515, topAtLeft: 170, bottomAtLeft: 940,
  }
  const windowQuad = [
    [window.xLeft, wallY(window.topAtLeft, window.xLeft)],
    [window.xRight, wallY(window.topAtLeft, window.xRight)],
    [window.xRight, wallY(window.bottomAtLeft, window.xRight)],
    [window.xLeft, wallY(window.bottomAtLeft, window.xLeft)],
  ]
  // 后墙 frontal 六卡。
  const columns = [[700, 855], [885, 1040]]
  const rows = [
    { top: 300, bottom: 408, rail: 415 },
    { top: 462, bottom: 570, rail: 577 },
    { top: 624, bottom: 732, rail: 739 },
  ]
  const slots = rows.flatMap(({ top, bottom }) => columns.map(([l, r]) => [
    [l, top], [r, top], [r, bottom], [l, bottom],
  ]))
  // 平台顶面（墙基 y=940 到前缘）、台阶面与低层地面。
  const wallBaseY = 940
  const platformFrontEdge = { leftY: 1085, rightY: 1040 }
  const stepBottomEdge = { leftY: 1165, rightY: 1120 }
  const platformTop = [
    [0, wallY(window.bottomAtLeft, 0)], [cornerX, wallBaseY],
    [1200, wallBaseY], [1200, platformFrontEdge.rightY],
    [0, platformFrontEdge.leftY],
  ]
  const cabinet = { x: 640, y: 765, width: 430, height: 245 }
  const sockets = [
    { id: 'window-frame', kind: 'window-frame', region: { x: 20, y: 130, width: 540, height: 880 } },
    { id: 'postcard-display', kind: 'postcard-display', region: { x: 685, y: 280, width: 370, height: 480 } },
    { id: 'cabinet', kind: 'cabinet', region: { x: 625, y: 745, width: 460, height: 290 } },
    { id: 'scratcher', kind: 'scratcher', region: { x: 40, y: 820, width: 220, height: 500 } },
    { id: 'feeding-set', kind: 'feeding-set', region: { x: 285, y: 1160, width: 230, height: 140 } },
    { id: 'rug', kind: 'rug', region: { x: 300, y: 1310, width: 680, height: 260 } },
    { id: 'plant', kind: 'plant', region: { x: 950, y: 640, width: 100, height: 130 } },
  ]
  // 锚点底边落在柜顶沿 y=765。
  const souvenirAnchors = [
    { id: 'souvenir-1', x: 680, y: 723, width: 54, height: 46 },
    { id: 'souvenir-2', x: 748, y: 721, width: 56, height: 48 },
    { id: 'souvenir-3', x: 818, y: 723, width: 54, height: 46 },
  ]
  const treatAnchor = { id: 'treat', x: 300, y: 856, width: 105, height: 84 }
  const catZones = [
    { label: 'gaze（平台窗座）', polygon: [[110, 880], [360, 880], [360, 1075], [110, 1075]] },
    { label: 'eat（低层）', polygon: [[270, 1140], [540, 1140], [540, 1320], [270, 1320]] },
    { label: 'sleep（rug）', polygon: [[350, 1330], [930, 1330], [930, 1550], [350, 1550]] },
    { label: 'play（低层）', polygon: [[40, 1350], [340, 1350], [340, 1580], [40, 1580]] },
  ]
  const exclusionZones = [
    { label: '台阶沿禁放', polygon: [[0, platformFrontEdge.leftY], [1200, platformFrontEdge.rightY], [1200, stepBottomEdge.rightY], [0, stepBottomEdge.leftY]] },
    { label: 'plant 独占', polygon: [[950, 640], [1050, 640], [1050, 770], [950, 770]] },
  ]

  const svg = svgDoc(`
    <polygon points="${p([[0, 60], [cornerX, 200], [cornerX, wallBaseY],
      [0, wallY(window.bottomAtLeft, 0)]])}"
      fill="${colors.wallShade}" stroke="${colors.outline}" stroke-width="4"/>
    <rect x="${cornerX}" y="200" width="${1200 - cornerX}"
      height="${wallBaseY - 200}"
      fill="${colors.wall}" stroke="${colors.outline}" stroke-width="4"/>
    <polygon points="${p(platformTop)}"
      fill="${colors.platform}" stroke="${colors.outline}" stroke-width="4"/>
    <polygon points="${p([[0, platformFrontEdge.leftY], [1200, platformFrontEdge.rightY],
      [1200, stepBottomEdge.rightY], [0, stepBottomEdge.leftY]])}"
      fill="${colors.stepFace}" stroke="${colors.outline}" stroke-width="4"/>
    <polygon points="${p([[0, stepBottomEdge.leftY], [1200, stepBottomEdge.rightY],
      [1200, 1600], [0, 1600]])}"
      fill="${colors.floor}" stroke="${colors.outline}" stroke-width="4"/>
    <polygon points="${p(windowQuad)}" fill="${colors.glass}"
      stroke="${colors.window}" stroke-width="10"/>
    ${rows.map(({ rail }) => `
      <rect x="685" y="${rail}" width="370" height="10" fill="${colors.rail}"/>
    `).join('')}
    ${slots.map(cardSvg).join('')}
    <rect x="${cabinet.x}" y="${cabinet.y}" width="${cabinet.width}"
      height="${cabinet.height}" fill="#d8c8a8"
      stroke="${colors.outline}" stroke-width="5"/>
    ${[window.topAtLeft, window.bottomAtLeft].map((y) => `
      <line x1="0" y1="${wallY(y, 0)}" x2="${cornerX}" y2="${wallY(y, cornerX)}"
        stroke="${colors.guide}" stroke-width="2.5" stroke-dasharray="10 8"/>
    `).join('')}
    ${horizonSvg(horizon)}
    <line x1="${cornerX}" y1="70" x2="${cornerX}" y2="${wallBaseY + 10}"
      stroke="${colors.outline}" stroke-width="5"/>
    <text x="${cornerX + 12}" y="110" font-size="22"
      fill="${colors.outline}">corner x=${cornerX} · 左墙 VP(${vpX},${horizon})</text>
    ${sockets.map(socketSvg).join('')}
    ${souvenirAnchors.map(anchorSvg).join('')}
    ${anchorSvg(treatAnchor)}
    ${catZones.map((zone) => zoneSvg(zone)).join('')}
    ${exclusionZones.map((zone) => zoneSvg(zone, colors.exclusion)).join('')}
    <text x="24" y="40" font-size="30" fill="#4f493f">F · 月白蓝灰错层 · HomeForm control v02 · 1200×1600</text>
    <text x="24" y="1568" font-size="20" fill="#6f6658">左墙：窗（向右退深）；后墙：三轨六卡（frontal）+ 独立低柜（落平台）；一级台阶下到低层生活区；z 序同 A</text>
  `)

  return {
    key: 'f-moonwhite-bluegray',
    title: 'F · 月白蓝灰错层',
    svg,
    manifest: {
      formId: 'moonwhite-bluegray-den',
      approvedDirection: 'home-theme--f-moonwhite-bluegray--candidate-v01.png',
      supersedes: 'home-theme--f-split-level-den--control-v01.png',
      canvas: { width, height },
      camera: {
        type: 'two-point-lite',
        horizonY: horizon,
        leftWallVanishingPoint: [vpX, horizon],
      },
      walls: { leftWall: { nearX: 0, cornerX }, backWall: { left: cornerX, right: 1200, top: 200, floorY: 990 } },
      windowAperture: { quad: windowQuad },
      platform: {
        top: platformTop,
        frontEdge: platformFrontEdge,
        stepBottomEdge,
        stepCount: 1,
      },
      postcardSlots: slots.map((quad) => ({ quad })),
      rails: rows.map(({ rail }) => ({ x: 685, y: rail, width: 370 })),
      cabinetFrontRect: cabinet,
      sockets,
      souvenirAnchors,
      treatAnchor,
      catZones,
      exclusionZones,
      zBands: ['shell', 'rear-pieces', 'cat', 'dynamic-content', 'piece-occlusion', 'lighting'],
    },
  }
}

await mkdir(root, { recursive: true })
for (const build of [buildFormA, buildFormB, buildFormF]) {
  const { key, title, svg, manifest } = build()
  const pngPath = path.join(root, `home-form--${key}--control-v01.png`)
  await sharp(Buffer.from(svg)).png().toFile(pngPath)
  await writeFile(
    path.join(root, `home-form--${key}--geometry-v01.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  console.log(`${title}: ${pngPath}`)
}
