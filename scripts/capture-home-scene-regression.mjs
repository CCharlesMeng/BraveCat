/**
 * 家场景像素回归截图：用固定种子存档和固定 homeActivity 捕获一组
 * 确定性截图，供 homeTheme 重构前后逐像素对比。
 *
 * 用法：
 *   node scripts/capture-home-scene-regression.mjs \
 *     --origin http://127.0.0.1:5199/ --out /tmp/bravecat-slice0-qa/before
 */
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// monorepo 拆分后领域模块在 packages/core，经 Vite dev server 的 /@fs/ 导入。
const coreModule = (relativePath) => (
  `/@fs${path.join(repoRoot, 'packages/core/src', relativePath)}`
)

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const argValue = (flag, fallback) => {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : fallback
}
const origin = argValue('--origin', 'http://127.0.0.1:5199/').replace(/\/$/, '')
const outputRoot = path.resolve(argValue('--out', '/tmp/bravecat-home-scene-qa'))
await mkdir(outputRoot, { recursive: true })

const profile = await mkdtemp(path.join(os.tmpdir(), 'bravecat-scene-qa-'))
const port = 9341
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--window-size=470,900',
  '--hide-scrollbars',
  '--disable-gpu',
  '--force-device-scale-factor=1',
  'about:blank',
], { stdio: 'ignore' })

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitForEndpoint = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) return
    } catch {
      // Chrome is still starting.
    }
    await delay(100)
  }
  throw new Error('Chrome debugging endpoint did not start')
}

try {
  await waitForEndpoint()
  const pageResponse = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,
    { method: 'PUT' },
  )
  const page = await pageResponse.json()
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let commandId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id) return
    const callback = pending.get(message.id)
    if (!callback) return
    pending.delete(message.id)
    if (message.error) callback.reject(new Error(message.error.message))
    else callback.resolve(message.result)
  })
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    commandId += 1
    pending.set(commandId, { resolve, reject })
    socket.send(JSON.stringify({ id: commandId, method, params }))
  })

  await command('Page.enable')
  await command('Runtime.enable')
  await command('Emulation.setDeviceMetricsOverride', {
    width: 470,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  })

  const navigate = async (url) => {
    await command('Page.navigate', { url })
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const result = await command('Runtime.evaluate', {
        expression: 'document.readyState',
        returnByValue: true,
      })
      if (result.result.value === 'complete') return
      await delay(100)
    }
    throw new Error(`Page did not finish loading: ${url}`)
  }

  const evaluate = async (expression, awaitPromise = false) => {
    const result = await command('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
    })
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description
          ?? result.exceptionDetails.text,
      )
    }
    return result.result.value
  }

  const seedState = async (postcardCount, souvenirCount, away = false) => {
    await navigate(`${origin}/`)
    await evaluate(`
      (async () => {
        const { adoptCat, createInitialGameState } = await import('${coreModule('game/index.ts')}')
        const { STARTER_CATALOG } = await import('${coreModule('assets/starterCatalog.ts')}')
        const { createIndexedDbSaveStore } = await import('${coreModule('save/index.ts')}')
        const now = Date.now()
        let state = adoptCat(createInitialGameState(now), {
          id: 'minho',
          name: 'Minho',
          portraitId: 'minho',
          adoptedAt: now,
        })
        const destinations = STARTER_CATALOG.destinations.slice(0, ${postcardCount})
        const portrait = STARTER_CATALOG.portraits[0]
        const postcards = destinations.map((destination, index) => {
          const scene = destination.sceneVariants[0]
          const pose = scene.compositionSlot.pose
          return {
            id: 'qa-trip-' + index + '--postcard-1',
            tripId: 'qa-trip-' + index,
            destinationId: destination.id,
            revealAt: now - index * 1000,
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
              copy: { id: 'qa-copy-' + index, text: '今天的风很轻。' },
            },
            isRead: true,
          }
        })
        const souvenirs = STARTER_CATALOG.souvenirs.slice(0, ${souvenirCount}).map(
          (souvenir, index) => ({
            id: 'qa-souvenir-' + index,
            tripId: 'qa-trip-' + index,
            souvenirId: souvenir.id,
            destinationId: souvenir.destinationId,
            revealedAt: now - index * 1000,
          }),
        )
        state = {
          ...state,
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
                  note: '窗边有风，我出去看看。',
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
    `, true)
  }

  const capture = async (name, url, expectations) => {
    await navigate(url)
    const { postcardCount, souvenirCount, away } = expectations
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const ready = await evaluate(`Boolean(document.querySelector('.room'))
        && document.querySelectorAll('.display-postcard:not(.empty)').length === ${postcardCount}
        && document.querySelectorAll('.table-souvenirs button').length === ${souvenirCount}
        && Boolean(document.querySelector('.departure-note')) === ${away}
        && [...document.querySelectorAll('img')].every(
          (image) => image.complete && image.naturalWidth > 0,
        )`)
      if (ready) break
      if (attempt === 119) throw new Error(`State did not render: ${name}`)
      await delay(100)
    }
    await evaluate(`(() => {
      const style = document.createElement('style')
      style.textContent = '*, *::before, *::after {'
        + 'animation: none !important;'
        + 'transition: none !important;'
        + 'caret-color: transparent !important;'
        + '}'
      document.head.append(style)
      return true
    })()`)
    await delay(400)
    const screenshot = await command('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    })
    await writeFile(
      path.join(outputRoot, `${name}.png`),
      Buffer.from(screenshot.data, 'base64'),
    )
    console.log(`captured ${name}`)
  }

  const activityUrl = (activity) => `${origin}/?homeActivity=${activity}`

  await seedState(6, 3)
  for (const activity of ['sleep', 'play', 'eat', 'gaze']) {
    await capture(`full-${activity}`, activityUrl(activity), {
      postcardCount: 6,
      souvenirCount: 3,
      away: false,
    })
  }
  await seedState(0, 0)
  await capture('empty-sleep', activityUrl('sleep'), {
    postcardCount: 0,
    souvenirCount: 0,
    away: false,
  })
  await seedState(2, 3, true)
  await capture('away', activityUrl('sleep'), {
    postcardCount: 2,
    souvenirCount: 3,
    away: true,
  })
  socket.close()
  console.log(`done: ${outputRoot}`)
} finally {
  chrome.kill('SIGTERM')
  await Promise.race([once(chrome, 'exit'), delay(2000)])
  await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 })
}
