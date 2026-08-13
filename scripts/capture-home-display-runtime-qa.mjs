import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// monorepo 拆分后领域模块在 packages/core，经 Vite dev server 的 /@fs/ 导入。
const coreModule = (relativePath) => (
  `/@fs${path.join(repoRoot, 'packages/core/src', relativePath)}`
)

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const outputRoot = path.resolve('docs/art/candidates/home-display-v2')
const profile = await mkdtemp(path.join(os.tmpdir(), 'bravecat-home-display-'))
const port = 9337
const appUrlIndex = process.argv.indexOf('--app-url')
const appUrl = appUrlIndex >= 0
  ? process.argv[appUrlIndex + 1]
  : 'http://127.0.0.1:5173/'
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
  await waitForEndpoint()
  const pageResponse = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(appUrl)}`,
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

  let seedSequence = 0
  const seedState = async (postcardCount, souvenirCount, away = false) => {
    seedSequence += 1
    const result = await command('Runtime.evaluate', {
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
          window.__bravecatQaSeedToken = ${seedSequence}
          setTimeout(() => location.reload(), 0)
          return { postcards: postcards.length, souvenirs: souvenirs.length }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text)
    }
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const reloadState = await command('Runtime.evaluate', {
        expression: `document.readyState === 'complete'
          && window.__bravecatQaSeedToken !== ${seedSequence}`,
        returnByValue: true,
      })
      if (reloadState.result.value) {
        for (let renderAttempt = 0; renderAttempt < 100; renderAttempt += 1) {
          const renderState = await command('Runtime.evaluate', {
            expression: `Boolean(document.querySelector('.room'))
              && document.querySelectorAll('.display-postcard:not(.empty)').length === ${postcardCount}
              && document.querySelectorAll('.table-souvenirs button').length === ${souvenirCount}
              && Boolean(document.querySelector('.departure-note')) === ${away}`,
            returnByValue: true,
          })
          if (renderState.result.value) return
          await delay(100)
        }
        throw new Error('Home page did not render the seeded QA state')
      }
      await delay(100)
    }
    throw new Error('Home page did not reload after QA state seeding')
  }

  const runtimeQa = []
  const interactionQa = {}
  const capture = async (name) => {
    const metrics = await command('Runtime.evaluate', {
      expression: `({
        shellWidth: document.querySelector('.app-shell')?.getBoundingClientRect().width,
        postcardCount: document.querySelectorAll('.display-postcard:not(.empty)').length,
        emptySlotCount: document.querySelectorAll('.display-postcard.empty').length,
        souvenirCount: document.querySelectorAll('.table-souvenirs button').length,
        departureNoteVisible: Boolean(document.querySelector('.departure-note')),
        emptyTreatVisible: (() => {
          const control = document.querySelector('.windowsill.empty')
          if (!control) return false
          const style = getComputedStyle(control)
          return style.display !== 'none'
            && style.visibility !== 'hidden'
            && Number(style.opacity) > 0
        })(),
        postcardHitTarget: (() => {
          const button = document.querySelector('.display-postcard:not(.empty)')
          if (!button) return null
          const rect = button.getBoundingClientRect()
          return document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          )?.closest('button') === button
        })(),
        postcardHitBlocker: (() => {
          const button = document.querySelector('.display-postcard:not(.empty)')
          if (!button) return null
          const rect = button.getBoundingClientRect()
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          )
          return hit ? hit.tagName.toLowerCase() + '.' + hit.className : null
        })(),
        souvenirHitTarget: (() => {
          const button = document.querySelector('.table-souvenirs button')
          if (!button) return null
          const rect = button.getBoundingClientRect()
          return document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          )?.closest('button') === button
        })(),
        souvenirHitBlocker: (() => {
          const button = document.querySelector('.table-souvenirs button')
          if (!button) return null
          const rect = button.getBoundingClientRect()
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          )
          return hit ? hit.tagName.toLowerCase() + '.' + hit.className : null
        })(),
        fixtureLoaded: [...document.querySelectorAll('.home-display-fixture, .souvenir-occlusion')]
          .every((image) => image.complete && image.naturalWidth > 0),
      })`,
      returnByValue: true,
    })
    const screenshot = await command('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    })
    await writeFile(
      path.join(outputRoot, `runtime--${name}--mobile-470--qa-v01.png`),
      Buffer.from(screenshot.data, 'base64'),
    )
    runtimeQa.push({ state: name, ...metrics.result.value })
    console.log(name, JSON.stringify(metrics.result.value))
  }

  const verifyPointerClick = async (name, buttonSelector, resultSelector) => {
    const target = await command('Runtime.evaluate', {
      expression: `(() => {
        const button = document.querySelector(${JSON.stringify(buttonSelector)})
        if (!button) return null
        const rect = button.getBoundingClientRect()
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      })()`,
      returnByValue: true,
    })
    if (!target.result.value) throw new Error(`${name} click target is missing`)
    const { x, y } = target.result.value
    await command('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    })
    await command('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    })
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const result = await command('Runtime.evaluate', {
        expression: `Boolean(document.querySelector(${JSON.stringify(resultSelector)}))`,
        returnByValue: true,
      })
      if (result.result.value) {
        interactionQa[name] = true
        return
      }
      await delay(50)
    }
    throw new Error(`${name} click did not open its collection detail`)
  }

  await seedState(0, 0)
  await capture('empty')
  await seedState(2, 2)
  await capture('partial')
  await seedState(6, 3)
  await capture('full')
  await verifyPointerClick(
    'postcard',
    '.display-postcard:not(.empty)',
    '.album-detail .postcard',
  )
  await seedState(2, 3, true)
  await capture('departure-note')
  await verifyPointerClick(
    'souvenir',
    '.table-souvenirs button',
    '.album-detail .souvenir-detail',
  )
  const expected = {
    empty: [0, 6, 0, false],
    partial: [2, 4, 2, false],
    full: [6, 0, 3, false],
    'departure-note': [2, 4, 3, true],
  }
  for (const state of runtimeQa) {
    const actual = [
      state.postcardCount,
      state.emptySlotCount,
      state.souvenirCount,
      state.departureNoteVisible,
    ]
    if (
      state.shellWidth !== 470
      || !state.fixtureLoaded
      || state.emptyTreatVisible
      || (state.postcardCount > 0 && !state.postcardHitTarget)
      || (state.souvenirCount > 0 && !state.souvenirHitTarget)
      || JSON.stringify(actual) !== JSON.stringify(expected[state.state])
    ) {
      throw new Error(`Runtime QA state failed: ${state.state}`)
    }
  }
  await writeFile(
    path.join(outputRoot, 'runtime-qa-report.v1.json'),
    `${JSON.stringify({
      viewport: { width: 470, height: 900 },
      states: runtimeQa,
      interactions: interactionQa,
    }, null, 2)}\n`,
  )
  socket.close()
} finally {
  chrome.kill('SIGTERM')
  await Promise.race([once(chrome, 'exit'), delay(2000)])
  await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 })
}
