import type { ItemDefinition, ItemKind } from '../assets'
import {
  getPackItemRejectionReason,
  reduceEconomy,
  type AddItemToPackAction,
  type PackItemRejectionReason,
} from '../economy'
import type { GameState } from '../game'
import type { CatId, DestinationId, ItemId } from '../ids'

export interface PendingPurchase {
  itemId: ItemId
  itemKind: ItemKind
}

export interface ShopPurchaseFlowState {
  game: GameState
  pendingPurchase: PendingPurchase | null
}

export interface ShopPurchaseFlowResult {
  status:
    | 'awaiting-choice'
    | 'choice-pending'
    | 'purchase-rejected'
    | 'kept-at-home'
    | 'no-pending-purchase'
    | 'packed'
    | 'pack-rejected'
  state: ShopPurchaseFlowState
  reason?: PackItemRejectionReason
}

export interface ConfirmPurchasedItemRequest {
  catId: CatId
  capacity: number
  packLocked: boolean
  wishDestinationId?: DestinationId
}

export const beginPurchaseChoice = (
  state: ShopPurchaseFlowState,
  item: ItemDefinition,
): ShopPurchaseFlowResult => {
  if (state.pendingPurchase) {
    return { status: 'choice-pending', state }
  }

  const economy = reduceEconomy(state.game.economy, {
    type: 'itemPurchased',
    itemId: item.id,
    price: item.price,
  })
  if (economy === state.game.economy) {
    return { status: 'purchase-rejected', state }
  }

  return {
    status: 'awaiting-choice',
    state: {
      game: {
        ...state.game,
        economy,
      },
      pendingPurchase: {
        itemId: item.id,
        itemKind: item.kind,
      },
    },
  }
}

export const keepPurchasedItemAtHome = (
  state: ShopPurchaseFlowState,
): ShopPurchaseFlowResult => {
  if (!state.pendingPurchase) {
    return { status: 'no-pending-purchase', state }
  }

  return {
    status: 'kept-at-home',
    state: {
      ...state,
      pendingPurchase: null,
    },
  }
}

export const confirmPurchasedItemInPack = (
  state: ShopPurchaseFlowState,
  request: ConfirmPurchasedItemRequest,
): ShopPurchaseFlowResult => {
  if (!state.pendingPurchase) {
    return { status: 'no-pending-purchase', state }
  }

  const action: AddItemToPackAction = {
    type: 'itemAddedToPack',
    catId: request.catId,
    itemId: state.pendingPurchase.itemId,
    itemKind: state.pendingPurchase.itemKind,
    wishDestinationId: request.wishDestinationId,
    capacity: request.capacity,
    packLocked: request.packLocked,
  }
  const reason = getPackItemRejectionReason(state.game.economy, action)
  if (reason) {
    return {
      status: 'pack-rejected',
      state: {
        ...state,
        pendingPurchase: null,
      },
      reason,
    }
  }

  const economy = reduceEconomy(state.game.economy, action)
  if (economy === state.game.economy) {
    return {
      status: 'pack-rejected',
      state: {
        ...state,
        pendingPurchase: null,
      },
    }
  }

  return {
    status: 'packed',
    state: {
      game: {
        ...state.game,
        economy,
      },
      pendingPurchase: null,
    },
  }
}
