import type { Page } from '@playwright/test'
import { auditAccessibility } from './accessibility'
import { test, expect, employeeId, serviceId, receipt, customer } from './fixtures'

async function reviewBooking(page: Page) {
  await page.goto('/book/barbearia-teste')
  await page.getByRole('combobox', { name: 'Serviço', exact: true }).selectOption(serviceId)
  await page.getByRole('combobox', { name: 'Profissional', exact: true }).selectOption(employeeId)
  await page.getByLabel('Data', { exact: true }).fill('2099-01-05')
  await page.getByRole('radio').first().check()
  await page.getByLabel('Nome', { exact: true }).fill('Cliente de teste')
  await page.getByLabel('Email', { exact: true }).fill('cliente@example.test')
  await page.getByRole('button', { name: 'Rever reserva' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar reserva' })).toBeVisible()
}

test('acessibilidade da revisão e da gestão da reserva em ecrã estreito', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await reviewBooking(page)
  await auditAccessibility(page, info)
  await page.goto(`/booking/manage/${receipt.id}#token=${receipt.cancellation_token}`)
  const cancel = page.getByRole('button', { name: 'Cancelar reserva', exact: true })
  await cancel.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Manter reserva' })).toBeFocused()
  await auditAccessibility(page, info)
  await page.keyboard.press('Enter')
  await expect(cancel).toBeFocused()
})

test('cliente reserva, abre ligação privada e cancela com confirmação', async ({ page, api }) => {
  let cancelled = false
  api.on('get_customer_booking', async (route) => {
    await route.fulfill({ json: cancelled ? { ...customer, status: 'cancelled', can_cancel: false } : customer })
  })
  api.on('cancel_customer_booking', async (route, body) => {
    expect(body).toEqual({ target_booking_id: receipt.id, cancellation_token: receipt.cancellation_token })
    cancelled = true
    await route.fulfill({ json: { ...customer, status: 'cancelled', can_cancel: false } })
  })
  await reviewBooking(page)
  expect(api.calls.filter((call) => call.name === 'confirm_booking')).toHaveLength(0)
  await page.getByRole('button', { name: 'Confirmar reserva' }).click()
  await expect(page.getByRole('heading', { name: 'Reserva confirmada.' })).toBeVisible()
  const confirmation = api.calls.find((call) => call.name === 'confirm_booking')!
  expect(confirmation.body).toMatchObject({ target_employee_id: employeeId, target_service_id: serviceId, customer_email: 'cliente@example.test' })
  const link = page.locator(`a[href^="/booking/manage/${receipt.id}"]`)
  await link.click()
  await expect(page.getByRole('heading', { name: 'A sua reserva.' })).toBeVisible()
  expect(new URL(page.url()).search).toBe('')
  await page.getByRole('button', { name: 'Cancelar reserva', exact: true }).click()
  expect(cancelled).toBe(false)
  await page.getByRole('button', { name: 'Manter reserva' }).click()
  expect(cancelled).toBe(false)
  await page.getByRole('button', { name: 'Cancelar reserva', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(page.getByRole('heading', { name: 'Reserva cancelada.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Reserva cancelada.' })).toBeVisible()
})

test('resultado incerto sobrevive ao reload e repete exatamente o mesmo pedido', async ({ page, api }) => {
  let attempts = 0
  api.on('confirm_booking', async (route) => {
    if (++attempts === 1) await route.abort('failed')
    else await route.fulfill({ json: receipt })
  })
  await reviewBooking(page)
  await page.getByRole('button', { name: 'Confirmar reserva' }).click()
  await expect(page.getByRole('button', { name: 'Verificar reserva' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reserva confirmada.' })).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Verificar reserva' }).click()
  await expect(page.getByRole('heading', { name: 'Reserva confirmada.' })).toBeVisible()
  const calls = api.calls.filter((call) => call.name === 'confirm_booking')
  expect(calls).toHaveLength(2)
  expect(calls[1].body).toEqual(calls[0].body)
  expect(await page.evaluate(() => sessionStorage.getItem('booking-pending:barbearia-teste'))).toBeNull()
})

test('vaga entretanto ocupada não anuncia sucesso e permite nova seleção', async ({ page, api }) => {
  api.on('confirm_booking', async (route) => {
    await route.fulfill({ status: 409, json: { code: '23P01', message: 'Overlap', details: null, hint: null } })
  })
  await reviewBooking(page)
  await page.getByRole('button', { name: 'Confirmar reserva' }).click()
  await expect(page.getByText('Este horário deixou de estar disponível. Escolha outra vaga.')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Serviço', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reserva confirmada.' })).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('booking-pending:barbearia-teste'))).toBeNull()
})

test('prazo terminado bloqueia cancelamento conforme a resposta do servidor', async ({ page, api }) => {
  api.on('get_customer_booking', async (route) => { await route.fulfill({ json: { ...customer, can_cancel: false } }) })
  await page.goto(`/booking/manage/${receipt.id}#token=${receipt.cancellation_token}`)
  await expect(page.getByText('O prazo de cancelamento terminou. Contacte a empresa.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancelar reserva', exact: true })).toHaveCount(0)
  expect(api.calls.some((call) => call.name === 'cancel_customer_booking')).toBe(false)
})

test('prazo que termina durante a confirmação não apresenta falso cancelamento', async ({ page, api }) => {
  api.on('cancel_customer_booking', async (route) => {
    await route.fulfill({ status: 400, json: { code: '22023', message: 'Deadline elapsed' } })
  })
  await page.goto(`/booking/manage/${receipt.id}#token=${receipt.cancellation_token}`)
  await page.getByRole('button', { name: 'Cancelar reserva', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(page.getByText('O prazo de cancelamento terminou. Contacte a empresa.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reserva cancelada.' })).toHaveCount(0)
})

test('ligação privada inválida não revela dados da reserva', async ({ page, api }) => {
  api.on('get_customer_booking', async (route) => { await route.fulfill({ status: 403, json: { code: '42501', message: 'Denied' } }) })
  await page.goto(`/booking/manage/${receipt.id}#token=${'b'.repeat(64)}`)
  await expect(page.getByText('Esta ligação não é válida ou a reserva não está disponível.')).toBeVisible()
  await expect(page.getByText('Corte · Miguel')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cancelar reserva', exact: true })).toHaveCount(0)
})

