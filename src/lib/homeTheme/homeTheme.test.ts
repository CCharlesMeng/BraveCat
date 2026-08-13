import { describe, expect, it } from 'vitest'
import {
  CLASSIC_V4_FORM,
  defaultHomeCustomization,
  HOME_THEME_PRESETS,
  isHomeCustomization,
  listCompatiblePieces,
  listHomeFinishes,
  listHomeForms,
  normalizeHomeCustomization,
  paintedCanvasRect,
  resolveHomeScene,
  SPLIT_LEVEL_DEN_FORM,
  SPLIT_LEVEL_DEN_PRESET,
  type HomeSceneContext,
} from './index'

const sceneFor = (context: Partial<HomeSceneContext> = {}) => resolveHomeScene(
  defaultHomeCustomization(),
  {
    time: 'noon',
    activity: 'sleep',
    portraitId: 'minho',
    ...context,
  },
)

const shellSrcOf = (scene: ReturnType<typeof resolveHomeScene>) => (
  scene.backdrop.find(({ id }) => id === 'shell')?.src
)

describe('resolveHomeScene', () => {
  it('resolves the default customization without knowing form internals', () => {
    const scene = sceneFor()
    expect(scene.formId).toBe('classic-v4')
    expect(scene.canvas).toEqual({ width: 1200, height: 1600 })
    expect(scene.backdrop).toEqual([
      { id: 'exterior-noon', src: '/dev-art/home-v4/exterior-noon.png' },
      { id: 'shell', src: '/dev-art/home-v4/interior-foreground.png' },
    ])
  })

  it('routes classic fixture and occlusion art through pieces unchanged', () => {
    const scene = sceneFor()
    // 与部件拆分前的输出一致：既有已验收资产原样接管。
    expect(scene.postcardDisplay.fixtureSrc)
      .toBe('/assets/home/display--postcard-wall--v03.png')
    expect(scene.souvenirDisplay.occlusionSrc)
      .toBe('/assets/home/display--souvenir-occlusion--v01.png')
    // classic 柜体仍烘焙在 shell 里，没有独立 rear 层。
    expect(scene.rearPieces).toEqual([])
    expect(scene.pieces).toEqual([
      {
        socketId: 'postcard-display',
        kind: 'postcard-display',
        pieceId: 'classic-wall-frames',
        pieceName: '暖木画框墙',
      },
      {
        socketId: 'cabinet',
        kind: 'cabinet',
        pieceId: 'classic-oak-cabinet',
        pieceName: '橡木矮柜',
      },
    ])
  })

  it('keeps the non-shipping candidate pack out of production', () => {
    expect(sceneFor().shippingEligible).toBe(false)
    expect(listHomeForms()).toEqual([
      { id: 'classic-v4', name: '经典水彩小屋', shippingEligible: false },
      {
        id: 'split-level-den',
        name: '错层窗台小屋',
        shippingEligible: false,
      },
    ])
  })

  it('selects lighting by time and leaves noon unlit', () => {
    expect(sceneFor({ time: 'noon' }).lighting).toBeNull()
    expect(sceneFor({ time: 'dusk' }).lighting?.src).toBe(
      '/dev-art/home-v4/lighting-dusk.png',
    )
  })

  it('lets the eating shell variant own the bowl', () => {
    expect(shellSrcOf(sceneFor({ activity: 'eat' }))).toBe(
      '/dev-art/home-v4/interior-foreground-eat.png',
    )
    expect(shellSrcOf(sceneFor({ activity: 'sleep' }))).toBe(
      '/dev-art/home-v4/interior-foreground.png',
    )
  })

  it('exposes Minho animation sprites without changing other portraits', () => {
    const sprite = sceneFor({ activity: 'gaze' }).cat.sprite
    expect(sprite?.src).toBe(
      '/dev-art/home-v4/cat-animations/cat--minho--gaze--ambient--v02.webp',
    )
    expect(sprite?.frameCount).toBe(8)
    expect(sprite?.style).toContain(
      `--home-cat-animation-src: url("${sprite?.src}")`,
    )
    expect(sceneFor({ portraitId: 'future-cat' }).cat.sprite).toBeNull()
  })

  it('flips the gaze pose toward the window', () => {
    const scene = sceneFor({ activity: 'gaze' })
    expect(scene.cat.placement.flip).toBe(true)
    expect(scene.cat.imageStyle).toContain('scaleX(-1)')
    expect(sceneFor({ activity: 'sleep' }).cat.imageStyle)
      .toContain('scaleX(1)')
  })

  it('falls back retired selections to preset defaults instead of failing', () => {
    const customization = defaultHomeCustomization()
    const context = {
      time: 'noon',
      activity: 'sleep',
      portraitId: 'minho',
    } as const

    // 整个房间形态已下架：整体回退默认预设。
    const fromRetiredForm = resolveHomeScene(
      { ...customization, formId: 'retired-loft' },
      context,
    )
    expect(fromRetiredForm.formId).toBe('classic-v4')

    // 表面风格已下架：回退该 form 的预设默认值，场景仍可解析。
    const fromRetiredFinish = resolveHomeScene(
      { ...customization, finishId: 'bare-plaster' },
      context,
    )
    expect(shellSrcOf(fromRetiredFinish))
      .toBe('/dev-art/home-v4/interior-foreground.png')

    // 指向不存在插槽的部件被丢弃，其余选择保留。
    expect(normalizeHomeCustomization({
      ...customization,
      pieces: { scratcher: 'tall-tree' },
    }).pieces).toEqual({})
  })

  it('keeps an already-valid selection as the same reference', () => {
    const customization = defaultHomeCustomization()
    expect(normalizeHomeCustomization(customization)).toBe(customization)
  })

  it('validates only the shape of stored customizations', () => {
    expect(isHomeCustomization(defaultHomeCustomization())).toBe(true)
    expect(isHomeCustomization({
      formId: 'retired-form',
      finishId: 'retired-finish',
      pieces: { scratcher: 'retired-piece' },
    })).toBe(true)
    expect(isHomeCustomization(null)).toBe(false)
    expect(isHomeCustomization({
      formId: 7,
      finishId: 'x',
      pieces: {},
    })).toBe(false)
    expect(isHomeCustomization({
      formId: 'x',
      finishId: 'x',
      pieces: { scratcher: 2 },
    })).toBe(false)
  })

  it('ships coordinated presets and keeps classic as the default', () => {
    expect(HOME_THEME_PRESETS.map(({ id }) => id))
      .toEqual(['classic-v4', 'split-level-den'])
    expect(defaultHomeCustomization()).toEqual({
      presetId: 'classic-v4',
      formId: 'classic-v4',
      finishId: 'classic-v4-watercolor',
      pieces: {
        'postcard-display': 'classic-wall-frames',
        cabinet: 'classic-oak-cabinet',
      },
    })
  })
})

describe('classic-v4 form geometry', () => {
  it('keeps the painted gaze pose in the visible crop without touching Treats', () => {
    const placement = CLASSIC_V4_FORM.catPlacements.gaze
    const paintedCat = paintedCanvasRect(
      placement,
      CLASSIC_V4_FORM.catPaintBounds.gaze!,
    )
    const treat = CLASSIC_V4_FORM.treatPlacement

    expect(placement.flip).toBe(true)
    expect(paintedCat.bottom).toBeLessThan(916)
    expect(treat.y + treat.height).toBeLessThanOrEqual(960)
    expect(paintedCat.right).toBeLessThan(treat.x)
  })

  it('keeps frames inside the design canvas and on one wall plane', () => {
    const { canvas, postcardDisplay } = CLASSIC_V4_FORM
    expect(postcardDisplay.slots.map(({ quad, contentSkewY }) => ({
      quad,
      contentSkewY,
    }))).toEqual([
      { quad: [[792, 184], [974, 225], [970, 319], [792, 278]], contentSkewY: 12.7 },
      { quad: [[1009, 233], [1148, 264], [1144, 337], [1008, 307]], contentSkewY: 12.6 },
      { quad: [[790, 342], [972, 381], [968, 476], [790, 437]], contentSkewY: 12.1 },
      { quad: [[1006, 388], [1145, 418], [1141, 491], [1005, 462]], contentSkewY: 12.2 },
      { quad: [[788, 500], [970, 537], [966, 632], [788, 595]], contentSkewY: 11.5 },
      { quad: [[1003, 544], [1142, 573], [1138, 646], [1002, 618]], contentSkewY: 11.7 },
    ])
    expect(postcardDisplay.slots.every(({ quad }) => (
      quad.every(([x, y]) => (
        x > postcardDisplay.wallPlane.cornerX
        && x <= canvas.width
        && y >= 0
        && y <= canvas.height
      ))
    ))).toBe(true)

    const polygonArea = (quad: readonly (readonly [number, number])[]) => (
      Math.abs(quad.reduce((sum, [x, y], index) => {
        const [nextX, nextY] = quad[(index + 1) % quad.length]
        return sum + x * nextY - nextX * y
      }, 0)) / 2
    )
    const reference = postcardDisplay.wallPlane.cabinetPerspectiveReference
    const [minimumSlope, maximumSlope] = [
      reference.frontSlope,
      reference.rearSlope,
    ].sort((left, right) => left - right)
    for (let row = 0; row < postcardDisplay.slots.length; row += 2) {
      const near = postcardDisplay.slots[row]
      const far = postcardDisplay.slots[row + 1]
      expect(polygonArea(far.quad)).toBeLessThan(polygonArea(near.quad))
      for (const slot of [near, far]) {
        const [[topLeftX, topLeftY], [topRightX, topRightY], , [bottomLeftX, bottomLeftY]] = slot.quad
        const [, , [bottomRightX, bottomRightY]] = slot.quad
        const topSlope = (topRightY - topLeftY) / (topRightX - topLeftX)
        const bottomSlope = (bottomRightY - bottomLeftY) / (bottomRightX - bottomLeftX)
        expect(topSlope).toBeGreaterThanOrEqual(minimumSlope)
        expect(topSlope).toBeLessThanOrEqual(maximumSlope)
        expect(bottomSlope).toBeGreaterThanOrEqual(minimumSlope)
        expect(bottomSlope).toBeLessThanOrEqual(maximumSlope)
        expect(Math.abs(topSlope - bottomSlope)).toBeGreaterThan(0.001)
      }
    }
  })

  it('keeps tabletop souvenirs on the physical table plane', () => {
    const { souvenirDisplay } = CLASSIC_V4_FORM
    expect(souvenirDisplay.tableSkewY).toBe(10)
    expect(souvenirDisplay.anchors).toHaveLength(3)
    for (const anchor of souvenirDisplay.anchors) {
      expect(anchor.skewY).toBe(souvenirDisplay.tableSkewY)
      expect(anchor.x).toBeGreaterThanOrEqual(900)
      expect(anchor.x + anchor.width).toBeLessThanOrEqual(1150)
      expect(anchor.y).toBeGreaterThanOrEqual(880)
      expect(anchor.y + anchor.height).toBeLessThanOrEqual(1020)
    }
  })

  it('resolves the split-level den with baked window and shelves', () => {
    const scene = resolveHomeScene(
      {
        presetId: SPLIT_LEVEL_DEN_PRESET.id,
        formId: SPLIT_LEVEL_DEN_PRESET.formId,
        finishId: SPLIT_LEVEL_DEN_PRESET.finishId,
        pieces: {},
      },
      { time: 'dusk', activity: 'gaze', portraitId: 'minho' },
    )
    expect(scene.formId).toBe('split-level-den')
    // 窗景烘焙在 shell 里：没有独立 exterior 与 lighting 层。
    expect(scene.backdrop).toEqual([
      { id: 'shell', src: '/dev-art/home-theme/split-level-den/shell.png' },
    ])
    expect(scene.lighting).toBeNull()
    expect(scene.postcardDisplay.fixtureSrc).toBeNull()
    expect(scene.souvenirDisplay.occlusionSrc).toBeNull()
    expect(scene.postcardDisplay.slots).toHaveLength(6)
    expect(scene.cat.sprite?.src).toContain('cat--minho--gaze')
    // 缺省选择由预设默认部件补齐，渲染为 backdrop 之上的独立层。
    expect(scene.rearPieces).toEqual([
      {
        id: 'piece-scratcher',
        src: '/dev-art/home-theme/split-level-den/piece--scratcher--green-post.png',
      },
      {
        id: 'piece-feeding-set',
        src: '/dev-art/home-theme/split-level-den/piece--feeding--ceramic-bowls.png',
      },
    ])
  })

  it('swaps a socket piece independently and falls back when retired', () => {
    const context = {
      time: 'noon',
      activity: 'sleep',
      portraitId: 'minho',
    } as const
    const denSelection = {
      presetId: 'split-level-den',
      formId: 'split-level-den',
      finishId: 'split-level-den-watercolor',
      pieces: {
        scratcher: 'den-rope-tower',
        'feeding-set': 'den-ceramic-bowls',
      },
    }

    const swapped = resolveHomeScene(denSelection, context)
    expect(swapped.rearPieces.map(({ src }) => src)).toEqual([
      '/dev-art/home-theme/split-level-den/piece--scratcher--rope-tower.png',
      '/dev-art/home-theme/split-level-den/piece--feeding--ceramic-bowls.png',
    ])

    // 装入不兼容部件（classic 的画框墙装进抓柱 socket）回退预设默认值。
    const normalized = normalizeHomeCustomization({
      ...denSelection,
      pieces: { ...denSelection.pieces, scratcher: 'classic-wall-frames' },
    })
    expect(normalized.pieces.scratcher).toBe('den-green-post')
    expect(normalized.pieces['feeding-set']).toBe('den-ceramic-bowls')
  })

  it('switches surface finishes without touching form geometry', () => {
    const context = {
      time: 'noon',
      activity: 'sleep',
      portraitId: 'minho',
    } as const
    const dusk = resolveHomeScene(
      {
        formId: 'split-level-den',
        finishId: 'split-level-den-dusk',
        pieces: {},
      },
      context,
    )
    expect(dusk.finishId).toBe('split-level-den-dusk')
    expect(dusk.backdrop).toEqual([
      {
        id: 'shell',
        src: '/dev-art/home-theme/split-level-den/shell--dusk.png',
      },
    ])
    // 暮色 finish 携带全时段灯光层，部件与动态内容一起进入暮色。
    expect(dusk.lighting?.src).toBe(
      '/dev-art/home-theme/split-level-den/finish-dusk-lighting.png',
    )
    // 几何不随 finish 变化。
    const morning = resolveHomeScene(
      {
        formId: 'split-level-den',
        finishId: 'split-level-den-watercolor',
        pieces: {},
      },
      context,
    )
    expect(dusk.postcardDisplay.slots).toEqual(morning.postcardDisplay.slots)
    expect(morning.lighting).toBeNull()

    expect(listHomeFinishes('split-level-den')).toEqual([
      { id: 'split-level-den-watercolor', name: '晨光原木' },
      { id: 'split-level-den-dusk', name: '暮色蓝调' },
    ])
    expect(listHomeFinishes('classic-v4')).toEqual([
      { id: 'classic-v4-watercolor', name: '经典水彩' },
    ])
  })

  it('lists only compatible registered pieces per socket', () => {
    expect(
      listCompatiblePieces('split-level-den', 'scratcher')
        .map(({ id }) => id),
    ).toEqual(['den-green-post', 'den-rope-tower'])
    expect(
      listCompatiblePieces('split-level-den', 'feeding-set')
        .map(({ id }) => id),
    ).toEqual(['den-ceramic-bowls', 'den-raised-feeder'])
    expect(
      listCompatiblePieces('classic-v4', 'postcard-display')
        .map(({ id }) => id),
    ).toEqual(['classic-wall-frames'])
    expect(listCompatiblePieces('classic-v4', 'missing-socket')).toEqual([])
  })

  it('keeps every split-level display edge on the shared wall plane', () => {
    const { slots, wallPlane } = SPLIT_LEVEL_DEN_FORM.postcardDisplay
    const { horizonY, vanishingPointX, cornerX } = wallPlane
    const polygonArea = (quad: readonly (readonly [number, number])[]) => (
      Math.abs(quad.reduce((sum, [x, y], index) => {
        const [nextX, nextY] = quad[(index + 1) % quad.length]
        return sum + x * nextY - nextX * y
      }, 0)) / 2
    )

    for (const { quad } of slots) {
      expect(quad.every(([x]) => x < cornerX)).toBe(true)
      for (const [from, to] of [[quad[0], quad[1]], [quad[3], quad[2]]]) {
        const [x1, y1] = from
        const [x2, y2] = to
        const yAtVanishingPoint = (
          y1 + (y2 - y1) * (vanishingPointX! - x1) / (x2 - x1)
        )
        // 坐标保留 0.1px：外推 ~17 倍后舍入误差最多约 ±2px。
        expect(Math.abs(yAtVanishingPoint - horizonY!)).toBeLessThan(2.5)
      }
    }
    for (let row = 0; row < slots.length; row += 2) {
      expect(polygonArea(slots[row + 1].quad))
        .toBeLessThan(polygonArea(slots[row].quad))
    }
  })

  it('projects display styles for every slot and anchor', () => {
    const scene = sceneFor()
    expect(scene.postcardDisplay.slots).toHaveLength(6)
    for (const slot of scene.postcardDisplay.slots) {
      expect(slot.style).toContain('clip-path: polygon(')
      expect(slot.style).toContain('--display-content-skew-y:')
    }
    expect(scene.souvenirDisplay.anchors).toHaveLength(3)
    for (const anchor of scene.souvenirDisplay.anchors) {
      expect(anchor.style).toContain('skewY(10deg)')
    }
    expect(scene.treat.style).toBe(
      'left: 50%; top: 52.5%; width: 10.5%; height: 7.000000000000001%',
    )
  })
})
