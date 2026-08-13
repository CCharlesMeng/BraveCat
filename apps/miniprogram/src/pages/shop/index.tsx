/**
 * 小铺页（对齐 App.svelte 的 shop 抽屉）。
 * 小铺只收 Treat（ADR-0006）：AI 生成次数/会员的付费入口独立于本页，
 * 走 platform/purchase.ts 的 PurchasePort（iOS 隐藏购买入口）。
 */
import { useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import type { ItemDefinition } from '@bravecat/core/assets'
import type { DestinationId } from '@bravecat/core/ids'
import { controller } from '../../game/controller'
import { useGameSnapshot, useSettleLoop } from '../../game/useGameClient'
import { findItem, STARTER_CATALOG, STARTER_ITEMS } from '../../game/catalog'
import { describePackRejection, itemKindLabels } from '../../game/copy'
import { asset } from '../../platform/assetBase'
import './index.scss'

type ShopCategory = ItemDefinition['kind']

export default function Shop() {
  const snapshot = useGameSnapshot()
  const [shopCategory, setShopCategory] = useState<ShopCategory>('snack')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedWishDestinationId, setSelectedWishDestinationId] = useState<
    DestinationId
  >(controller.catalog.destinations[0].id)
  useSettleLoop()

  const { game, pendingPurchase } = snapshot
  const treats = game.economy.treats
  const catName = game.cats.find(
    ({ id }) => id === (game.activeCatId ?? game.cats[0]?.id),
  )?.name ?? 'Minho'
  const shopItems = STARTER_ITEMS.filter(({ kind }) => kind === shopCategory)
  const pendingPurchaseItem = pendingPurchase
    ? findItem(pendingPurchase.itemId) ?? null
    : null
  const pendingPurchasePackRejection = pendingPurchaseItem
    ? controller.packRejectionFor(
      snapshot,
      pendingPurchaseItem,
      pendingPurchaseItem.kind === 'wish'
        ? selectedWishDestinationId
        : undefined,
    )
    : undefined

  const purchaseItem = async (item: ItemDefinition) => {
    if (busy) return
    if (pendingPurchase) {
      setNotice('先决定刚买下的物品放在哪里吧。')
      return
    }
    setBusy(true)
    try {
      setNotice('')
      const status = await controller.purchaseItem(item)
      if (status !== 'awaiting-choice') {
        setNotice(status === 'purchase-rejected'
          ? '还差一些小鱼干，先看看别的吧。'
          : '先决定刚买下的物品放在哪里吧。')
        return
      }
      setNotice(`${item.name}已经买下。选一个去处吧。`)
    } finally {
      setBusy(false)
    }
  }

  const leavePurchasedItemAtHome = async () => {
    if (busy || !pendingPurchaseItem) return
    setBusy(true)
    try {
      const itemName = pendingPurchaseItem.name
      await controller.keepPurchasedItemAtHome()
      setNotice(`${itemName}已经留在家里。`)
    } finally {
      setBusy(false)
    }
  }

  const packPurchasedItem = async () => {
    if (busy || !pendingPurchaseItem) return
    setBusy(true)
    try {
      const item = pendingPurchaseItem
      const result = await controller.packPurchasedItem(
        item.kind === 'wish' ? selectedWishDestinationId : undefined,
      )
      setNotice(result.status === 'packed'
        ? `${item.name}已经放进行囊。`
        : describePackRejection(result.reason, item.name, catName))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="shop-shell">
      <Text className="muted">基础物品一直都在，不用赶时间。</Text>
      {notice && <Text className="notice">{notice}</Text>}

      <View className="tabs">
        {(Object.entries(itemKindLabels) as [ShopCategory, string][]).map(
          ([kind, label]) => (
            <View
              key={kind}
              className={`tab${shopCategory === kind ? ' active' : ''}`}
              onClick={() => setShopCategory(kind)}
            >
              <Text>{label}</Text>
            </View>
          ),
        )}
      </View>

      {shopItems.map((item) => {
        const owned = game.economy.ownedItems[item.id] ?? 0
        const affordable = treats >= item.price
        const isPending = pendingPurchaseItem?.id === item.id
        const buttonDisabled = !affordable || busy || pendingPurchase !== null
        return (
          <View key={item.id} className="shop-card">
            <View className="card">
              <Image
                className="card-token"
                src={asset(item.imageSrc)}
                mode="aspectFit"
              />
              <View className="card-copy">
                <Text className="card-title">{item.name}</Text>
                <Text className="muted small">{item.effectHint}</Text>
                <Text className="muted small">家里有 {owned} 件</Text>
              </View>
              {!isPending && (
                <View
                  className={`card-action${buttonDisabled ? ' disabled' : ''}`}
                  onClick={() => {
                    if (!buttonDisabled) void purchaseItem(item)
                  }}
                >
                  <Text>
                    {busy
                      ? '购买中…'
                      : pendingPurchase
                        ? '请先选择'
                        : affordable
                          ? `${item.price} 条小鱼干`
                          : `还差 ${item.price - treats}`}
                  </Text>
                </View>
              )}
            </View>

            {isPending && (
              <View className="purchase-choice">
                {item.kind === 'wish' && (
                  <>
                    <Text className="muted small">写下心愿地</Text>
                    <View className="wish-grid">
                      {STARTER_CATALOG.destinations.map((destination) => (
                        <View
                          key={destination.id}
                          className={`tab${selectedWishDestinationId === destination.id ? ' active' : ''}`}
                          onClick={() => (
                            setSelectedWishDestinationId(destination.id)
                          )}
                        >
                          <Text>{destination.name}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
                <View className="purchase-choice-actions">
                  <View
                    className="card-action secondary"
                    onClick={() => void leavePurchasedItemAtHome()}
                  >
                    <Text>带回家</Text>
                  </View>
                  <View
                    className={`card-action${pendingPurchasePackRejection !== undefined ? ' disabled' : ''}`}
                    onClick={() => {
                      if (pendingPurchasePackRejection === undefined) {
                        void packPurchasedItem()
                      }
                    }}
                  >
                    <Text>装入行囊</Text>
                  </View>
                </View>
                {pendingPurchasePackRejection === 'capacity-reached' && (
                  <Text className="muted small">行囊已满，请先调整。</Text>
                )}
              </View>
            )}
          </View>
        )
      })}

      <View className="treat-footer">
        <Text className="muted small">现在共有 {treats} 条小鱼干</Text>
      </View>
    </View>
  )
}
