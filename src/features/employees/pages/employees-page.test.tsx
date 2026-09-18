// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EmployeesPage } from './employees-page'

const mocks = vi.hoisted(() => ({ role: 'owner', available: true,
  getEmployees: vi.fn(), getEmployeeMembers: vi.fn(), saveEmployee: vi.fn(), setEmployeeActive: vi.fn(), getServices: vi.fn(),
}))
vi.mock('../../businesses/hooks/use-businesses', () => ({
  useBusiness: () => ({ data: mocks.available ? { role: mocks.role } : null, isPending: false, isError: false }),
}))
vi.mock('../api/employees-api', () => ({ getEmployees: mocks.getEmployees, getEmployeeMembers: mocks.getEmployeeMembers,
  saveEmployee: mocks.saveEmployee, setEmployeeActive: mocks.setEmployeeActive }))
vi.mock('../../services/api/services-api', () => ({ getServices: mocks.getServices, createService: vi.fn(), updateService: vi.fn() }))

const businessId = '61000000-0000-4000-8000-000000000001'
const serviceId = '64000000-0000-4000-8000-000000000001'
const userId = '62000000-0000-4000-8000-000000000001'
const employees = [
  { id: 'a', name: 'Ana', user_id: userId, is_active: true, employee_services: [{ service_id: serviceId }] },
  { id: 'b', name: 'Bruno', user_id: null, is_active: false, employee_services: [] },
]
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/dashboard/${businessId}/employees`]}>
    <Routes><Route path="/dashboard/:businessId/employees" element={<EmployeesPage />} /></Routes>
  </MemoryRouter></QueryClientProvider>)
  return client
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.role = 'owner'
  mocks.available = true
  mocks.getEmployees.mockResolvedValue(employees)
  mocks.getServices.mockResolvedValue([{ id: serviceId, name: 'Corte', is_active: true }])
  mocks.getEmployeeMembers.mockResolvedValue([{ user_id: userId, role: 'owner' }])
  mocks.saveEmployee.mockResolvedValue('a')
  mocks.setEmployeeActive.mockResolvedValue({})
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)

it('admin cria no modal e guarda perfil e seleção juntos', async () => {
  mocks.role = 'admin'
  const client = setup()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar colaborador' }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(await dialog.findByLabelText('Nome'), { target: { value: ' Nova ' } })
  fireEvent.click(dialog.getByRole('checkbox', { name: 'Corte' }))
  fireEvent.click(dialog.getByRole('button', { name: 'Criar colaborador' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(mocks.saveEmployee).toHaveBeenCalledWith(businessId, { name: 'Nova', userId: '', serviceIds: [serviceId] }, undefined)
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['employees', businessId] })
})

it('preenche edição e permite limpar serviços e conta', async () => {
  setup()
  fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0])
  const dialog = within(screen.getByRole('dialog'))
  expect((await dialog.findByLabelText('Nome') as HTMLInputElement).value).toBe('Ana')
  expect((dialog.getByRole('checkbox', { name: 'Corte' }) as HTMLInputElement).checked).toBe(true)
  expect((dialog.getByLabelText('Conta associada (opcional)') as HTMLSelectElement).value).toBe(userId)
  fireEvent.click(dialog.getByRole('checkbox', { name: 'Corte' }))
  fireEvent.change(dialog.getByLabelText('Conta associada (opcional)'), { target: { value: '' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar alterações' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(mocks.saveEmployee).toHaveBeenCalledWith(businessId, { name: 'Ana', userId: '', serviceIds: [] }, 'a')
})

it('conserva formulário e seleção após erro e permite repetir', async () => {
  mocks.saveEmployee.mockRejectedValueOnce({ code: '23505' }).mockResolvedValueOnce('a')
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar colaborador' }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(await dialog.findByLabelText('Nome'), { target: { value: 'Nova' } })
  fireEvent.click(dialog.getByRole('checkbox', { name: 'Corte' }))
  fireEvent.click(dialog.getByRole('button', { name: 'Criar colaborador' }))
  expect((await dialog.findByRole('alert')).textContent).toContain('já está associada')
  expect((dialog.getByLabelText('Nome') as HTMLInputElement).value).toBe('Nova')
  expect((dialog.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  fireEvent.click(dialog.getByRole('button', { name: 'Criar colaborador' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('employee consulta sem controlos de escrita nem pedidos de membros', async () => {
  mocks.role = 'employee'
  setup()
  await screen.findByText('Ana')
  expect(screen.queryByRole('button', { name: 'Adicionar colaborador' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Desativar' })).toBeNull()
  expect(mocks.getEmployeeMembers).not.toHaveBeenCalled()
})

it('recusa empresa indisponível', async () => {
  mocks.available = false
  setup()
  await screen.findByText('Esta empresa não está disponível para a sua conta.')
  expect(screen.queryByRole('button', { name: 'Adicionar colaborador' })).toBeNull()
})

it('acompanha duas ativações concorrentes sem desbloquear a outra', async () => {
  let finishA!: () => void
  let finishB!: () => void
  mocks.setEmployeeActive.mockImplementation((_businessId, id) => new Promise<void>((resolve) => {
    if (id === 'a') finishA = resolve
    else finishB = resolve
  }))
  setup()
  const a = await screen.findByRole('button', { name: 'Desativar' }) as HTMLButtonElement
  const b = screen.getByRole('button', { name: 'Ativar' }) as HTMLButtonElement
  fireEvent.click(a)
  expect(a.disabled).toBe(true)
  expect(b.disabled).toBe(false)
  fireEvent.click(b)
  await waitFor(() => expect(mocks.setEmployeeActive).toHaveBeenCalledTimes(2))
  await act(async () => finishA())
  await waitFor(() => expect(a.disabled).toBe(false))
  expect(b.disabled).toBe(true)
  await act(async () => finishB())
  await waitFor(() => expect(b.disabled).toBe(false))
  expect(mocks.setEmployeeActive.mock.calls).toEqual([[businessId, 'a', false], [businessId, 'b', true]])
})

it('mostra falha de estado e volta a permitir a operação', async () => {
  mocks.setEmployeeActive.mockRejectedValue(new Error('network'))
  setup()
  const button = await screen.findByRole('button', { name: 'Desativar' }) as HTMLButtonElement
  fireEvent.click(button)
  expect((await screen.findByRole('alert')).textContent).toContain('Ana')
  expect(button.disabled).toBe(false)
})

it('não permite gravar antes de carregar as opções e permite repetir falha', async () => {
  mocks.getEmployeeMembers.mockRejectedValueOnce(new Error('network')).mockResolvedValue([])
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar colaborador' }))
  const dialog = within(screen.getByRole('dialog'))
  await dialog.findByRole('alert')
  expect(dialog.queryByRole('button', { name: 'Criar colaborador' })).toBeNull()
  fireEvent.click(dialog.getByRole('button', { name: 'Tentar novamente' }))
  await dialog.findByLabelText('Nome')
})

it('permite criar sem serviços disponíveis', async () => {
  mocks.getServices.mockResolvedValue([])
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar colaborador' }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(await dialog.findByLabelText('Nome'), { target: { value: 'Nova' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Criar colaborador' }))
  await waitFor(() => expect(mocks.saveEmployee).toHaveBeenCalledWith(businessId, { name: 'Nova', userId: '', serviceIds: [] }, undefined))
})
