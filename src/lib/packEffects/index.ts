import type {
  ItemDefinition,
  ItemEffect,
  PortraitPose,
} from '../assets'
import type { ItemId } from '../ids'

export interface PackEffects {
  travelDurationMultiplier: number
  secondPostcardChanceBonus: number
  companionChanceBonus: number
  poseWeights: Readonly<Partial<Record<PortraitPose, number>>>
  copyTagWeights: Readonly<Record<string, number>>
}

export const EMPTY_PACK_EFFECTS: PackEffects = {
  travelDurationMultiplier: 1,
  secondPostcardChanceBonus: 0,
  companionChanceBonus: 0,
  poseWeights: {},
  copyTagWeights: {},
}

const applyEffect = (
  effects: PackEffects,
  effect: ItemEffect,
): PackEffects => {
  if (effect.kind === 'travel-duration') {
    return {
      ...effects,
      travelDurationMultiplier:
        effects.travelDurationMultiplier * effect.multiplier,
    }
  }
  if (effect.kind === 'second-postcard-chance') {
    return {
      ...effects,
      secondPostcardChanceBonus: Math.min(
        0.2,
        effects.secondPostcardChanceBonus + effect.bonus,
      ),
    }
  }
  if (effect.kind === 'companion-chance') {
    return {
      ...effects,
      companionChanceBonus: Math.min(
        0.1,
        effects.companionChanceBonus + effect.bonus,
      ),
    }
  }
  if (effect.kind === 'pose-weight') {
    return {
      ...effects,
      poseWeights: {
        ...effects.poseWeights,
        [effect.pose]:
          (effects.poseWeights[effect.pose] ?? 1) * effect.multiplier,
      },
    }
  }

  return {
    ...effects,
    copyTagWeights: {
      ...effects.copyTagWeights,
      [effect.tag]:
        (effects.copyTagWeights[effect.tag] ?? 1) * effect.multiplier,
    },
  }
}

export const resolvePackEffects = (
  items: readonly ItemDefinition[],
  packedItemIds: readonly ItemId[],
): PackEffects => {
  const definitions = new Map(items.map((item) => [item.id, item]))

  return packedItemIds.reduce((effects, itemId) => {
    const item = definitions.get(itemId)
    return (item?.effects ?? []).reduce(applyEffect, effects)
  }, EMPTY_PACK_EFFECTS)
}
