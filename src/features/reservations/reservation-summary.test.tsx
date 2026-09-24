// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import type { BusinessSummary } from '../businesses/business.types'
import { ReservationSummary } from './reservation-summary'

const mocks = vi.hoisted(() => ({ summary: vi.fn(), profile: vi.fn() }))
vi.mock('../auth/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'user-1' } } }) }))
vi.mock('./reservations-api', () => ({ getOwnProfessional: mocks.profile }))
vi.mock('./reservation-summary-api', () => ({ getReservationSummary: mocks.summary }))
const business: BusinessSummary = { id: 'd1000000-0000-4000-8000-000000000001', name: 'Empresa', slug: 'empresa', timezone: 'Europe/Lisbon', role: 'owner', is_active: true, public_booking_enabled: true }
const clients: QueryClient[] = []
function setup(role: BusinessSummary['role'] = 'owner') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  render(<QueryClientProvider client={client}><MemoryRouter><ReservationSummary business={{ ...business, role }} /></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.profile.mockResolvedValue({ id: 'professional-1', name: 'Miguel' })
  mocks.summary.mockResolvedValue({ today: 2, week: 8, upcoming: [{ id: 'booking-1', starts_at: '2026-07-06T09:00:00Z', service_name: 'Corte', employee_name: 'Miguel' }] })
})
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()) })
it.each(['owner', 'admin'] as const)('%s vê contagens e próximas marcações no fuso da empresa', async (role) => {
  setup(role)
  await screen.findByText('Corte')
  expect(screen.getByText('2')).toBeTruthy()
  expect(screen.getByText('8')).toBeTruthy()
  expect(screen.getByText(/10:00/)).toBeTruthy()
  expect(screen.getByText('Miguel')).toBeTruthy()
  expect(mocks.profile).not.toHaveBeenCalled()
})
it('colaborador sem associação não consulta o resumo', async () => {
  mocks.profile.mockResolvedValue(null)
  setup('employee')
  await screen.findByText(/ainda não está associada/)
  expect(mocks.summary).not.toHaveBeenCalled()
})
it('colaborador associado vê a sua agenda', async () => {
  setup('employee')
  await screen.findByText('Corte')
  expect(screen.getByText('A sua agenda.')).toBeTruthy()
  expect(screen.queryByText('Miguel')).toBeNull()
  expect(mocks.profile).toHaveBeenCalledWith(business.id, 'user-1', expect.any(AbortSignal))
})
it('erro permite repetir e distingue ausência de próximas reservas', async () => {
  mocks.summary.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ today: 0, week: 0, upcoming: [] })
  setup()
  await screen.findByRole('alert')
  expect(screen.queryByText('0')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar resumo' }))
  await screen.findByText('Não há próximas marcações confirmadas neste período.')
  expect(screen.getAllByText('0')).toHaveLength(2)
})
