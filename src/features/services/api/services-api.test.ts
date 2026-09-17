import { beforeEach, expect, it, vi } from 'vitest'
import { createService, getServices, updateService } from './services-api'

const { client, query } = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), insert: vi.fn(), update: vi.fn(), single: vi.fn() }
  return { client: { from: vi.fn() }, query }
})
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: () => client }))
beforeEach(() => {
  vi.resetAllMocks()
  client.from.mockReturnValue(query)
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.single.mockResolvedValue({ data: { id: 'service' }, error: null })
  query.order.mockResolvedValue({ data: [], error: null })
})
it('lê o catálogo ordenado exclusivamente da empresa pedida', async () => {
  expect(await getServices('tenant')).toEqual([])
  expect(client.from).toHaveBeenCalledWith('services')
  expect(query.eq).toHaveBeenCalledWith('business_id', 'tenant')
  expect(query.order).toHaveBeenCalledWith('name')
})
it('mapeia criação e descrição vazia', async () => {
  await createService({ businessId: 'tenant', name: 'Corte', description: '', durationMinutes: 30, priceCents: 1234 })
  expect(query.insert).toHaveBeenCalledWith({ business_id: 'tenant', name: 'Corte', description: null, duration_minutes: 30, price_cents: 1234 })
})
it('atualiza apenas os campos fornecidos e filtra tenant e serviço', async () => {
  await updateService({ businessId: 'tenant', id: 'service', isActive: false })
  expect(query.update).toHaveBeenCalledWith({ is_active: false })
  expect(query.eq.mock.calls).toEqual([['id', 'service'], ['business_id', 'tenant']])
})
it('preserva valores zero e null ao editar', async () => {
  await updateService({ businessId: 'tenant', id: 'service', name: 'Novo', description: null, durationMinutes: 15, priceCents: 0 })
  expect(query.update).toHaveBeenCalledWith({ name: 'Novo', description: null, duration_minutes: 15, price_cents: 0 })
})
it('propaga erros da API em vez de reportar sucesso', async () => {
  const error = { code: '42501' }
  query.single.mockResolvedValue({ data: null, error })
  await expect(updateService({ businessId: 'tenant', id: 'service', isActive: true })).rejects.toEqual(error)
})
