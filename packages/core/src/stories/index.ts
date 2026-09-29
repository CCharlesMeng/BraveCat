import type { CatId, ItemId } from '../ids'
import type { RandomSource } from '../itinerary'

export interface StoryDefinition {
  id: string
  version: string
  title: string
  place: string
  favoredItemId: ItemId
  closing: string
  acts: readonly { image: string; copy: string }[]
}

export const STORIES: readonly StoryDefinition[] = [
  {
    id: 'night-watch-stargazing', version: '1', title: '值夜观星', place: '风仪山',
    favoredItemId: 'small-telescope',
    closing: '它没有赶着追上哪一颗星。只是找到一个不被风吹到的位置，替家里多看了一会儿天亮以前的夜空。',
    acts: [
      { image: 'scene-01-arrival', copy: '山上的风有点大，我再往灯亮的地方走一会儿。' },
      { image: 'scene-02-ascent', copy: '墙边安静一点，风从那些小仪针旁边绕过去。' },
      { image: 'scene-03-stargazing', copy: '这里看得见很远。风也没有刚才那么急了。' },
      { image: 'scene-04-dawn-rest', copy: '天快亮了。我找到一个背风的地方，先睡一会儿。' },
    ],
  },
  {
    id: 'mist-harbor-returning-boats', version: '1', title: '雾港看归船', place: '潮窗港',
    favoredItemId: 'fish-biscuit',
    closing: '雨停以后，船慢慢回到港里。它把海风和等候的早晨，一起带进了梦里。',
    acts: [
      { image: 'scene-01-sunrise-harbor', copy: '太阳把水面照亮了，远处的船还没有靠岸。' },
      { image: 'scene-02-indoor-rain-wait', copy: '雨落在窗外，我在这里等一等。' },
      { image: 'scene-03-fisherman-fish-gift', copy: '船回来了，今天的海风里有小鱼的味道。' },
      { image: 'scene-04-dried-fish-sleep', copy: '把早晨抱在怀里，慢慢睡着了。' },
    ],
  },
]

/** A complete approved frame already contains Minho; it has no portrait layer. */
export interface StoryFrameRecipe {
  kind: 'story-frame'
  src: string
  copy: string
}
export interface StoryAct {
  index: number
  revealAt: number
  recipe: StoryFrameRecipe
}
export interface StoryPlan {
  storyId: string
  contentVersion: string
  tripId: string
  travelerCatId: CatId
  travelerName: string
  title: string
  place: string
  closing: string
  departsAt: number
  returnsAt: number
  acts: readonly StoryAct[]
}
export interface StoryCollection extends Omit<StoryPlan, 'acts' | 'closing'> {
  acts: readonly (StoryAct & { isRead: boolean })[]
  closing?: string
}
export interface StoryState {
  collections: readonly StoryCollection[]
  lastTripByCat: Readonly<Record<CatId, 'ordinary' | 'story'>>
}
export const createInitialStoryState = (): StoryState => ({ collections: [], lastTripByCat: {} })
export interface StorySelectionContext {
  completedStoryIds: readonly string[]
  reservedStoryIds: readonly string[]
  lastCompletedStoryId?: string
  needsOrdinaryTrip: boolean
}
export const chooseStory = (
  context: StorySelectionContext,
  packedItemIds: readonly ItemId[],
  random: RandomSource,
): StoryDefinition | undefined => {
  if (context.needsOrdinaryTrip) return undefined
  let candidates = STORIES.filter(({ id }) => !context.reservedStoryIds.includes(id))
  const unseen = candidates.filter(({ id }) => !context.completedStoryIds.includes(id))
  if (unseen.length) candidates = unseen
  else if (candidates.length > 1) candidates = candidates.filter(({ id }) => id !== context.lastCompletedStoryId)
  if (!candidates.length) return undefined
  const weight = (story: StoryDefinition) => packedItemIds.includes(story.favoredItemId) ? 2 : 1
  const chance = candidates.some((story) => weight(story) === 2) ? 0.3 : 0.2
  if (random() >= chance) return undefined
  let roll = random() * candidates.reduce((sum, story) => sum + weight(story), 0)
  return candidates.find((story) => { roll -= weight(story); return roll < 0 }) ?? candidates.at(-1)
}
export const lockStory = (
  story: StoryDefinition, travelerCatId: CatId, travelerName: string,
  departsAt: number, returnsAt: number,
): StoryPlan => ({
  storyId: story.id, contentVersion: story.version, title: story.title, place: story.place,
  closing: story.closing, travelerCatId, travelerName, departsAt, returnsAt,
  tripId: `${travelerCatId}-${departsAt}`,
  acts: story.acts.map((act, index) => ({
    index, revealAt: departsAt + (returnsAt - departsAt) * (index + 1) / 5,
    recipe: { kind: 'story-frame', src: `/stories/${story.id}/v${story.version}/${act.image}.webp`, copy: act.copy },
  })),
})
export const revealStory = (state: StoryState, plan: StoryPlan, now: number): StoryState => {
  const previous = state.collections.find(({ tripId }) => tripId === plan.tripId)
  const arrived = plan.acts.filter(({ revealAt }) => revealAt <= now)
  if (!arrived.length || arrived.length <= (previous?.acts.length ?? 0)) return state
  const { acts: _acts, closing, ...identity } = plan
  const collection: StoryCollection = {
    ...identity,
    acts: arrived.map((act) => ({ ...act, isRead: previous?.acts[act.index]?.isRead ?? false })),
    ...(arrived.length === 4 ? { closing } : {}),
  }
  return { ...state, collections: previous
    ? state.collections.map((entry) => entry.tripId === plan.tripId ? collection : entry)
    : [...state.collections, collection] }
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const validIdentity = (v: Record<string, unknown>) => (
  text(v.storyId) && text(v.contentVersion) && text(v.travelerCatId) && text(v.travelerName)
  && text(v.title) && text(v.place) && finite(v.departsAt) && finite(v.returnsAt)
  && v.returnsAt > v.departsAt && v.tripId === `${v.travelerCatId}-${v.departsAt}`
)
const validActs = (v: Record<string, unknown>, collection: boolean) => (
  Array.isArray(v.acts) && v.acts.length <= 4 && v.acts.length >= (collection ? 1 : 4)
  && v.acts.every((act, index) => record(act) && act.index === index && finite(act.revealAt)
    && act.revealAt === Number(v.departsAt) + (Number(v.returnsAt) - Number(v.departsAt)) * (index + 1) / 5
    && record(act.recipe) && act.recipe.kind === 'story-frame' && text(act.recipe.copy)
    && typeof act.recipe.src === 'string' && /^\/stories\/[a-z-]+\/v[0-9]+\/scene-[a-z0-9-]+\.webp$/.test(act.recipe.src)
    && (!collection || typeof act.isRead === 'boolean'))
)
export const isStoryPlan = (v: unknown): v is StoryPlan => record(v) && validIdentity(v) && validActs(v, false) && text(v.closing)
export const isStoryState = (v: unknown): v is StoryState => (
  record(v) && record(v.lastTripByCat) && Object.values(v.lastTripByCat).every((kind) => kind === 'ordinary' || kind === 'story')
  && Array.isArray(v.collections) && v.collections.every((entry) => record(entry) && validIdentity(entry) && validActs(entry, true)
    && (Array.isArray(entry.acts) && entry.acts.length === 4 ? text(entry.closing) : entry.closing === undefined))
  && new Set(v.collections.map((entry) => entry.tripId)).size === v.collections.length
)
