/**
 * HomePiece 注册表：可独立换件的物件 adapter。
 *
 * 部件资产是整幅画布尺寸的透明 PNG；`base: null` 表示迁移期该部件的
 * 本体仍烘焙在所属 form 的 shell 里（只贡献遮挡层），拆出独立资产后
 * 补上 base 并从 shell 中移除。
 */
import type { HomePiece } from '../types'

const DEN_PIECE_ROOT = '/dev-art/home-theme/split-level-den'

export const HOME_PIECES: Readonly<Record<string, HomePiece>> = {
  /** classic-v4 的暖木画框墙：既有已验收 fixture 资产原样接管。 */
  'classic-wall-frames': {
    id: 'classic-wall-frames',
    kind: 'postcard-display',
    name: '暖木画框墙',
    compatibleProfiles: ['classic-v4/right-wall-display'],
    art: {
      base: '/assets/home/display--postcard-wall--v03.png',
    },
  },
  /**
   * classic-v4 的橡木矮柜：柜体仍烘焙在 shell 里，本部件目前只承担
   * 原全局纪念品遮挡图（柜前的书与篮筐）。
   */
  'classic-oak-cabinet': {
    id: 'classic-oak-cabinet',
    kind: 'cabinet',
    name: '橡木矮柜',
    compatibleProfiles: ['classic-v4/cabinet'],
    art: {
      base: null,
      foregroundOcclusion: '/assets/home/display--souvenir-occlusion--v01.png',
    },
  },
  'den-green-post': {
    id: 'den-green-post',
    kind: 'scratcher',
    name: '青绒双层抓柱',
    compatibleProfiles: ['split-level-den/platform-scratcher'],
    art: {
      base: `${DEN_PIECE_ROOT}/piece--scratcher--green-post.png`,
    },
  },
  'den-rope-tower': {
    id: 'den-rope-tower',
    kind: 'scratcher',
    name: '麻绳斜塔',
    compatibleProfiles: ['split-level-den/platform-scratcher'],
    art: {
      base: `${DEN_PIECE_ROOT}/piece--scratcher--rope-tower.png`,
    },
  },
  'den-ceramic-bowls': {
    id: 'den-ceramic-bowls',
    kind: 'feeding-set',
    name: '陶瓷双碗',
    compatibleProfiles: ['split-level-den/platform-feeding'],
    art: {
      base: `${DEN_PIECE_ROOT}/piece--feeding--ceramic-bowls.png`,
    },
  },
  'den-raised-feeder': {
    id: 'den-raised-feeder',
    kind: 'feeding-set',
    name: '原木高脚食台',
    compatibleProfiles: ['split-level-den/platform-feeding'],
    art: {
      base: `${DEN_PIECE_ROOT}/piece--feeding--raised-feeder.png`,
    },
  },
}

export const homePieceFor = (pieceId: string): HomePiece | null => (
  HOME_PIECES[pieceId] ?? null
)
