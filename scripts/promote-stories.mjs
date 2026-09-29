import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
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
if (approval.decision !== 'approved') throw new Error('Story sources are not approved')
const artifacts = []
for (const story of ['night-watch-stargazing', 'mist-harbor-returning-boats']) {
  const sourceRoot = `docs/art/candidates/cinematic-v6/${story}/selected-four-act-v01`
  const files = (await readdir(path.join(root, sourceRoot))).filter((file) => /^scene-0[1-4]-.*\.png$/.test(file)).sort()
  if (files.length !== 4) throw new Error(`${story}: expected four acts`)
  for (const file of files) {
    const source = `${sourceRoot}/${file}`
    const bytes = await readFile(path.join(root, source))
    const sourceSha256 = hash(bytes)
    if (!approval.entries.some((entry) => entry.source === 'main' && entry.path === source && entry.sha256 === sourceSha256)) throw new Error(`Approval bytes mismatch: ${source}`)
    // Fit the whole approved frame without cropping or redrawing. Footer is rendered by the client.
    const output = await sharp(bytes).rotate().resize(1200, 660, { fit: 'contain', background: '#f8efd8' }).toColourspace('srgb').webp({ quality: 90 }).toBuffer()
    const src = `/stories/${story}/v1/${file.replace('.png', '.webp')}`
    const target = path.join(root, 'apps/web/public', src)
    if (check) {
      if (hash(await readFile(target)) !== hash(output)) throw new Error(`Stale story asset: ${src}`)
    } else {
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, output)
    }
    artifacts.push({ storyId: story, source, sourceSha256, src, sha256: hash(output), width: 1200, height: 660 })
  }
}
const manifest = JSON.stringify({ schemaVersion: 1, contentVersion: '1', shippingEligible: true, approval: { path: approvalPath, sha256: hash(approvalBytes) }, transformation: 'sRGB, contain 1200x660 on ivory, WebP quality 90; no crop or redraw', artifacts }, null, 2) + '\n'
const manifestPath = path.join(root, 'docs/art/production/stories/manifest.v1.json')
if (check) {
  if (await readFile(manifestPath, 'utf8') !== manifest) throw new Error('Stale story manifest')
} else {
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, manifest)
}
console.log(`Story promotion ${check ? 'verified' : 'written'}: ${artifacts.length} approved frames`)
