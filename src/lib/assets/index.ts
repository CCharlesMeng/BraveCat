import type {
  DestinationId,
  ItemId,
  PortraitId,
  SceneVariantId,
  SouvenirId,
} from '../ids'
import {
  BASELINE_PORTRAIT_POSES,
  isPortraitPose,
  PORTRAIT_POSES,
  PORTRAIT_POSE_VOCABULARY,
} from './portraitPoseVocabulary.js'

export {
  BASELINE_PORTRAIT_POSES,
  isPortraitPose,
  PORTRAIT_POSES,
  PORTRAIT_POSE_VOCABULARY,
} from './portraitPoseVocabulary.js'

export type PortraitPose = (typeof PORTRAIT_POSES)[number]
type PortraitPoseDefinition = (typeof PORTRAIT_POSE_VOCABULARY)[number]
export type BaselinePortraitPose = Extract<
  PortraitPoseDefinition,
  { baseline: true }
>['id']

export interface CompositionSlot {
  x: number
  y: number
  scale: number
  pose: PortraitPose
  flip: boolean
}

export interface SceneVariant {
  id: SceneVariantId
  destinationId: DestinationId
  imageSrc: string
  compositionSlot: CompositionSlot
  hasCompanion: boolean
}

export interface Destination {
  id: DestinationId
  name: string
  sceneVariants: readonly SceneVariant[]
}

export interface Portrait {
  id: PortraitId
  name: string
  poses: Readonly<Record<BaselinePortraitPose, string>>
    & Readonly<Partial<Record<PortraitPose, string>>>
}

export type ItemKind = 'snack' | 'wish' | 'toy'

export interface ItemDefinition {
  id: ItemId
  name: string
  kind: ItemKind
  price: number
  imageSrc: string
  effectHint: string
}

export interface SouvenirDefinition {
  id: SouvenirId
  destinationId: DestinationId
  name: string
  visualToken: string
  imageSrc?: string
}

export interface CopyLibrary {
  postcardNotes: readonly string[]
  travelNotes: readonly string[]
}

/**
 * 运行时只读取这份类型化清单；新增场景与形象不应要求修改业务代码。
 */
export interface AssetCatalog {
  sceneSetRevision: string
  sceneRevisions: Readonly<Record<SceneVariantId, string>>
  portraitSetRevisions: Readonly<Record<PortraitId, string>>
  destinations: readonly Destination[]
  portraits: readonly Portrait[]
  items: readonly ItemDefinition[]
  souvenirs: readonly SouvenirDefinition[]
  copy: CopyLibrary
}

export const defineAssetCatalog = <TCatalog extends AssetCatalog>(
  catalog: TCatalog,
): TCatalog => {
  if (!catalog.sceneSetRevision.trim()) {
    throw new RangeError('场景目录 revision 不能为空')
  }
  if (catalog.copy.postcardNotes.length === 0) {
    throw new RangeError('明信片文案库不能为空')
  }
  if (catalog.copy.travelNotes.length === 0) {
    throw new RangeError('出发字条文案库不能为空')
  }

  for (const portrait of catalog.portraits) {
    if (!catalog.portraitSetRevisions[portrait.id]?.trim()) {
      throw new RangeError(`形象 ${portrait.id} 缺少 set revision`)
    }
    for (const pose of BASELINE_PORTRAIT_POSES) {
      if (!portrait.poses[pose]?.trim()) {
        throw new RangeError(`形象 ${portrait.id} 缺少 ${pose} 姿势文件`)
      }
    }
    for (const [pose, imageSrc] of Object.entries(portrait.poses)) {
      if (!isPortraitPose(pose)) {
        throw new RangeError(`形象 ${portrait.id} 包含未知姿势 ${pose}`)
      }
      if (!imageSrc?.trim()) {
        throw new RangeError(`形象 ${portrait.id} 缺少 ${pose} 姿势文件`)
      }
    }
  }

  const destinationIds = new Set(
    catalog.destinations.map(({ id }) => id),
  )
  for (const souvenir of catalog.souvenirs) {
    if (!destinationIds.has(souvenir.destinationId)) {
      throw new RangeError(
        `纪念品 ${souvenir.id} 引用了未知目的地 ${souvenir.destinationId}`,
      )
    }
    if (!souvenir.visualToken.trim()) {
      throw new RangeError(`纪念品 ${souvenir.id} 缺少图形标记`)
    }
  }

  for (const destination of catalog.destinations) {
    if (destination.sceneVariants.length < 2) {
      throw new RangeError(
        `目的地 ${destination.id} 至少需要 2 个场景变体`,
      )
    }

    for (const scene of destination.sceneVariants) {
      if (!catalog.sceneRevisions[scene.id]?.trim()) {
        throw new RangeError(`场景 ${scene.id} 缺少 revision`)
      }
      if (!isPortraitPose(scene.compositionSlot.pose)) {
        throw new RangeError(
          `场景 ${scene.id} 引用了未知姿势 ${scene.compositionSlot.pose}`,
        )
      }
      for (const portrait of catalog.portraits) {
        if (!portrait.poses[scene.compositionSlot.pose]?.trim()) {
          throw new RangeError(
            `形象 ${portrait.id} 缺少场景 ${scene.id} 所需的 `
              + `${scene.compositionSlot.pose} 姿势文件`,
          )
        }
      }
    }
  }

  return catalog
}
