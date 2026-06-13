import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await page.goto('/')
  await page.getByRole('button', { name: '加载示例' }).click()
  await page.getByRole('button', { name: '练习', exact: true }).click()
})

/** 取消两种题型，仅保留指定题型 */
async function keepOnly(page: Page, keep: '单选题' | '多选题' | '判断题') {
  for (const t of ['单选题', '多选题', '判断题'] as const) {
    if (t !== keep) await page.getByRole('button', { name: t, exact: true }).click()
  }
}

const opt = '[data-testid="opt"]'
const revealed = '[data-testid="opt"][data-state="correct"], [data-testid="opt"][data-state="missed"]'

test('练习·单选：点选即时揭晓，无确认按钮', async ({ page }) => {
  await keepOnly(page, '单选题')
  await page.getByRole('button', { name: /开始练习/ }).click()

  await page.locator(opt).first().click()
  // 单选点一下立即判分（揭晓正确/漏选），且无需「确认作答」
  await expect(page.locator(revealed)).not.toHaveCount(0)
  await expect(page.getByTestId('confirm-answer')).toHaveCount(0)
})

test('练习·多选：选一项不揭晓，确认后才判分（回归）', async ({ page }) => {
  await keepOnly(page, '多选题')
  await page.getByRole('button', { name: /开始练习/ }).click()

  // 选第一个选项
  await page.locator(opt).first().click()
  // 不应揭晓任何正确/漏选项，且只有该项处于已选
  await expect(page.locator(revealed)).toHaveCount(0)
  await expect(page.locator('[data-testid="opt"][data-state="picked"]')).toHaveCount(1)
  await expect(page.getByTestId('confirm-answer')).toBeVisible()

  // 再选一个，确认作答后才揭晓
  await page.locator(opt).nth(1).click()
  await expect(page.locator('[data-testid="opt"][data-state="picked"]')).toHaveCount(2)
  await page.getByTestId('confirm-answer').click()
  await expect(page.locator(revealed)).not.toHaveCount(0)
  await expect(page.getByTestId('confirm-answer')).toHaveCount(0)
})

test('错题本「重练全部」进入答题界面（回归）', async ({ page }) => {
  // 制造错题：考试全不作答直接交卷 → 全部计错入错题本
  await page.getByRole('button', { name: /考试 · 交卷判分/ }).click()
  await page.getByRole('button', { name: /开始考试/ }).click()
  await page.getByRole('button', { name: '交卷' }).click()
  await expect(page.getByText('答题详情')).toBeVisible()

  await page.getByRole('button', { name: /错题本/ }).click()
  await page.getByRole('button', { name: '重练全部' }).click()
  // 应进入答题界面而非停留在错题本
  await expect(page.locator(opt).first()).toBeVisible()
  await expect(page.getByText(/练习 ·/)).toBeVisible()
})

test('考试：作答不揭晓，交卷后出成绩', async ({ page }) => {
  await page.getByRole('button', { name: /考试 · 交卷判分/ }).click()
  await page.getByRole('button', { name: /开始考试/ }).click()

  await page.locator(opt).first().click()
  // 考试模式作答后不揭晓答案
  await expect(page.locator(revealed)).toHaveCount(0)

  await page.getByRole('button', { name: '交卷' }).click() // 弹窗自动确认
  await expect(page.getByText('答题详情')).toBeVisible()
})
