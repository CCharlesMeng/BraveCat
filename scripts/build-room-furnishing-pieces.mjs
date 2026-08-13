/**
 * A/B/F cabinet / rug / plant 部件装配（还原修复轮，件序第 4~6 件）：
 *
 * 绿幕素材键控 → 裁边 → 等比缩放进 geometry v02 的对应 socket region →
 * 落地件垫接触阴影 → 输出透明部件与 QA 合成，并把绿幕原稿归档进
 * production/<slug>/。
 *
 * 说明：A/B 柜体素材自带 3/4 视角，因此不做 cabinetFrontQuad 的
 * 二次透视 warp，直接按 region 底边对齐放置。右墙件要求侧板朝右、
 * 顶面向左上（VP 方向）收：A 原稿与 B v02 斗柜原稿均满足，无需翻转
 * （B v01 长矮柜需翻转，已被 v02 高身斗柜取代）。
 * 植物底部锚到装配后的实际柜顶（冻结几何的柜顶假设偏高），
 * 放置结果写进 placement--furnishings--v01.json 供后续 QA 复用。
 *
 * 布局调优轮（对照签收效果图）：rug/plant 的 socket region 尺寸与
 * 效果图差距过大（rug 占地约 65–74% 画宽、plant 约 15% 画高），
 * 以 LAYOUT_TUNING 内的调优 box 覆盖冻结 region；rug 允许 fill
 * 拉伸到目标椭圆比。调优数值是 v03 几何冻结的输入。
 *
 * Usage:
 *   node scripts/build-room-furnishing-pieces.mjs
 */
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  keyedPng, contactShadowSvg, loadGeometry, resolveShell,
} from './lib/piece-utils.mjs'

const width = 1200
const height = 1600
const stagingRoot = '/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets'
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)

/**
 * align:
 *   bottom — 底边中点贴 region 底边（落地/置物件）
 *   center — 区域内几何居中（地毯这类平铺件）
 * shadow — 相对已放置尺寸的接触阴影参数；地毯本身平贴地面不投影。
 */
const PIECES = [
  { kind: 'cabinet', align: 'bottom', shadow: { rxFactor: 0.52, ry: 26, dy: 4, opacity: 0.3 } },
  { kind: 'rug', align: 'center', shadow: null },
  { kind: 'plant', align: 'bottom', shadow: { rxFactor: 0.3, ry: 10, dy: 2, opacity: 0.28 } },
]

const SOURCES = {
  'a-clear-sage': {
    cabinet: { file: 'cabinet-a-rattan-greenscreen-v01.png' },
    rug: { file: 'rug-a-sage-greenscreen-v01.png' },
    plant: { file: 'plant-a-celadon-greenscreen-v01.png' },
  },
  'b-warm-walnut-gallery': {
    cabinet: { file: 'cabinet-b-walnut-dresser-greenscreen-v02.png', archiveVersion: 'v02' },
    rug: { file: 'rug-b-jute-greenscreen-v01.png' },
    plant: { file: 'plant-b-terracotta-greenscreen-v01.png' },
  },
  'f-moonwhite-bluegray': {
    cabinet: { file: 'cabinet-f-oak-greenscreen-v01.png' },
    rug: { file: 'rug-f-bluegrey-greenscreen-v01.png' },
    plant: { file: 'plant-f-moonwhite-greenscreen-v01.png' },
  },
}

/** 布局调优 box：覆盖冻结 socket region；rug 用 fill 拉到目标椭圆比。 */
const LAYOUT_TUNING = {
  'a-clear-sage': {
    /* 柜体放大并下移落地：概念稿柜子更靠前、底边约 y1290，
       原 region 底边 1225 使柜体读成壁挂。 */
    cabinet: { x: 920, y: 960, width: 270, height: 330 },
    rug: { x: 180, y: 1270, width: 840, height: 310, fit: 'fill' },
    plant: { x: 1040, y: 600, width: 140, height: 280 },
  },
  'b-warm-walnut-gallery': {
    /* 斗柜放大并下移到概念稿位置（底边 ~1300、右缘贴画布边）；
       plant 让出右下 postcard 框（slot 右缘 x1105），贴斗柜右端。 */
    cabinet: { x: 800, y: 920, width: 400, height: 380 },
    rug: { x: 210, y: 1290, width: 780, height: 300, fit: 'fill' },
    plant: { x: 1085, y: 600, width: 110, height: 230 },
  },
  'f-moonwhite-bluegray': {
    rug: { x: 200, y: 1240, width: 800, height: 330, fit: 'fill' },
    plant: { x: 950, y: 600, width: 130, height: 240 },
  },
}

for (const [slug, sources] of Object.entries(SOURCES)) {
  const geometry = await loadGeometry(productionRoot, slug)
  const qaLayers = []
  const qaOutlines = []
  const placements = {}

  for (const { kind, align, shadow } of PIECES) {
    const { file, flop, archiveVersion = 'v01' } = sources[kind]
    const region = LAYOUT_TUNING[slug]?.[kind]
      ?? geometry.sockets.find(({ id }) => id === kind).region

    await copyFile(
      path.join(stagingRoot, file),
      path.join(productionRoot, slug, `source--${kind}--imagegen-${archiveVersion}.png`),
    )

    let keyed = await keyedPng(path.join(stagingRoot, file))
    if (flop) keyed = await sharp(keyed).flop().png().toBuffer()
    const trimmed = await sharp(keyed).trim({ threshold: 10 }).png().toBuffer()
    const meta = await sharp(trimmed).metadata()
    const scale = Math.min(region.width / meta.width, region.height / meta.height)
    const scaledWidth = region.fit === 'fill' ? region.width : Math.round(meta.width * scale)
    const scaledHeight = region.fit === 'fill' ? region.height : Math.round(meta.height * scale)
    const left = Math.round(region.x + (region.width - scaledWidth) / 2)
    let top = align === 'bottom'
      ? region.y + region.height - scaledHeight
      : Math.round(region.y + (region.height - scaledHeight) / 2)
    /* 植物坐在柜顶：底部压进装配后柜顶面 14px，而非冻结 region 底边。 */
    if (kind === 'plant' && placements.cabinet) {
      top = placements.cabinet.top + 14 - scaledHeight
    }

    const layers = []
    if (shadow) {
      layers.push({
        input: contactShadowSvg({
          canvasWidth: width,
          canvasHeight: height,
          cx: left + scaledWidth / 2,
          cy: top + scaledHeight + shadow.dy,
          rx: Math.round(scaledWidth * shadow.rxFactor),
          ry: shadow.ry,
          opacity: shadow.opacity,
        }),
      })
    }
    layers.push({
      input: await sharp(trimmed).resize(scaledWidth, scaledHeight, { fit: 'fill' }).png().toBuffer(),
      left,
      top,
    })

    const piecePath = path.join(productionRoot, slug, `piece--${kind}--candidate-v01.png`)
    await sharp({
      create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite(layers)
      .png()
      .toFile(piecePath)

    placements[kind] = { left, top, width: scaledWidth, height: scaledHeight }
    qaLayers.push({ input: await readFile(piecePath) })
    qaOutlines.push(`<rect x="${region.x}" y="${region.y}" width="${region.width}"
      height="${region.height}" fill="none" stroke="#7a5a8a"
      stroke-width="4" stroke-dasharray="12 8"/>`)
    console.log(`${slug}: ${kind} piece written (${scaledWidth}x${scaledHeight} @ ${left},${top})`)
  }

  await writeFile(
    path.join(productionRoot, slug, 'placement--furnishings--v01.json'),
    `${JSON.stringify(placements, null, 2)}\n`,
  )

  const outline = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${qaOutlines.join('\n  ')}
</svg>
  `)
  await sharp(await resolveShell(productionRoot, slug))
    .flatten({ background: '#9fc2d8' })
    .composite([...qaLayers, { input: outline }])
    .png()
    .toFile(path.join(productionRoot, slug, 'qa--piece-furnishings--v01.png'))
  console.log(`${slug}: furnishings QA written`)
}
