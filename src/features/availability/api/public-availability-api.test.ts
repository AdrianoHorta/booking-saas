import { beforeEach, expect, it, vi } from 'vitest'
import { getPublicAvailability } from './public-availability-api'

const { rpc, abortSignal } = vi.hoisted(() => ({ rpc: vi.fn(), abortSignal: vi.fn() }))
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: () => ({ rpc }) }))
const request = { businessSlug: 'salao-ana', employeeId: '63000000-0000-4000-8000-000000000001', serviceId: '64000000-0000-4000-8000-000000000001', date: '2099-01-05' }
const response = { server_now: '2099-01-04T00:00:00+00:00', timezone: 'Europe/Lisbon', duration_minutes: 30,
  slots: [{ starts_at: '2099-01-05T09:00:00+00:00', ends_at: '2099-01-05T09:30:00+00:00' }] }
const signal = new AbortController().signal
beforeEach(() => {
  vi.resetAllMocks()
  rpc.mockReturnValue({ abortSignal })
  abortSignal.mockResolvedValue({ data: response, error: null })
})
it('consulta por slug e converte os instantes sem recalcular as vagas no browser', async () => {
  expect((await getPublicAvailability(request, signal)).slots).toEqual([{ start: Date.parse(response.slots[0].starts_at), end: Date.parse(response.slots[0].ends_at) }])
  expect(rpc).toHaveBeenCalledWith('get_public_booking_availability', { target_business_slug: request.businessSlug, target_employee_id: request.employeeId, target_service_id: request.serviceId, target_date: request.date })
  expect(abortSignal).toHaveBeenCalledWith(signal)
})
it('rejeita datas inválidas antes da chamada', async () => {
  await expect(getPublicAvailability({ ...request, date: '2099-02-30' }, signal)).rejects.toThrow()
  expect(rpc).not.toHaveBeenCalled()
})
it.each([null, { ...response, slots: undefined }, { ...response, slots: [{ ...response.slots[0], ends_at: response.slots[0].starts_at }] }])('não transforma respostas inválidas em disponibilidade: %j', async (data) => {
  abortSignal.mockResolvedValue({ data, error: null })
  await expect(getPublicAvailability(request, signal)).rejects.toThrow()
})
it('aceita ausência legítima de vagas', async () => {
  abortSignal.mockResolvedValue({ data: { ...response, slots: [] }, error: null })
  expect((await getPublicAvailability(request, signal)).slots).toEqual([])
})
it.each(['42501', '22023'])('traduz o erro %s', async (code) => {
  abortSignal.mockResolvedValue({ data: null, error: { code } })
  await expect(getPublicAvailability(request, signal)).rejects.toThrow()
})
it('preserva falhas de rede', async () => {
  const error = { message: 'Network unavailable' }
  abortSignal.mockResolvedValue({ data: null, error })
  await expect(getPublicAvailability(request, signal)).rejects.toEqual(error)
})
