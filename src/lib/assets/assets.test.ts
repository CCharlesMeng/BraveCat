import { describe, expect, it } from 'vitest'
import {
  defineAssetCatalog,
  type AssetCatalog,
} from './index'
import {
  STARTER_CATALOG,
  STARTER_DESTINATIONS,
} from './starterCatalog'

const validCatalog = (): AssetCatalog => ({
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

  it('拒绝纪念品引用素材目录之外的目的地', () => {
    const catalog = validCatalog()

    expect(() => defineAssetCatalog({
      ...catalog,
      souvenirs: [{
        id: 'kyoto-charm',
        destinationId: 'kyoto',
        name: '鸟居御守',
        visualToken: '守',
      }],
    })).toThrow('纪念品 kyoto-charm 引用了未知目的地 kyoto')
  })

  it('拒绝没有安全图形标记的纪念品', () => {
    const catalog = validCatalog()

    expect(() => defineAssetCatalog({
      ...catalog,
      souvenirs: [{
        id: 'paris-pin',
        destinationId: 'paris',
        name: '铁塔纪念章',
        visualToken: ' ',
      }],
    })).toThrow('纪念品 paris-pin 缺少图形标记')
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

  it('每个旅行目的地都有使用安全图形标记的纪念品元数据', () => {
    for (const destination of STARTER_CATALOG.destinations) {
      const souvenirs = STARTER_CATALOG.souvenirs.filter(
        ({ destinationId }) => destinationId === destination.id,
      )

      expect(souvenirs).toHaveLength(2)
      for (const souvenir of souvenirs) {
        expect(souvenir.visualToken.trim()).not.toBe('')
        expect(souvenir.imageSrc).toBeUndefined()
      }
    }
  })
})
