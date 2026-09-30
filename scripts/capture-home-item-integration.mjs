// Independent browser storage only. Production activity selection is pinned via RNG.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const url = process.env.HOME_QA_URL || 'http://127.0.0.1:19174'
const output = process.env.HOME_QA_OUTPUT || 'docs/releases/archive/2026-09-30-item-integration'
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const themes = ['a-clear-sage', 'b-warm-walnut-gallery', 'f-moonwhite-bluegray']
const measurements = []
for (const [index, activity] of ['sleep', 'play', 'eat', 'gaze'].entries()) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.clock.setFixedTime(new Date('2026-09-30T12:00:00+08:00'))
  await page.addInitScript(value => { crypto.getRandomValues = array => { if (array instanceof Uint32Array) array.fill(value); return array } }, index)
  await page.goto(url)
  await page.getByRole('button', { name: '让它住进家里', exact: true }).click()
  for (const theme of themes) {
    await page.evaluate(async theme => {
      await new Promise((resolve, reject) => {
        const r = indexedDB.open('bravecat')
        r.onerror = () => reject(r.error)
        r.onsuccess = () => {
          const db = r.result, tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state')
          const read = store.get('current')
          read.onsuccess = () => {
            const record = read.result
            record.state.homeCustomization.homeThemeId = theme
            record.state.clockNow = Date.now()
            record.state.economy.accrual.lastAccruedAt = Date.now()
            record.state.economy.windowsillTreats = 17
            store.put(record)
          }
          tx.oncomplete = () => { db.close(); resolve() }
          tx.onerror = () => reject(tx.error)
        }
      })
    }, theme)
    await page.reload()
    await page.locator('.room img').evaluateAll(async images => Promise.all(images.map(image => image.decode())))
    await page.screenshot({ path: path.join(output, `${theme}-${activity}.png`), fullPage: true })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.screenshot({ path: path.join(output, `${theme}-${activity}-animated.png`), fullPage: true })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const actualActivity = await page.locator('.room').getAttribute('data-home-activity')
    if (actualActivity !== activity) throw new Error(`Expected ${activity}, got ${actualActivity}`)
    measurements.push({ theme, activity: actualActivity, time: await page.locator('.room').getAttribute('data-home-time') })
    if (activity === 'gaze' && theme === themes[0]) {
      await page.locator('.home-art-canvas').screenshot({path: path.join(output, 'composite.png')})
      const style = await page.addStyleTag({content: '.home-art-cat,.home-art-cat-item,.home-item-contact{visibility:hidden} .home-art-cat-item-occlusion,.windowsill{visibility:hidden}'})
      await page.locator('.home-art-canvas').screenshot({path: path.join(output, 'background-only.png')})
      await style.evaluate(element => element.remove())
      const isolated = await page.addStyleTag({content: '.home-art-layer,.home-art-cat{visibility:hidden} .home-art-canvas{background:#f6f0df} .home-art-cat-item-occlusion{visibility:hidden}'})
      await page.locator('.home-art-canvas').screenshot({path: path.join(output, 'items-only.png')})
      await isolated.evaluate(element => element.remove())
      await page.setViewportSize({width:1280,height:720})
      await page.screenshot({path:path.join(output,'after-desktop.png')})
      await page.setViewportSize({width:390,height:844})
      await page.screenshot({path:path.join(output,'after-mobile.png'),fullPage:true})
    }
    if (activity === 'gaze') {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      for (const [time,hour] of [['morning','07'],['dusk','18'],['late-night','23']]) {
        await page.clock.setFixedTime(new Date(`2026-10-01T${hour}:00:00+08:00`))
        await page.reload()
        await page.locator('.room img').evaluateAll(async images => Promise.all(images.map(image => image.decode())))
        const actualTime = await page.locator('.room').getAttribute('data-home-time')
        if (actualTime !== time) throw new Error(`Expected ${time}, got ${actualTime}`)
        await page.screenshot({path:path.join(output,`${theme}-${time}-animated.png`),fullPage:true})
      }
      await page.clock.setFixedTime(new Date('2026-09-30T12:00:00+08:00'))
      await page.emulateMedia({ reducedMotion: 'reduce' })
    }
  }
  await context.close()
}
await writeFile(path.join(output,'capture.json'),JSON.stringify({ url, measurements, simulatedDevice:true },null,2)+'\n')
await browser.close()
console.log(`Captured ${measurements.length} theme/activity combinations at ${output}`)
