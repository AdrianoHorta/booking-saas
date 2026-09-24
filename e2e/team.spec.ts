import type { Page } from '@playwright/test'
import { auditAccessibility } from './accessibility'
import { test, expect, receipt, employeeId, type TestApi } from './fixtures'

const businessId = '61000000-0000-4000-8000-000000000001'
const userId = '62000000-0000-4000-8000-000000000001'
const anaId = '63000000-0000-4000-8000-000000000002'
const path = `/dashboard/${businessId}/reservations`
const newStart = '2099-01-05T10:00:00Z'
const newEnd = '2099-01-05T10:30:00Z'
const booking = { ...receipt, customer: { name: 'Cliente Miguel', email: 'miguel-client@example.test', phone: null } }

async function setup(page: Page, api: TestApi, role: 'owner' | 'employee' = 'owner', associated = true) {
  await page.clock.setFixedTime(new Date('2099-01-01T12:00:00Z'))
  await api.signIn(userId)
  api.onGet('business_members', async (route, params) => {
    expect(params.get('user_id')).toBe(`eq.${userId}`)
    if (params.has('business_id')) expect(params.get('business_id')).toBe(`eq.${businessId}`)
    await route.fulfill({ json: [{ role, business: { id: businessId, name: 'Empresa teste', slug: 'empresa-teste',
      timezone: 'Europe/Lisbon', is_active: true, public_booking_enabled: true, cancellation_notice_hours: 12 } }] })
  })
  api.onGet('employees', async (route, params) => {
    expect(params.get('business_id')).toBe(`eq.${businessId}`)
    if (role === 'employee') {
      expect(params.get('user_id')).toBe(`eq.${userId}`)
      await route.fulfill({ json: associated ? [{ id: employeeId, name: 'Miguel' }] : [] })
    } else await route.fulfill({ json: [
      { id: employeeId, name: 'Miguel', is_active: true, employee_services: [] },
      { id: anaId, name: 'Ana', is_active: true, employee_services: [] },
    ] })
  })
  api.onGet('bookings', async (route, params) => {
    expect(params.get('business_id')).toBe(`eq.${businessId}`)
    await route.fulfill({ json: [booking] })
  })
  api.on('get_reschedule_slots', async (route, body) => {
    expect(body).toMatchObject({ target_business_id: businessId, target_booking_id: booking.id })
    await route.fulfill({ json: { expected_start: booking.starts_at, slots: [{ starts_at: newStart, ends_at: newEnd }] } })
  })
}

async function openOwnerReservations(page: Page) {
  await page.goto(path)
  await page.getByRole('button', { name: 'Miguel', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Reservas', exact: true })).toBeVisible()
}

test('acessibilidade da agenda e teclado na janela de reagendamento', async ({ page, api }, info) => {
  await setup(page, api)
  await page.setViewportSize({ width: 320, height: 800 })
  await openOwnerReservations(page)
  await auditAccessibility(page, info)
  const opener = page.getByRole('button', { name: 'Reagendar reserva' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Reagendar reserva' })
  await expect(dialog.getByLabel('Nova data')).toBeFocused()
  await auditAccessibility(page, info)
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    // Native dialogs may let Tab reach browser chrome, but never background controls.
    expect(await dialog.evaluate((node) => node.contains(document.activeElement) || document.activeElement === document.body)).toBe(true)
  }
  await dialog.getByRole('button', { name: 'Manter horário' }).focus()
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Shift+Tab')
    expect(await dialog.evaluate((node) => node.contains(document.activeElement) || document.activeElement === document.body)).toBe(true)
  }
  await dialog.getByLabel('Nova data').focus()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  const cancel = page.getByRole('button', { name: 'Cancelar reserva', exact: true })
  await cancel.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Manter reserva' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(cancel).toBeFocused()
})

test('proprietário escolhe colaborador e os filtros chegam ao servidor', async ({ page, api }) => {
  await setup(page, api)
  api.onGet('bookings', async (route, params) => {
    const ana = params.get('employee_id') === `eq.${anaId}`
    expect(params.get('business_id')).toBe(`eq.${businessId}`)
    await route.fulfill({ json: params.get('status') === 'eq.cancelled' ? [] : [ana
      ? { ...booking, employee_name: 'Ana', customer: { ...booking.customer, name: 'Cliente Ana' } } : booking] })
  })
  await page.goto(path)
  await expect(page.getByText('Escolha um colaborador para consultar as reservas.')).toBeVisible()
  expect(api.calls.some((call) => call.name === 'GET:bookings')).toBe(false)
  await page.getByRole('button', { name: 'Miguel', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Reservas da empresa - Miguel', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Reservas' }).getByText('Profissional', { exact: true })).toBeVisible()
  await expect(page.getByText('Cliente Miguel', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ana', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Reservas da empresa - Ana', exact: true })).toBeVisible()
  await expect(page.getByText('Cliente Ana', { exact: true })).toBeVisible()
  await expect(page.getByText('Cliente Miguel', { exact: true })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('cancelled')
  await expect(page.getByText('Não existem reservas para este período e estado.')).toBeVisible()
  expect(api.calls.filter((call) => call.name === 'GET:bookings').at(-1)?.body).toMatchObject({ employee_id: `eq.${anaId}`, status: 'eq.cancelled' })
})

test('colaborador vê a sua agenda sem seletor de colegas nem profissional redundante', async ({ page, api }) => {
  await setup(page, api, 'employee')
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'As minhas reservas.' })).toBeVisible()
  await expect(page.getByText('Cliente Miguel', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Colaboradores' })).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Reservas' }).getByText('Profissional', { exact: true })).toHaveCount(0)
})

test('colaborador sem associação recebe orientação e não consulta reservas', async ({ page, api }) => {
  await setup(page, api, 'employee', false)
  await page.goto(path)
  await expect(page.getByText(/A sua conta ainda não está associada a um profissional desta empresa/)).toBeVisible()
  expect(api.calls.some((call) => call.name === 'GET:bookings')).toBe(false)
  await expect(page.getByRole('button', { name: 'Reagendar reserva' })).toHaveCount(0)
})

test('reagendamento confirmado atualiza o card e preserva preço e referência', async ({ page, api }) => {
  await setup(page, api)
  let moved = false
  api.onGet('bookings', async (route) => { await route.fulfill({ json: [moved ? { ...booking, starts_at: newStart, ends_at: newEnd } : booking] }) })
  api.on('reschedule_booking', async (route, body) => {
    expect(body).toEqual({ target_business_id: businessId, target_booking_id: booking.id, expected_start: booking.starts_at, requested_start: newStart })
    moved = true
    await route.fulfill({ json: { id: booking.id, starts_at: newStart, ends_at: newEnd } })
  })
  await openOwnerReservations(page)
  await page.getByRole('button', { name: 'Reagendar reserva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Reagendar reserva' })
  await dialog.getByRole('combobox', { name: 'Novo horário', exact: true }).selectOption(newStart)
  expect(moved).toBe(false)
  await dialog.getByRole('button', { name: 'Confirmar novo horário' }).click()
  await expect(dialog).toHaveCount(0)
  const card = page.getByRole('list', { name: 'Reservas' })
  await expect(card.getByText(/10:00/)).toBeVisible()
  await expect(card.getByText(/15,00/)).toBeVisible()
  await card.getByText('Referência', { exact: true }).click()
  await expect(card.getByText(booking.id, { exact: true })).toBeVisible()
  await expect(card.getByText(/09:00/)).toHaveCount(0)
})

test('conflito no reagendamento preserva horário e permite fechar a janela', async ({ page, api }) => {
  await setup(page, api)
  api.on('reschedule_booking', async (route) => { await route.fulfill({ status: 409, json: { code: '23P01', message: 'Overlap' } }) })
  await openOwnerReservations(page)
  await page.getByRole('button', { name: 'Reagendar reserva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Reagendar reserva' })
  await dialog.getByRole('combobox', { name: 'Novo horário', exact: true }).selectOption(newStart)
  await dialog.getByRole('button', { name: 'Confirmar novo horário' }).click()
  await expect(dialog.getByText('Esta vaga já não está disponível. A reserva original foi mantida.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Manter horário' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Reservas' }).getByText(/09:00/)).toBeVisible()
})

test('resultado incerto bloqueia edição e Escape até verificar o mesmo pedido', async ({ page, api }) => {
  await setup(page, api)
  let attempts = 0
  let saved = false
  api.onGet('bookings', async (route) => {
    await route.fulfill({ json: [saved ? { ...booking, starts_at: newStart, ends_at: newEnd } : booking] })
  })
  api.on('reschedule_booking', async (route) => {
    // The server committed, but the first response was lost in transit.
    saved = true
    if (++attempts === 1) await route.abort('failed')
    else await route.fulfill({ json: { id: booking.id, starts_at: newStart, ends_at: newEnd } })
  })
  await openOwnerReservations(page)
  await page.getByRole('button', { name: 'Reagendar reserva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Reagendar reserva' })
  await dialog.getByRole('combobox', { name: 'Novo horário', exact: true }).selectOption(newStart)
  await dialog.getByRole('button', { name: 'Confirmar novo horário' }).click()
  await expect(dialog.getByRole('button', { name: 'Verificar alteração' })).toBeVisible()
  await expect(dialog.getByRole('combobox')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Verificar alteração' }).click()
  await expect(dialog).toHaveCount(0)
  const calls = api.calls.filter((call) => call.name === 'reschedule_booking')
  expect(calls).toHaveLength(2)
  expect(calls[1].body).toEqual(calls[0].body)
  await expect(page.getByRole('list', { name: 'Reservas' }).getByText(/10:00/)).toBeVisible()
})

test('sessão sem acesso à empresa não consulta reservas nem colaboradores', async ({ page, api }) => {
  await setup(page, api)
  api.onGet('business_members', async (route) => { await route.fulfill({ json: [] }) })
  await page.goto(path)
  await expect(page.getByText('Esta empresa não está disponível para a sua conta.')).toBeVisible()
  expect(api.calls.some((call) => call.name === 'GET:bookings' || call.name === 'GET:employees')).toBe(false)
})

test('visitante sem sessão é encaminhado para login sem consultar dados privados', async ({ page, api }) => {
  await page.goto(path)
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  expect(api.calls).toEqual([])
})

test('equipa cancela apenas após confirmação e mantém o estado após reload', async ({ page, api }) => {
  await setup(page, api)
  let cancelled = false
  api.onGet('bookings', async (route) => {
    await route.fulfill({ json: [{ ...booking, status: cancelled ? 'cancelled' : 'confirmed' }] })
  })
  api.on('cancel_booking', async (route, body) => {
    expect(body).toEqual({ target_business_id: businessId, target_booking_id: booking.id })
    cancelled = true
    await route.fulfill({ json: { id: booking.id, status: 'cancelled', cancelled_at: '2099-01-01T12:00:00Z' } })
  })
  await openOwnerReservations(page)
  await page.getByRole('button', { name: 'Cancelar reserva', exact: true }).click()
  await page.getByRole('button', { name: 'Manter reserva' }).click()
  expect(api.calls.filter((call) => call.name === 'cancel_booking')).toHaveLength(0)
  await page.getByRole('button', { name: 'Cancelar reserva', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  const list = page.getByRole('list', { name: 'Reservas' })
  await expect(list.getByText('Cancelada', { exact: true })).toBeVisible()
  await expect(list.getByRole('button', { name: 'Reagendar reserva' })).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Miguel', exact: true }).click()
  await expect(list.getByText('Cancelada', { exact: true })).toBeVisible()
  expect(api.calls.filter((call) => call.name === 'cancel_booking')).toHaveLength(1)
})

test('cancelamento com resposta perdida permite repetir o mesmo pedido', async ({ page, api }) => {
  await setup(page, api)
  let cancelled = false
  let attempts = 0
  api.onGet('bookings', async (route) => {
    await route.fulfill({ json: [{ ...booking, status: cancelled ? 'cancelled' : 'confirmed' }] })
  })
  api.on('cancel_booking', async (route) => {
    cancelled = true
    if (++attempts === 1) await route.abort('failed')
    else await route.fulfill({ json: { id: booking.id, status: 'cancelled', cancelled_at: '2099-01-01T12:00:00Z' } })
  })
  await openOwnerReservations(page)
  await page.getByRole('button', { name: 'Cancelar reserva', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(page.getByText(/Não foi possível confirmar o cancelamento/)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Reservas' }).getByText('Confirmada', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(page.getByRole('list', { name: 'Reservas' }).getByText('Cancelada', { exact: true })).toBeVisible()
  const calls = api.calls.filter((call) => call.name === 'cancel_booking')
  expect(calls).toHaveLength(2)
  expect(calls[1].body).toEqual(calls[0].body)
})

test('prazo rejeitado pelo servidor não anuncia cancelamento à equipa', async ({ page, api }) => {
  await setup(page, api)
  api.on('cancel_booking', async (route) => {
    await route.fulfill({ status: 400, json: { code: '22023', message: 'Cancellation deadline passed' } })
  })
  await openOwnerReservations(page)
  await page.getByRole('button', { name: 'Cancelar reserva', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(page.getByText('O prazo de cancelamento desta reserva terminou.')).toBeVisible()
  await expect(page.getByText('Reserva cancelada.', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Reservas' }).getByText('Confirmada', { exact: true })).toBeVisible()
})

test('paginação mantém filtros e regressa à primeira página ao mudar de colaborador', async ({ page, api }) => {
  await setup(page, api)
  const rows = Array.from({ length: 27 }, (_, index) => ({ ...booking,
    id: `66000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    customer: { ...booking.customer, name: `Cliente ${index + 1}` },
  }))
  api.onGet('bookings', async (route, params) => {
    expect(params.get('business_id')).toBe(`eq.${businessId}`)
    expect(params.get('limit')).toBe('26')
    const offset = Number(params.get('offset') ?? '0')
    await route.fulfill({ json: rows.slice(offset, offset + 26) })
  })
  await openOwnerReservations(page)
  const list = page.getByRole('list', { name: 'Reservas' })
  await expect(list.getByRole('listitem')).toHaveCount(25)
  await expect(list.getByText('Cliente 26', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Seguinte', exact: true }).click()
  await expect(page.getByText('Página 2', { exact: true })).toBeVisible()
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list.getByText('Cliente 26', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Seguinte', exact: true })).toBeDisabled()
  expect(api.calls.filter((call) => call.name === 'GET:bookings').at(-1)?.body).toMatchObject({ offset: '25', employee_id: `eq.${employeeId}` })
  await page.getByRole('button', { name: 'Ana', exact: true }).click()
  await expect(page.getByText('Página 1', { exact: true })).toBeVisible()
  await expect(list.getByRole('listitem')).toHaveCount(25)
  expect(api.calls.filter((call) => call.name === 'GET:bookings').at(-1)?.body).toMatchObject({ offset: '0', employee_id: `eq.${anaId}` })
})

test('logout noutra aba remove a agenda aberta e não restaura sessão no reload', async ({ page, context, api }) => {
  await setup(page, api, 'employee')
  api.onAuth('logout', async (route) => { await route.fulfill({ status: 204 }) })
  await page.goto(path)
  await expect(page.getByText('Cliente Miguel', { exact: true })).toBeVisible()
  const other = await context.newPage()
  await other.clock.setFixedTime(new Date('2099-01-01T12:00:00Z'))
  await other.goto('/dashboard')
  await expect(other.getByRole('heading', { name: 'Os seus negócios.' })).toBeVisible()
  await other.getByRole('button', { name: 'Terminar sessão' }).click()
  await expect(other).toHaveURL(/\/login$/)
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Cliente Miguel', { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => localStorage.getItem('sb-booking-test-auth-token'))).toBeNull()
})
