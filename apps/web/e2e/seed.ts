import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

/**
 * 固定种子存档注入，与 scripts/capture-home-scene-regression.mjs 同一做法：
 * 借 vite dev server 的 /@fs 直连 packages/core 源码，在页面里组装一份
 * 确定性 GameState 写进 IndexedDB（库名 bravecat），随后重新加载页面即可
 * 从该存档水合，避免用例硬等真实时钟。
 */
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
)
const coreModule = (relativePath: string) => (
  `/@fs${path.join(repoRoot, 'packages/core/src', relativePath)}`
)

export interface SeedSaveOptions {
  /** 领养小猫的名字（id 固定为 minho）。 */
  catName?: string
  /** 小鱼干余额，默认与全新开局一致（12）。 */
  treats?: number
  /** 窗台上待收取的小鱼干数量。 */
  windowsillTreats?: number
  /** 已寄回家的明信片数量（取目录前 N 个目的地）。 */
  postcardCount?: number
  /** 已带回家的纪念品数量（取目录前 N 件）。 */
  souvenirCount?: number
  /** true 时小猫处于旅行中（已出发、一小时后返回，留有字条）。 */
  away?: boolean
}

export const AWAY_NOTE = '窗边有风，我出去看看。'

export const seedSave = async (
  page: Page,
  options: SeedSaveOptions = {},
) => {
  const {
    catName = 'Minho',
    treats = 12,
    windowsillTreats = 0,
    postcardCount = 0,
    souvenirCount = 0,
    away = false,
  } = options

  await page.goto('/')
  await page.evaluate(`
    (async () => {
      const { adoptCat, createInitialGameState } = await import(
        ${JSON.stringify(coreModule('game/index.ts'))}
      )
      const { STARTER_CATALOG } = await import(
        ${JSON.stringify(coreModule('assets/starterCatalog.ts'))}
      )
      const { createIndexedDbSaveStore } = await import(
        ${JSON.stringify(coreModule('save/index.ts'))}
      )
      const now = Date.now()
      let state = adoptCat(createInitialGameState(now), {
        id: 'minho',
        name: ${JSON.stringify(catName)},
        portraitId: 'minho',
        adoptedAt: now,
      })
      const destinations = STARTER_CATALOG.destinations.slice(
        0,
        ${postcardCount},
      )
      const portrait = STARTER_CATALOG.portraits[0]
      const postcards = destinations.map((destination, index) => {
        const scene = destination.sceneVariants[0]
        const pose = scene.compositionSlot.pose
        return {
          id: 'e2e-trip-' + index + '--postcard-1',
          tripId: 'e2e-trip-' + index,
          destinationId: destination.id,
          revealAt: now - (index + 1) * 1000,
          recipe: {
            recipeVersion: 1,
            travelerCatId: 'minho',
            scene: {
              id: scene.id,
              revision: STARTER_CATALOG.sceneRevisions[scene.id],
            },
            portrait: {
              id: portrait.id,
              setRevision: STARTER_CATALOG.portraitSetRevisions[portrait.id],
            },
            composition: {
              id: scene.id + '--default',
              x: scene.compositionSlot.x,
              y: scene.compositionSlot.y,
              scale: scene.compositionSlot.scale,
              flip: scene.compositionSlot.flip,
            },
            pose,
            layers: [
              { id: 'scene', kind: 'scene', src: scene.imageSrc },
              { id: 'portrait', kind: 'portrait', src: portrait.poses[pose] },
            ],
            copy: { id: 'e2e-copy-' + index, text: '今天的风很轻。' },
          },
          isRead: true,
        }
      })
      const souvenirs = STARTER_CATALOG.souvenirs.slice(0, ${souvenirCount})
        .map((souvenir, index) => ({
          id: 'e2e-souvenir-' + index,
          tripId: 'e2e-trip-' + index,
          souvenirId: souvenir.id,
          destinationId: souvenir.destinationId,
          revealedAt: now - (index + 1) * 1000,
        }))
      state = {
        ...state,
        economy: {
          ...state.economy,
          treats: ${treats},
          windowsillTreats: ${windowsillTreats},
        },
        travelByCat: {
          minho: ${away}
            ? {
                kind: 'planned',
                plan: {
                  itinerary: {
                    destinationId: STARTER_CATALOG.destinations[0].id,
                    departsAt: now - 1000,
                    returnsAt: now + 3600000,
                    postcardSlots: [],
                  },
                  content: { postcards: [], souvenirIds: [] },
                },
                note: ${JSON.stringify(AWAY_NOTE)},
                packedItems: [],
                itemOutcomes: [],
              }
            : { kind: 'home' },
        },
        postcards: { received: postcards },
        souvenirs: { received: souvenirs },
      }
      await createIndexedDbSaveStore('bravecat').save(state)
      return true
    })()
  `)
}
