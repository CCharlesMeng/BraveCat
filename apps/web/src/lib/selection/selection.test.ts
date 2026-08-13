import { describe, expect, it } from 'vitest'
import { selectTripContent } from './index'
import type { AssetCatalog } from '../assets'
import type { Itinerary } from '../itinerary'

const randomFrom = (...values: number[]) => {
  let index = 0
  return () => values[index++] ?? 0
}

const catalog: AssetCatalog = {
  sceneSetRevision: 'scenes-r1',
  sceneRevisions: {
    'paris-day': 'paris-day-r1',
  },
  portraitSetRevisions: {
    'my-cat': 'portraits-r1',
  },
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
    postcardNotes: ['人，咪到{destination}啦。风很轻。'],
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
      {
        itinerary,
        travelerCatId: 'cat-1',
        portraitId: 'my-cat',
        catalog,
      },
      () => 0,
    )

    expect(content.postcards).toEqual([
      {
        recipe: {
          recipeVersion: 1,
          travelerCatId: 'cat-1',
          scene: {
            id: 'paris-day',
            revision: 'paris-day-r1',
          },
          portrait: {
            id: 'my-cat',
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
              src: '/portraits/gaze.png',
            },
          ],
          copy: {
            id: 'postcard-note-1',
            text: '人，咪到巴黎啦。风很轻。',
          },
        },
      },
    ])
  })

  it('同一旅行与近期来信优先使用不同的场景和文案', () => {
    const catalogWithAlternatives: AssetCatalog = {
      ...catalog,
      sceneRevisions: {
        'paris-day': 'paris-day-r1',
        'paris-night': 'paris-night-r1',
        'paris-morning': 'paris-morning-r1',
      },
      destinations: [{
        ...catalog.destinations[0],
        sceneVariants: [
          ...catalog.destinations[0].sceneVariants,
          {
            id: 'paris-night',
            destinationId: 'paris',
            imageSrc: '/scenes/paris-night.png',
            compositionSlot: {
              x: 0.2,
              y: 0.8,
              scale: 0.3,
              pose: 'gaze',
              flip: false,
            },
            hasCompanion: false,
          },
          {
            id: 'paris-morning',
            destinationId: 'paris',
            imageSrc: '/scenes/paris-morning.png',
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
      }],
      copy: {
        ...catalog.copy,
        postcardNotes: [
          catalog.copy.postcardNotes[0],
          '人，咪在{destination}听见了远处的铃声。',
          '人，咪从{destination}捎来一点很轻的风。',
        ],
      },
    }
    const itinerary: Itinerary = {
      destinationId: 'paris',
      departsAt: 1_000,
      returnsAt: 4_000,
      postcardSlots: [
        { destinationId: 'paris', revealAt: 2_000 },
        { destinationId: 'paris', revealAt: 3_000 },
      ],
      routeKind: 'unwished',
      isDetour: false,
    }
    const recentPostcard = selectTripContent({
      itinerary: {
        ...itinerary,
        postcardSlots: [itinerary.postcardSlots[0]],
      },
      travelerCatId: 'cat-1',
      portraitId: 'my-cat',
      catalog: catalogWithAlternatives,
    }, () => 0).postcards[0].recipe

    const content = selectTripContent({
      itinerary,
      travelerCatId: 'cat-1',
      portraitId: 'my-cat',
      catalog: catalogWithAlternatives,
      recentPostcardRecipes: [recentPostcard],
    }, () => 0)

    expect(content.postcards.map(({ recipe }) => recipe.scene.id)).toEqual([
      'paris-night',
      'paris-morning',
    ])
    expect(content.postcards.map(({ recipe }) => recipe.copy.id)).toEqual([
      'postcard-note-2',
      'postcard-note-3',
    ])
  })

  it('按行囊效果提高目标姿势与文案标签的选取权重', () => {
    const weightedCatalog: AssetCatalog = {
      ...catalog,
      sceneRevisions: {
        'paris-gaze': 'paris-gaze-r1',
        'paris-eat': 'paris-eat-r1',
      },
      destinations: [{
        ...catalog.destinations[0],
        sceneVariants: [
          {
            ...catalog.destinations[0].sceneVariants[0],
            id: 'paris-gaze',
          },
          {
            ...catalog.destinations[0].sceneVariants[0],
            id: 'paris-eat',
            compositionSlot: {
              ...catalog.destinations[0].sceneVariants[0].compositionSlot,
              pose: 'eat',
            },
          },
        ],
      }],
      copy: {
        ...catalog.copy,
        postcardNotes: [
          '人，咪在{destination}坐了一会儿。',
          '人，咪在{destination}吃到一口点心。',
        ],
        postcardNoteTags: [[], ['food']],
      },
    }
    const itinerary: Itinerary = {
      destinationId: 'paris',
      departsAt: 1_000,
      returnsAt: 3_000,
      postcardSlots: [{ destinationId: 'paris', revealAt: 2_000 }],
      routeKind: 'unwished',
      isDetour: false,
    }

    const content = selectTripContent({
      itinerary,
      travelerCatId: 'cat-1',
      portraitId: 'my-cat',
      catalog: weightedCatalog,
      packEffects: {
        travelDurationMultiplier: 1,
        secondPostcardChanceBonus: 0,
        companionChanceBonus: 0,
        poseWeights: { gaze: 1.5 },
        copyTagWeights: { food: 1.5 },
      },
    }, randomFrom(0.5, 0.4, 0))

    expect(content.postcards[0].recipe.scene.id).toBe('paris-gaze')
    expect(content.postcards[0].recipe.copy.id).toBe('postcard-note-2')
  })

  it('小铃铛的概率增量可以把边界随机值选到旅伴场景', () => {
    const companionCatalog: AssetCatalog = {
      ...catalog,
      sceneRevisions: {
        'paris-day': 'paris-day-r1',
        'paris-companion': 'paris-companion-r1',
      },
      destinations: [{
        ...catalog.destinations[0],
        sceneVariants: [
          catalog.destinations[0].sceneVariants[0],
          {
            ...catalog.destinations[0].sceneVariants[0],
            id: 'paris-companion',
            hasCompanion: true,
          },
        ],
      }],
    }
    const itinerary: Itinerary = {
      destinationId: 'paris',
      departsAt: 1_000,
      returnsAt: 3_000,
      postcardSlots: [{ destinationId: 'paris', revealAt: 2_000 }],
      routeKind: 'unwished',
      isDetour: false,
    }

    const content = selectTripContent({
      itinerary,
      travelerCatId: 'cat-1',
      portraitId: 'my-cat',
      catalog: companionCatalog,
      packEffects: {
        travelDurationMultiplier: 1,
        secondPostcardChanceBonus: 0,
        companionChanceBonus: 0.1,
        poseWeights: {},
        copyTagWeights: {},
      },
    }, randomFrom(0.15, 0, 0, 0))

    expect(content.postcards[0].recipe.scene.id).toBe('paris-companion')
  })
})
