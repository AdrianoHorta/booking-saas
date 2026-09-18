// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PublicBookingSettings } from './public-booking-settings'
import { useBusiness } from '../hooks/use-businesses'
import type { BusinessSummary } from '../business.types'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getBusiness: vi.fn() }))
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: () => ({ rpc: mocks.rpc }) }))
vi.mock('../../auth/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'owner' } } }) }))
vi.mock('../api/business-api', async (original) => ({ ...await original<typeof import('../api/business-api')>(), getBusiness: mocks.getBusiness }))
const business: BusinessSummary = { id: 'c1000000-0000-4000-8000-000000000001', name: 'Ana', slug: 'ana', timezone: 'UTC', role: 'owner', is_active: true, public_booking_enabled: false }
function Connected() {
  const query = useBusiness(business.id)
  return query.data ? <PublicBookingSettings business={query.data} /> : null
}
function setup(overrides: Partial<BusinessSummary> = {}) {
  const data = { ...business, ...overrides }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } })
  client.setQueryData(['business', 'owner', business.id], data)
  mocks.getBusiness.mockResolvedValue(data)
  render(<QueryClientProvider client={client}><Connected /></QueryClientProvider>)
  return client
}
beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)
it.each(['owner', 'admin'] as const)('%s pode publicar; aguarda servidor e atualiza cache', async (role) => {
  let finish!: (result: { data: boolean; error: null }) => void
  mocks.rpc.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  const client = setup({ role })
  mocks.getBusiness.mockResolvedValue({ ...business, role, public_booking_enabled: true })
  fireEvent.click(screen.getByRole('button', { name: 'Ativar reservas públicas' }))
  await screen.findByRole('button', { name: 'A guardar…' })
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Publicação: Desativada')).toBeTruthy()
  expect(mocks.rpc).toHaveBeenCalledWith('set_public_booking_enabled', { target_business_id: business.id, enabled: true })
  await act(async () => finish({ data: true, error: null }))
  await screen.findByRole('button', { name: 'Desativar reservas públicas' })
  expect(client.getQueryData<BusinessSummary>(['business', 'owner', business.id])?.public_booking_enabled).toBe(true)
})
it('employee consulta estado mas não recebe botão', () => {
  setup({ role: 'employee' })
  expect(screen.queryByRole('button')).toBeNull()
})
it('falha mantém estado e permite repetir', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } }).mockResolvedValueOnce({ data: true, error: null })
  setup()
  fireEvent.click(screen.getByRole('button', { name: 'Ativar reservas públicas' }))
  await screen.findByRole('alert')
  expect(screen.getByText('Publicação: Desativada')).toBeTruthy()
  expect(screen.queryByText('Alteração de publicação guardada.')).toBeNull()
  mocks.getBusiness.mockResolvedValue({ ...business, public_booking_enabled: true })
  fireEvent.click(screen.getByRole('button', { name: 'Ativar reservas públicas' }))
  await screen.findByText('Alteração de publicação guardada.')
})
it('empresa inativa não pode ativar', () => {
  setup({ is_active: false })
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
})
it('permite desativar publicação mesmo com empresa inativa', async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null })
  setup({ is_active: false, public_booking_enabled: true })
  mocks.getBusiness.mockResolvedValue({ ...business, is_active: false })
  fireEvent.click(screen.getByRole('button', { name: 'Desativar reservas públicas' }))
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('set_public_booking_enabled', { target_business_id: business.id, enabled: false }))
  await screen.findByText('Publicação: Desativada')
})
