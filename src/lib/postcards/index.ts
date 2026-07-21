import type { AssetCatalog } from '../assets'
import type { Itinerary } from '../itinerary'
import type {
  DestinationId,
  PostcardId,
  TripId,
} from '../ids'
import type {
  SelectedPostcard,
  TripContent,
} from '../selection'

export interface ReceivedPostcard extends SelectedPostcard {
  id: PostcardId
  tripId: TripId
  destinationId: DestinationId
  revealAt: number
  isRead: boolean
}

export interface PostcardState {
  received: readonly ReceivedPostcard[]
}

export interface PostcardComposition {
  scene: {
    src: string
  }
  portrait: {
    src: string
    anchorX: number
    anchorY: number
    heightScale: number
    flip: boolean
  }
  note: string
  postmarkDate: string
}

export type PostcardAction =
  | {
      type: 'timePassed'
      now: number
      tripId: TripId
      itinerary: Itinerary
      content: TripContent
    }
  | {
      type: 'postcardViewed'
      postcardId: PostcardId
    }

export const createInitialPostcardState = (): PostcardState => ({
  received: [],
})

export const resolvePostcardComposition = (
  _catalog: AssetCatalog,
  postcard: ReceivedPostcard,
): PostcardComposition => {
  const { recipe } = postcard
  const [sceneLayer, portraitLayer] = recipe.layers

  return {
    scene: {
      src: sceneLayer.src,
    },
    portrait: {
      src: portraitLayer.src,
      anchorX: recipe.composition.x,
      anchorY: recipe.composition.y,
      heightScale: recipe.composition.scale,
      flip: recipe.composition.flip,
    },
    note: recipe.copy.text,
    postmarkDate: new Date(postcard.revealAt)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' '),
  }
}

export const reducePostcards = (
  state: PostcardState,
  action: PostcardAction,
): PostcardState => {
  if (action.type === 'postcardViewed') {
    const postcard = state.received.find(({ id }) => id === action.postcardId)
    if (!postcard || postcard.isRead) return state

    return {
      received: state.received.map((entry) => (
        entry.id === action.postcardId
          ? { ...entry, isRead: true }
          : entry
      )),
    }
  }

  const additions: ReceivedPostcard[] = []

  for (const [index, slot] of action.itinerary.postcardSlots.entries()) {
    if (slot.revealAt > action.now) continue

    const id = `${action.tripId}--postcard-${index + 1}`
    if (state.received.some((postcard) => postcard.id === id)) continue

    const selected = action.content.postcards[index]
    if (!selected) {
      throw new RangeError('旅行内容与明信片时间线不一致')
    }

    additions.push({
      id,
      tripId: action.tripId,
      destinationId: slot.destinationId,
      revealAt: slot.revealAt,
      ...selected,
      isRead: false,
    })
  }

  if (additions.length === 0) return state

  return {
    received: [...state.received, ...additions],
  }
}
