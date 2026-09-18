import { beforeEach, expect, it, vi } from 'vitest'
import { getReservations, reservationBounds, PAGE_SIZE, type ReservationFilters } from './reservations-api'
const { from, query } = vi.hoisted(() => ({ from: vi.fn(), query: { select: vi.fn(), eq: vi.fn(), lt: vi.fn(), gt: vi.fn(), order: vi.fn(), range: vi.fn(), abortSignal: vi.fn() } }))
vi.mock('../../lib/supabase/client', () => ({ getSupabase: () => ({ from }) }))
const input: ReservationFilters = { businessId: 'd1000000-0000-4000-8000-000000000001', timezone: 'Europe/Lisbon', from: '2026-03-29', to: '2026-03-29', status: 'all', page: 0 }
beforeEach(() => {
  vi.resetAllMocks(); from.mockReturnValue(query)
  for (const [key, fn] of Object.entries(query)) if (key !== 'abortSignal') fn.mockReturnValue(query)
  query.abortSignal.mockResolvedValue({ data: [], error: null })
})
it('dia da mudança de hora usa limites locais e não 24 horas fixas', () => {
  expect(reservationBounds(input)).toEqual({ start: '2026-03-29T00:00:00.000Z', end: '2026-03-29T23:00:00.000Z' })
  expect(reservationBounds({ ...input, from: '2026-10-25', to: '2026-10-25' })).toEqual({ start: '2026-10-24T23:00:00.000Z', end: '2026-10-26T00:00:00.000Z' })
})
it('filtra tenant e sobreposição e ordena para paginação estável', async () => {
  const signal = new AbortController().signal
  await getReservations(input, signal)
  expect(from).toHaveBeenCalledWith('bookings')
  expect(query.eq.mock.calls).toEqual([['business_id', input.businessId]])
  expect(query.lt).toHaveBeenCalledWith('starts_at', '2026-03-29T23:00:00.000Z')
  expect(query.gt).toHaveBeenCalledWith('ends_at', '2026-03-29T00:00:00.000Z')
  expect(query.order.mock.calls).toEqual([['starts_at'], ['id']])
  expect(query.abortSignal).toHaveBeenCalledWith(signal)
})
it('pede um registo extra para detetar a próxima página', async () => {
  query.abortSignal.mockResolvedValue({ data: Array.from({ length: PAGE_SIZE + 1 }, (_, id) => ({ id })), error: null })
  const result = await getReservations({ ...input, page: 1, status: 'confirmed' }, new AbortController().signal)
  expect(query.range).toHaveBeenCalledWith(25, 50)
  expect(query.eq).toHaveBeenCalledWith('status', 'confirmed')
  expect(result.hasMore).toBe(true)
  expect(result.reservations).toHaveLength(25)
})
it.each([{ from: '2026-02-30' }, { to: '2026-03-28' }, { to: '2026-05-01' }])('não consulta com período inválido %j', async (change) => {
  await expect(getReservations({ ...input, ...change }, new AbortController().signal)).rejects.toThrow()
  expect(from).not.toHaveBeenCalled()
})
it('erro de consulta não é convertido em lista vazia', async () => {
  query.abortSignal.mockResolvedValue({ data: null, error: { code: '42501' } })
  await expect(getReservations(input, new AbortController().signal)).rejects.toThrow('Não foi possível carregar')
})
