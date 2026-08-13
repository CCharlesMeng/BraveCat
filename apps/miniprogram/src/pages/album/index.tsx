/**
 * 相册页（对齐 App.svelte 的 album 抽屉）。
 * 存档转移在小程序上下文重定义：没有文件下载/上传，导出=复制 JSON
 * 到剪贴板，导入=读剪贴板 JSON（取舍记录见 README）。
 */
import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { resolvePostcardComposition } from '@bravecat/core/postcards'
import {
  LANDMARK_SCENES_SHIPPING_ELIGIBLE,
} from '@bravecat/core/assets/starterCatalog'
import { controller, hydrateOnce } from '../../game/controller'
import { useGameSnapshot, useSettleLoop } from '../../game/useGameClient'
import {
  findDestination,
  findSouvenir,
  STARTER_CATALOG,
} from '../../game/catalog'
import { drawerArt } from '../../game/copy'
import { asset } from '../../platform/assetBase'
import './index.scss'

type AlbumView = 'postcards' | 'souvenirs'

const canRenderLandmarkScenes = (
  process.env.NODE_ENV === 'development' || LANDMARK_SCENES_SHIPPING_ELIGIBLE
)

export default function Album() {
  const snapshot = useGameSnapshot()
  const [albumView, setAlbumView] = useState<AlbumView>('postcards')
  const [transferNotice, setTransferNotice] = useState('')
  useSettleLoop()

  useDidShow(() => {
    void hydrateOnce().then(() => controller.markAllPostcardsRead())
  })

  const { game } = snapshot
  const postcardsByPostmark = [...game.postcards.received].sort(
    (left, right) => right.revealAt - left.revealAt,
  )
  const souvenirsByReturn = [...game.souvenirs.received].sort(
    (left, right) => right.revealedAt - left.revealedAt,
  )

  const exportGame = async () => {
    try {
      const document = controller.exportDocument()
      await Taro.setClipboardData({
        data: JSON.stringify(document),
      })
      setTransferNotice('完整存档已经复制到剪贴板，粘贴到安全的地方保存。')
    } catch {
      setTransferNotice('这次没能导出存档，请再试一次。')
    }
  }

  const importGame = async () => {
    try {
      const { data } = await Taro.getClipboardData()
      await controller.importDocument(JSON.parse(data))
      setTransferNotice('完整存档已经恢复。')
    } catch (error) {
      setTransferNotice(error instanceof Error && error.message
        && !error.message.includes('JSON')
        ? `没有导入：${error.message}`
        : '没有导入：剪贴板里不是有效的存档 JSON。')
    }
  }

  const openDetail = (kind: AlbumView, id: string) => {
    void Taro.navigateTo({
      url: `/pages/postcard/index?kind=${kind}&id=${id}`,
    })
  }

  return (
    <View className="album-shell">
      <View className="tabs">
        <View
          className={`tab${albumView === 'postcards' ? ' active' : ''}`}
          onClick={() => setAlbumView('postcards')}
        >
          <Text>明信片 {game.postcards.received.length}</Text>
        </View>
        <View
          className={`tab${albumView === 'souvenirs' ? ' active' : ''}`}
          onClick={() => setAlbumView('souvenirs')}
        >
          <Text>纪念品 {game.souvenirs.received.length}</Text>
        </View>
      </View>

      {albumView === 'postcards' && (
        postcardsByPostmark.length > 0 ? (
          <>
            <Text className="muted small">
              按邮戳时间排列，最近寄到家的在前。
            </Text>
            {postcardsByPostmark.map((postcard) => {
              const composition = resolvePostcardComposition(
                STARTER_CATALOG,
                postcard,
              )
              const destinationName = findDestination(
                postcard.destinationId,
              )?.name ?? '远方'
              return (
                <View
                  key={postcard.id}
                  className="card"
                  onClick={() => openDetail('postcards', postcard.id)}
                >
                  <View className="postcard-thumbnail">
                    {canRenderLandmarkScenes ? (
                      <>
                        <Image
                          className="thumb-scene"
                          src={composition.scene.src}
                          mode="aspectFill"
                        />
                        <Image
                          className="thumb-portrait"
                          src={composition.portrait.src}
                          mode="heightFix"
                          style={[
                            `left: ${composition.portrait.anchorX * 100}%`,
                            `top: ${composition.portrait.anchorY * 100}%`,
                            `height: ${composition.portrait.heightScale * 100}%`,
                            `transform: translate(-50%, -100%) scaleX(${composition.portrait.flip ? -1 : 1})`,
                          ].join('; ')}
                        />
                      </>
                    ) : (
                      <View className="thumb-placeholder" />
                    )}
                  </View>
                  <View className="card-copy">
                    <Text className="card-title">{destinationName}</Text>
                    <Text className="muted small">
                      {composition.postmarkDate.slice(0, 10)}
                    </Text>
                  </View>
                </View>
              )
            })}
          </>
        ) : (
          <View className="empty-state">
            <Image src={asset(drawerArt.albumEmpty)} mode="aspectFit" />
            <Text className="card-title">第一张明信片还在路上</Text>
            <Text className="muted small">小猫寄回的明信片会收在这一页。</Text>
          </View>
        )
      )}

      {albumView === 'souvenirs' && (
        souvenirsByReturn.length > 0 ? (
          <>
            <Text className="muted small">
              小猫回家时带回的小物件会留在这里。
            </Text>
            {souvenirsByReturn.map((receivedSouvenir) => {
              const souvenir = findSouvenir(receivedSouvenir.souvenirId)
              return (
                <View
                  key={receivedSouvenir.id}
                  className="card"
                  onClick={() => openDetail('souvenirs', receivedSouvenir.id)}
                >
                  {souvenir?.imageSrc ? (
                    <Image
                      className="card-token"
                      src={asset(souvenir.imageSrc)}
                      mode="aspectFit"
                    />
                  ) : (
                    <Text className="souvenir-token">
                      {souvenir?.visualToken ?? '念'}
                    </Text>
                  )}
                  <View className="card-copy">
                    <Text className="card-title">
                      {souvenir?.name ?? '远方带回的小物'}
                    </Text>
                    <Text className="muted small">
                      {findDestination(
                        receivedSouvenir.destinationId,
                      )?.name ?? '远方'}
                    </Text>
                  </View>
                </View>
              )
            })}
          </>
        ) : (
          <View className="empty-state">
            <Image src={asset(drawerArt.albumEmpty)} mode="aspectFit" />
            <Text className="card-title">还没有带回纪念品</Text>
            <Text className="muted small">
              旅行结束回到家时，纪念品会收在这一页。
            </Text>
          </View>
        )
      )}

      <View className="save-transfer">
        <Text className="card-title">带走这个家</Text>
        <Text className="muted small">
          导出会包含小猫、行囊、旅行、相册和未读状态；
          小程序里以剪贴板承载存档 JSON。
        </Text>
        <View className="transfer-actions">
          <View className="card-action" onClick={() => void exportGame()}>
            <Text>导出到剪贴板</Text>
          </View>
          <View
            className="card-action secondary"
            onClick={() => void importGame()}
          >
            <Text>从剪贴板导入</Text>
          </View>
        </View>
        {transferNotice && <Text className="notice">{transferNotice}</Text>}
      </View>
    </View>
  )
}
