import { test, expect } from './fixtures'
import { auditAccessibility } from './accessibility'

test('apresentação do produto permite conhecer funcionalidades e criar conta', async ({ page }, info) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('O tempo é seu.')
  await expect(page.locator('body')).not.toContainText(/demonstração|dados fictícios|projeto em desenvolvimento/i)
  await expect(page.locator('a[href="/demo"]')).toHaveCount(0)
  await auditAccessibility(page, info)
  await page.screenshot({ path: info.outputPath('home.png'), fullPage: true })
  await page.getByRole('link', { name: 'Conhecer funcionalidades' }).click()
  await expect(page).toHaveURL(/\/features$/)
  await expect(page).toHaveTitle('Funcionalidades · Booking SaaS')
  await expect(page.getByRole('heading', { name: 'Reservas online', exact: true })).toBeVisible()
  await auditAccessibility(page, info)
  await page.screenshot({ path: info.outputPath('features.png'), fullPage: true })
  await page.getByRole('link', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByRole('heading', { name: 'Um novo começo.' })).toBeVisible()
})

test('ligações antigas abrem o produto sem carregar a demonstração', async ({ page, api }) => {
  const loaded: string[] = []
  page.on('request', (request) => loaded.push(new URL(request.url()).pathname))
  await page.addInitScript(() => sessionStorage.setItem('booking-demo-v1', '{invalid'))
  for (const path of ['/demo', '/demo/']) {
    await page.goto(path)
    await expect(page).toHaveURL('http://127.0.0.1:4177/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('O tempo é seu.')
  }
  await page.goto('/project')
  await expect(page).toHaveURL(/\/features$/)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tudo no seu lugar.')
  expect(loaded.filter((path) => /\/assets\/demo-/.test(path))).toEqual([])
  expect(api.calls).toEqual([])
})

test('conta existente entra no painel sem expor o email na apresentação', async ({ page, api }) => {
  await api.signIn('72000000-0000-4000-8000-000000000001')
  api.onGet('business_members', async (route) => route.fulfill({ json: [] }))
  await page.goto('/')
  await page.getByRole('link', { name: 'Ir para os meus negócios' }).first().click()
  await expect(page.getByRole('heading', { name: 'Os seus negócios.' })).toBeVisible()
  await expect(page.getByText('O seu espaço de trabalho', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('team@example.test')
  await page.getByRole('link', { name: 'Editar perfil' }).click()
  await expect(page.getByText('Atual: team@example.test')).toBeVisible()
})
