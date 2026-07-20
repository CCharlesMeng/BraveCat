import { describe, expect, it } from 'vitest'
import type { Itinerary } from '../itinerary'
import type { PostcardRecipe, TripContent } from '../selection'
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

const firstRecipe: PostcardRecipe = {
  recipeVersion: 1,
  travelerCatId: 'minho',
  scene: {
    id: 'paris-day',
    revision: 'scenes-r1',
  },
  portrait: {
    id: 'minho',
    setRevision: 'portraits-r1',
  },
  composition: {
    id: 'paris-day--default',
    x: 0.2,
    y: 0.8,
    scale: 0.3,
    flip: false,
  },
  pose: 'gaze',
  layers: [
    {
      id: 'scene',
      kind: 'scene',
      src: '/scenes/paris-day.png',
    },
    {
      id: 'portrait',
      kind: 'portrait',
      src: '/portraits/minho/gaze.png',
    },
  ],
  copy: {
    id: 'postcard-note-1',
    text: '风从铁塔旁边绕过去。',
  },
}

const secondRecipe: PostcardRecipe = {
  ...firstRecipe,
  scene: {
    id: 'paris-dawn',
    revision: 'scenes-r1',
  },
  composition: {
    ...firstRecipe.composition,
    id: 'paris-dawn--default',
  },
  pose: 'sit',
  layers: [
    {
      id: 'scene',
      kind: 'scene',
      src: '/scenes/paris-dawn.png',
    },
    {
      id: 'portrait',
      kind: 'portrait',
      src: '/portraits/minho/sit.png',
    },
  ],
  copy: {
    id: 'postcard-note-2',
    text: '天亮的时候，桥边很安静。',
  },
}

const content: TripContent = {
  postcards: [
    {
      recipe: firstRecipe,
    },
    {
      recipe: secondRecipe,
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
        recipe: firstRecipe,
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
