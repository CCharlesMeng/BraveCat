import { describe, expect, it } from 'vitest'
import {
  defineAssetCatalog,
  PORTRAIT_POSES,
  PORTRAIT_POSE_VOCABULARY,
  type AssetCatalog,
} from './index'
import {
  STARTER_CATALOG,
  STARTER_DESTINATIONS,
} from './starterCatalog'

const validCatalog = (): AssetCatalog => ({
  sceneSetRevision: 'scenes-r1',
  sceneRevisions: {
    'paris-day': 'paris-day-r1',
    'paris-dawn': 'paris-dawn-r1',
  },
  portraitSetRevisions: {
    minho: 'portraits-r1',
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
            y: 0.9,
            scale: 0.3,
            pose: 'gaze',
            flip: false,
          },
          hasCompanion: false,
        },
        {
          id: 'paris-dawn',
          destinationId: 'paris',
          imageSrc: '/scenes/paris-dawn.png',
          compositionSlot: {
            x: 0.8,
            y: 0.9,
            scale: 0.3,
            pose: 'sit',
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
    postcardNotes: ['今天的风很轻。'],
    travelNotes: ['我出去看看。'],
  },
})

describe('AssetCatalog', () => {
  it('以十个姿势及其落脚与互动语义作为唯一词汇', () => {
    expect(PORTRAIT_POSES).toEqual([
      'sit',
      'sleep',
      'walk',
      'eat',
      'play',
      'gaze',
      'sniff',
      'reach',
      'stretch',
      'greet',
    ])
    expect(PORTRAIT_POSE_VOCABULARY).toHaveLength(10)
    expect(PORTRAIT_POSE_VOCABULARY.every(
      ({ support }) => (
        support.anchor === 'support-contact-bottom-center'
        && support.surface.length > 0
        && support.contacts.length > 0
      ),
    )).toBe(true)
    expect(Object.fromEntries(
      PORTRAIT_POSE_VOCABULARY.map(({ id, interaction }) => [
        id,
        interaction.source,
      ]),
    )).toMatchObject({
      eat: 'portrait-contained',
      play: 'portrait-contained',
      gaze: 'scene-provided',
      sniff: 'scene-provided',
      reach: 'scene-provided',
      greet: 'scene-provided',
    })
  })

  it('拒绝缺少固定姿势文件的形象', () => {
    const catalog = validCatalog()
    const portrait = catalog.portraits[0]

    expect(() => defineAssetCatalog({
      ...catalog,
      portraits: [{
        ...portrait,
        poses: { ...portrait.poses, gaze: '' },
      }],
    })).toThrow(
      '形象 minho 缺少 gaze 姿势文件',
    )
  })

  it('扩展姿势只在场景使用时要求对应形象文件', () => {
    const catalog = validCatalog()
    const destination = catalog.destinations[0]
    const sniffScene = {
      ...destination.sceneVariants[0],
      compositionSlot: {
        ...destination.sceneVariants[0].compositionSlot,
        pose: 'sniff' as const,
      },
    }
    const catalogWithSniffScene = {
      ...catalog,
      destinations: [{
        ...destination,
        sceneVariants: [sniffScene, destination.sceneVariants[1]],
      }],
    }

    expect(() => defineAssetCatalog(catalogWithSniffScene)).toThrow(
      '形象 minho 缺少场景 paris-day 所需的 sniff 姿势文件',
    )
    expect(() => defineAssetCatalog({
      ...catalogWithSniffScene,
      portraits: [{
        ...catalog.portraits[0],
        poses: {
          ...catalog.portraits[0].poses,
          sniff: '/portraits/minho/sniff.png',
        },
      }],
    })).not.toThrow()
  })

  it('拒绝场景变体不足两个的目的地', () => {
    const catalog = validCatalog()
    const destination = catalog.destinations[0]

    expect(() => defineAssetCatalog({
      ...catalog,
      destinations: [{
        ...destination,
        sceneVariants: [destination.sceneVariants[0]],
      }],
    })).toThrow(
      '目的地 paris 至少需要 2 个场景变体',
    )
  })

  it('拒绝空的明信片文案库', () => {
    const catalog = validCatalog()

    expect(() => defineAssetCatalog({
      ...catalog,
      copy: { ...catalog.copy, postcardNotes: [] },
    })).toThrow('明信片文案库不能为空')
  })

  it('拒绝空的出发字条文案库', () => {
    const catalog = validCatalog()

    expect(() => defineAssetCatalog({
      ...catalog,
      copy: { ...catalog.copy, travelNotes: [] },
    })).toThrow('出发字条文案库不能为空')
  })

  it('拒绝场景引用固定集合之外的姿势', () => {
    const catalog = validCatalog()
    const destination = catalog.destinations[0]
    const scene = destination.sceneVariants[0]

    expect(() => defineAssetCatalog({
      ...catalog,
      destinations: [{
        ...destination,
        sceneVariants: [
          {
            ...scene,
            compositionSlot: {
              ...scene.compositionSlot,
              pose: 'fly' as 'gaze',
            },
          },
          destination.sceneVariants[1],
        ],
      }],
    })).toThrow('场景 paris-day 引用了未知姿势 fly')
  })

  it('所有视觉已批准目的地都能进入旅行与心愿选择', () => {
    const sceneCount = STARTER_CATALOG.destinations.reduce(
      (total, { sceneVariants }) => total + sceneVariants.length,
      0,
    )

    expect(STARTER_CATALOG.destinations.length).toBeGreaterThan(0)
    expect(sceneCount).toBeGreaterThanOrEqual(
      STARTER_CATALOG.destinations.length * 2,
    )
    expect(STARTER_DESTINATIONS.map(({ id }) => id)).toEqual(
      STARTER_CATALOG.destinations.map(({ id }) => id),
    )
  })
})
