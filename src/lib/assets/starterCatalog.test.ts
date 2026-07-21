import { describe, expect, it } from 'vitest'
import type { SceneVariant } from './index'
import { DEV_LATEST_ART_METADATA } from './devLatestArtCatalog.generated'
import {
  DEVELOPMENT_LATEST_ART_CATALOG,
  LANDMARK_SCENES_SHIPPING_ELIGIBLE,
  PRODUCTION_STARTER_CATALOG,
  STARTER_CATALOG,
  USE_DEVELOPMENT_LATEST_ART,
} from './starterCatalog'

describe('landmark runtime catalogs', () => {
  it('uses the exact 76-scene v5 and ten-pose watercolor preview in development', () => {
    const scenes = DEVELOPMENT_LATEST_ART_CATALOG!.destinations
      .reduce<SceneVariant[]>(
        (allScenes, destination) => [
          ...allScenes,
          ...destination.sceneVariants,
        ],
        [],
      )

    expect(DEVELOPMENT_LATEST_ART_CATALOG!.destinations).toHaveLength(25)
    expect(scenes).toHaveLength(76)
    expect(new Set(scenes.map(({ id }) => id)).size).toBe(76)
    expect(scenes.every(({ imageSrc }) => (
      imageSrc.startsWith('/dev-art/latest-v5/scenes/')
      && imageSrc.endsWith('.webp')
    ))).toBe(true)
    expect(
      Object.keys(DEVELOPMENT_LATEST_ART_CATALOG!.portraits[0].poses),
    ).toHaveLength(10)
    expect(
      [...new Set(scenes.map(
        ({ compositionSlot }) => compositionSlot.pose,
      ))].sort(),
    ).toEqual(DEV_LATEST_ART_METADATA.compositeQa.selectableScenePoseIds)
    expect(scenes.some(({ compositionSlot }) => (
      new Set<string>(
        DEV_LATEST_ART_METADATA.compositeQa.pendingDedicatedScenePoseIds,
      ).has(compositionSlot.pose)
    ))).toBe(false)
  })

  it('keeps the production catalog independent from development candidates', () => {
    const scenes = PRODUCTION_STARTER_CATALOG.destinations
      .reduce<SceneVariant[]>(
        (allScenes, destination) => [
          ...allScenes,
          ...destination.sceneVariants,
        ],
        [],
      )

    expect(
      Object.keys(PRODUCTION_STARTER_CATALOG.portraits[0].poses),
    ).toHaveLength(6)
    expect(scenes.every(({ imageSrc }) => (
      imageSrc.startsWith('/scenes/')
      && !imageSrc.includes('/dev-art/')
    ))).toBe(true)
  })

  it('selects the preview catalog only in development', () => {
    const scenes = STARTER_CATALOG.destinations.reduce<SceneVariant[]>(
      (allScenes, destination) => [
        ...allScenes,
        ...destination.sceneVariants,
      ],
      [],
    )

    expect(STARTER_CATALOG).toBe(
      USE_DEVELOPMENT_LATEST_ART
        ? DEVELOPMENT_LATEST_ART_CATALOG
        : PRODUCTION_STARTER_CATALOG,
    )
    expect(scenes.length).toBe(
      USE_DEVELOPMENT_LATEST_ART ? 76 : 61,
    )
  })

  it('records pending gates without presenting candidate review as production approval', () => {
    expect(LANDMARK_SCENES_SHIPPING_ELIGIBLE).toBe(false)
    expect(DEV_LATEST_ART_METADATA.shippingEligible).toBe(false)
    expect(DEV_LATEST_ART_METADATA.productionPromotion).toBe('not-promoted')
    expect(
      DEV_LATEST_ART_METADATA.landmarkV5.productionApproval,
    ).toBe('not-promoted')
    expect(
      DEV_LATEST_ART_METADATA.minhoWatercolorV2.candidateReview,
    ).toBe('pending-human-review')
    expect(DEV_LATEST_ART_METADATA.compositeQa).toMatchObject({
      status: 'pending-human-review',
      selectableScenePoseIds: ['gaze', 'sit', 'sleep', 'walk'],
      pendingDedicatedScenePoseIds: [
        'eat',
        'greet',
        'play',
        'reach',
        'sniff',
        'stretch',
      ],
    })
    expect(DEV_LATEST_ART_METADATA.cinematic.included).toBe(false)
  })
})
