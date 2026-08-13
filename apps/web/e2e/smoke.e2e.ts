import { expect, test } from '@playwright/test'
import { AWAY_NOTE, seedSave } from './seed.ts'

/**
 * 核心循环冒烟用例。断言全部基于稳定文案与 aria 结构，不做像素比对；
 * 需要既有进度的用例复用 e2e/seed.ts 的种子存档注入，不等真实时钟。
 */

test('全新开局：领养命名后首页出现小猫', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: '让它住进家里' }),
  ).toBeVisible()
  await page.getByLabel('给小猫取一个名字').fill('豆豆')
  await page.getByRole('button', { name: '让它住进家里' }).click()

  await expect(page.getByLabel('豆豆的家')).toBeVisible()
  await expect(page.locator('.cat-name')).toHaveText('豆豆')
  await expect(page.getByRole('button', { name: '行囊' })).toBeVisible()
  await expect(page.getByRole('button', { name: '小铺' })).toBeVisible()
  await expect(page.getByRole('button', { name: '相册' })).toBeVisible()
})

test('窗台收小鱼干后余额增加', async ({ page }) => {
  await seedSave(page, { windowsillTreats: 5 })
  await page.goto('/?homeActivity=sleep')

  await expect(page.locator('.treat-balance strong')).toHaveText('12')
  await page
    .getByRole('button', { name: '收取窗台上的 5 条小鱼干' })
    .click()

  await expect(page.locator('.treat-balance strong')).toHaveText('17')
  // dev 预览主题会隐藏收空后的窗台按钮，改断言收取文案与按钮消失。
  await expect(page.locator('.status-line')).toContainText('窗台空了')
  await expect(
    page.getByRole('button', { name: '收取窗台上的 5 条小鱼干' }),
  ).toHaveCount(0)
})

test('小铺购买备满三件行囊后小猫出发', async ({ page }) => {
  await seedSave(page, { treats: 30 })
  await page.goto('/?homeActivity=sleep')
  await expect(page.locator('.room')).toBeVisible()

  await page.getByRole('button', { name: '小铺' }).click()
  for (const itemName of ['小鱼饼', '旅行罐头']) {
    await page
      .getByRole('button', { name: new RegExp(`^购买${itemName}`) })
      .click()
    await page.getByRole('button', { name: '装入行囊' }).click()
    await expect(page.locator('.shop-notice'))
      .toHaveText(`${itemName}已经放进行囊。`)
  }
  await page.getByRole('button', { name: '小玩具' }).click()
  await page.getByRole('button', { name: /^购买小毛毯/ }).click()
  await page.getByRole('button', { name: '装入行囊' }).click()
  await expect(page.locator('.shop-notice'))
    .toHaveText('小毛毯已经放进行囊。')
  await page.locator('.drawer-close').click()

  await page.getByRole('button', { name: '行囊' }).click()
  await expect(page.locator('.pack-summary strong')).toHaveText('3 / 3')
  await page.locator('.drawer-close').click()

  // 出发窗口是游戏时间 30 分钟–6 小时；加速到 1 小时/秒后几秒内出发，
  // 字条出现即把时钟拨回实时，冻结在「旅行中」再做剩余断言。
  await page.getByRole('button', { name: '1 小时/秒' }).click()
  await expect(page.locator('.departure-note'))
    .toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '实时' }).click()

  await expect(page.locator('.departure-note')).toContainText('留给家里')
  await expect(page.locator('.status-line')).toContainText('已经出门了')
})

test('注入旅行中存档：字条、明信片墙与相册可打开', async ({ page }) => {
  await seedSave(page, { postcardCount: 2, souvenirCount: 3, away: true })
  await page.goto('/?homeActivity=sleep')

  await expect(page.locator('.departure-note')).toBeVisible()
  await expect(page.locator('.departure-note')).toContainText(AWAY_NOTE)

  const wallPostcards = page.locator('.display-postcard:not(.empty)')
  await expect(wallPostcards).toHaveCount(2)
  await expect(page.locator('.table-souvenirs button')).toHaveCount(3)

  await wallPostcards.first().click()
  await expect(page.getByRole('button', { name: '返回相册' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: '保存或分享明信片' }),
  ).toBeVisible()
  await page.getByRole('button', { name: '返回相册' }).click()

  await expect(
    page.locator('.album-tabs button', { hasText: '明信片' }),
  ).toContainText('2')
  await page.locator('.album-tabs button', { hasText: '纪念品' }).click()
  const souvenirCards = page.getByRole('list', { name: '带回家的纪念品' })
  await expect(souvenirCards.locator('li')).toHaveCount(3)
  await souvenirCards.locator('li button').first().click()
  await expect(page.locator('.souvenir-detail h3')).not.toBeEmpty()
})

test('相册里提供存档导出入口', async ({ page }) => {
  await seedSave(page)
  await page.goto('/?homeActivity=sleep')
  await expect(page.locator('.room')).toBeVisible()

  await page.getByRole('button', { name: '相册' }).click()
  await expect(
    page.getByRole('heading', { name: '带走这个家' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '导出存档' })).toBeVisible()
  await expect(
    page.locator('.save-transfer input[type="file"]'),
  ).toBeAttached()
})
