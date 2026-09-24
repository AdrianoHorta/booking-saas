import { Temporal } from '@js-temporal/polyfill'
import { beforeEach, expect, it, vi } from 'vitest'
import { getReservationSummary, summaryPeriod } from './reservation-summary-api'

const { from, queries } = vi.hoisted(() => ({ from: vi.fn(), queries: [] as Record<string, ReturnType<typeof vi.fn>>[] }))
vi.mock('../../lib/supabase/client', () => ({ getSupabase: () => ({ from }) }))
const businessId = 'd1000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.resetAllMocks()
  queries.length = 0
  from.mockImplementation(() => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of ['select', 'eq', 'gte', 'lt', 'order', 'limit']) query[method] = vi.fn(() => query)
    query.abortSignal = vi.fn().mockResolvedValue({ count: queries.length === 0 ? 1250 : 2000, data: [], error: null })
    queries.push(query)
    return query
  })
})
it('usa dias locais de 23 e 25 horas e sete datas de calendário', () => {
  expect(summaryPeriod('Europe/Lisbon', Temporal.Instant.from('2026-03-29T12:00:00Z'))).toEqual({
    start: '2026-03-29T00:00:00Z', tomorrow: '2026-03-29T23:00:00Z', end: '2026-04-04T23:00:00Z', now: '2026-03-29T12:00:00Z',
  })
  expect(summaryPeriod('Europe/Lisbon', Temporal.Instant.from('2026-10-25T12:00:00Z')).tomorrow).toBe('2026-10-26T00:00:00Z')
  expect(summaryPeriod('Asia/Tokyo', Temporal.Instant.from('2026-09-21T23:00:00Z')).start).toBe('2026-09-21T15:00:00Z')
})
it('conta além do limite de linhas e limita a lista a cinco confirmações da empresa', async () => {
  const signal = new AbortController().signal
  const result = await getReservationSummary(businessId, 'Europe/Lisbon', signal)
  expect(result).toEqual({ today: 1250, week: 2000, upcoming: [] })
  for (const query of queries) {
    expect(query.eq.mock.calls).toEqual([['business_id', businessId], ['status', 'confirmed']])
    expect(query.abortSignal).toHaveBeenCalledWith(signal)
  }
  expect(queries[0].select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
  expect(queries[2].limit).toHaveBeenCalledWith(5)
  expect(queries[2].order.mock.calls).toEqual([['starts_at'], ['id']])
  expect(queries[2].lt.mock.calls).toEqual(queries[1].lt.mock.calls)
  expect(Date.parse(queries[2].gte.mock.calls[0][1])).toBeGreaterThanOrEqual(Date.parse(queries[0].gte.mock.calls[0][1]))
})
it.each([{ error: { code: '42501' }, count: null }, { error: null, count: null }])('não apresenta zero quando uma contagem falha: %j', async (response) => {
  const normal = from.getMockImplementation()!
  from.mockImplementationOnce(() => {
    const query = normal()
    query.abortSignal.mockResolvedValue(response)
    return query
  })
  await expect(getReservationSummary(businessId, 'UTC', new AbortController().signal)).rejects.toThrow('Não foi possível')
})
it('rejeita empresa inválida antes de consultar', async () => {
  await expect(getReservationSummary('invalid', 'UTC', new AbortController().signal)).rejects.toThrow()
  expect(from).not.toHaveBeenCalled()
})
