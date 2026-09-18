import { beforeEach, expect, it, vi } from 'vitest'
import { getEmployees, getEmployeeMembers, saveEmployee, setEmployeeActive } from './employees-api'

const { client, query } = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), abortSignal: vi.fn(), update: vi.fn(), single: vi.fn() }
  return { client: { from: vi.fn(), rpc: vi.fn() }, query }
})
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: () => client }))
beforeEach(() => {
  vi.resetAllMocks()
  client.from.mockReturnValue(query)
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.abortSignal.mockResolvedValue({ data: [], error: null })
  query.single.mockResolvedValue({ data: { id: 'employee' }, error: null })
  client.rpc.mockResolvedValue({ data: 'employee', error: null })
})
it('lê colaboradores e associações da empresa e suporta cancelamento', async () => {
  const signal = new AbortController().signal
  expect(await getEmployees('tenant', signal)).toEqual([])
  expect(client.from).toHaveBeenCalledWith('employees')
  expect(query.select).toHaveBeenCalledWith('*,employee_services(service_id)')
  expect(query.eq).toHaveBeenCalledWith('business_id', 'tenant')
  expect(query.order).toHaveBeenCalledWith('name')
  expect(query.abortSignal).toHaveBeenCalledWith(signal)
})
it('limita as contas selecionáveis aos membros da empresa', async () => {
  const businessId = 'd1000000-0000-4000-8000-000000000001'
  client.rpc.mockReturnValue(query)
  await getEmployeeMembers(businessId, new AbortController().signal)
  expect(client.rpc).toHaveBeenCalledWith('list_business_members', { target_business_id: businessId })
  expect(client.from).not.toHaveBeenCalled()
})
it('guarda perfil e serviços numa única RPC com defaults SQL para campos vazios', async () => {
  await saveEmployee('tenant', { name: 'Ana', userId: '', serviceIds: [] })
  expect(client.rpc).toHaveBeenCalledWith('save_employee', {
    target_business_id: 'tenant', employee_name: 'Ana', target_employee_id: undefined,
    linked_user_id: undefined, service_ids: [],
  })
  expect(client.from).not.toHaveBeenCalled()
})
it('envia a identidade e a seleção completa ao editar', async () => {
  await saveEmployee('tenant', { name: 'Ana', userId: 'member', serviceIds: ['service'] }, 'employee')
  expect(client.rpc).toHaveBeenCalledWith('save_employee', {
    target_business_id: 'tenant', employee_name: 'Ana', target_employee_id: 'employee',
    linked_user_id: 'member', service_ids: ['service'],
  })
})
it('altera apenas o estado e filtra por empresa e colaborador', async () => {
  await setEmployeeActive('tenant', 'employee', false)
  expect(query.update).toHaveBeenCalledWith({ is_active: false })
  expect(query.eq.mock.calls).toEqual([['business_id', 'tenant'], ['id', 'employee']])
})
it('propaga falhas da transação', async () => {
  const error = { code: '23503' }
  client.rpc.mockResolvedValue({ data: null, error })
  await expect(saveEmployee('tenant', { name: 'Ana', userId: '', serviceIds: [] })).rejects.toEqual(error)
})
