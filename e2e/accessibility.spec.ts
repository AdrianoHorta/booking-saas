import { test, expect } from './fixtures'
import { auditAccessibility } from './accessibility'

test('acessibilidade do login e dos erros num ecrã estreito', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  await auditAccessibility(page, info)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  const email = page.getByLabel('Email', { exact: true })
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(email).toBeFocused()
  await expect(email).toHaveAccessibleDescription(/.+/)
  await auditAccessibility(page, info)
})
