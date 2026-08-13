/**
 * 明信片 / 纪念品详情页。
 * 明信片经 core 合成器（OffscreenCanvas 适配）产出临时文件展示与保存；
 * 合成失败时回退到「场景图 + 小猫图层 + 信纸」的分层展示。
 * 会话分享走 onShareAppMessage 开放能力（useShareAppMessage）。
 */
import { useEffect, useState } from 'react'
import { useRouter, useShareAppMessage } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import {
  resolvePostcardComposition,
} from '@bravecat/core/postcards'
import {
  LANDMARK_SCENES_SHIPPING_ELIGIBLE,
} from '@bravecat/core/assets/starterCatalog'
import { useGameSnapshot, useSettleLoop } from '../../game/useGameClient'
import { findDestination, findSouvenir, STARTER_CATALOG } from '../../game/catalog'
import { asset } from '../../platform/assetBase'
import { composePostcardToTempFile } from '../../platform/postcardCanvas'
import { savePostcardToAlbum } from '../../platform/share'
import './index.scss'

const canRenderLandmarkScenes = (
  process.env.NODE_ENV === 'development' || LANDMARK_SCENES_SHIPPING_ELIGIBLE
)

export default function PostcardDetail() {
  const router = useRouter()
  const kind = router.params.kind === 'souvenirs' ? 'souvenirs' : 'postcards'
  const detailId = router.params.id ?? ''
  const snapshot = useGameSnapshot()
  const [composedPath, setComposedPath] = useState<string | null>(null)
  const [composeFailed, setComposeFailed] = useState(false)
  const [exportNotice, setExportNotice] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  useSettleLoop()

  const { game } = snapshot
  const postcard = kind === 'postcards'
    ? game.postcards.received.find(({ id }) => id === detailId) ?? null
    : null
  const receivedSouvenir = kind === 'souvenirs'
    ? game.souvenirs.received.find(({ id }) => id === detailId) ?? null
    : null

  const composition = postcard
    ? resolvePostcardComposition(STARTER_CATALOG, postcard)
    : null
  const destinationName = findDestination(
    postcard?.destinationId ?? receivedSouvenir?.destinationId,
  )?.name ?? '远方'

  useShareAppMessage(() => ({
    title: postcard
      ? `从${destinationName}寄来的明信片`
      : '来看看小猫的旅行相册',
    path: `/pages/postcard/index?kind=${kind}&id=${detailId}`,
    imageUrl: composedPath ?? undefined,
  }))

  useEffect(() => {
    if (!postcard || !canRenderLandmarkScenes) return
    let active = true
    setComposeFailed(false)
    void composePostcardToTempFile(
      resolvePostcardComposition(STARTER_CATALOG, postcard),
      findDestination(postcard.destinationId)?.name ?? '远方',
    ).then((path) => {
      if (active) setComposedPath(path)
    }).catch(() => {
      if (active) setComposeFailed(true)
    })
    return () => {
      active = false
    }
    // 只按明信片身份重算；composition 为派生值。
  }, [postcard?.id])

  const exportPostcard = async () => {
    if (exportBusy || !postcard) return
    if (!canRenderLandmarkScenes) {
      setExportNotice('场景仍在发布审核中，暂时不能保存。')
      return
    }
    setExportBusy(true)
    setExportNotice('正在把明信片铺平……')
    try {
      const path = composedPath ?? await composePostcardToTempFile(
        resolvePostcardComposition(STARTER_CATALOG, postcard),
        destinationName,
      )
      if (!composedPath) setComposedPath(path)
      const result = await savePostcardToAlbum(path)
      setExportNotice(result === 'saved'
        ? '明信片已经保存到相册。'
        : result === 'denied'
          ? '没有相册权限，明信片仍好好留在这里。'
          : '这次没能保存明信片，请稍后再试。')
    } catch {
      setExportNotice('这次没能保存明信片，请稍后再试。')
    } finally {
      setExportBusy(false)
    }
  }

  if (kind === 'souvenirs') {
    const souvenir = receivedSouvenir
      ? findSouvenir(receivedSouvenir.souvenirId)
      : undefined
    return (
      <View className="detail-shell">
        {receivedSouvenir ? (
          <View className="souvenir-detail">
            {souvenir?.imageSrc ? (
              <Image
                className="souvenir-image"
                src={asset(souvenir.imageSrc)}
                mode="aspectFit"
              />
            ) : (
              <Text className="souvenir-token-large">
                {souvenir?.visualToken ?? '念'}
              </Text>
            )}
            <Text className="card-title">
              {souvenir?.name ?? '远方带回的小物'}
            </Text>
            <Text className="muted">{destinationName}</Text>
            <Text className="muted small">
              {new Date(receivedSouvenir.revealedAt)
                .toISOString()
                .slice(0, 10)}
            </Text>
          </View>
        ) : (
          <Text className="muted">正在找这件纪念品……</Text>
        )}
      </View>
    )
  }

  return (
    <View className="detail-shell">
      {postcard && composition ? (
        <>
          {composedPath && !composeFailed ? (
            <Image
              className="postcard-composed"
              src={composedPath}
              mode="widthFix"
            />
          ) : (
            <View className="postcard-layered">
              <View className="layered-picture">
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
              <View className="layered-message">
                <View className="message-copy">
                  <Text>{composition.note}</Text>
                  <Text className="muted small">{destinationName}</Text>
                </View>
                <View className="postmark">
                  <Text>
                    {composition.postmarkDate.slice(5, 10).replace('-', '.')}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View
            className={`card-action save-button${exportBusy ? ' disabled' : ''}`}
            onClick={() => void exportPostcard()}
          >
            <Text>{exportBusy ? '正在生成…' : '保存到相册'}</Text>
          </View>
          <Text className="muted small share-hint">
            右上角「…」可以把这张明信片分享给朋友。
          </Text>
          {exportNotice && <Text className="notice">{exportNotice}</Text>}
        </>
      ) : (
        <Text className="muted">正在展开这张明信片……</Text>
      )}
    </View>
  )
}
