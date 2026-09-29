import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { adoptCat, createInitialGameState } from '../../../packages/core/src/game/index'
import { createPlanTrip } from '../../../packages/core/src/planTrip'
import { planItinerary } from '../../../packages/core/src/itinerary/index'
import { selectTripContent } from '../../../packages/core/src/selection/index'
import { STARTER_CATALOG, STARTER_DESTINATIONS } from '../../../packages/core/src/assets/starterCatalog'
import { lockStory, STORIES } from '../../../packages/core/src/stories/index'

const seedStory = async (page: Page, elapsed: number, storyIndex = 0, url = '/') => {
  await page.goto(url)
  await expect(page.getByRole('heading', { name: '让它住进家里' })).toBeVisible()
  const now = Date.now()
  const initial = adoptCat(createInitialGameState(now), { id: 'minho', name: '米诺', portraitId: 'minho', adoptedAt: now - 100000 })
  const story = lockStory(STORIES[storyIndex], 'minho', '米诺', now - elapsed, now - elapsed + 1000000)
  const state = { ...initial, travelByCat: { minho: { kind: 'planned', note: '去远方看看。', packedItems: [], itemOutcomes: [], plan: {
    story, itinerary: { destinationId: `story:${story.storyId}`, departsAt: story.departsAt, returnsAt: story.returnsAt, postcardSlots: [], routeKind: 'story', isDetour: false }, content: { postcards: [], souvenirIds: [] },
  } } } }
  await page.evaluate(async (value) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('bravecat')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('state', 'readwrite')
        tx.objectStore('state').put({ key: 'current', state: value })
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
    })
  }, state)
  await page.reload()
  await expect(page.getByLabel('米诺的家')).toBeVisible()
}
const openStories = async (page: Page) => {
  await page.getByRole('button', { name: /^相册/ }).click()
  await page.getByRole('button', { name: /^小故事/ }).click()
}

test('正式窄屏：只展示已寄到一幕，可保存单卡，无云入口或请求', async ({ page }) => {
  const external: string[] = []
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:19174')) external.push(request.url()) })
  await seedStory(page, 210000)
  await expect(page.locator('.home-art-canvas')).toBeVisible()
  await openStories(page)
  await page.getByRole('button', { name: /米诺.*1\/4 封来信/ }).click()
  await expect(page.getByRole('button', { name: '下一页' })).toBeDisabled()
  await expect(page.getByLabel('故事尾页')).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveAttribute('width', '1200')
  await expect(page.getByText('这张明信片暂时没有展开')).toHaveCount(0)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '保存或分享这一幕' }).click()
  expect((await download).suggestedFilename()).toContain('值夜观星-第1幕')
  await expect(page.getByText('云同步', { exact: true })).toHaveCount(0)
  await expect(page.getByText('上传照片', { exact: true })).toHaveCount(0)
  expect(external).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/story-first-act-production.png', fullPage: true })
})

test('正式 PWA：离线重载补齐四幕、尾页，全部发布画面缓存可用', async ({ page, context }) => {
  await seedStory(page, 1100000, 1)
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await openStories(page)
  await page.getByRole('button', { name: /米诺.*已收齐/ }).click()
  for (let index = 0; index < 4; index++) {
    await expect(page.locator('canvas')).toHaveAttribute('width', '1200')
    await expect(page.getByText('这张明信片暂时没有展开')).toHaveCount(0)
    await page.getByRole('button', { name: '下一页' }).click()
  }
  await expect(page.getByLabel('故事尾页')).toContainText('船慢慢回到港里')
  await expect(page.getByRole('button', { name: '下一页' })).toBeDisabled()
  const missing = await page.evaluate(async () => {
    const keys = await caches.keys()
    const cache = await caches.open(keys.find(key => key.includes('precache'))!)
    const requests = await cache.keys()
    const stories = requests.filter(request => new URL(request.url).pathname.startsWith('/stories/'))
    const homes = requests.filter(request => new URL(request.url).pathname.startsWith('/home-release/'))
    return { stories: stories.length, homes: homes.length, scenes: requests.filter(request => new URL(request.url).pathname.startsWith('/scenes/')).length }
  })
  expect(missing).toEqual({ stories: 8, homes: 29, scenes: 61 })
  await page.screenshot({ path: 'test-results/story-closing-offline.png', fullPage: true })
})

test('正式 A/B/F 主题与猫窝隧道资源完整，切换后重载保留', async ({ page }) => {
  await seedStory(page, 1100000)
  await page.getByRole('button', { name: '布置家', exact: true }).click()
  for (const name of ['暖胡桃', '月白']) {
    const button = page.getByRole('button', { name: new RegExp(name) })
    await button.click()
    await expect(button).toBeDisabled()
    await expect.poll(async () => page.locator('.home-art-canvas img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
  }
  await page.reload()
  await expect.poll(async () => page.locator('.home-art-canvas img').evaluateAll(images => images.length > 0 && images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
  await expect(page.locator('.home-art-canvas img').first()).toHaveAttribute('src', /f-moonwhite-bluegray/)
  await page.screenshot({ path: 'test-results/home-production.png', fullPage: true })
})

test('Service Worker 更新激活后存档与离线故事仍在', async ({ page, context }) => {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
  let revision = 1
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
      const filename = pathname === '/' ? 'index.html' : pathname.slice(1)
      const file = path.resolve(dist, filename)
      if (!file.startsWith(`${dist}/`)) { response.writeHead(403).end(); return }
      const data = await readFile(file)
      const mime: Record<string, string> = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
      response.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream')
      response.setHeader('Cache-Control', 'no-store')
      response.end(filename === 'sw.js' ? `${data.toString()}\n// upgrade fixture ${revision}\n` : data)
    } catch { response.writeHead(404).end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No test server address')
  try {
    await seedStory(page, 1100000, 0, `http://127.0.0.1:${address.port}`)
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.reload()
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
    revision = 2
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      const changed = new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
      await registration.update()
      await changed
    })
    await context.setOffline(true)
    await page.reload()
    await openStories(page)
    await expect(page.getByRole('button', { name: /米诺.*已收齐/ })).toBeVisible()
    await page.getByRole('button', { name: /米诺.*已收齐/ }).click()
    await expect(page.locator('canvas')).toHaveAttribute('width', '1200')
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('正式本地备份包含故事，损坏文件不覆盖，导入后可回看', async ({ page }) => {
  await seedStory(page, 1100000)
  await openStories(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出存档', exact: true }).click()
  const downloaded = await downloadPromise
  const backup = JSON.parse(await readFile((await downloaded.path())!, 'utf8'))
  expect(backup.schemaVersion).toBe(5)
  expect(backup.state.stories.collections[0].acts).toHaveLength(4)
  const input = page.locator('input[type=file]')
  await input.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...backup, schemaVersion: 999 })) })
  await expect(page.locator('.transfer-notice')).toContainText('没有导入')
  await expect(page.getByRole('button', { name: /米诺.*已收齐/ })).toBeVisible()
  await input.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await expect(page.locator('.transfer-notice')).toHaveText('完整存档已经恢复。')
  await page.reload()
  await openStories(page)
  await page.getByRole('button', { name: /米诺.*已收齐/ }).click()
  await expect(page.locator('canvas')).toHaveAttribute('width', '1200')
})


test('新安装后离线首次收到普通地标，完整图片与 PNG 导出可用', async ({ page, context }) => {
  const requestedScenes: string[] = []
  page.on('request', request => { if (request.resourceType() === 'image' && request.url().includes('/scenes/')) requestedScenes.push(request.url()) })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '让它住进家里' })).toBeVisible()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  expect(requestedScenes).toEqual([])
  await context.setOffline(true)
  const now = Date.now()
  const plan = createPlanTrip({ planItinerary, selectContent: selectTripContent })({
    departsAt: now - 3 * 86400000, destinations: STARTER_DESTINATIONS,
    packedItemIds: [], travelerCatId: 'minho', portraitId: 'minho', catalog: STARTER_CATALOG,
  }, () => 0)
  const state = {
    ...adoptCat(createInitialGameState(now), { id: 'minho', name: '米诺', portraitId: 'minho', adoptedAt: 0 }),
    travelByCat: { minho: { kind: 'planned', plan, note: '出门了', packedItems: [], itemOutcomes: [] } },
  }
  expect(state.postcards.received).toHaveLength(0)
  await page.evaluate(async value => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('bravecat')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('state', 'readwrite')
        tx.objectStore('state').put({ key: 'current', state: value })
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
    })
  }, state)
  await page.reload()
  await page.getByRole('button', { name: /^相册/ }).click()
  await page.getByRole('list', { name: '收到的明信片' }).getByRole('button', { name: /^查看.*的明信片$/ }).first().click()
  const canvas = page.locator('.album-detail canvas')
  await expect(canvas).toHaveAttribute('width', '1200')
  await expect.poll(() => canvas.evaluate(node => {
    const pixels = (node as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 1200, 660).data
    return pixels.some((value, index) => index % 4 === 3 && value > 0)
  })).toBe(true)
  await expect(page.locator('.render-error')).toHaveCount(0)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '保存或分享明信片' }).click()
  const file = await downloadPromise
  expect(file.suggestedFilename()).toMatch(/\.png$/)
  const png = await readFile((await file.path())!)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.length).toBeGreaterThan(10000)
})
