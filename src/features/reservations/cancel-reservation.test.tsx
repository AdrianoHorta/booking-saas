// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CancelReservation } from './cancel-reservation'
const { cancel } = vi.hoisted(() => ({ cancel: vi.fn() }))
vi.mock('./reservations-api', () => ({ cancelReservation: cancel }))
function setup(startsAt = '2099-01-01T10:00:00Z') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(<QueryClientProvider client={client}><CancelReservation businessId="business" bookingId="booking" serviceName="Corte" startsAt={startsAt} /></QueryClientProvider>)
  return invalidate
}
beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)
it('exige confirmação e permite manter a reserva', () => {
  setup(); fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }))
  expect(cancel).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Manter reserva' }))
  expect(screen.queryByRole('button', { name: 'Confirmar cancelamento' })).toBeNull()
})
it('aguarda resposta e atualiza lista, resumo e disponibilidade', async () => {
  let finish!: () => void
  cancel.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
  const invalidate = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))
  const button = await screen.findByRole('button', { name: 'A cancelar…' })
  expect((button as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('Reserva cancelada.')).toBeNull()
  await act(async () => finish())
  await screen.findByText('Reserva cancelada.')
  expect(cancel).toHaveBeenCalledWith('business', 'booking')
  for (const key of ['reservations','reservation-summary','availability','public-booking-slots']) expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] })
})
it('erro permite repetir sem anunciar sucesso', async () => {
  cancel.mockRejectedValueOnce(new Error('Falha de ligação')).mockResolvedValueOnce({})
  setup(); fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))
  await screen.findByText('Falha de ligação')
  expect(screen.queryByText('Reserva cancelada.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))
  await screen.findByText('Reserva cancelada.')
})
it('não oferece cancelamento para reserva iniciada', () => {
  setup('2000-01-01T10:00:00Z'); expect(screen.queryByRole('button')).toBeNull()
})
