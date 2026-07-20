import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url))
const productionManifestRoot = path.join(
  repositoryRoot,
  'docs/art/production/landmarks',
)
const productionManifestFiles = readdirSync(productionManifestRoot)
  .map((filename) => ({
    filename,
    version: Number(filename.match(/^manifest\.v(\d+)\.json$/)?.[1] ?? -1),
  }))
  .filter(({ version }) => version >= 0)
  .sort((left, right) => right.version - left.version)

if (productionManifestFiles.length === 0) {
  throw new Error('No landmark production manifest is available')
}

const currentProductionManifest = productionManifestFiles[0]
const productionManifest = JSON.parse(
  readFileSync(
    path.join(productionManifestRoot, currentProductionManifest.filename),
    'utf8',
  ),
  ) as {
    shippingEligible?: boolean
    scope?: { activeSceneVariantCount?: number }
    source?: {
      rightsReview?: {
        decisionRecord?: string
        decisionRecordSha256?: string
      }
    }
    review?: { shippingApproval?: string }
    remainingGates?: readonly string[]
  }
const rightsDecisionPath =
  productionManifest.source?.rightsReview?.decisionRecord
let rightsDecision: {
  decision?: string
  shippingEligible?: boolean
  remainingGates?: readonly string[]
} | null = null
if (rightsDecisionPath) {
  const rightsDecisionContents = readFileSync(
    path.join(repositoryRoot, rightsDecisionPath),
  )
  rightsDecision = JSON.parse(rightsDecisionContents.toString('utf8'))
  const rightsDecisionSha256 = createHash('sha256')
    .update(rightsDecisionContents)
    .digest('hex')
  if (
    productionManifest.source?.rightsReview?.decisionRecordSha256
      !== rightsDecisionSha256
  ) {
    throw new Error(
      `${currentProductionManifest.filename}: stale rights decision fingerprint`,
    )
  }
}
const configuredLandmarkSceneCacheEntries =
  productionManifest.scope?.activeSceneVariantCount

if (
  !Number.isInteger(configuredLandmarkSceneCacheEntries)
  || configuredLandmarkSceneCacheEntries! <= 0
) {
  throw new Error(
    `${currentProductionManifest.filename}: invalid activeSceneVariantCount`,
  )
}
if (typeof productionManifest.shippingEligible !== 'boolean') {
  throw new Error(
    `${currentProductionManifest.filename}: missing shippingEligible gate`,
  )
}
if (
  productionManifest.shippingEligible
  && (
    rightsDecision?.shippingEligible !== true
    || rightsDecision?.decision !== 'cleared-for-shipping'
    || (rightsDecision?.remainingGates?.length ?? 0) > 0
    || productionManifest.review?.shippingApproval !== 'approved'
    || (productionManifest.remainingGates?.length ?? 0) > 0
  )
) {
  throw new Error(
    `${currentProductionManifest.filename}: shipping gate is not fully approved`,
  )
}
const landmarkSceneCacheEntries = configuredLandmarkSceneCacheEntries as number

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '咪游记',
        short_name: '咪游记',
        description: '为小猫备好行囊，等它从远方寄回一张明信片。',
        lang: 'zh-CN',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f0df',
        theme_color: '#879b70',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        globIgnores: ['scenes/**'],
        runtimeCaching: productionManifest.shippingEligible
          ? [
              {
                urlPattern: /\/scenes\/.*\.webp$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: `bravecat-landmark-scenes-v${currentProductionManifest.version}`,
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                  expiration: {
                    maxEntries: landmarkSceneCacheEntries,
                    maxAgeSeconds: 60 * 60 * 24 * 365,
                    purgeOnQuotaError: true,
                  },
                },
              },
            ]
          : [],
      },
    }),
    {
      name: 'strip-non-shipping-landmark-scenes',
      apply: 'build',
      closeBundle() {
        if (!productionManifest.shippingEligible) {
          rmSync(path.join(repositoryRoot, 'dist/scenes'), {
            recursive: true,
            force: true,
          })
        }
      },
    },
  ],
})
