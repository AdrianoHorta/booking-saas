import { beforeEach, expect, it, vi } from 'vitest'
import { rescheduleReservation } from './reschedule-api'
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../lib/supabase/client', () => ({ getSupabase: () => ({ rpc }) }))
const request = { businessId: 'd1000000-0000-4000-8000-000000000001', bookingId: 'd6000000-0000-4000-8000-000000000001', expectedStart: '2099-01-05T09:00:00Z', requestedStart: '2099-01-05T10:00:00Z' }
beforeEach(() => vi.resetAllMocks())
it('envia horário esperado para impedir sobrescrever alterações concorrentes', async () => {
  rpc.mockResolvedValue({ data: { id: request.bookingId, starts_at: request.requestedStart, ends_at: '2099-01-05T10:30:00Z' }, error: null })
  await rescheduleReservation(request)
  expect(rpc).toHaveBeenCalledWith('reschedule_booking', { target_business_id: request.businessId, target_booking_id: request.bookingId, expected_start: request.expectedStart, requested_start: request.requestedStart })
})
it.each(['23P01','40001','42501','22023'])('erro %s é definitivo e não anuncia sucesso', async (code) => {
  rpc.mockResolvedValue({ data: null, error: { code } })
  await expect(rescheduleReservation(request)).rejects.toMatchObject({ uncertain: false })
})
it('falha de ligação mantém resultado incerto', async () => {
  rpc.mockRejectedValue(new Error('network'))
  await expect(rescheduleReservation(request)).rejects.toMatchObject({ uncertain: true })
})
