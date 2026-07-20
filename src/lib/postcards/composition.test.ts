import { describe, expect, it } from 'vitest'
import type { AssetCatalog } from '../assets'
import type { Itinerary } from '../itinerary'
import { selectTripContent } from '../selection'
import type { ReceivedPostcard } from './index'
import { resolvePostcardComposition } from './index'

const revisedCatalog: AssetCatalog = {
  sceneSetRevision: 'scenes-r2',
  sceneRevisions: {
    'paris-day': 'paris-day-r2',
  },
  portraitSetRevisions: {
    minho: 'portraits-r2',
  },
  destinations: [
    {
      id: 'paris',
      name: '巴黎',
      sceneVariants: [
        {
          id: 'paris-day',
          destinationId: 'paris',
          imageSrc: '/scenes/paris-day-revised.png',
          compositionSlot: {
            x: 0.1,
            y: 0.7,
            scale: 0.2,
            pose: 'sit',
            flip: false,
          },
          hasCompanion: false,
        },
      ],
    },
  ],
  portraits: [
    {
      id: 'minho',
      name: 'Minho',
      poses: {
        sit: '/portraits/minho/sit.png',
        sleep: '/portraits/minho/sleep.png',
        walk: '/portraits/minho/walk.png',
        eat: '/portraits/minho/eat.png',
        play: '/portraits/minho/play.png',
        gaze: '/portraits/minho/gaze-revised.png',
      },
    },
  ],
  items: [],
  souvenirs: [],
  copy: {
    postcardNotes: ['修订后的风很轻。'],
    travelNotes: ['我出门了。'],
  },
}

const originalCatalog: AssetCatalog = {
  ...revisedCatalog,
  sceneSetRevision: 'scenes-r1',
  sceneRevisions: {
    'paris-day': 'paris-day-r1',
  },
  portraitSetRevisions: {
    minho: 'portraits-r1',
  },
  destinations: [{
    ...revisedCatalog.destinations[0],
    sceneVariants: [{
      ...revisedCatalog.destinations[0].sceneVariants[0],
      imageSrc: '/scenes/paris-day.png',
      compositionSlot: {
        x: 0.8,
        y: 0.9,
        scale: 0.3,
        pose: 'gaze',
        flip: true,
      },
    }],
  }],
  portraits: [{
    ...revisedCatalog.portraits[0],
    poses: {
      ...revisedCatalog.portraits[0].poses,
      gaze: '/portraits/minho/gaze.png',
    },
  }],
  copy: {
    ...revisedCatalog.copy,
    postcardNotes: ['风从铁塔旁边绕过去。'],
  },
}

describe('Postcard composition', () => {
  it('素材目录在选取后修订也仍按快照解析原图层、构图和文案', () => {
    const itinerary: Itinerary = {
      destinationId: 'paris',
      departsAt: 1_000,
      returnsAt: 3_000,
      postcardSlots: [{ destinationId: 'paris', revealAt: 2_000 }],
      routeKind: 'unwished',
      isDetour: false,
    }
    const selected = selectTripContent({
      itinerary,
      travelerCatId: 'cat-1',
      portraitId: 'minho',
      catalog: originalCatalog,
    }, () => 0).postcards[0]
    const postcard: ReceivedPostcard = {
      id: 'trip--postcard-1',
      tripId: 'trip',
      destinationId: 'paris',
      revealAt: Date.UTC(2026, 6, 20),
      ...selected,
      isRead: false,
    }

    expect(resolvePostcardComposition(revisedCatalog, postcard)).toEqual({
      scene: {
        src: '/scenes/paris-day.png',
      },
      portrait: {
        src: '/portraits/minho/gaze.png',
        anchorX: 0.8,
        anchorY: 0.9,
        heightScale: 0.3,
        flip: true,
      },
      note: '风从铁塔旁边绕过去。',
      postmarkDate: '2026-07-20',
    })
  })
})
