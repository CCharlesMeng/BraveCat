/**
 * classic-v4：现役水彩小屋，作为第一个 HomeForm 的数据整理。
 *
 * 窗框、猫爬架、碗、柜子、地毯仍烘焙在 shell 图里，因此本 form 暂无
 * 可替换 socket；明信片墙、纪念品桌面、Treat 与猫落位是它冻结的
 * 物理事实。资产来源与坐标沿用 Home v4 的已验收数据，不得在此调整。
 */
import type { HomeFormDefinition } from '../types'

const ART_ROOT = '/dev-art/home-v4'

const TABLE_SKEW_Y = 10

export const CLASSIC_V4_FORM = {
  id: 'classic-v4',
  name: '经典水彩小屋',
  /** 候选资产尚未通过上线验收；生产环境继续使用 CSS 房间兜底。 */
  shippingEligible: false,
  canvas: { width: 1200, height: 1600 },
  finishes: [
    {
      id: 'classic-v4-watercolor',
      name: '经典水彩',
      exterior: {
        morning: `${ART_ROOT}/exterior-morning.png`,
        noon: `${ART_ROOT}/exterior-noon.png`,
        dusk: `${ART_ROOT}/exterior-dusk.png`,
        'late-night': `${ART_ROOT}/exterior-late-night.png`,
      },
      lighting: {
        morning: `${ART_ROOT}/lighting-morning.png`,
        noon: null,
        dusk: `${ART_ROOT}/lighting-dusk.png`,
        'late-night': `${ART_ROOT}/lighting-late-night.png`,
      },
      shell: {
        default: `${ART_ROOT}/interior-foreground.png`,
        activityVariants: {
          eat: `${ART_ROOT}/interior-foreground-eat.png`,
        },
      },
    },
  ],
  /**
   * 窗框、猫爬架、碗、地毯仍烘焙在 shell 里未开 socket；
   * 画框墙 fixture 与柜前遮挡已由 piece 接管。
   */
  sockets: [
    {
      id: 'postcard-display',
      kind: 'postcard-display',
      compatibilityProfile: 'classic-v4/right-wall-display',
      region: { x: 770, y: 170, width: 390, height: 490 },
    },
    {
      id: 'cabinet',
      kind: 'cabinet',
      compatibilityProfile: 'classic-v4/cabinet',
      region: { x: 900, y: 880, width: 270, height: 330 },
    },
  ],
  catPlacements: {
    sleep: { x: 40, y: 550, width: 420, height: 420 },
    play: { x: 20, y: 480, width: 450, height: 450 },
    eat: { x: 30, y: 520, width: 450, height: 450 },
    gaze: { x: 20, y: 550, width: 360, height: 360, flip: true },
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
  catAnimationsByPortrait: {
    minho: {
      sleep: {
        src: `${ART_ROOT}/cat-animations/cat--minho--sleep--ambient--v02.webp`,
        frameCount: 8,
      },
      play: {
        src: `${ART_ROOT}/cat-animations/cat--minho--play--ambient--v02.webp`,
        frameCount: 8,
      },
      eat: {
        src: `${ART_ROOT}/cat-animations/cat--minho--eat--ambient--v02.webp`,
        frameCount: 8,
      },
      gaze: {
        src: `${ART_ROOT}/cat-animations/cat--minho--gaze--ambient--v02.webp`,
        frameCount: 8,
      },
    },
  },
  treatPlacement: { x: 600, y: 840, width: 126, height: 112 },
  postcardDisplay: {
    slots: [
      { quad: [[792, 184], [974, 225], [970, 319], [792, 278]], contentSkewY: 12.7 },
      { quad: [[1009, 233], [1148, 264], [1144, 337], [1008, 307]], contentSkewY: 12.6 },
      { quad: [[790, 342], [972, 381], [968, 476], [790, 437]], contentSkewY: 12.1 },
      { quad: [[1006, 388], [1145, 418], [1141, 491], [1005, 462]], contentSkewY: 12.2 },
      { quad: [[788, 500], [970, 537], [966, 632], [788, 595]], contentSkewY: 11.5 },
      { quad: [[1003, 544], [1142, 573], [1138, 646], [1002, 618]], contentSkewY: 11.7 },
    ],
    wallPlane: {
      cornerX: 768,
      cabinetPerspectiveReference: {
        rearSlope: 65 / 262,
        frontSlope: 50 / 262,
      },
    },
  },
  souvenirDisplay: {
    anchors: [
      { x: 950, y: 934, width: 62, height: 52, rotation: -10, skewY: TABLE_SKEW_Y, zIndex: 2 },
      { x: 992, y: 936, width: 58, height: 50, rotation: 7, skewY: TABLE_SKEW_Y, zIndex: 3 },
      { x: 1024, y: 930, width: 56, height: 48, rotation: -3, skewY: TABLE_SKEW_Y, zIndex: 1 },
    ],
    tableSkewY: TABLE_SKEW_Y,
  },
} as const satisfies HomeFormDefinition
