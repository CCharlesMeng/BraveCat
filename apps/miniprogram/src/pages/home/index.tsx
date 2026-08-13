/**
 * 首页家场景（对齐 App.svelte 的 room 区块 + home-nav）。
 * 消费 homeTheme 的 backdrop 图层数组与样式字符串输出；样式为
 * left/top/width/height 百分比 + transform + clip-path 的内联串，
 * WebView 渲染器下 WXSS 直接兼容（README 记录 Skyline 差异）。
 */
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, Input, Text, View } from '@tarojs/components'
import {
  LANDMARK_SCENES_SHIPPING_ELIGIBLE,
} from '@bravecat/core/assets/starterCatalog'
import { resolveHomeScene } from '@bravecat/core/homeTheme'
import { resolvePostcardComposition } from '@bravecat/core/postcards'
import type { TravelState } from '@bravecat/core/travel'
import { controller, hydrateOnce } from '../../game/controller'
import { useGameSnapshot, useSettleLoop } from '../../game/useGameClient'
import { findSouvenir, STARTER_CATALOG } from '../../game/catalog'
import {
  drawerArt,
  homeActivities,
  homeTimeFor,
  roomCopy,
  travelStatusCopy,
} from '../../game/copy'
import { asset } from '../../platform/assetBase'
import './index.scss'

const HOME_TRAVEL_STATE = { kind: 'home' } as const satisfies TravelState
const isDevelopment = process.env.NODE_ENV === 'development'
const canRenderLandmarkScenes = (
  isDevelopment || LANDMARK_SCENES_SHIPPING_ELIGIBLE
)

export default function Home() {
  const snapshot = useGameSnapshot()
  const [adoptionName, setAdoptionName] = useState('Minho')
  const [adoptionNotice, setAdoptionNotice] = useState('')
  const [hydrateNotice, setHydrateNotice] = useState('')
  const [activityNotice, setActivityNotice] = useState('')

  useEffect(() => {
    void hydrateOnce().then(({ loadFailed }) => {
      if (loadFailed) setHydrateNotice('没有读到上次的家，暂时从这里开始。')
    })
  }, [])

  useSettleLoop(({ returnedCats }) => {
    if (returnedCats.length === 0) return
    if (returnedCats.length === 1) {
      const cat = returnedCats[0]
      setActivityNotice(cat.souvenirCount > 0
        ? `${cat.name}回家了，还带回 ${cat.souvenirCount} 件纪念品。`
        : `${cat.name}回家了，正在熟悉的垫子上休息。`)
    } else {
      setActivityNotice(`${returnedCats.length} 只小猫先后回家了。`)
    }
  })

  const { game, now, hydrated, homeActivity } = snapshot
  const economy = game.economy
  const activeCatId = game.activeCatId ?? game.cats[0]?.id ?? null
  const catProfile = game.cats.find(({ id }) => id === activeCatId) ?? null
  const catName = catProfile?.name ?? 'Minho'
  const activeCatKey = controller.activeCatKeyOf(game)
  const travel = game.travelByCat[activeCatKey] ?? HOME_TRAVEL_STATE
  const travelPresence = controller.presence(game, activeCatKey, now)
  const isCatAway = travelPresence === 'traveling'
  const activePortrait = STARTER_CATALOG.portraits.find(
    ({ id }) => id === (catProfile?.portraitId ?? 'minho'),
  ) ?? STARTER_CATALOG.portraits[0]
  const activeActivity = homeActivities[homeActivity]
  const homePortraitSrc = asset(activePortrait.poses[activeActivity.pose])

  const homeScene = resolveHomeScene(game.homeCustomization, {
    time: homeTimeFor(new Date(now)),
    activity: homeActivity,
    portraitId: activePortrait.id,
  })

  const postcardsByPostmark = [...game.postcards.received].sort(
    (left, right) => right.revealAt - left.revealAt,
  )
  const seenDestinations = new Set<string>()
  const displayedVisitedPlaces = postcardsByPostmark.filter((postcard) => {
    if (seenDestinations.has(postcard.destinationId)) return false
    seenDestinations.add(postcard.destinationId)
    return true
  }).slice(0, 6)
  const seenSouvenirs = new Set<string>()
  const displayedSouvenirs = [...game.souvenirs.received]
    .sort((left, right) => right.revealedAt - left.revealedAt)
    .filter((souvenir) => {
      if (seenSouvenirs.has(souvenir.souvenirId)) return false
      seenSouvenirs.add(souvenir.souvenirId)
      return true
    })
    .slice(0, 3)
  const unreadPostcardCount = game.postcards.received.filter(
    ({ isRead }) => !isRead,
  ).length

  const currentTripId = travel.kind === 'planned'
    ? `${activeCatKey}-${travel.plan.itinerary.departsAt}`
    : null
  const currentTripSouvenirCount = currentTripId
    ? game.souvenirs.received.filter(
      ({ tripId }) => tripId === currentTripId,
    ).length
    : 0

  const persistenceNotice = snapshot.saveFailed
    ? '这次没能保存，先别退出小程序。'
    : hydrateNotice
  const statusLine = persistenceNotice
    || travelStatusCopy(travelPresence, catName, currentTripSouvenirCount)
    || (unreadPostcardCount > 0
      ? `有 ${unreadPostcardCount} 张新明信片寄到了。`
      : '')
    || activityNotice
    || '屋里很安静，风从窗外吹进来。'

  const completeAdoption = async () => {
    try {
      await controller.adopt(adoptionName.trim() || 'Minho')
      setAdoptionNotice('')
      setHydrateNotice('')
    } catch (error) {
      setAdoptionNotice(error instanceof Error
        ? error.message
        : '这次没有完成领养，请再试一次。')
    }
  }

  const collectTreats = async () => {
    if (economy.windowsillTreats === 0) return
    await controller.collectTreats()
    setActivityNotice(`窗台空了。${catName}好像听见了小鱼干的声音。`)
  }

  const setTimeAcceleration = async (multiplier: number) => {
    controller.setTimeAcceleration(multiplier)
    setActivityNotice(multiplier === 1
      ? '开发时钟已恢复为实时。'
      : `开发时钟已切换为 ${multiplier} 倍。`)
    await controller.settle()
  }

  const grantDevelopmentTreats = async () => {
    const granted = await controller.applyEconomyAction({
      type: 'treatsGranted',
      amount: 24,
    })
    if (granted) setActivityNotice('测试补给已经加入：+24 条小鱼干。')
  }

  const goTo = (page: 'pack' | 'shop' | 'album') => {
    void Taro.navigateTo({ url: `/pages/${page}/index` })
  }

  if (!hydrated) {
    return (
      <View className="adoption-shell">
        <Text className="brand-kicker">BraveCat</Text>
        <Text className="page-title">咪游记</Text>
        <Text className="muted">正在把家里的东西摆回原位……</Text>
      </View>
    )
  }

  if (!catProfile) {
    return (
      <View className="adoption-shell">
        <Text className="brand-kicker">BraveCat · 初次见面</Text>
        <Text className="page-title">让它住进家里</Text>
        <View className="adoption-card">
          <Image
            className="adoption-portrait"
            src={asset('/portraits/minho/portrait--minho--sit--v01.png')}
            mode="aspectFit"
          />
          <Text className="muted">给小猫取一个名字</Text>
          <Input
            className="adoption-input"
            value={adoptionName}
            maxlength={12}
            onInput={(event) => setAdoptionName(event.detail.value)}
          />
          <Text className="muted small">
            名字以后仍属于同一只小猫，不会因为更换形象而丢失进度。
          </Text>
          {adoptionNotice && (
            <Text className="notice-error">{adoptionNotice}</Text>
          )}
          <View
            className="primary-button"
            onClick={() => void completeAdoption()}
          >
            <Text>让它住进家里</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="home-shell">
      <View className="topbar">
        <View>
          <Text className="brand-kicker">BraveCat</Text>
          <Text className="page-title">咪游记</Text>
        </View>
        <View className="treat-balance">
          <Image src={asset(drawerArt.treat)} mode="aspectFit" />
          <Text>{economy.treats}</Text>
        </View>
      </View>

      {isDevelopment && (
        <View className="developer-clock">
          <Text className="muted small">开发时钟</Text>
          <View
            className="dev-button"
            onClick={() => void setTimeAcceleration(1)}
          ><Text>实时</Text></View>
          <View
            className="dev-button"
            onClick={() => void setTimeAcceleration(3_600)}
          ><Text>1时/秒</Text></View>
          <View
            className="dev-button"
            onClick={() => void setTimeAcceleration(86_400)}
          ><Text>1天/秒</Text></View>
          <View
            className="dev-button"
            onClick={() => void grantDevelopmentTreats()}
          ><Text>补给+24</Text></View>
        </View>
      )}

      <View className="room">
        <View className="home-art-canvas">
          {homeScene.backdrop.map((layer) => (
            <Image
              key={layer.id}
              className="home-art-layer"
              src={layer.src}
              mode="scaleToFill"
            />
          ))}
          {homeScene.rearPieces.map((layer) => (
            <Image
              key={layer.id}
              className="home-art-layer"
              src={layer.src}
              mode="scaleToFill"
            />
          ))}
          {!isCatAway && (
            <Image
              className="home-art-cat"
              src={homePortraitSrc}
              mode="aspectFit"
              style={homeScene.cat.imageStyle}
            />
          )}
        </View>

        <View className="home-display-canvas">
          {homeScene.postcardDisplay.fixtureSrc && (
            <Image
              className="home-art-layer"
              src={homeScene.postcardDisplay.fixtureSrc}
              mode="scaleToFill"
            />
          )}
          {homeScene.postcardDisplay.slots.map((slot, index) => {
            const postcard = displayedVisitedPlaces[index]
            if (!postcard) {
              return (
                <View
                  key={`empty-${index}`}
                  className="display-postcard empty"
                  style={slot.style}
                />
              )
            }
            const composition = resolvePostcardComposition(
              STARTER_CATALOG,
              postcard,
            )
            return (
              <View
                key={postcard.id}
                className="display-postcard"
                style={slot.style}
                onClick={() => void Taro.navigateTo({
                  url: `/pages/postcard/index?kind=postcards&id=${postcard.id}`,
                })}
              >
                {canRenderLandmarkScenes ? (
                  <Image
                    className="display-postcard-art"
                    src={composition.scene.src}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="display-postcard-art placeholder" />
                )}
              </View>
            )
          })}
          {displayedSouvenirs.map((receivedSouvenir, index) => {
            const souvenir = findSouvenir(receivedSouvenir.souvenirId)
            const anchor = homeScene.souvenirDisplay.anchors[index]
            if (!anchor) return null
            return (
              <View
                key={receivedSouvenir.id}
                className="table-souvenir"
                style={anchor.style}
                onClick={() => void Taro.navigateTo({
                  url: `/pages/postcard/index?kind=souvenirs&id=${receivedSouvenir.id}`,
                })}
              >
                <View className="souvenir-support" />
                {souvenir?.imageSrc ? (
                  <Image src={asset(souvenir.imageSrc)} mode="aspectFit" />
                ) : (
                  <Text>{souvenir?.visualToken ?? '念'}</Text>
                )}
              </View>
            )
          })}
          {homeScene.souvenirDisplay.occlusionSrc && (
            <Image
              className="home-art-layer occlusion"
              src={homeScene.souvenirDisplay.occlusionSrc}
              mode="scaleToFill"
            />
          )}
          {homeScene.lighting && (
            <Image
              className="home-art-layer lighting"
              src={homeScene.lighting.src}
              mode="scaleToFill"
            />
          )}
          <View
            className={`windowsill${economy.windowsillTreats === 0 ? ' empty' : ''}`}
            style={homeScene.treat.style}
            onClick={() => void collectTreats()}
          >
            {economy.windowsillTreats > 0 ? (
              <>
                <Image src={asset(drawerArt.treatLarge)} mode="aspectFit" />
                <Text className="treat-count">
                  +{economy.windowsillTreats}
                </Text>
              </>
            ) : (
              <Text className="empty-sill-mark">·</Text>
            )}
          </View>
        </View>

        {isCatAway && travel.kind === 'planned' && (
          <View className="departure-note">
            <Text className="muted small">留给家里</Text>
            <Text className="note-body">{travel.note}</Text>
            <Text className="muted small">— {catName}</Text>
          </View>
        )}
      </View>

      <View className="room-copy">
        <Text className="cat-name">{catName}</Text>
        <Text className="muted">
          {roomCopy(travelPresence, homeActivity)}
        </Text>
      </View>

      <View className="home-nav">
        <View className="nav-button" onClick={() => goTo('pack')}>
          <Image src={asset(drawerArt.nav.pack)} mode="aspectFit" />
          <Text>行囊</Text>
        </View>
        <View className="nav-button" onClick={() => goTo('shop')}>
          <Image src={asset(drawerArt.nav.shop)} mode="aspectFit" />
          <Text>小铺</Text>
        </View>
        <View className="nav-button" onClick={() => goTo('album')}>
          <Image src={asset(drawerArt.nav.album)} mode="aspectFit" />
          <Text>相册</Text>
          {unreadPostcardCount > 0 && (
            <Text className="unread-badge">{unreadPostcardCount}</Text>
          )}
        </View>
      </View>

      <Text className="status-line">{statusLine}</Text>
    </View>
  )
}
