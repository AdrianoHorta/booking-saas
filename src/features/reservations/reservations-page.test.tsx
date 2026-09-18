// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReservationsPage } from './reservations-page'
const mocks = vi.hoisted(() => ({ role: 'employee', get: vi.fn(), profile: vi.fn(), employees: vi.fn() }))
vi.mock('../employees/api/employees-api', () => ({ getEmployees: mocks.employees }))
vi.mock('../auth/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'miguel' } } }) }))
vi.mock('../businesses/hooks/use-businesses', () => ({ useBusiness: () => ({ isPending: false, isError: false,
  data: { id: 'd1000000-0000-4000-8000-000000000001', name: 'Empresa', role: mocks.role, timezone: 'Europe/Lisbon' } }) }))
vi.mock('./reservations-api', async (original) => ({ ...await original<typeof import('./reservations-api')>(), getReservations: mocks.get, getOwnProfessional: mocks.profile }))
const booking = { id: 'reservation-1', starts_at: '2026-07-06T09:00:00Z', ends_at: '2026-07-06T09:30:00Z', status: 'confirmed', service_name: 'Corte original', employee_name: 'Miguel', duration_minutes: 30, price_cents: 1500, currency: 'EUR', customer: { name: 'Cliente Ana', email: 'ana@example.test', phone: '912345678' } }
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard/d1000000-0000-4000-8000-000000000001/reservations']}>
    <Routes><Route path="/dashboard/:businessId/reservations" element={<ReservationsPage />} /></Routes>
  </MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { vi.resetAllMocks(); mocks.role = 'employee'; mocks.profile.mockResolvedValue({ id: 'professional', name: 'Miguel' }); mocks.get.mockResolvedValue({ reservations: [booking], hasMore: false }); mocks.employees.mockResolvedValue([{ id: 'd3000000-0000-4000-8000-000000000001', name: 'Miguel', is_active: true }, { id: 'd3000000-0000-4000-8000-000000000002', name: 'Ana', is_active: false }]) })
afterEach(cleanup)
it('Miguel vê os dados devolvidos pelo servidor com contactos e hora da empresa', async () => {
  setup(); await screen.findByText('Cliente Ana')
  expect(screen.getByText('As minhas reservas.')).toBeTruthy()
  expect(screen.getByText('ana@example.test')).toBeTruthy()
  expect(screen.getByText(/10:00/)).toBeTruthy()
  expect(screen.getByText('Corte original')).toBeTruthy()
  expect(screen.queryByText('Profissional')).toBeNull()
  expect(screen.getByText('Duração')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /cancelar/i })).toBeNull()
})
it.each(['owner', 'admin'])('%s consulta empresa sem exigir perfil de profissional', async (role) => {
  mocks.role = role; setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Miguel' }))
  await screen.findByText('Cliente Ana')
  expect(screen.getByText('Reservas da empresa - Miguel')).toBeTruthy()
  expect(screen.getByText('Profissional')).toBeTruthy()
  expect(mocks.get.mock.calls.at(-1)?.[0].employeeId).toBe('d3000000-0000-4000-8000-000000000001')
  expect(mocks.profile).not.toHaveBeenCalled()
})
it('sem associação explica como resolver e não consulta reservas', async () => {
  mocks.profile.mockResolvedValue(null); setup()
  await screen.findByText(/ainda não está associada/)
  expect(mocks.get).not.toHaveBeenCalled()
})
it('período inválido esconde dados anteriores e impede consulta', async () => {
  setup(); await screen.findByText('Cliente Ana')
  const calls = mocks.get.mock.calls.length
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '' } })
  await screen.findByRole('alert')
  expect(screen.queryByText('Cliente Ana')).toBeNull()
  expect(mocks.get).toHaveBeenCalledTimes(calls)
})
it('mudar estado reinicia a paginação e encaminha o filtro', async () => {
  mocks.get.mockResolvedValue({ reservations: [booking], hasMore: true }); setup()
  await screen.findByText('Cliente Ana'); fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }))
  await waitFor(() => expect(mocks.get.mock.calls.at(-1)?.[0].page).toBe(1))
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'cancelled' } })
  await waitFor(() => expect(mocks.get.mock.calls.at(-1)?.[0]).toMatchObject({ page: 0, status: 'cancelled' }))
})
it('falha mostra erro e atualização permite repetir', async () => {
  mocks.get.mockRejectedValueOnce(new Error('Falha de ligação')).mockResolvedValueOnce({ reservations: [], hasMore: false })
  setup(); await screen.findByText('Falha de ligação')
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar reservas' }))
  await screen.findByText('Não existem reservas para este período e estado.')
})
it('resposta antiga não substitui o novo filtro', async () => {
  let finish!: (result: { reservations: typeof booking[]; hasMore: boolean }) => void
  mocks.get.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve })).mockResolvedValueOnce({ reservations: [], hasMore: false })
  setup(); await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'cancelled' } })
  await screen.findByText('Não existem reservas para este período e estado.')
  await act(async () => finish({ reservations: [booking], hasMore: false }))
  expect(screen.queryByText('Cliente Ana')).toBeNull()
})
