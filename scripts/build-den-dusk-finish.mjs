/**
 * split-level-den「暮色蓝调」finish 资产：
 *
 * 1. shell--dusk.png：干净底整体调色（压亮度/降饱和 + 靛蓝 multiply），
 *    只改连续表面的材质氛围，不动任何几何。
 * 2. finish-dusk-lighting.png：全时段灯光层（普通 alpha 叠加），以窗为
 *    中心的径向渐变，让部件、猫与动态内容也进入同一暮色。
 *
 * Usage:
 *   node scripts/build-den-dusk-finish.mjs
 */
import path from 'node:path'
import sharp from 'sharp'

const candidateRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/split-level-den',
)
const runtimeRoot = path.resolve('apps/web/public/dev-art/home-theme/split-level-den')
const width = 1200
const height = 1600

// 1. 调色 shell：先整体压暗降饱和，再叠一层靛蓝 multiply。
const duskTint = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#96a4d6"/>
</svg>
`)
const duskShell = await sharp(path.join(runtimeRoot, 'shell.png'))
  .modulate({ brightness: 0.9, saturation: 1.05 })
  .composite([{ input: duskTint, blend: 'multiply' }])
  .modulate({ brightness: 1.12 })
  .png()
  .toBuffer()
await sharp(duskShell).toFile(
  path.join(candidateRoot, 'shell--dusk--candidate-v01.png'),
)
await sharp(duskShell).toFile(path.join(runtimeRoot, 'shell--dusk.png'))

// 2. 灯光层：窗心 (280, 520) 保留暖光，四周渐入靛蓝暮色。
const lightingSvg = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="dusk" cx="0.23" cy="0.33" r="1.1">
      <stop offset="0" stop-color="#3c4570" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#38406b" stop-opacity="0.1"/>
      <stop offset="1" stop-color="#252c4e" stop-opacity="0.3"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#dusk)"/>
</svg>
`)
const lighting = await sharp(lightingSvg).png().toBuffer()
await sharp(lighting).toFile(
  path.join(candidateRoot, 'finish-dusk-lighting--candidate-v01.png'),
)
await sharp(lighting).toFile(path.join(runtimeRoot, 'finish-dusk-lighting.png'))

// 预览：暮色 shell + 默认部件 + 灯光层。
await sharp(duskShell)
  .composite([
    { input: path.join(runtimeRoot, 'piece--scratcher--green-post.png') },
    { input: path.join(runtimeRoot, 'piece--feeding--ceramic-bowls.png') },
    { input: lighting },
  ])
  .png()
  .toFile(path.join(candidateRoot, 'finish-dusk--composite-preview.png'))

console.log('dusk finish assets written')
