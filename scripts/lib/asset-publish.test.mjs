import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildPublishManifest,
  classifyRuntimeAssets,
  contentTypeFor,
  evaluateHomeDisplayShippingGate,
  evaluateLandmarkShippingGate,
  evaluatePortraitShippingGate,
  homeDisplayAssetsByRuntime,
  landmarkScenesBySrc,
  portraitArtifactsBySrc,
  publishManifestKeys,
} from './asset-publish.mjs'

const clearedRightsDecision = {
  decision: 'cleared-for-shipping',
  shippingEligible: true,
  remainingGates: [],
}

const landmarkManifest = ({ shippingEligible, decisionRecordSha256 }) => ({
  shippingEligible,
  source: {
    rightsReview: {
      decisionRecord: 'docs/art/reviews/landmarks/rights-decision.json',
      decisionRecordSha256,
    },
  },
  review: { shippingApproval: 'approved' },
  remainingGates: [],
  destinations: [
    {
      scenes: [
        { imageSrc: '/scenes/scene-a.webp', sha256: 'hash-a' },
        { imageSrc: '/scenes/scene-b.webp', sha256: 'hash-b' },
      ],
    },
  ],
})

describe('evaluateLandmarkShippingGate', () => {
  it('passes a fully approved manifest', () => {
    const gate = evaluateLandmarkShippingGate({
      manifestName: 'manifest.v9.json',
      manifest: landmarkManifest({ shippingEligible: true, decisionRecordSha256: 'fp' }),
      rightsDecision: clearedRightsDecision,
      rightsDecisionSha256: 'fp',
    })
    assert.equal(gate.eligible, true)
    assert.deepEqual(gate.violations, [])
  })

  it('treats an uncleaned rights decision as a clean exclusion, not a violation', () => {
    const gate = evaluateLandmarkShippingGate({
      manifestName: 'manifest.v9.json',
      manifest: landmarkManifest({ shippingEligible: false, decisionRecordSha256: 'fp' }),
      rightsDecision: { decision: 'review-complete-not-cleared', shippingEligible: false },
      rightsDecisionSha256: 'fp',
    })
    assert.equal(gate.eligible, false)
    assert.deepEqual(gate.violations, [])
    assert.match(gate.reason, /review-complete-not-cleared/)
  })

  it('flags a stale rights decision fingerprint', () => {
    const gate = evaluateLandmarkShippingGate({
      manifestName: 'manifest.v9.json',
      manifest: landmarkManifest({ shippingEligible: false, decisionRecordSha256: 'old' }),
      rightsDecision: clearedRightsDecision,
      rightsDecisionSha256: 'new',
    })
    assert.equal(gate.eligible, false)
    assert.deepEqual(gate.violations, [
      'manifest.v9.json: stale rights decision fingerprint',
    ])
  })

  it('flags shippingEligible without a cleared rights decision', () => {
    const gate = evaluateLandmarkShippingGate({
      manifestName: 'manifest.v9.json',
      manifest: landmarkManifest({ shippingEligible: true, decisionRecordSha256: 'fp' }),
      rightsDecision: { decision: 'review-complete-not-cleared', shippingEligible: false },
      rightsDecisionSha256: 'fp',
    })
    assert.equal(gate.eligible, false)
    assert.deepEqual(gate.violations, [
      'manifest.v9.json: shipping gate is not fully approved',
    ])
  })

  it('flags a manifest without the shippingEligible boolean', () => {
    const gate = evaluateLandmarkShippingGate({
      manifestName: 'manifest.v9.json',
      manifest: { source: {}, destinations: [] },
      rightsDecision: null,
      rightsDecisionSha256: null,
    })
    assert.deepEqual(gate.violations, [
      'manifest.v9.json: missing shippingEligible gate',
    ])
  })
})

const portraitManifest = ({ state = 'approved', artifacts } = {}) => ({
  portrait: {
    status: 'approved',
    poses: { sit: '/portraits/minho/sit.png' },
  },
  production: {
    state,
    validationResult: 'pass',
    artifacts: artifacts ?? { sit: { sha256: 'hash-sit' } },
  },
})

describe('evaluatePortraitShippingGate', () => {
  it('passes an approved portrait with artifact hashes', () => {
    const gate = evaluatePortraitShippingGate({
      manifestName: 'minho/manifest.json',
      manifest: portraitManifest(),
    })
    assert.equal(gate.eligible, true)
    assert.deepEqual(gate.violations, [])
  })

  it('excludes an unapproved portrait without violations', () => {
    const gate = evaluatePortraitShippingGate({
      manifestName: 'minho/manifest.json',
      manifest: portraitManifest({ state: 'pending' }),
    })
    assert.equal(gate.eligible, false)
    assert.deepEqual(gate.violations, [])
  })

  it('flags a pose without an approved artifact hash', () => {
    const gate = evaluatePortraitShippingGate({
      manifestName: 'minho/manifest.json',
      manifest: portraitManifest({ artifacts: {} }),
    })
    assert.deepEqual(gate.violations, [
      'minho/manifest.json: pose "sit" has no approved artifact hash',
    ])
  })
})

describe('evaluateHomeDisplayShippingGate', () => {
  it('requires shippingEligible', () => {
    const gate = evaluateHomeDisplayShippingGate({
      manifestName: 'home-display/manifest.v2.json',
      manifest: { shippingEligible: false, assets: [] },
    })
    assert.equal(gate.eligible, false)
    assert.deepEqual(gate.violations, [])
  })

  it('flags manifest entries without runtime path or hash', () => {
    const gate = evaluateHomeDisplayShippingGate({
      manifestName: 'home-display/manifest.v2.json',
      manifest: { shippingEligible: true, assets: [{ id: 'wall' }] },
    })
    assert.deepEqual(gate.violations, [
      'home-display/manifest.v2.json: asset "wall" lacks runtime path or hash',
    ])
  })
})

const gatesFixture = ({ landmarksEligible = false } = {}) => ({
  landmarks: {
    eligible: landmarksEligible,
    reason: landmarksEligible ? null : 'landmark rights decision is review-complete-not-cleared',
    scenesBySrc: landmarkScenesBySrc(
      landmarkManifest({ shippingEligible: landmarksEligible, decisionRecordSha256: 'fp' }),
    ),
  },
  portraits: {
    eligible: true,
    reason: null,
    posesBySrc: portraitArtifactsBySrc(portraitManifest()),
  },
  homeDisplay: {
    eligible: true,
    reason: null,
    assetsByRuntime: homeDisplayAssetsByRuntime({
      assets: [{ runtime: '/assets/home/wall.png', sha256: 'hash-wall' }],
    }),
    removedRuntimeAssets: new Set(['/assets/home/removed-table.png']),
  },
})

const file = (publicPath, sha256, bytes = 10) => ({ publicPath, sha256, bytes })

describe('classifyRuntimeAssets', () => {
  it('excludes scenes while the landmark gate is closed', () => {
    const [scene] = classifyRuntimeAssets({
      files: [file('/scenes/scene-a.webp', 'hash-a')],
      gates: gatesFixture(),
    })
    assert.equal(scene.verdict, 'exclude')
    assert.match(scene.reason, /review-complete-not-cleared/)
  })

  it('publishes approved scenes once the landmark gate opens', () => {
    const [scene] = classifyRuntimeAssets({
      files: [file('/scenes/scene-a.webp', 'hash-a')],
      gates: gatesFixture({ landmarksEligible: true }),
    })
    assert.equal(scene.verdict, 'publish')
    assert.equal(scene.gate, 'landmark-production-manifest')
  })

  it('rejects a scene that is not in the production manifest', () => {
    const [scene] = classifyRuntimeAssets({
      files: [file('/scenes/rogue.webp', 'hash-x')],
      gates: gatesFixture({ landmarksEligible: true }),
    })
    assert.equal(scene.verdict, 'reject')
    assert.equal(scene.reason, 'not listed in the landmark production manifest')
  })

  it('rejects a scene whose bytes differ from the approved hash', () => {
    const [scene] = classifyRuntimeAssets({
      files: [file('/scenes/scene-a.webp', 'tampered')],
      gates: gatesFixture({ landmarksEligible: true }),
    })
    assert.equal(scene.verdict, 'reject')
    assert.equal(scene.reason, 'content hash differs from the approved landmark manifest')
  })

  it('publishes approved portraits and rejects unknown or tampered ones', () => {
    const [approved, unknown, tampered] = classifyRuntimeAssets({
      files: [
        file('/portraits/minho/sit.png', 'hash-sit'),
        file('/portraits/minho/rogue.png', 'hash-x'),
        file('/portraits/minho/sit.png', 'tampered'),
      ],
      gates: gatesFixture(),
    })
    assert.equal(approved.verdict, 'publish')
    assert.equal(unknown.verdict, 'reject')
    assert.equal(unknown.reason, 'not an approved portrait artifact')
    assert.equal(tampered.verdict, 'reject')
  })

  it('rejects a removed runtime asset that reappears', () => {
    const [removed] = classifyRuntimeAssets({
      files: [file('/assets/home/removed-table.png', 'hash-x')],
      gates: gatesFixture(),
    })
    assert.equal(removed.verdict, 'reject')
    assert.equal(removed.reason, 'removed runtime asset must not be republished')
  })

  it('verifies home display assets against their approved hash', () => {
    const [approved, tampered] = classifyRuntimeAssets({
      files: [
        file('/assets/home/wall.png', 'hash-wall'),
        file('/assets/home/wall.png', 'tampered'),
      ],
      gates: gatesFixture(),
    })
    assert.equal(approved.verdict, 'publish')
    assert.equal(approved.gate, 'home-display-production-manifest')
    assert.equal(tampered.verdict, 'reject')
  })

  it('publishes baseline UI assets that predate the gate manifests', () => {
    const [glyph] = classifyRuntimeAssets({
      files: [file('/assets/glyphs/close.svg', 'hash-glyph')],
      gates: gatesFixture(),
    })
    assert.equal(glyph.verdict, 'publish')
    assert.equal(glyph.gate, 'baseline-ui')
  })

  it('rejects files outside the publishable categories', () => {
    const [devArt] = classifyRuntimeAssets({
      files: [file('/dev-art/preview.png', 'hash-x')],
      gates: gatesFixture(),
    })
    assert.equal(devArt.verdict, 'reject')
  })
})

describe('buildPublishManifest', () => {
  const classified = [
    {
      publicPath: '/portraits/minho/sit.png',
      sha256: 'hash-sit',
      bytes: 300,
      verdict: 'publish',
      gate: 'portrait-production-manifest',
      reason: null,
    },
    {
      publicPath: '/assets/glyphs/close.svg',
      sha256: 'hash-glyph',
      bytes: 100,
      verdict: 'publish',
      gate: 'baseline-ui',
      reason: null,
    },
    {
      publicPath: '/scenes/scene-a.webp',
      sha256: 'hash-a',
      bytes: 500,
      verdict: 'exclude',
      gate: 'landmark-production-manifest',
      reason: 'landmark rights decision is review-complete-not-cleared',
    },
  ]

  const build = () => buildPublishManifest({
    classified,
    cdnBaseUrl: 'https://cdn.example.com',
    keyPrefix: 'prod/',
    generatedAt: '2026-08-13T00:00:00.000Z',
    gates: { landmarks: { eligible: false } },
  })

  it('lists published assets sorted by path with keys, hashes and content types', () => {
    const manifest = build()
    assert.equal(manifest.assetCount, 2)
    assert.equal(manifest.totalBytes, 400)
    assert.deepEqual(manifest.assets.map(({ path: p }) => p), [
      '/assets/glyphs/close.svg',
      '/portraits/minho/sit.png',
    ])
    assert.deepEqual(manifest.assets[0], {
      path: '/assets/glyphs/close.svg',
      key: 'prod/assets/glyphs/close.svg',
      sha256: 'hash-glyph',
      bytes: 100,
      contentType: 'image/svg+xml',
      gate: 'baseline-ui',
    })
  })

  it('records exclusions with their gate reasons', () => {
    const manifest = build()
    assert.deepEqual(manifest.excluded, [
      {
        path: '/scenes/scene-a.webp',
        reason: 'landmark rights decision is review-complete-not-cleared',
      },
    ])
  })

  it('derives a deterministic content hash that tracks asset changes', () => {
    const manifest = build()
    assert.equal(manifest.contentHash, build().contentHash)
    const changed = buildPublishManifest({
      classified: [
        { ...classified[0], sha256: 'different' },
        classified[1],
        classified[2],
      ],
      cdnBaseUrl: 'https://cdn.example.com',
      keyPrefix: 'prod/',
      generatedAt: '2026-08-13T00:00:00.000Z',
      gates: {},
    })
    assert.notEqual(changed.contentHash, manifest.contentHash)
  })

  it('names remote manifest keys from the content hash', () => {
    const keys = publishManifestKeys({ contentHash: 'abcdef0123456789', keyPrefix: 'prod/' })
    assert.deepEqual(keys, {
      versioned: 'prod/manifests/assets.abcdef012345.json',
      latest: 'prod/manifests/assets.latest.json',
    })
  })
})

describe('contentTypeFor', () => {
  it('maps runtime asset extensions', () => {
    assert.equal(contentTypeFor('/scenes/a.webp'), 'image/webp')
    assert.equal(contentTypeFor('/portraits/a.png'), 'image/png')
    assert.equal(contentTypeFor('/assets/glyphs/a.svg'), 'image/svg+xml')
    assert.equal(contentTypeFor('/assets/unknown.bin'), 'application/octet-stream')
  })
})
