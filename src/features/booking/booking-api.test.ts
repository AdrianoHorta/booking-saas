// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { BookingError, clearPendingBooking, confirmBooking, loadPendingBooking, savePendingBooking, type BookingRequest } from './booking-api'
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../lib/supabase/client', () => ({ getSupabase: () => ({ rpc }) }))
const request: BookingRequest = { slug: 'salao-ana', employeeId: '63000000-0000-4000-8000-000000000001', serviceId: '64000000-0000-4000-8000-000000000001',
  startsAt: '2099-01-05T09:00:00Z', requestKey: '65000000-0000-4000-8000-000000000001', contacts: { name: ' Ana ', email: ' ANA@example.test ', phone: '' } }
const receipt = { id: '66000000-0000-4000-8000-000000000001', status: 'confirmed', starts_at: request.startsAt, ends_at: '2099-01-05T09:30:00Z',
  cancellation_token: 'a'.repeat(64), cancellation_notice_hours: 12, cancellation_deadline: '2099-01-04T21:00:00Z',
  service_name: 'Corte', employee_name: 'Maria', duration_minutes: 30, price_cents: 1500, currency: 'EUR' }
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear() })
it('envia contactos normalizados e chave, sem aceitar preço ou duração do browser', async () => {
  rpc.mockResolvedValue({ data: receipt, error: null })
  expect(await confirmBooking(request)).toEqual(receipt)
  expect(rpc).toHaveBeenCalledWith('confirm_booking', { business_slug: request.slug, target_employee_id: request.employeeId, target_service_id: request.serviceId,
    requested_start: request.startsAt, request_key: request.requestKey, customer_name: 'Ana', customer_email: 'ana@example.test', customer_phone: undefined })
})
it.each([['23P01','conflict'], ['42501','unavailable'], ['22023','invalid'], ['40001','uncertain']])('classifica %s como %s', async (code, kind) => {
  rpc.mockResolvedValue({ error: { code }, data: null })
  await expect(confirmBooking(request)).rejects.toMatchObject({ kind })
})
it('resposta de sucesso incompleta deixa resultado incerto', async () => {
  rpc.mockResolvedValue({ error: null, data: {} })
  await expect(confirmBooking(request)).rejects.toMatchObject({ kind: 'uncertain' })
})
it('falha de rede permite repetir exatamente a mesma chave', async () => {
  rpc.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: receipt, error: null })
  await expect(confirmBooking(request)).rejects.toBeInstanceOf(BookingError)
  await confirmBooking(request)
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1])
})
it('recupera pedido apenas da empresa correta e remove-o ao concluir', () => {
  savePendingBooking(request)
  expect(loadPendingBooking(request.slug)?.requestKey).toBe(request.requestKey)
  expect(loadPendingBooking('outra-empresa')).toBeNull()
  clearPendingBooking(request.slug)
  expect(loadPendingBooking(request.slug)).toBeNull()
})
