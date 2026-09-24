// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CustomerBookingPage } from './customer-booking-page'
const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('./customer-booking-api', () => ({ customerBooking: api }))
const data = { id: 'booking', status: 'confirmed', business_name: 'Salão', timezone: 'Europe/Lisbon', service_name: 'Corte', employee_name: 'Miguel',
  starts_at: '2099-07-01T09:00:00Z', ends_at: '2099-07-01T09:30:00Z', cancellation_notice_hours: 12, cancellation_deadline: '2099-06-30T21:00:00Z', can_cancel: true }
function setup() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter initialEntries={[`/booking/manage/booking#token=${'a'.repeat(64)}`]}><Routes><Route path="/booking/manage/:bookingId" element={<CustomerBookingPage />} /></Routes></MemoryRouter>
  </QueryClientProvider>)
}
beforeEach(() => { vi.resetAllMocks(); api.mockResolvedValue(data) })
afterEach(cleanup)
it('abrir ligação não cancela, exige confirmação e usa token do fragmento', async () => {
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Cancelar reserva' }))
  expect(api.mock.calls.every((call) => call[2] !== true)).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Manter reserva' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }))
  api.mockResolvedValue({ ...data, status: 'cancelled', can_cancel: false })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))
  await screen.findByText('Reserva cancelada.')
  expect(api).toHaveBeenCalledWith('booking', 'a'.repeat(64), true)
})
it('prazo terminado não apresenta ação', async () => {
  api.mockResolvedValue({ ...data, can_cancel: false }); setup()
  await screen.findByText('O prazo de cancelamento terminou. Contacte a empresa.')
  expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).toBeNull()
})
it('token inválido não mostra dados da reserva', async () => {
  api.mockRejectedValue(new Error('Ligação inválida')); setup()
  await screen.findByText('Ligação inválida')
  expect(screen.queryByText('Corte · Miguel')).toBeNull()
})
it('erro do servidor preserva estado e permite atualizar', async () => {
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Cancelar reserva' }))
  api.mockRejectedValueOnce(new Error('Prazo terminou'))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))
  await screen.findByText('Prazo terminou')
  expect(screen.queryByText('Reserva cancelada.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar estado' }))
  await waitFor(() => expect(api.mock.calls.length).toBeGreaterThan(2))
})
