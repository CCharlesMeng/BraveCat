/**
 * 全件穿戴 QA：每套 form 把当前已产出的候选部件按 z 序合成到
 * clean shell 上（窗外景（江湾 v03，1.10 倍率居中）→ shell →
 * window-frame → postcard 轨/框 → scratcher → feeding-set），
 * 输出一张整房审阅图。仅证据用途，不是 runtime 合成器。
 *
 * Usage:
 *   node scripts/build-dressed-room-qa.mjs
 */
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const width = 1200
const height = 1600
const scale = 1.1
const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)
const exteriorMaster = path.resolve(
  'docs/art/candidates/home-exteriors/approved-direction-2026-08-13/masters',
  'ext-riverbend-embankment--master--noon-clear--candidate-v03.png',
)

const PIECE_ORDER = [
  'piece--window-frame--candidate-v01.png',
  'piece--postcard-display-rails--candidate-v01.png',
  'piece--postcard-display-frames-foreground--candidate-v01.png',
  'piece--scratcher--candidate-v01.png',
  'piece--feeding-set--candidate-v01.png',
]

const exterior = await sharp(exteriorMaster)
  .resize(Math.round(width * scale), Math.round(height * scale))
  .extract({
    left: Math.round((width * scale - width) / 2),
    top: Math.round((height * scale - height) / 2),
    width,
    height,
  })
  .png()
  .toBuffer()

for (const slug of ['a-clear-sage', 'b-warm-walnut-gallery', 'f-moonwhite-bluegray']) {
  const layers = [
    { input: path.join(productionRoot, slug, 'shell--aperture-alpha--candidate-v01.png') },
  ]
  for (const piece of PIECE_ORDER) {
    const piecePath = path.join(productionRoot, slug, piece)
    try {
      await access(piecePath)
      layers.push({ input: await readFile(piecePath) })
    } catch {
      // 该 form 尚未产出这件部件，跳过。
    }
  }
  await sharp(exterior)
    .composite(layers)
    .png()
    .toFile(path.join(productionRoot, slug, 'qa--dressed-room--v01.png'))
  console.log(`${slug}: dressed-room QA written (${layers.length - 1} pieces)`)
}
