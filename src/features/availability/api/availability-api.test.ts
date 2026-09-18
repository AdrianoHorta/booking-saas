import { beforeEach, expect, it, vi } from 'vitest'
import { getAvailability } from './availability-api'

const { rpc, abortSignal } = vi.hoisted(() => ({ rpc: vi.fn(), abortSignal: vi.fn() }))
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: () => ({ rpc }) }))
const request = { businessId: '61000000-0000-4000-8000-000000000001', employeeId: '63000000-0000-4000-8000-000000000001', serviceId: '64000000-0000-4000-8000-000000000001', date: '2026-07-06' }
beforeEach(() => {
  vi.resetAllMocks()
  rpc.mockReturnValue({ abortSignal })
  abortSignal.mockResolvedValue({ error: null, data: {
    server_now: '2026-07-05T00:00:00Z', timezone: 'Europe/Lisbon', duration_minutes: 30, slot_interval_minutes: 15,
    business_active: true, employee_active: true, service_active: true, assigned: true,
    working_hours: [{ weekday: 1, start_minute: 540, end_minute: 600 }], blocked_periods: [], booking_periods: [],
  } })
})
it('envia tenant, colaborador, serviço e data sem aceitar duração ou hora vindas do cliente', async () => {
  const signal = new AbortController().signal
  const result = await getAvailability(request, signal)
  expect(rpc).toHaveBeenCalledWith('get_availability_context', {
    target_business_id: request.businessId, target_employee_id: request.employeeId, target_service_id: request.serviceId, target_date: request.date,
  })
  expect(abortSignal).toHaveBeenCalledWith(signal)
  expect(result.slots).toHaveLength(3)
})
it('não consulta para IDs ou datas inválidos', async () => {
  await expect(getAvailability({ ...request, date: '2026-02-30' }, new AbortController().signal)).rejects.toThrow()
  expect(rpc).not.toHaveBeenCalled()
})
it('propaga falhas de permissão e não apresenta erro como agenda livre', async () => {
  const error = { code: '42501' }
  abortSignal.mockResolvedValue({ data: null, error })
  await expect(getAvailability(request, new AbortController().signal)).rejects.toEqual(error)
})
it('traduz limites da consulta sem expor detalhes SQL', async () => {
  abortSignal.mockResolvedValue({ data: null, error: { code: '22023' } })
  await expect(getAvailability(request, new AbortController().signal)).rejects.toThrow('31 dias')
})
