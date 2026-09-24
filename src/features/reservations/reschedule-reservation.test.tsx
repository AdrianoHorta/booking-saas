// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RescheduleReservation } from './reschedule-reservation'
import { RescheduleError } from './reschedule-api'
const { slots, save } = vi.hoisted(() => ({ slots: vi.fn(), save: vi.fn() }))
vi.mock('./reschedule-api', async (original) => ({ ...await original<typeof import('./reschedule-api')>(), getRescheduleSlots: slots, rescheduleReservation: save }))
const initial = '2099-01-05T09:00:00Z'
const target = '2099-01-05T10:00:00Z'
beforeEach(() => {
  vi.resetAllMocks()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open','') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  slots.mockResolvedValue({ expected_start: initial, slots: [{ starts_at: target, ends_at: '2099-01-05T10:30:00Z' }] })
  save.mockResolvedValue({})
})
afterEach(cleanup)
async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><RescheduleReservation businessId="business" bookingId="booking" startsAt={initial} timezone="UTC" /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Reagendar reserva' }))
  await screen.findByLabelText('Novo horário')
  fireEvent.change(screen.getByLabelText('Novo horário'), { target: { value: target } })
  return client
}
it('só envia depois de escolher e confirmar novo horário', async () => {
  const client = await setup(); const invalidate = vi.spyOn(client,'invalidateQueries')
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar novo horário' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(save).toHaveBeenCalledWith({ businessId: 'business', bookingId: 'booking', expectedStart: initial, requestedStart: target }, expect.anything())
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['reservation-summary'] })
})
it('resultado incerto bloqueia edição e repete o mesmo pedido', async () => {
  save.mockRejectedValueOnce(new RescheduleError('Incerto',true)).mockResolvedValueOnce({})
  await setup(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar novo horário' }))
  await screen.findByText('Incerto')
  expect(screen.queryByLabelText('Nova data')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Verificar alteração' }))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  expect(save.mock.calls[0][0]).toEqual(save.mock.calls[1][0])
})
it('conflito mantém editor e exige nova seleção', async () => {
  save.mockRejectedValue(new RescheduleError('Vaga ocupada'))
  await setup(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar novo horário' }))
  await screen.findByText('Vaga ocupada')
  await screen.findByLabelText('Novo horário')
  expect((screen.getByRole('button', { name: 'Confirmar novo horário' }) as HTMLButtonElement).disabled).toBe(true)
})
it('horário original alterado por outra pessoa impede sobrescrita', async () => {
  slots.mockResolvedValue({ expected_start: '2099-01-05T09:30:00Z', slots: [{ starts_at: target, ends_at: '2099-01-05T10:30:00Z' }] })
  await setup(); await screen.findByText(/A reserva foi alterada entretanto/)
  expect((screen.getByRole('button', { name: 'Confirmar novo horário' }) as HTMLButtonElement).disabled).toBe(true)
  expect(save).not.toHaveBeenCalled()
})
