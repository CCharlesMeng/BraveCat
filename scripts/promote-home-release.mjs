import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')
const approvalPath = 'docs/art/reviews/all-existing-assets-approval-2026-09-29.json'
const approvalBytes = await readFile(path.join(root, approvalPath))
const approval = JSON.parse(approvalBytes)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
if (approval.decision !== 'approved') throw new Error('Home sources are not approved')
const pairs = []
for (const theme of ['a-clear-sage', 'b-warm-walnut-gallery', 'f-moonwhite-bluegray']) {
  for (const file of ['base-plate--aperture-alpha', 'exterior-noon', 'lighting', 'cat-item--rest-cloud-bed--base', 'cat-item--rest-cloud-bed--occlusion', 'cat-item--play-soft-tunnel--base', 'cat-item--play-soft-tunnel--occlusion']) {
    pairs.push([`/dev-art/home-theme/${theme}/${file}.png`, `/home-release/${theme}/${file}.webp`])
  }
}
const feedingCrops = {
  'a-clear-sage': { left: 283, top: 1172, width: 274, height: 103 },
  'b-warm-walnut-gallery': { left: 290, top: 1195, width: 240, height: 100 },
  'f-moonwhite-bluegray': { left: 379, top: 895, width: 252, height: 105 },
}
for (const [theme, crop] of Object.entries(feedingCrops)) {
  pairs.push([`docs/art/candidates/home-theme-prototypes/2026-08-13/production/${theme}/piece--feeding-set--candidate-v01.png`, `/home-release/${theme}/cat-item--feed-daily-bowls--base.webp`, crop])
}
for (const pose of ['sleep', 'play', 'eat', 'gaze']) {
  for (const suffix of ['v03', 'poster--v03']) {
    const file = `cat--minho--${pose}--ambient--${suffix}.webp`
    pairs.push([`/dev-art/home-v4/cat-animations/${file}`, `/home-release/minho/${file}`])
  }
}
const artifacts = []
for (const [sourceSrc, src, crop] of pairs) {
  const source = sourceSrc.startsWith('/') ? `apps/web/public${sourceSrc}` : sourceSrc
  const bytes = await readFile(path.join(root, source))
  const sourceSha256 = hash(bytes)
  if (!approval.entries.some(entry => entry.source === 'main' && entry.path === source && entry.sha256 === sourceSha256)) throw new Error(`Unapproved bytes: ${source}`)
  const pipeline = sharp(bytes)
  const output = source.endsWith('.png') ? await (crop ? pipeline.extract(crop) : pipeline).webp({ lossless: true }).toBuffer() : bytes
  const target = path.join(root, 'apps/web/public', src)
  if (check) {
    if (hash(await readFile(target)) !== hash(output)) throw new Error(`Stale home release: ${src}`)
  } else {
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, output)
  }
  artifacts.push({ source, sourceSha256, src, sha256: hash(output), byteLength: output.length, ...(crop ? { transparentCanvasCrop: crop } : {}) })
}
const manifest = JSON.stringify({ schemaVersion: 1, shippingEligible: true, approval: { path: approvalPath, sha256: hash(approvalBytes) }, transformation: 'lossless PNG to WebP; feeding sets cropped only to nontransparent bounds; approved animations copied byte-for-byte', artifacts }, null, 2) + '\n'
const target = path.join(root, 'docs/art/production/home-release/manifest.v1.json')
if (check) {
  if (await readFile(target, 'utf8') !== manifest) throw new Error('Stale home manifest')
} else {
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, manifest)
}
console.log(`Home release ${check ? 'verified' : 'written'}: ${artifacts.length} approved assets`)
