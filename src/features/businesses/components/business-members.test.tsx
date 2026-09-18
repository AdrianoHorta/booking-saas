// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BusinessMembers } from './business-members'
import type { BusinessSummary } from '../business.types'
const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn(), remove: vi.fn() }))
vi.mock('../../auth/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'owner' } } }) }))
vi.mock('../api/members-api', async (original) => ({ ...await original<typeof import('../api/members-api')>(),
  listBusinessMembers: mocks.list, saveBusinessMember: mocks.save, removeBusinessMember: mocks.remove }))
const business: BusinessSummary = { id: 'd1000000-0000-4000-8000-000000000001', name: 'Company', slug: 'company', timezone: 'UTC', role: 'owner', is_active: true, public_booking_enabled: false }
function setup(role: BusinessSummary['role'] = 'owner') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><BusinessMembers business={{ ...business, role }} /></QueryClientProvider>)
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.list.mockResolvedValue([{ user_id: 'owner', email: 'owner@example.test', role: 'owner' }, { user_id: 'worker', email: 'miguel@example.test', role: 'employee' }])
  mocks.save.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined)
})
afterEach(cleanup)
it('adiciona por email normalizado e atualiza lista', async () => {
  setup(); await screen.findByText('miguel@example.test')
  fireEvent.change(screen.getByLabelText('Email da conta'), { target: { value: ' NOVO@example.test ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar acesso' }))
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(business.id, { email: 'novo@example.test', role: 'employee' }))
  await screen.findByText(/Acesso guardado/)
  expect(mocks.list.mock.calls.length).toBeGreaterThan(1)
})
it('não consulta nem mostra emails a employee', () => {
  setup('employee')
  expect(screen.queryByText('Acesso à empresa')).toBeNull()
  expect(mocks.list).not.toHaveBeenCalled()
})
it('admin não recebe opção de promover ou atribuir admin', async () => {
  setup('admin'); await screen.findByText('miguel@example.test')
  expect(screen.queryByRole('button', { name: 'Tornar administrador' })).toBeNull()
  expect(screen.queryByRole('option', { name: 'Administrador' })).toBeNull()
})
it('owner pode promover colaborador', async () => {
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Tornar administrador' }))
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(business.id, { email: 'miguel@example.test', role: 'admin' }))
})
it('retirar acesso exige confirmação e permite cancelar', async () => {
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Retirar acesso' }))
  expect(mocks.remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('button', { name: 'Confirmar retirada de acesso' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retirar acesso' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar retirada de acesso' }))
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(business.id, 'worker'))
  await screen.findByText(/Acesso retirado/)
})
it('erro não anuncia sucesso e mantém email para nova tentativa', async () => {
  mocks.save.mockRejectedValue(new Error('Conta não existe'))
  setup(); await screen.findByText('miguel@example.test')
  fireEvent.change(screen.getByLabelText('Email da conta'), { target: { value: 'missing@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar acesso' }))
  await screen.findByText('Conta não existe')
  expect(screen.queryByText(/Acesso guardado/)).toBeNull()
  expect((screen.getByLabelText('Email da conta') as HTMLInputElement).value).toBe('missing@example.test')
})
