import {
  PORTRAIT_POSES,
  type AssetCatalog,
  type Portrait,
  type PortraitPose,
  type SceneVariant,
} from '../assets'
import type { Itinerary, RandomSource } from '../itinerary'
import type {
  CatId,
  PortraitId,
  SceneVariantId,
  SouvenirId,
} from '../ids'

export const POSTCARD_RECIPE_VERSION = 1 as const

export interface PostcardRecipe {
  readonly recipeVersion: typeof POSTCARD_RECIPE_VERSION
  readonly travelerCatId: CatId
  readonly scene: {
    readonly id: SceneVariantId
    readonly revision: string
  }
  readonly portrait: {
    readonly id: PortraitId
    readonly setRevision: string
  }
  readonly composition: {
    readonly id: string
    readonly x: number
    readonly y: number
    readonly scale: number
    readonly flip: boolean
  }
  readonly pose: PortraitPose
  readonly layers: readonly [
    {
      readonly id: 'scene'
      readonly kind: 'scene'
      readonly src: string
    },
    {
      readonly id: 'portrait'
      readonly kind: 'portrait'
      readonly src: string
    },
  ]
  readonly copy: {
    readonly id: string
    readonly text: string
  }
}

export interface SelectionRequest {
  itinerary: Itinerary
  travelerCatId: CatId
  portraitId: PortraitId
  catalog: AssetCatalog
}

export interface SelectedPostcard {
  readonly recipe: PostcardRecipe
}

interface RecipeSnapshotSource {
  travelerCatId: CatId
  scene: SceneVariant
  sceneRevision: string
  portrait: Portrait
  portraitSetRevision: string
  pose: PortraitPose
  copyId: string
  copyText: string
}

const createPostcardRecipe = (
  source: RecipeSnapshotSource,
): PostcardRecipe => ({
  recipeVersion: POSTCARD_RECIPE_VERSION,
  travelerCatId: source.travelerCatId,
  scene: {
    id: source.scene.id,
    revision: source.sceneRevision,
  },
  portrait: {
    id: source.portrait.id,
    setRevision: source.portraitSetRevision,
  },
  composition: {
    id: `${source.scene.id}--default`,
    x: source.scene.compositionSlot.x,
    y: source.scene.compositionSlot.y,
    scale: source.scene.compositionSlot.scale,
    flip: source.scene.compositionSlot.flip,
  },
  pose: source.pose,
  layers: [
    {
      id: 'scene',
      kind: 'scene',
      src: source.scene.imageSrc,
    },
    {
      id: 'portrait',
      kind: 'portrait',
      src: source.portrait.poses[source.pose],
    },
  ],
  copy: {
    id: source.copyId,
    text: source.copyText,
  },
})

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

const isPose = (value: unknown): value is PortraitPose => (
  typeof value === 'string'
  && (PORTRAIT_POSES as readonly string[]).includes(value)
)

export const isPostcardRecipe = (
  value: unknown,
): value is PostcardRecipe => {
  if (
    !isRecord(value)
    || value.recipeVersion !== POSTCARD_RECIPE_VERSION
    || typeof value.travelerCatId !== 'string'
    || !isRecord(value.scene)
    || typeof value.scene.id !== 'string'
    || typeof value.scene.revision !== 'string'
    || !isRecord(value.portrait)
    || typeof value.portrait.id !== 'string'
    || typeof value.portrait.setRevision !== 'string'
    || !isRecord(value.composition)
    || typeof value.composition.id !== 'string'
    || typeof value.composition.x !== 'number'
    || typeof value.composition.y !== 'number'
    || typeof value.composition.scale !== 'number'
    || typeof value.composition.flip !== 'boolean'
    || !isPose(value.pose)
    || !Array.isArray(value.layers)
    || value.layers.length !== 2
    || !isRecord(value.layers[0])
    || value.layers[0].id !== 'scene'
    || value.layers[0].kind !== 'scene'
    || typeof value.layers[0].src !== 'string'
    || !isRecord(value.layers[1])
    || value.layers[1].id !== 'portrait'
    || value.layers[1].kind !== 'portrait'
    || typeof value.layers[1].src !== 'string'
    || !isRecord(value.copy)
    || typeof value.copy.id !== 'string'
    || typeof value.copy.text !== 'string'
  ) return false

  return (
    value.travelerCatId.trim().length > 0
    && value.scene.id.trim().length > 0
    && value.scene.revision.trim().length > 0
    && value.portrait.id.trim().length > 0
    && value.portrait.setRevision.trim().length > 0
    && value.composition.id.trim().length > 0
    && Number.isFinite(value.composition.x)
    && Number.isFinite(value.composition.y)
    && Number.isFinite(value.composition.scale)
    && value.composition.scale > 0
    && value.layers[0].src.trim().length > 0
    && value.layers[1].src.trim().length > 0
    && value.copy.id.trim().length > 0
  )
}

export const restoreSelectedPostcard = (
  value: unknown,
  travelerCatId: CatId,
  catalog: AssetCatalog,
): SelectedPostcard | undefined => {
  if (
    isRecord(value)
    && isPostcardRecipe(value.recipe)
    && value.recipe.travelerCatId === travelerCatId
  ) {
    return { recipe: value.recipe }
  }
  if (
    !isRecord(value)
    || typeof value.sceneVariantId !== 'string'
    || typeof value.portraitId !== 'string'
    || !isPose(value.pose)
    || typeof value.note !== 'string'
  ) return undefined

  const scene = catalog.destinations
    .flatMap(({ sceneVariants }) => sceneVariants)
    .find(({ id }) => id === value.sceneVariantId)
  const portrait = catalog.portraits.find(
    ({ id }) => id === value.portraitId,
  )
  const sceneRevision = scene
    ? catalog.sceneRevisions[scene.id]
    : undefined
  const portraitSetRevision = catalog.portraitSetRevisions[value.portraitId]
  if (
    !scene
    || !sceneRevision
    || !portrait
    || !portraitSetRevision
  ) return undefined

  const noteIndex = catalog.copy.postcardNotes.indexOf(value.note)
  return {
    recipe: createPostcardRecipe({
      travelerCatId,
      scene,
      sceneRevision,
      portrait,
      portraitSetRevision,
      pose: value.pose,
      copyId: noteIndex >= 0
        ? `postcard-note-${noteIndex + 1}`
        : `legacy-note:${value.note}`,
      copyText: value.note,
    }),
  }
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
): { value: T; index: number } => {
  if (values.length === 0) throw new RangeError(emptyMessage)
  const index = Math.min(
    values.length - 1,
    Math.floor(random() * values.length),
  )
  return { value: values[index], index }
}

export const selectTripContent: ContentSelector = (request, random) => ({
  postcards: request.itinerary.postcardSlots.map((slot) => {
    const destination = request.catalog.destinations.find(
      ({ id }) => id === slot.destinationId,
    )
    if (!destination) {
      throw new RangeError(`素材目录缺少目的地：${slot.destinationId}`)
    }

    const { value: scene } = selectOne(
      destination.sceneVariants,
      random,
      `目的地没有场景变体：${slot.destinationId}`,
    )
    const { value: note, index: noteIndex } = selectOne(
      request.catalog.copy.postcardNotes,
      random,
      '明信片文案库不能为空',
    )
    const portrait = request.catalog.portraits.find(
      ({ id }) => id === request.portraitId,
    )
    if (!portrait) {
      throw new RangeError(`素材目录缺少形象：${request.portraitId}`)
    }
    const portraitSetRevision = request.catalog
      .portraitSetRevisions[request.portraitId]
    if (!portraitSetRevision) {
      throw new RangeError(`形象缺少 set revision：${request.portraitId}`)
    }
    const sceneRevision = request.catalog.sceneRevisions[scene.id]
    if (!sceneRevision) {
      throw new RangeError(`场景缺少 revision：${scene.id}`)
    }

    return {
      recipe: createPostcardRecipe({
        travelerCatId: request.travelerCatId,
        scene,
        sceneRevision,
        portrait,
        portraitSetRevision,
        pose: scene.compositionSlot.pose,
        copyId: `postcard-note-${noteIndex + 1}`,
        copyText: note,
      }),
    }
  }),
  souvenirIds: [],
})
