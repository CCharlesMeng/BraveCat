import { describe, expect, it } from 'vitest'
import type { Itinerary } from '../itinerary'
import type { TripContent } from '../selection'
import {
  createInitialPostcardState,
  reducePostcards,
} from './index'

const itinerary: Itinerary = {
  destinationId: 'paris',
  departsAt: 1_000,
  returnsAt: 4_000,
  routeKind: 'unwished',
  isDetour: false,
  postcardSlots: [
    { destinationId: 'paris', revealAt: 2_000 },
    { destinationId: 'paris', revealAt: 3_000 },
  ],
}

const content: TripContent = {
  postcards: [
    {
      sceneVariantId: 'paris-day',
      portraitId: 'minho',
      pose: 'gaze',
      note: '风从铁塔旁边绕过去。',
    },
    {
      sceneVariantId: 'paris-dawn',
      portraitId: 'minho',
      pose: 'sit',
      note: '天亮的时候，桥边很安静。',
    },
  ],
  souvenirIds: [],
}

describe('Postcard delivery', () => {
  it('只在预定时刻揭晓，并在刷新式重试时保持幂等', () => {
    const initial = createInitialPostcardState()
    const beforeReveal = reducePostcards(initial, {
      type: 'timePassed',
      now: 1_999,
      tripId: 'minho-1000',
      itinerary,
      content,
    })
    const firstReveal = reducePostcards(beforeReveal, {
      type: 'timePassed',
      now: 2_000,
      tripId: 'minho-1000',
      itinerary,
      content,
    })
    const retried = reducePostcards(firstReveal, {
      type: 'timePassed',
      now: 2_500,
      tripId: 'minho-1000',
      itinerary,
      content,
    })

    expect(beforeReveal).toBe(initial)
    expect(firstReveal.received).toEqual([
      {
        id: 'minho-1000--postcard-1',
        tripId: 'minho-1000',
        destinationId: 'paris',
        revealAt: 2_000,
        sceneVariantId: 'paris-day',
        portraitId: 'minho',
        pose: 'gaze',
        note: '风从铁塔旁边绕过去。',
        isRead: false,
      },
    ])
    expect(retried).toBe(firstReveal)
  })

  it('查看明信片后清除它的未读状态', () => {
    const received = reducePostcards(createInitialPostcardState(), {
      type: 'timePassed',
      now: 2_000,
      tripId: 'minho-1000',
      itinerary,
      content,
    })

    const viewed = reducePostcards(received, {
      type: 'postcardViewed',
      postcardId: 'minho-1000--postcard-1',
    })

    expect(viewed.received[0].isRead).toBe(true)
  })
})
