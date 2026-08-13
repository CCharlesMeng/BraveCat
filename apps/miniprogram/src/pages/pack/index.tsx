/** 行囊页（对齐 App.svelte 的 pack 抽屉；拖拽改为按钮装入/取回）。 */
import { useState } from 'react'
import { Image, Picker, Text, View } from '@tarojs/components'
import type { ItemDefinition } from '@bravecat/core/assets'
import type { DestinationId } from '@bravecat/core/ids'
import { controller } from '../../game/controller'
import { useGameSnapshot, useSettleLoop } from '../../game/useGameClient'
import {
  findDestination,
  findItem,
  STARTER_CATALOG,
  STARTER_ITEMS,
} from '../../game/catalog'
import { drawerArt, itemKindLabels, packItemStyle } from '../../game/copy'
import { asset } from '../../platform/assetBase'
import './index.scss'

export default function Pack() {
  const snapshot = useGameSnapshot()
  const [notice, setNotice] = useState('')
  const [selectedWishDestinationId, setSelectedWishDestinationId] = useState<
    DestinationId
  >(controller.catalog.destinations[0].id)
  useSettleLoop()

  const { game, now } = snapshot
  const economy = game.economy
  const activeCatKey = controller.activeCatKeyOf(game)
  const pack = economy.packs[activeCatKey] ?? []
  const capacity = controller.packCapacity
  const travelPresence = controller.presence(game, activeCatKey, now)
  const isPackLocked = travelPresence === 'traveling'
  const availableItems = STARTER_ITEMS.filter(
    ({ id }) => (economy.ownedItems[id] ?? 0) > 0,
  )
  const destinations = STARTER_CATALOG.destinations
  const wishIndex = Math.max(
    0,
    destinations.findIndex(({ id }) => id === selectedWishDestinationId),
  )

  const summaryCopy = travelPresence === 'waiting'
    ? '已经准备好了。还可以调整，但不能命令它立刻出发。'
    : travelPresence === 'traveling'
      ? '这些物品正在旅途中，回来前不能调整。'
      : '放入第一件物品后，小猫会自己等待合适的出发时机。'

  const addItemToPack = async (item: ItemDefinition) => {
    const added = await controller.addItemToPack(
      item,
      item.kind === 'wish' ? selectedWishDestinationId : undefined,
    )
    setNotice(added ? `${item.name}已经放进行囊。` : '行囊没有变化。')
  }

  const removeItemFromPack = async (item: ItemDefinition) => {
    const removed = await controller.removeItemFromPack(item)
    if (removed) setNotice(`${item.name}已经放回家里。`)
  }

  return (
    <View className="pack-shell">
      <View className="pack-summary">
        <View className="pack-count">
          <Text className="count">{pack.length} / {capacity}</Text>
          <Text className="muted small">行囊格数</Text>
        </View>
        <Text className="muted">{summaryCopy}</Text>
      </View>

      <View className="pack-art">
        <Image
          className="pack-layer"
          src={asset(drawerArt.packBase)}
          mode="scaleToFill"
        />
        {pack.map((packedItem, index) => {
          const item = findItem(packedItem.itemId)
          if (!item) return null
          return (
            <Image
              key={packedItem.itemId}
              className="pack-item"
              src={asset(item.imageSrc)}
              mode="aspectFit"
              style={packItemStyle(index, item.id)}
            />
          )
        })}
        <Image
          className="pack-layer rim"
          src={asset(drawerArt.packRim)}
          mode="scaleToFill"
        />
      </View>

      {notice && <Text className="notice">{notice}</Text>}

      <Text className="section-title">已装行囊</Text>
      {Array.from({ length: capacity }, (_, index) => {
        const packedItem = pack[index]
        const item = packedItem ? findItem(packedItem.itemId) : undefined
        if (!item || !packedItem) {
          return (
            <View key={`empty-${index}`} className="card empty-slot">
              <Text className="muted">＋ 空格子，去下面挑一件小物</Text>
            </View>
          )
        }
        return (
          <View key={item.id} className="card">
            <Image
              className="card-token"
              src={asset(item.imageSrc)}
              mode="aspectFit"
            />
            <View className="card-copy">
              <Text className="card-title">{item.name}</Text>
              <Text className="muted small">{itemKindLabels[item.kind]}</Text>
              {packedItem.wishDestinationId && (
                <Text className="muted small">
                  心愿地：{findDestination(packedItem.wishDestinationId)?.name}
                </Text>
              )}
            </View>
            <View
              className={`card-action secondary${isPackLocked ? ' disabled' : ''}`}
              onClick={() => {
                if (!isPackLocked) void removeItemFromPack(item)
              }}
            >
              <Text>取回</Text>
            </View>
          </View>
        )
      })}

      <Text className="section-title">家中物品</Text>
      {availableItems.length === 0 && (
        <Text className="muted">先去小铺挑一件小物吧。</Text>
      )}
      {availableItems.map((item) => {
        const itemAlreadyPacked = pack.some(
          ({ itemId }) => itemId === item.id,
        )
        const disabled = pack.length >= capacity
          || isPackLocked
          || itemAlreadyPacked
        return (
          <View key={item.id} className="card">
            <Image
              className="card-token"
              src={asset(item.imageSrc)}
              mode="aspectFit"
            />
            <View className="card-copy">
              <Text className="card-title">{item.name}</Text>
              <Text className="muted small">
                有 {economy.ownedItems[item.id] ?? 0} 件
              </Text>
              {item.kind === 'wish' && (
                <Picker
                  mode="selector"
                  range={destinations.map(({ name }) => name)}
                  value={wishIndex}
                  onChange={(event) => {
                    const index = Number(event.detail.value)
                    setSelectedWishDestinationId(destinations[index].id)
                  }}
                >
                  <Text className="wish-picker">
                    心愿地：{destinations[wishIndex].name} ▾
                  </Text>
                </Picker>
              )}
            </View>
            <View
              className={`card-action${disabled ? ' disabled' : ''}`}
              onClick={() => {
                if (!disabled) void addItemToPack(item)
              }}
            >
              <Text>{itemAlreadyPacked ? '已放入' : '装入'}</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}
