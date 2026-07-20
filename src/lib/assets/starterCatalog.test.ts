import { describe, expect, it } from 'vitest'
import type { SceneVariant } from './index'
import {
  LANDMARK_SCENES_SHIPPING_ELIGIBLE,
  STARTER_CATALOG,
} from './starterCatalog'

describe('promoted landmark catalog', () => {
  it('references all visually approved runtime scenes', () => {
    const scenes = STARTER_CATALOG.destinations.reduce<SceneVariant[]>(
      (allScenes, destination) => [
        ...allScenes,
        ...destination.sceneVariants,
      ],
      [],
    )

    expect(STARTER_CATALOG.destinations.length).toBeGreaterThan(0)
    expect(scenes.length).toBeGreaterThanOrEqual(
      STARTER_CATALOG.destinations.length * 2,
    )
    expect(new Set(scenes.map(({ id }) => id)).size).toBe(scenes.length)

    for (const scene of scenes) {
      expect(scene.id).not.toMatch(/--v\d{2}$/)
      expect(scene.imageSrc).toMatch(
        /^\/scenes\/scene--.+--v\d{2}\.webp$/,
      )
    }
  })

  it('keeps runtime scenes behind the unresolved rights gate', () => {
    expect(LANDMARK_SCENES_SHIPPING_ELIGIBLE).toBe(false)
  })
})
