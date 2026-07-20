import { describe, expect, it } from 'vitest'
import { selectTripContent } from './index'
import type { AssetCatalog } from '../assets'
import type { Itinerary } from '../itinerary'

const catalog: AssetCatalog = {
  destinations: [
    {
      id: 'paris',
      name: '巴黎',
      sceneVariants: [
        {
          id: 'paris-day',
          destinationId: 'paris',
          imageSrc: '/scenes/paris-day.png',
          compositionSlot: {
            x: 0.2,
            y: 0.8,
            scale: 0.3,
            pose: 'gaze',
            flip: false,
          },
          hasCompanion: false,
        },
      ],
    },
  ],
  portraits: [
    {
      id: 'my-cat',
      name: '小猫',
      poses: {
        sit: '/portraits/sit.png',
        sleep: '/portraits/sleep.png',
        walk: '/portraits/walk.png',
        eat: '/portraits/eat.png',
        play: '/portraits/play.png',
        gaze: '/portraits/gaze.png',
      },
    },
  ],
  items: [],
  souvenirs: [],
  copy: {
    postcardNotes: ['风很轻。'],
    travelNotes: ['我出去看看。'],
  },
}

describe('Selection', () => {
  it('只从旅行目的地的素材中选取场景、姿势和文案', () => {
    const itinerary: Itinerary = {
      destinationId: 'paris',
      departsAt: 1_000,
      returnsAt: 3_000,
      postcardSlots: [{ destinationId: 'paris', revealAt: 2_000 }],
      routeKind: 'unwished',
      isDetour: false,
    }

    const content = selectTripContent(
      { itinerary, portraitId: 'my-cat', catalog },
      () => 0,
    )

    expect(content.postcards).toEqual([
      {
        sceneVariantId: 'paris-day',
        portraitId: 'my-cat',
        pose: 'gaze',
        note: '风很轻。',
      },
    ])
  })
})
