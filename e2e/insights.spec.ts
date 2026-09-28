import { test, expect } from './fixtures'
import { auditAccessibility } from './accessibility'

const businessId = '81000000-0000-4000-8000-000000000001'
const userId = '82000000-0000-4000-8000-000000000001'
const path = `/dashboard/${businessId}/insights`
test('gestor consulta indicadores e ativa emails sem enviar pedidos pelo browser', async ({ page, api }, info) => {
  await page.clock.setFixedTime(new Date('2099-07-02T12:00:00Z'))
  await api.signIn(userId)
  api.onGet('business_members', async (route) => { await route.fulfill({ json: [{ role: 'owner', business: {
    id: businessId, name: 'Empresa', slug: 'empresa', timezone: 'Europe/Lisbon', is_active: true, public_booking_enabled: true,
  } }] }) })
  api.on('booking_analytics', async (route, body) => {
    expect(body).toEqual({ target_business_id: businessId, date_from: '2099-07-01', date_to: '2099-07-02' })
    await route.fulfill({ json: { confirmed: 3, cancelled: 1, booked_value_cents: 4500, booked_minutes: 90,
      daily: [{ date: '2099-07-02', confirmed: 3, cancelled: 1 }], services: [{ name: 'Corte', confirmed: 3, booked_value_cents: 4500 }] } })
  })
  let enabled = false
  api.on('booking_integration_status', async (route) => { await route.fulfill({ json: { emails_enabled: enabled, deliveries: [] } }) })
  api.on('set_booking_emails_enabled', async (route, body) => {
    expect(body).toEqual({ target_business_id: businessId, enabled: true }); enabled = true
    await route.fulfill({ json: true })
  })
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Indicadores e notificações.' })).toBeVisible()
  await expect(page.getByText('45,00', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('table', { name: 'Marcações por dia' })).toBeVisible()
  await expect(page.getByText('Emails automáticos desativados.')).toBeVisible()
  await auditAccessibility(page, info)
  await page.getByRole('button', { name: 'Ativar emails', exact: true }).click()
  await expect(page.getByText('Emails automáticos ativos.')).toBeVisible()
  const calls = api.calls.filter((call) => call.name === 'booking_analytics').length
  await page.getByLabel('Até', { exact: true }).fill('2099-06-30')
  await expect(page.getByText('Escolha um período válido de 1 a 366 dias.')).toBeVisible()
  expect(api.calls.filter((call) => call.name === 'booking_analytics')).toHaveLength(calls)
})

test('colaborador não consulta indicadores nem o estado dos envios da empresa', async ({ page, api }) => {
  await api.signIn(userId)
  api.onGet('business_members', async (route) => { await route.fulfill({ json: [{ role: 'employee', business: {
    id: businessId, name: 'Empresa', slug: 'empresa', timezone: 'Europe/Lisbon', is_active: true, public_booking_enabled: true,
  } }] }) })
  await page.goto(path)
  await expect(page.getByText('Esta página está disponível apenas para o proprietário e administradores da empresa.')).toBeVisible()
  expect(api.calls.some((call) => call.name === 'booking_analytics' || call.name === 'booking_integration_status')).toBe(false)
})

test('falha de indicadores não apresenta zeros e permite recuperar', async ({ page, api }) => {
  await api.signIn(userId)
  api.onGet('business_members', async (route) => { await route.fulfill({ json: [{ role: 'admin', business: {
    id: businessId, name: 'Empresa', slug: 'empresa', timezone: 'Europe/Lisbon', is_active: true, public_booking_enabled: true,
  } }] }) })
  let failed = true
  api.on('booking_analytics', async (route) => {
    if (failed) await route.fulfill({ status: 500, json: { message: 'Unavailable' } })
    else await route.fulfill({ json: { confirmed: 0, cancelled: 0, booked_value_cents: 0, booked_minutes: 0, daily: [], services: [] } })
  })
  api.on('booking_integration_status', async (route) => { await route.fulfill({ json: { emails_enabled: false, deliveries: [{
    id: '1', channel: 'calendar', event: 'confirmed', state: 'failed', attempts: 1, error_code: 'reconnect', created_at: '2099-07-02T12:00:00Z', finished_at: '2099-07-02T12:00:01Z',
  }] } }) })
  await page.goto(path)
  await expect(page.getByText('Não foi possível carregar os indicadores.')).toBeVisible()
  await expect(page.getByText('Não existem reservas neste período.')).toHaveCount(0)
  await expect(page.getByText(/Google Calendar · Confirmação · Requer atenção/)).toBeVisible()
  failed = false
  await page.getByRole('button', { name: 'Atualizar indicadores' }).click()
  await expect(page.getByText('Não existem reservas neste período.')).toBeVisible()
})
