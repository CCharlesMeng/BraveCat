import {
  isPortraitPose,
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
import {
  EMPTY_PACK_EFFECTS,
  type PackEffects,
} from '../packEffects'

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
  recentPostcardRecipes?: readonly Pick<PostcardRecipe, 'scene' | 'copy'>[]
  packEffects?: PackEffects
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
): PostcardRecipe => {
  const portraitSrc = source.portrait.poses[source.pose]
  if (!portraitSrc) {
    throw new RangeError(
      `形象 ${source.portrait.id} 缺少 ${source.pose} 姿势文件`,
    )
  }

  return {
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
        src: portraitSrc,
      },
    ],
    copy: {
      id: source.copyId,
      text: source.copyText,
    },
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
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
    || !isPortraitPose(value.pose)
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
    || !isPortraitPose(value.pose)
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

const selectWeighted = <T>(
  values: readonly T[],
  weightFor: (value: T) => number,
  random: RandomSource,
  emptyMessage: string,
): { value: T; index: number } => {
  if (values.length === 0) throw new RangeError(emptyMessage)
  const weights = values.map((value) => Math.max(0, weightFor(value)))
  const totalWeight = weights.reduce((total, weight) => total + weight, 0)
  if (totalWeight <= 0) return selectOne(values, random, emptyMessage)

  const target = Math.min(random(), 0.999_999_999) * totalWeight
  let cumulativeWeight = 0
  for (const [index, weight] of weights.entries()) {
    cumulativeWeight += weight
    if (target < cumulativeWeight) {
      return { value: values[index], index }
    }
  }

  return { value: values[values.length - 1], index: values.length - 1 }
}

const renderPostcardNote = (
  template: string,
  destinationName: string,
): string => (
  template.replaceAll('{destination}', destinationName)
)

const COMPANION_SCENE_CHANCE = 0.1
const ONE_SOUVENIR_THRESHOLD = 0.45
const TWO_SOUVENIR_THRESHOLD = 0.9

const selectScenePool = (
  destination: AssetCatalog['destinations'][number],
  random: RandomSource,
  companionChanceBonus: number,
) => {
  const ordinaryScenes = destination.sceneVariants.filter(
    ({ hasCompanion }) => !hasCompanion,
  )
  const companionScenes = destination.sceneVariants.filter(
    ({ hasCompanion }) => hasCompanion,
  )
  const scenePool = ordinaryScenes.length > 0 && companionScenes.length > 0
    ? (random() < Math.min(
      1,
      COMPANION_SCENE_CHANCE + companionChanceBonus,
    )
      ? companionScenes
      : ordinaryScenes)
    : destination.sceneVariants

  if (scenePool.length === 0) {
    throw new RangeError(`目的地没有场景变体：${destination.id}`)
  }

  return scenePool
}

interface PostcardSource {
  scene: SceneVariant
  note: string
  noteIndex: number
}

const copyWeightFor = (
  tags: readonly string[],
  tagWeights: PackEffects['copyTagWeights'],
) => tags.reduce(
  (weight, tag) => weight * (tagWeights[tag] ?? 1),
  1,
)

const postcardSourceKey = (
  sceneId: SceneVariant['id'],
  copyId: string,
) => `${sceneId}\u0000${copyId}`

const selectPostcardSource = (
  destination: AssetCatalog['destinations'][number],
  notes: readonly string[],
  usedSceneIds: ReadonlySet<string>,
  usedCopyIds: ReadonlySet<string>,
  usedSourceKeys: ReadonlySet<string>,
  random: RandomSource,
  effects: PackEffects,
  noteTags: readonly (readonly string[])[],
): PostcardSource => {
  const scenePool = selectScenePool(
    destination,
    random,
    effects.companionChanceBonus,
  )
  const { value: scene } = selectWeighted(
    scenePool,
    ({ compositionSlot }) => (
      effects.poseWeights[compositionSlot.pose] ?? 1
    ),
    random,
    `目的地没有场景变体：${destination.id}`,
  )
  const noteChoices = notes.map((note, index) => ({
    note,
    tags: noteTags[index] ?? [],
  }))
  const {
    value: { note },
    index: noteIndex,
  } = selectWeighted(
    noteChoices,
    ({ tags }) => copyWeightFor(tags, effects.copyTagWeights),
    random,
    '明信片文案库不能为空',
  )
  const copyId = `postcard-note-${noteIndex + 1}`
  const sourceKey = postcardSourceKey(scene.id, copyId)
  if (
    !usedSceneIds.has(scene.id)
    && !usedCopyIds.has(copyId)
    && !usedSourceKeys.has(sourceKey)
  ) {
    return { scene, note, noteIndex }
  }

  const candidates = scenePool.flatMap((candidateScene) => (
    notes.map((candidateNote, candidateNoteIndex) => ({
      scene: candidateScene,
      note: candidateNote,
      noteIndex: candidateNoteIndex,
      noteTags: noteTags[candidateNoteIndex] ?? [],
      copyId: `postcard-note-${candidateNoteIndex + 1}`,
    }))
  ))
  const unusedSources = candidates.filter(({ scene, copyId: candidateCopyId }) => (
    !usedSourceKeys.has(postcardSourceKey(scene.id, candidateCopyId))
  ))
  const distinctSource = unusedSources.filter(({ scene, copyId: candidateCopyId }) => (
    !usedSceneIds.has(scene.id) && !usedCopyIds.has(candidateCopyId)
  ))
  const { value: selected } = selectWeighted(
    distinctSource.length > 0
      ? distinctSource
      : unusedSources.length > 0
        ? unusedSources
        : candidates,
    ({ scene: candidateScene, noteTags: candidateNoteTags }) => (
      (effects.poseWeights[candidateScene.compositionSlot.pose] ?? 1)
      * copyWeightFor(candidateNoteTags, effects.copyTagWeights)
    ),
    random,
    `目的地没有场景变体：${destination.id}`,
  )

  return selected
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
  const effects = request.packEffects ?? EMPTY_PACK_EFFECTS
  const noteTags = request.catalog.copy.postcardNoteTags
    ?? request.catalog.copy.postcardNotes.map(() => [])
  const usedSceneIds = new Set(
    request.recentPostcardRecipes?.map(({ scene }) => scene.id) ?? [],
  )
  const usedCopyIds = new Set(
    request.recentPostcardRecipes?.map(({ copy }) => copy.id) ?? [],
  )
  const usedSourceKeys = new Set(
    request.recentPostcardRecipes?.map(({ scene, copy }) => (
      postcardSourceKey(scene.id, copy.id)
    )) ?? [],
  )
  const postcards = request.itinerary.postcardSlots.map((slot) => {
    const destination = request.catalog.destinations.find(
      ({ id }) => id === slot.destinationId,
    )
    if (!destination) {
      throw new RangeError(`素材目录缺少目的地：${slot.destinationId}`)
    }

    const { scene, note, noteIndex } = selectPostcardSource(
      destination,
      request.catalog.copy.postcardNotes,
      usedSceneIds,
      usedCopyIds,
      usedSourceKeys,
      random,
      effects,
      noteTags,
    )
    const copyId = `postcard-note-${noteIndex + 1}`
    usedSceneIds.add(scene.id)
    usedCopyIds.add(copyId)
    usedSourceKeys.add(postcardSourceKey(scene.id, copyId))
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
        copyText: renderPostcardNote(note, destination.name),
      }),
    }
  })

  return {
    postcards,
    souvenirIds: selectSouvenirIds(request, random),
  }
}
