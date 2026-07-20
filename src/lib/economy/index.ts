import type { CatId, DestinationId, ItemId } from '../ids'
import type { ItemKind } from '../assets'

export interface TreatAccrual {
  lastAccruedAt: number
  amountPerHour: number
  capacity: number
}

export interface EconomyState {
  treats: number
  windowsillTreats: number
  accrual: TreatAccrual
  ownedItems: Readonly<Partial<Record<ItemId, number>>>
  packs: Readonly<Record<CatId, readonly PackedItem[]>>
}

export interface PackedItem {
  itemId: ItemId
  kind: ItemKind
  wishDestinationId?: DestinationId
}

export type PackItemRejectionReason =
  | 'pack-locked'
  | 'item-not-owned'
  | 'capacity-reached'
  | 'duplicate-item'
  | 'wish-already-packed'
  | 'wish-destination-required'

export interface AddItemToPackAction {
  type: 'itemAddedToPack'
  catId: CatId
  itemId: ItemId
  itemKind: ItemKind
  wishDestinationId?: DestinationId
  capacity: number
  packLocked: boolean
}

export type EconomyAction =
  | { type: 'timePassed'; now: number }
  | { type: 'windowsillCollected' }
  | { type: 'treatsGranted'; amount: number }
  | { type: 'itemPurchased'; itemId: ItemId; price: number }
  | AddItemToPackAction
  | { type: 'itemRemovedFromPack'; catId: CatId; itemId: ItemId }

export type EconomyReducer = (
  state: EconomyState,
  action: EconomyAction,
) => EconomyState

const HOUR_IN_MS = 60 * 60 * 1_000

export const createInitialEconomyState = (now: number): EconomyState => ({
  treats: 12,
  windowsillTreats: 0,
  accrual: {
    lastAccruedAt: now,
    amountPerHour: 1,
    capacity: 24,
  },
  ownedItems: {},
  packs: {},
})

export const getPackItemRejectionReason = (
  state: EconomyState,
  action: AddItemToPackAction,
): PackItemRejectionReason | undefined => {
  const available = state.ownedItems[action.itemId] ?? 0
  const pack = state.packs[action.catId] ?? []

  if (action.packLocked) return 'pack-locked'
  if (available === 0) return 'item-not-owned'
  if (pack.length >= action.capacity) return 'capacity-reached'
  if (pack.some(({ itemId }) => itemId === action.itemId)) {
    return 'duplicate-item'
  }
  if (
    action.itemKind === 'wish'
    && pack.some(({ kind }) => kind === 'wish')
  ) {
    return 'wish-already-packed'
  }
  if (action.itemKind === 'wish' && !action.wishDestinationId) {
    return 'wish-destination-required'
  }

  return undefined
}

export const reduceEconomy: EconomyReducer = (state, action) => {
  if (action.type === 'treatsGranted') {
    if (!Number.isInteger(action.amount) || action.amount <= 0) return state

    return {
      ...state,
      treats: state.treats + action.amount,
    }
  }

  if (action.type === 'itemRemovedFromPack') {
    const pack = state.packs[action.catId] ?? []
    if (!pack.some(({ itemId }) => itemId === action.itemId)) return state

    return {
      ...state,
      ownedItems: {
        ...state.ownedItems,
        [action.itemId]: (state.ownedItems[action.itemId] ?? 0) + 1,
      },
      packs: {
        ...state.packs,
        [action.catId]: pack.filter(
          ({ itemId }) => itemId !== action.itemId,
        ),
      },
    }
  }

  if (action.type === 'itemAddedToPack') {
    const available = state.ownedItems[action.itemId] ?? 0
    const pack = state.packs[action.catId] ?? []
    if (getPackItemRejectionReason(state, action)) return state

    return {
      ...state,
      ownedItems: {
        ...state.ownedItems,
        [action.itemId]: available - 1,
      },
      packs: {
        ...state.packs,
        [action.catId]: [
          ...pack,
          {
            itemId: action.itemId,
            kind: action.itemKind,
            ...(action.wishDestinationId
              ? { wishDestinationId: action.wishDestinationId }
              : {}),
          },
        ],
      },
    }
  }

  if (action.type === 'itemPurchased') {
    if (action.price < 0 || state.treats < action.price) return state

    return {
      ...state,
      treats: state.treats - action.price,
      ownedItems: {
        ...state.ownedItems,
        [action.itemId]: (state.ownedItems[action.itemId] ?? 0) + 1,
      },
    }
  }

  if (action.type === 'windowsillCollected') {
    if (state.windowsillTreats === 0) return state

    return {
      ...state,
      treats: state.treats + state.windowsillTreats,
      windowsillTreats: 0,
    }
  }

  if (action.type !== 'timePassed') return state

  const elapsed = action.now - state.accrual.lastAccruedAt
  if (elapsed <= 0 || state.accrual.amountPerHour <= 0) return state

  const interval = HOUR_IN_MS / state.accrual.amountPerHour
  const accruedTreats = Math.floor(elapsed / interval)
  if (accruedTreats === 0) return state

  return {
    ...state,
    windowsillTreats: Math.min(
      state.accrual.capacity,
      state.windowsillTreats + accruedTreats,
    ),
    accrual: {
      ...state.accrual,
      lastAccruedAt: state.accrual.lastAccruedAt + accruedTreats * interval,
    },
  }
}
