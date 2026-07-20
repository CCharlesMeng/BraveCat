import type { AssetCatalog, PortraitPose } from '../assets'
import type { Itinerary, RandomSource } from '../itinerary'
import type {
  PortraitId,
  SceneVariantId,
  SouvenirId,
} from '../ids'

export interface SelectionRequest {
  itinerary: Itinerary
  portraitId: PortraitId
  catalog: AssetCatalog
}

export interface SelectedPostcard {
  sceneVariantId: SceneVariantId
  portraitId: PortraitId
  pose: PortraitPose
  note: string
}

export interface TripContent {
  postcards: readonly SelectedPostcard[]
  souvenirIds: readonly SouvenirId[]
}

/**
 * 选取器只从素材目录选择内容，不改变已经确定的行程时间线。
 */
export type ContentSelector = (
  request: SelectionRequest,
  random: RandomSource,
) => TripContent

const selectOne = <T>(
  values: readonly T[],
  random: RandomSource,
  emptyMessage: string,
): T => {
  if (values.length === 0) throw new RangeError(emptyMessage)
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))]
}

export const selectTripContent: ContentSelector = (request, random) => ({
  postcards: request.itinerary.postcardSlots.map((slot) => {
    const destination = request.catalog.destinations.find(
      ({ id }) => id === slot.destinationId,
    )
    if (!destination) {
      throw new RangeError(`素材目录缺少目的地：${slot.destinationId}`)
    }

    const scene = selectOne(
      destination.sceneVariants,
      random,
      `目的地没有场景变体：${slot.destinationId}`,
    )
    const note = selectOne(
      request.catalog.copy.postcardNotes,
      random,
      '明信片文案库不能为空',
    )

    return {
      sceneVariantId: scene.id,
      portraitId: request.portraitId,
      pose: scene.compositionSlot.pose,
      note,
    }
  }),
  souvenirIds: [],
})
