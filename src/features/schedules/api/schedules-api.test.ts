import { beforeEach, expect, it, vi } from 'vitest'
import { deleteBlockedPeriod, getSchedule, saveBlockedPeriod, saveWorkingHours } from './schedules-api'

const { client, query } = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), abortSignal: vi.fn(), update: vi.fn(), insert: vi.fn(), delete: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(), then: vi.fn() }
  return { client: { from: vi.fn(), rpc: vi.fn() }, query }
})
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: () => client }))
const scope = { businessId: 'tenant', employeeId: 'employee' }
beforeEach(() => {
  vi.resetAllMocks()
  client.from.mockReturnValue(query)
  for (const method of ['select', 'eq', 'order', 'abortSignal', 'update', 'insert', 'delete'] as const) query[method].mockReturnValue(query)
  query.single.mockResolvedValue({ data: { id: 'block' }, error: null })
  query.maybeSingle.mockResolvedValue({ data: { id: 'employee' }, error: null })
  query.then.mockImplementation((resolve) => resolve({ data: [], error: null }))
  client.rpc.mockResolvedValue({ error: null })
})
it('filtra todas as leituras pela empresa e colaborador e transmite cancelamento', async () => {
  const signal = new AbortController().signal
  expect(await getSchedule(scope, signal)).toEqual({ employee: { id: 'employee' }, hours: [], blocks: [] })
  expect(query.eq.mock.calls).toEqual([
    ['business_id', 'tenant'], ['id', 'employee'],
    ['business_id', 'tenant'], ['employee_id', 'employee'],
    ['business_id', 'tenant'], ['employee_id', 'employee'],
  ])
  expect(query.abortSignal.mock.calls).toEqual([[signal], [signal], [signal]])
})
it('guarda a semana numa única RPC, convertendo HH:mm em minutos', async () => {
  await saveWorkingHours(scope, { periods: [{ weekday: 7, start: '22:00', end: '24:00' }] })
  expect(client.rpc).toHaveBeenCalledWith('save_employee_working_hours', {
    target_business_id: 'tenant', target_employee_id: 'employee',
    periods: [{ weekday: 7, start_minute: 1320, end_minute: 1440 }],
  })
  expect(client.from).not.toHaveBeenCalled()
})
it('cria bloqueio com tenant e colaborador explícitos', async () => {
  const values = { label: 'Férias', starts_at: '2026-07-01T00:00:00Z', ends_at: '2026-07-02T00:00:00Z' }
  await saveBlockedPeriod(scope, values)
  expect(query.insert).toHaveBeenCalledWith({ ...values, business_id: 'tenant', employee_id: 'employee' })
})
it('edição e remoção limitam-se ao bloqueio, empresa e colaborador pedidos', async () => {
  const values = { label: 'Férias', starts_at: '2026-07-01T00:00:00Z', ends_at: '2026-07-02T00:00:00Z' }
  await saveBlockedPeriod(scope, { ...values, id: 'block' })
  expect(query.update).toHaveBeenCalledWith(values)
  expect(query.eq.mock.calls).toEqual([['business_id', 'tenant'], ['employee_id', 'employee'], ['id', 'block']])
  query.eq.mockClear()
  await deleteBlockedPeriod(scope, 'block')
  expect(query.eq.mock.calls).toEqual([['business_id', 'tenant'], ['employee_id', 'employee'], ['id', 'block']])
})
it('não reporta sucesso quando RPC ou remoção falham', async () => {
  const error = { code: '42501' }
  client.rpc.mockResolvedValue({ error })
  query.single.mockResolvedValue({ error, data: null })
  await expect(saveWorkingHours(scope, { periods: [] })).rejects.toEqual(error)
  await expect(deleteBlockedPeriod(scope, 'block')).rejects.toEqual(error)
})
