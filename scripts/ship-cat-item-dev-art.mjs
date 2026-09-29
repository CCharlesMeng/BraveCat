/**
 * Copy Phase-1 Cat Item / base-plate assets into public/dev-art/home-theme/.
 * Exact-byte copy for plates and bases; occlusion files already derived.
 * Does NOT set runtimeEligible=true and does NOT write public/assets/.
 *
 * Usage:
 *   node scripts/ship-cat-item-dev-art.mjs
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'

const productionRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/production',
)
const sourcesRoot = path.resolve(
  'docs/art/candidates/home-theme-prototypes/2026-08-13/approved-direction/cat-items/production-sources',
)
const destRoot = path.resolve('apps/web/public/dev-art/home-theme')

const themes = [
  {
    slug: 'a-clear-sage',
    itemTheme: 'a-clear-sage',
  },
  {
    slug: 'b-warm-walnut-gallery',
    itemTheme: 'b-warm-walnut',
  },
  {
    slug: 'f-moonwhite-bluegray',
    itemTheme: 'f-moonwhite-bluegray',
  },
]

const sha256 = async (filePath) => {
  const buf = await readFile(filePath)
  return createHash('sha256').update(buf).digest('hex')
}

const assertSameBytes = async (src, dest) => {
  const [a, b] = await Promise.all([sha256(src), sha256(dest)])
  if (a !== b) throw new Error(`byte mismatch after copy:\n  ${src}\n  ${dest}`)
}

for (const theme of themes) {
  const dest = path.join(destRoot, theme.slug)
  await mkdir(dest, { recursive: true })

  const plateSrc = path.join(
    productionRoot,
    theme.slug,
    'furnished-base-plate--aperture-alpha--candidate-v01.png',
  )
  const maskSrc = path.join(
    productionRoot,
    theme.slug,
    'aperture-mask--furnished-base-plate--candidate-v01.png',
  )
  const copies = [
    [plateSrc, path.join(dest, 'base-plate--aperture-alpha.png')],
    [maskSrc, path.join(dest, 'aperture-mask.png')],
  ]

  for (const item of ['rest-cloud-bed', 'play-soft-tunnel']) {
    const baseSrc = path.join(
      sourcesRoot,
      item,
      theme.itemTheme,
      `cat-item--${item}--${theme.itemTheme}--base--candidate-v01.png`,
    )
    const occSrc = path.join(
      sourcesRoot,
      item,
      theme.itemTheme,
      `cat-item--${item}--${theme.itemTheme}--foreground-occlusion--candidate-v01.png`,
    )
    copies.push(
      [baseSrc, path.join(dest, `cat-item--${item}--base.png`)],
      [occSrc, path.join(dest, `cat-item--${item}--occlusion.png`)],
    )
  }

  for (const [src, out] of copies) {
    await copyFile(src, out)
    await assertSameBytes(src, out)
    console.log(`${theme.slug}: ${path.basename(out)}`)
  }

  // Confirm geometry still says runtimeEligible=false (ship does not flip it).
  const geometry = JSON.parse(await readFile(
    path.join(
      productionRoot,
      theme.slug,
      'geometry--furnished-base-plate--measured-freeze-v02.json',
    ),
    'utf8',
  ))
  if (geometry.runtimeEligible !== false) {
    throw new Error(`${theme.slug}: expected runtimeEligible=false`)
  }
}

console.log('shipped 18 files under apps/web/public/dev-art/home-theme/{a,b,f}/')
