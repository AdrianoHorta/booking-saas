import type { Page } from '@playwright/test'
import { auditAccessibility } from './accessibility'
import { test, expect, syntheticSession, type TestApi } from './fixtures'

const businessId = '71000000-0000-4000-8000-000000000001'
const ownerId = '72000000-0000-4000-8000-000000000001'
const workerId = '72000000-0000-4000-8000-000000000002'
const adminId = '72000000-0000-4000-8000-000000000003'
const path = `/dashboard/${businessId}?view=settings`
type Role = 'owner' | 'admin' | 'employee'
type Member = { user_id: string; email: string; role: Role }
const business = { id: businessId, name: 'Empresa da equipa', slug: 'equipa-teste', timezone: 'Europe/Lisbon',
  is_active: true, public_booking_enabled: false, cancellation_notice_hours: 12 }

async function setup(page: Page, api: TestApi, role: Role = 'owner') {
  const id = role === 'owner' ? ownerId : role === 'admin' ? adminId : workerId
  await page.clock.setFixedTime(new Date('2099-01-01T12:00:00Z'))
  await api.signIn(id)
  const state = { role, id, revoked: false, members: [
    { user_id: ownerId, email: 'owner@example.test', role: 'owner' },
    { user_id: adminId, email: 'admin@example.test', role: 'admin' },
  ] as Member[] }
  api.onGet('business_members', async (route, params) => {
    expect(params.get('user_id')).toBe(`eq.${state.id}`)
    await route.fulfill({ json: state.revoked ? [] : [{ role: state.role, business }] })
  })
  api.onGet('bookings', async (route) => {
    await route.fulfill({ json: [], headers: { 'content-range': '*/0', 'access-control-expose-headers': 'content-range' } })
  })
  api.onGet('employees', async (route) => { await route.fulfill({ json: [] }) })
  api.on('calendar_connection_status', async (route) => { await route.fulfill({ json: null }) })
  api.on('list_business_members', async (route, body) => {
    expect(body.target_business_id).toBe(businessId)
    await route.fulfill({ json: state.members })
  })
  return state
}

test('dashboard organiza acessos em cartões e separa as definições', async ({ page, api }, info) => {
  await setup(page, api)
  await page.goto(`/dashboard/${businessId}`)
  await expect(page.getByRole('heading', { name: 'O seu espaço de trabalho' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Agenda e reservas/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Acesso à empresa' })).toHaveCount(0)
  await expect(page.getByText('Não há próximas marcações confirmadas neste período.')).toBeVisible()
  await page.screenshot({ path: info.outputPath('dashboard-overview.png'), fullPage: true })
  await auditAccessibility(page, info)
  await page.getByRole('link', { name: 'Definições', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'A sua empresa' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Acesso à empresa' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('dashboard-settings.png'), fullPage: true })
  await auditAccessibility(page, info)
  await page.reload()
  await expect(page.getByRole('link', { name: 'Definições', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('proprietário adiciona conta, altera papel e confirma a retirada de acesso', async ({ page, api }) => {
  const state = await setup(page, api)
  api.on('save_business_member', async (route, body) => {
    expect(body).toMatchObject({ target_business_id: businessId, member_email: 'worker@example.test' })
    const existing = state.members.find((member) => member.user_id === workerId)
    if (existing) existing.role = body.member_role as Role
    else state.members.push({ user_id: workerId, email: 'worker@example.test', role: body.member_role as Role })
    await route.fulfill({ json: null })
  })
  api.on('remove_business_member', async (route, body) => {
    expect(body).toEqual({ target_business_id: businessId, target_user_id: workerId })
    state.members = state.members.filter((member) => member.user_id !== workerId)
    await route.fulfill({ json: null })
  })
  await page.goto(path)
  const section = page.getByRole('region', { name: 'Acesso à empresa' })
  await section.getByLabel('Email da conta').fill('worker@example.test')
  await section.getByRole('button', { name: 'Guardar acesso' }).click()
  const member = section.getByRole('listitem').filter({ hasText: 'worker@example.test' })
  await expect(member.getByText('Colaborador', { exact: true })).toBeVisible()
  await member.getByRole('button', { name: 'Tornar administrador' }).click()
  await expect(member.getByText('Administrador', { exact: true })).toBeVisible()
  await member.getByRole('button', { name: 'Retirar acesso', exact: true }).click()
  expect(api.calls.some((call) => call.name === 'remove_business_member')).toBe(false)
  await member.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(member).toBeVisible()
  await member.getByRole('button', { name: 'Retirar acesso', exact: true }).click()
  await member.getByRole('button', { name: 'Confirmar retirada de acesso' }).click()
  await expect(member).toHaveCount(0)
  await expect(section.getByText('Acesso retirado. O profissional e as reservas foram mantidos.')).toBeVisible()
  await page.reload()
  await expect(section.getByText('owner@example.test', { exact: true })).toBeVisible()
  await expect(section.getByText('worker@example.test', { exact: true })).toHaveCount(0)
  expect(api.calls.filter((call) => call.name === 'remove_business_member')).toHaveLength(1)
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click()
  await expect(page.getByText('Não há próximas marcações confirmadas neste período.')).toBeVisible()
})

test('email sem conta registada mostra erro sem adicionar um membro fictício', async ({ page, api }) => {
  await setup(page, api)
  api.on('save_business_member', async (route) => { await route.fulfill({ status: 400, json: { code: 'P0002', message: 'Not found' } }) })
  await page.goto(path)
  const section = page.getByRole('region', { name: 'Acesso à empresa' })
  await section.getByLabel('Email da conta').fill('unknown@example.test')
  await section.getByRole('button', { name: 'Guardar acesso' }).click()
  await expect(section.getByText('Esta conta ainda não existe. Peça à pessoa para se registar primeiro.')).toBeVisible()
  await expect(section.getByRole('listitem')).toHaveCount(2)
  await expect(section.getByText(/Acesso guardado/)).toHaveCount(0)
})

test('administrador não promove membros nem altera proprietário ou o seu acesso', async ({ page, api }) => {
  const state = await setup(page, api, 'admin')
  state.members.push({ user_id: workerId, email: 'worker@example.test', role: 'employee' })
  await page.goto(path)
  const section = page.getByRole('region', { name: 'Acesso à empresa' })
  await expect(section.getByText('worker@example.test', { exact: true })).toBeVisible()
  await expect(section.getByRole('button', { name: 'Tornar administrador' })).toHaveCount(0)
  await expect(section.getByRole('listitem').filter({ hasText: 'owner@example.test' }).getByRole('button')).toHaveCount(0)
  await expect(section.getByRole('listitem').filter({ hasText: 'admin@example.test' }).getByRole('button')).toHaveCount(0)
  await expect(section.getByRole('combobox', { name: 'Permissão', exact: true }).locator('option')).toHaveCount(1)
  await expect(section.getByRole('button', { name: 'Retirar acesso', exact: true })).toHaveCount(1)
})

test('colaborador não vê gestão de membros nem pede a lista de emails', async ({ page, api }) => {
  await setup(page, api, 'employee')
  await page.goto(path)
  await expect(page.getByRole('heading', { name: business.name, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Terminar sessão' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Acesso à empresa' })).toHaveCount(0)
  expect(api.calls.some((call) => call.name === 'list_business_members')).toBe(false)
})

test('logout e login de outra conta no mesmo documento removem os dados anteriores', async ({ page, api }) => {
  const state = await setup(page, api)
  api.onAuth('logout', async (route) => { await route.fulfill({ status: 204 }) })
  api.onAuth('token', async (route, body) => {
    expect(body.email).toBe('worker@example.test')
    state.id = workerId; state.role = 'employee'
    await route.fulfill({ json: syntheticSession(workerId, 'worker@example.test') })
  })
  await page.goto(path)
  await expect(page.getByText('owner@example.test', { exact: true })).toBeVisible()
  const before = api.calls.filter((call) => call.name === 'list_business_members').length
  // Detect accidental document reloads: cache isolation must work in the SPA itself.
  await page.evaluate(() => { Object.assign(window, { e2eDocumentMarker: 'same-document' }) })
  await page.getByRole('button', { name: 'Terminar sessão' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('owner@example.test', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('sb-booking-test-auth-token'))).toBeNull()
  await page.getByLabel('Email', { exact: true }).fill('worker@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('link', { name: /Empresa da equipa/ }).click()
  await expect(page.getByRole('heading', { name: business.name, exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Acesso à empresa' })).toHaveCount(0)
  await expect(page.getByText('owner@example.test', { exact: true })).toHaveCount(0)
  expect(api.calls.filter((call) => call.name === 'list_business_members')).toHaveLength(before)
  expect(await page.evaluate(() => Reflect.get(window, 'e2eDocumentMarker'))).toBe('same-document')
  await page.getByRole('button', { name: 'Terminar sessão' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => localStorage.getItem('sb-booking-test-auth-token'))).toBeNull()
})

test('retirada de acesso esconde a empresa na próxima revalidação sem recarregar', async ({ page, api }) => {
  const state = await setup(page, api, 'admin')
  await page.goto(path)
  await expect(page.getByText('owner@example.test', { exact: true })).toBeVisible()
  state.revoked = true
  await page.clock.setFixedTime(new Date('2099-01-01T12:00:31Z'))
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
  })
  await expect(page.getByRole('heading', { name: 'Empresa indisponível.' })).toBeVisible()
  await expect(page.getByText('owner@example.test', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Acesso à empresa' })).toHaveCount(0)
})
