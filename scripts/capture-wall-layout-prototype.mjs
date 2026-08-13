/**
 * PROTOTYPE — 用后即弃。
 * 对 ?wallProto=p|g 的定案布局和透视原理解读图各截一张 470×900 运行时图，
 * 播种 6 张明信片后截图。
 * 结构仿照 capture-home-display-runtime-qa.mjs；原型验证结束后删除。
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
const outputRoot = path.resolve(
  'docs/art/candidates/home-wall-prototype/2026-08-13-right-recede',
)
const profile = await mkdtemp(path.join(os.tmpdir(), 'bravecat-wall-proto-'))
const port = 9338
const appOrigin = process.env.WALL_PROTO_ORIGIN ?? 'http://127.0.0.1:5173'
const variants = ['p', 'g']
const expectedSlots = { p: 6, g: 6 }
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--window-size=470,900',
  '--hide-scrollbars',
  '--disable-gpu',
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
  await mkdir(outputRoot, { recursive: true })
  await waitForEndpoint()
  const pageResponse = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${appOrigin}/`)}`,
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
  // 固定为正午光照，避免夜间 lighting 层压暗布局细节。
  await command('Page.addScriptToEvaluateOnNewDocument', {
    source: 'Date.prototype.getHours = function () { return 12 }',
  })
  await command('Emulation.setDeviceMetricsOverride', {
    width: 470,
    height: 900,
    deviceScaleFactor: 2,
    mobile: true,
  })

  const waitForReady = async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const result = await command('Runtime.evaluate', {
        expression: 'document.readyState',
        returnByValue: true,
      })
      if (result.result.value === 'complete') {
        await delay(350)
        return
      }
      await delay(100)
    }
    throw new Error('Home page did not finish loading')
  }
  await waitForReady()

  // 播种 6 张明信片 + 3 件纪念品（同 QA full 状态）。
  const seed = await command('Runtime.evaluate', {
    expression: `
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
        const destinations = STARTER_CATALOG.destinations.slice(0, 6)
        const portrait = STARTER_CATALOG.portraits[0]
        const postcards = destinations.map((destination, index) => {
          const scene = destination.sceneVariants[0]
          const pose = scene.compositionSlot.pose
          return {
            id: 'proto-trip-' + index + '--postcard-1',
            tripId: 'proto-trip-' + index,
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
              copy: { id: 'proto-copy-' + index, text: '今天的风很轻。' },
            },
            isRead: true,
          }
        })
        const souvenirs = STARTER_CATALOG.souvenirs.slice(0, 3).map(
          (souvenir, index) => ({
            id: 'proto-souvenir-' + index,
            tripId: 'proto-trip-' + index,
            souvenirId: souvenir.id,
            destinationId: souvenir.destinationId,
            revealedAt: now - index * 1000,
          }),
        )
        state = {
          ...state,
          postcards: { received: postcards },
          souvenirs: { received: souvenirs },
        }
        await createIndexedDbSaveStore('bravecat').save(state)
        return postcards.length
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  })
  if (seed.exceptionDetails) throw new Error(seed.exceptionDetails.text)

  for (const variant of variants) {
    await command('Page.navigate', {
      url: `${appOrigin}/?wallProto=${variant}`,
    })
    await waitForReady()
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const rendered = await command('Runtime.evaluate', {
        expression: `Boolean(document.querySelector('.room'))
          && document.querySelectorAll('.wall-proto-slot').length === ${expectedSlots[variant]}
          && Boolean(document.querySelector('.wall-proto-svg'))
          && [...document.querySelectorAll('.home-art-layer')]
            .some((image) => image.src.includes('right-recede')
              && image.complete && image.naturalWidth > 0)
          && [...document.querySelectorAll('.wall-proto-slot img')]
            .every((image) => image.complete && image.naturalWidth > 0)`,
        returnByValue: true,
      })
      if (rendered.result.value) break
      if (attempt === 99) {
        const diagnostic = await command('Runtime.evaluate', {
          expression: `({
            readyState: document.readyState,
            slotCount: document.querySelectorAll('.wall-proto-slot').length,
            hasSvg: Boolean(document.querySelector('.wall-proto-svg')),
            homeLayers: [...document.querySelectorAll('.home-art-layer')]
              .map((image) => ({
                src: image.src,
                complete: image.complete,
                naturalWidth: image.naturalWidth,
              })),
            postcardImages: [...document.querySelectorAll('.wall-proto-slot img')]
              .map((image) => ({
                complete: image.complete,
                naturalWidth: image.naturalWidth,
              })),
          })`,
          returnByValue: true,
        })
        throw new Error(
          `Variant ${variant} did not become ready: `
          + JSON.stringify(diagnostic.result.value),
        )
      }
      await delay(100)
    }
    await delay(300)
    const screenshot = await command('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    })
    await writeFile(
      path.join(outputRoot, `wall-proto--${variant}--mobile-470.png`),
      Buffer.from(screenshot.data, 'base64'),
    )
    console.log(`captured variant ${variant}`)
  }
  socket.close()
} finally {
  chrome.kill('SIGTERM')
  await Promise.race([once(chrome, 'exit'), delay(2000)])
  await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 })
}
