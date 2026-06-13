import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
const BANK_INPUT = 'input[accept=".txt,.docx,.pdf"]'
const JSON_INPUT = 'input[accept=".json"]'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

async function importFile(page: import('@playwright/test').Page, file: string) {
  await page.locator(BANK_INPUT).setInputFiles(fixture(file))
  // 解析成功后出现「建为新题库」
  await expect(page.getByRole('button', { name: '建为新题库' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '建为新题库' }).click()
  await page.getByRole('button', { name: /创建/ }).click()
}

test('TXT 导入：括号答案格式，3 题', async ({ page }) => {
  await importFile(page, 'bank.txt')
  await expect(page.getByTestId('question-list').locator('li')).toHaveCount(3)
})

test('Word(.docx) 导入：答案行格式，3 题', async ({ page }) => {
  await importFile(page, 'bank.docx')
  await expect(page.getByTestId('question-list').locator('li')).toHaveCount(3)
})

test('PDF 导入：经 pdfjs 抽取，4 题', async ({ page }) => {
  await importFile(page, 'bank-synth.pdf')
  await expect(page.getByTestId('question-list').locator('li')).toHaveCount(4)
})

test('不支持的文件类型给出错误提示', async ({ page }) => {
  await page.locator(BANK_INPUT).setInputFiles(fixture('unsupported.png'))
  await expect(page.getByText(/仅支持/)).toBeVisible()
  await expect(page.getByRole('button', { name: '建为新题库' })).toHaveCount(0)
})

test('粘贴文本并解析预览', async ({ page }) => {
  await page.getByPlaceholder(/在此粘贴题库文本/).fill('1. 粘贴单选（ B ）。\nA. 甲\nB. 乙\nC. 丙')
  await page.getByRole('button', { name: '解析预览' }).click()
  await expect(page.getByText(/识别到/)).toBeVisible()
  await page.getByRole('button', { name: '建为新题库' }).click()
  await page.getByRole('button', { name: /创建/ }).click()
  await expect(page.getByTestId('question-list').locator('li')).toHaveCount(1)
})

test('导出 JSON 后再导入，题数一致', async ({ page }) => {
  await importFile(page, 'bank.txt')
  await expect(page.getByTestId('question-list').locator('li')).toHaveCount(3)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出' }).click(),
  ])
  const saved = join(tmpdir(), `shuati-export-${Date.now()}.json`)
  await download.saveAs(saved)

  await page.locator(JSON_INPUT).setInputFiles(saved)
  await expect(page.getByText(/导入 3 题/)).toBeVisible()
})
