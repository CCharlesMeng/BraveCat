/**
 * split-level-den（原型编号 F）：错层窗台小屋，第二个 HomeForm。
 *
 * 几何冻结自已确认方向的控制图 home-theme--f-split-level-den--control-v01：
 * 左墙向画外右灭点 (2750, 900) 退深，近端是落地窗，中段是展示墙，
 * 远端是壁柜；x=980 处转角接右侧返回墙。窗台层（yAtLeft≈1010 的平台）
 * 承担看窗与进食，低层地面承担睡眠与玩耍。
 *
 * 窗景与展示架烘焙在 shell 里，因此没有独立 exterior/lighting 层，
 * 也没有明信片 fixture 与纪念品遮挡图。卡位行与柜沿锚点按
 * shell--candidate-v01 实测重排（书架 yAtLeft≈262/419/578、柜顶沿
 * y≈730→748），再用与控制图相同的 wallY 公式投影，不得手工调整单点。
 */
import type { HomeFormDefinition } from '../types'

const CLASSIC_ANIMATION_ROOT = '/dev-art/home-v4/cat-animations'
/** 实测柜顶沿斜率 18px/340px ≈ 3.0°。 */
const WALL_SKEW_AT_LEDGE = 3

export const SPLIT_LEVEL_DEN_FORM = {
  id: 'split-level-den',
  name: '错层窗台小屋',
  /** 开发预览阶段；未通过上线验收。 */
  shippingEligible: false,
  canvas: { width: 1200, height: 1600 },
  finishIds: ['split-level-den-watercolor'],
  socketIds: [],
  exterior: null,
  lighting: {
    morning: null,
    noon: null,
    dusk: null,
    'late-night': null,
  },
  shell: {
    default: '/dev-art/home-theme/split-level-den/shell.png',
    activityVariants: {},
  },
  catPlacements: {
    sleep: { x: 450, y: 1080, width: 400, height: 400 },
    play: { x: 620, y: 1040, width: 430, height: 430 },
    eat: { x: 180, y: 780, width: 400, height: 400 },
    gaze: { x: 80, y: 670, width: 340, height: 340, flip: true },
  },
  catPaintBounds: {
    gaze: {
      x: 249,
      y: 64,
      width: 526,
      height: 896,
      sourceWidth: 1024,
      sourceHeight: 1024,
    },
  },
  // 暂复用 classic-v4 的 minho 动画贴片；两个 form 均为平视相机，
  // 差异待美术评审后决定是否为本 form 单独出图。
  catAnimationsByPortrait: {
    minho: {
      sleep: {
        src: `${CLASSIC_ANIMATION_ROOT}/cat--minho--sleep--ambient--v02.webp`,
        frameCount: 8,
      },
      play: {
        src: `${CLASSIC_ANIMATION_ROOT}/cat--minho--play--ambient--v02.webp`,
        frameCount: 8,
      },
      eat: {
        src: `${CLASSIC_ANIMATION_ROOT}/cat--minho--eat--ambient--v02.webp`,
        frameCount: 8,
      },
      gaze: {
        src: `${CLASSIC_ANIMATION_ROOT}/cat--minho--gaze--ambient--v02.webp`,
        frameCount: 8,
      },
    },
  },
  treatPlacement: { x: 255, y: 758, width: 115, height: 98 },
  postcardDisplay: {
    fixtureSrc: null,
    slots: [
      { quad: [[560, 306.7], [690, 341.9], [690, 420.6], [560, 390.3]], contentSkewY: 15.2 },
      { quad: [[720, 350.1], [840, 382.6], [840, 455.5], [720, 427.6]], contentSkewY: 15.2 },
      { quad: [[560, 431.7], [690, 459.5], [690, 538.2], [560, 515.4]], contentSkewY: 12.1 },
      { quad: [[720, 466], [840, 491.6], [840, 564.5], [720, 543.5]], contentSkewY: 12.1 },
      { quad: [[560, 558.4], [690, 578.6], [690, 657.3], [560, 642]], contentSkewY: 8.8 },
      { quad: [[720, 583.3], [840, 602], [840, 675], [720, 660.8]], contentSkewY: 8.8 },
    ],
    wallPlane: {
      cornerX: 980,
      horizonY: 900,
      vanishingPointX: 2750,
    },
  },
  souvenirDisplay: {
    anchors: [
      { x: 600, y: 688, width: 62, height: 52, rotation: -10, skewY: WALL_SKEW_AT_LEDGE, zIndex: 2 },
      { x: 668, y: 693, width: 58, height: 50, rotation: 7, skewY: WALL_SKEW_AT_LEDGE, zIndex: 3 },
      { x: 736, y: 699, width: 56, height: 48, rotation: -3, skewY: WALL_SKEW_AT_LEDGE, zIndex: 1 },
    ],
    occlusionSrc: null,
    tableSkewY: WALL_SKEW_AT_LEDGE,
  },
} as const satisfies HomeFormDefinition
