import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type TestInfo } from '@playwright/test'

export async function auditAccessibility(page: Page, info: TestInfo) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  await info.attach(`accessibility-${info.attachments.length}`, { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  expect(result.violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}
