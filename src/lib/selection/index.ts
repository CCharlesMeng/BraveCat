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

const COMPANION_SCENE_CHANCE = 0.1
const ONE_SOUVENIR_THRESHOLD = 0.45
const TWO_SOUVENIR_THRESHOLD = 0.9

const selectScene = (
  destination: AssetCatalog['destinations'][number],
  random: RandomSource,
) => {
  const ordinaryScenes = destination.sceneVariants.filter(
    ({ hasCompanion }) => !hasCompanion,
  )
  const companionScenes = destination.sceneVariants.filter(
    ({ hasCompanion }) => hasCompanion,
  )
  const scenePool = ordinaryScenes.length > 0 && companionScenes.length > 0
    ? (random() < COMPANION_SCENE_CHANCE
      ? companionScenes
      : ordinaryScenes)
    : destination.sceneVariants

  return selectOne(
    scenePool,
    random,
    `目的地没有场景变体：${destination.id}`,
  )
}

const selectSouvenirIds = (
  request: SelectionRequest,
  random: RandomSource,
): readonly SouvenirId[] => {
  const available = request.catalog.souvenirs.filter(
    ({ destinationId }) => destinationId === request.itinerary.destinationId,
  )
  const maximumCount = Math.min(2, available.length)
  const countRoll = random()
  const requestedCount = countRoll < ONE_SOUVENIR_THRESHOLD
    ? 0
    : countRoll < TWO_SOUVENIR_THRESHOLD
      ? 1
      : 2
  const count = Math.min(maximumCount, requestedCount)
  const remaining = [...available]

  return Array.from({ length: count }, () => {
    const selectedIndex = Math.min(
      remaining.length - 1,
      Math.floor(random() * remaining.length),
    )
    return remaining.splice(selectedIndex, 1)[0].id
  })
}

export const selectTripContent: ContentSelector = (request, random) => {
  const postcards = request.itinerary.postcardSlots.map((slot) => {
    const destination = request.catalog.destinations.find(
      ({ id }) => id === slot.destinationId,
    )
    if (!destination) {
      throw new RangeError(`素材目录缺少目的地：${slot.destinationId}`)
    }

    const scene = selectScene(destination, random)
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
  })

  return {
    postcards,
    souvenirIds: selectSouvenirIds(request, random),
  }
}
