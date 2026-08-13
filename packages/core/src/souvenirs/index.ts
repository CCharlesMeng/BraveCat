import type { Itinerary } from '../itinerary'
import type {
  DestinationId,
  SouvenirId,
  TripId,
} from '../ids'
import type { TripContent } from '../selection'

export interface ReceivedSouvenir {
  id: string
  tripId: TripId
  souvenirId: SouvenirId
  destinationId: DestinationId
  revealedAt: number
}

export interface SouvenirState {
  received: readonly ReceivedSouvenir[]
}

export interface SouvenirAction {
  type: 'timePassed'
  now: number
  tripId: TripId
  itinerary: Itinerary
  content: TripContent
}

export const createInitialSouvenirState = (): SouvenirState => ({
  received: [],
})

export const reduceSouvenirs = (
  state: SouvenirState,
  action: SouvenirAction,
): SouvenirState => {
  if (action.now < action.itinerary.returnsAt) return state

  const additions: ReceivedSouvenir[] = []
  for (const [index, souvenirId] of action.content.souvenirIds.entries()) {
    const id = `${action.tripId}--souvenir-${index + 1}`
    if (state.received.some((souvenir) => souvenir.id === id)) continue

    additions.push({
      id,
      tripId: action.tripId,
      souvenirId,
      destinationId: action.itinerary.destinationId,
      revealedAt: action.itinerary.returnsAt,
    })
  }

  if (additions.length === 0) return state

  return {
    received: [...state.received, ...additions],
  }
}
