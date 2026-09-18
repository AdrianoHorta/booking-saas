// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AvailabilityPage } from './availability-page'

const mocks = vi.hoisted(() => ({ active: true, role: 'employee', getServices: vi.fn(), getEmployees: vi.fn(), getAvailability: vi.fn() }))
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: vi.fn() }))
vi.mock('../../businesses/hooks/use-businesses', () => ({ useBusiness: () => ({ data: { timezone: 'Europe/Lisbon', is_active: mocks.active, role: mocks.role }, isPending: false, isError: false }) }))
vi.mock('../../services/api/services-api', () => ({ getServices: mocks.getServices, createService: vi.fn(), updateService: vi.fn() }))
vi.mock('../../employees/api/employees-api', () => ({ getEmployees: mocks.getEmployees, getEmployeeMembers: vi.fn(), saveEmployee: vi.fn(), setEmployeeActive: vi.fn() }))
vi.mock('../api/availability-api', async (importOriginal) => ({ ...await importOriginal<typeof import('../api/availability-api')>(), getAvailability: mocks.getAvailability }))
const businessId = '61000000-0000-4000-8000-000000000001'
const serviceId = '64000000-0000-4000-8000-000000000001'
const employeeId = '63000000-0000-4000-8000-000000000001'
const result = { serverNow: '2030-07-01T00:00:00Z', timezone: 'Europe/Lisbon', durationMinutes: 30, reason: null,
  slots: [{ start: Date.parse('2030-07-01T08:00Z'), end: Date.parse('2030-07-01T08:30Z') }] }
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/dashboard/${businessId}/availability`]}>
    <Routes><Route path="/dashboard/:businessId/availability" element={<AvailabilityPage />} /></Routes>
  </MemoryRouter></QueryClientProvider>)
  return client
}
async function choose() {
  await screen.findByRole('option', { name: 'Corte · 30 min' })
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2030-07-01' } })
  fireEvent.change(screen.getByLabelText('Serviço'), { target: { value: serviceId } })
  fireEvent.change(screen.getByLabelText('Colaborador'), { target: { value: employeeId } })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.active = true
  mocks.getServices.mockResolvedValue([
    { id: serviceId, name: 'Corte', duration_minutes: 30, is_active: true },
    { id: '64000000-0000-4000-8000-000000000002', name: 'Inativo', duration_minutes: 30, is_active: false },
  ])
  mocks.getEmployees.mockResolvedValue([
    { id: employeeId, name: 'Ana', is_active: true, employee_services: [{ service_id: serviceId }] },
    { id: 'unassigned', name: 'Sem associação', is_active: true, employee_services: [] },
    { id: 'inactive', name: 'Inativo', is_active: false, employee_services: [{ service_id: serviceId }] },
  ])
  mocks.getAvailability.mockResolvedValue(result)
})
afterEach(cleanup)
it('employee pode consultar e só escolhe profissionais ativos associados', async () => {
  setup()
  await choose()
  expect(screen.queryByRole('option', { name: 'Sem associação' })).toBeNull()
  expect(screen.queryByRole('option', { name: 'Inativo' })).toBeNull()
  await screen.findByRole('list', { name: 'Vagas disponíveis' })
  expect(mocks.getAvailability.mock.calls[0][0]).toEqual({ businessId, employeeId, serviceId, date: '2030-07-01' })
  expect(screen.queryByRole('button', { name: /reservar/i })).toBeNull()
})
it('não consulta até completar a seleção', async () => {
  setup()
  await screen.findByLabelText('Serviço')
  expect(mocks.getAvailability).not.toHaveBeenCalled()
})
it('mostra ausência de vagas sem a confundir com erro', async () => {
  mocks.getAvailability.mockResolvedValue({ ...result, slots: [] })
  setup()
  await choose()
  await screen.findByText('Não existem vagas disponíveis nesta data para esta seleção.')
  expect(screen.queryByRole('alert')).toBeNull()
})
it('falha da consulta tem feedback e permite repetir', async () => {
  mocks.getAvailability.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(result)
  setup()
  await choose()
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByRole('list', { name: 'Vagas disponíveis' })
})
it('não mostra resposta antiga depois de mudar a data', async () => {
  let finishOld!: (value: typeof result) => void
  mocks.getAvailability.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve }))
    .mockResolvedValueOnce({ ...result, slots: [] })
  setup()
  await choose()
  await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2030-07-02' } })
  await screen.findByText('Não existem vagas disponíveis nesta data para esta seleção.')
  await act(async () => finishOld(result))
  expect(screen.queryByRole('list', { name: 'Vagas disponíveis' })).toBeNull()
})
it('desativação detetada na leitura remota impede mostrar vagas', async () => {
  mocks.getAvailability.mockResolvedValue({ ...result, reason: 'employee_inactive', slots: [] })
  setup()
  await choose()
  await screen.findByText('O colaborador está inativo.')
})
it('empresa inativa não apresenta seletor nem consulta de vagas', async () => {
  mocks.active = false
  setup()
  await screen.findByText('A empresa está inativa.')
  expect(screen.queryByLabelText('Serviço')).toBeNull()
  expect(mocks.getAvailability).not.toHaveBeenCalled()
})
it('limpa o colaborador e as vagas ao mudar de serviço', async () => {
  setup()
  await choose()
  await screen.findByRole('list', { name: 'Vagas disponíveis' })
  fireEvent.change(screen.getByLabelText('Serviço'), { target: { value: '' } })
  expect((screen.getByLabelText('Colaborador') as HTMLSelectElement).value).toBe('')
  expect(screen.queryByRole('list', { name: 'Vagas disponíveis' })).toBeNull()
})
