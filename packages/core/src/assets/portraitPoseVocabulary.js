const SUPPORT_ANCHOR = 'support-contact-bottom-center'

/**
 * The complete reusable Portrait pose vocabulary.
 *
 * A Scene must provide the named support surface and, when required, the
 * interaction target in the stated zone. Portrait-contained targets travel
 * with the pose artwork; Scene-provided targets must not be baked into it.
 */
export const PORTRAIT_POSE_VOCABULARY = /** @type {const} */ ([
  {
    id: 'sit',
    baseline: true,
    support: {
      surface: 'compact-horizontal-perch',
      contacts: 'hindquarters-and-front-paws',
      anchor: SUPPORT_ANCHOR,
    },
    interaction: {
      kind: 'none',
      target: 'none',
      source: 'none',
      targetZone: 'none',
    },
  },
  {
    id: 'sleep',
    baseline: true,
    support: {
      surface: 'broad-horizontal-perch',
      contacts: 'torso-head-and-curled-paws',
      anchor: SUPPORT_ANCHOR,
    },
    interaction: {
      kind: 'none',
      target: 'none',
      source: 'none',
      targetZone: 'none',
    },
  },
  {
    id: 'walk',
    baseline: true,
    support: {
      surface: 'continuous-horizontal-path',
      contacts: 'load-bearing-paws',
      anchor: SUPPORT_ANCHOR,
    },
    interaction: {
      kind: 'none',
      target: 'none',
      source: 'none',
      targetZone: 'none',
    },
  },
  {
    id: 'eat',
    baseline: true,
    support: {
      surface: 'horizontal-perch',
      contacts: 'standing-paws',
      anchor: SUPPORT_ANCHOR,
    },
    interaction: {
      kind: 'eat',
      target: 'food-vessel',
      source: 'portrait-contained',
      targetZone: 'below-and-ahead-of-muzzle',
    },
  },
  {
    id: 'play',
    baseline: true,
    support: {
      surface: 'horizontal-perch',
      contacts: 'hind-paws-and-bracing-front-paw',
      anchor: SUPPORT_ANCHOR,
    },
    interaction: {
      kind: 'play',
      target: 'small-toy',
      source: 'portrait-contained',
      targetZone: 'within-front-paw-reach',
    },
  },
  {
    id: 'gaze',
    baseline: true,
    support: {
      surface: 'compact-horizontal-perch',
      contacts: 'hindquarters-and-paws',
      anchor: SUPPORT_ANCHOR,
    },
    interaction: {
      kind: 'observe',
      target: 'distant-view',
      source: 'scene-provided',
      targetZone: 'along-head-and-eye-direction',
    },
  },
  {
    id: 'sniff',
    baseline: false,
    support: {
      surface: 'continuous-horizontal-path',
      contacts: 'standing-paws',
      anchor: SUPPORT_ANCHOR,
    },
    interaction: {
      kind: 'sniff',
      target: 'scent-source',
      source: 'scene-provided',
      targetZone: 'immediately-ahead-of-lowered-nose',
    },
  },
  {
    id: 'reach',
    baseline: false,
    support: {
      surface: 'horizontal-perch-with-front-clearance',
      contacts: 'hind-paws-and-bracing-front-paw',
      anchor: SUPPORT_ANCHOR,
    },
    interaction: {
      kind: 'reach',
      target: 'reachable-scene-feature',
      source: 'scene-provided',
      targetZone: 'ahead-of-raised-front-paw',
    },
  },
  {
    id: 'stretch',
    baseline: false,
    support: {
      surface: 'broad-horizontal-perch',
      contacts: 'extended-front-paws-and-hind-paws',
      anchor: SUPPORT_ANCHOR,
    },
    interaction: {
      kind: 'none',
      target: 'none',
      source: 'none',
      targetZone: 'none',
    },
  },
  {
    id: 'greet',
    baseline: false,
    support: {
      surface: 'compact-horizontal-perch',
      contacts: 'hindquarters-and-supporting-paw',
      anchor: SUPPORT_ANCHOR,
    },
    interaction: {
      kind: 'greet',
      target: 'viewer-or-companion',
      source: 'scene-provided',
      targetZone: 'along-face-and-raised-paw-direction',
    },
  },
])

export const PORTRAIT_POSES = Object.freeze(
  PORTRAIT_POSE_VOCABULARY.map(({ id }) => id),
)

export const BASELINE_PORTRAIT_POSES = Object.freeze(
  PORTRAIT_POSE_VOCABULARY
    .filter(({ baseline }) => baseline)
    .map(({ id }) => id),
)

const portraitPoseSet = new Set(PORTRAIT_POSES)

/**
 * @param {unknown} value
 * @returns {value is (typeof PORTRAIT_POSES)[number]}
 */
export const isPortraitPose = (value) => (
  typeof value === 'string'
  && portraitPoseSet.has(
    /** @type {(typeof PORTRAIT_POSES)[number]} */ (value),
  )
)
