import { describe, expect, it } from 'vitest'
import type { AssetCatalog } from '../assets'
import type { ReceivedPostcard } from './index'
import { resolvePostcardComposition } from './index'

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
            x: 0.8,
            y: 0.9,
            scale: 0.3,
            pose: 'gaze',
            flip: true,
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
        gaze: '/portraits/minho/gaze.png',
      },
    },
  ],
  items: [],
  souvenirs: [],
  copy: {
    postcardNotes: ['风很轻。'],
    travelNotes: ['我出门了。'],
  },
}

const postcard: ReceivedPostcard = {
  id: 'trip--postcard-1',
  tripId: 'trip',
  destinationId: 'paris',
  revealAt: Date.UTC(2026, 6, 20),
  sceneVariantId: 'paris-day',
  portraitId: 'minho',
  pose: 'gaze',
  note: '风从铁塔旁边绕过去。',
  isRead: false,
}

describe('Postcard composition', () => {
  it('把场景、正确姿势、构图位、文案和邮戳解析成离线图层', () => {
    expect(resolvePostcardComposition(catalog, postcard)).toEqual({
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
