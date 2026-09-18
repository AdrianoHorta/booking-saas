// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SchedulePage } from './schedule-page'

const mocks = vi.hoisted(() => ({ role: 'owner', getSchedule: vi.fn(), saveWorkingHours: vi.fn(), saveBlockedPeriod: vi.fn(), deleteBlockedPeriod: vi.fn() }))
vi.mock('../../businesses/hooks/use-businesses', () => ({
  useBusiness: () => ({ data: { role: mocks.role, timezone: 'Europe/Lisbon' }, isPending: false, isError: false }),
}))
vi.mock('../api/schedules-api', () => ({ getSchedule: mocks.getSchedule, saveWorkingHours: mocks.saveWorkingHours,
  saveBlockedPeriod: mocks.saveBlockedPeriod, deleteBlockedPeriod: mocks.deleteBlockedPeriod }))
const scope = { businessId: '71000000-0000-4000-8000-000000000001', employeeId: '73000000-0000-4000-8000-000000000001' }
const data = {
  employee: { id: scope.employeeId, name: 'Ana', is_active: true },
  hours: [{ id: 'hour', weekday: 1, start_minute: 540, end_minute: 720 }],
  blocks: [{ id: 'block', label: 'Férias', starts_at: '2026-07-01T08:00:00Z', ends_at: '2026-07-01T11:00:00Z' }],
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/dashboard/${scope.businessId}/employees/${scope.employeeId}/schedule`]}>
    <Routes><Route path="/dashboard/:businessId/employees/:employeeId/schedule" element={<SchedulePage />} /></Routes>
  </MemoryRouter></QueryClientProvider>)
  return client
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.role = 'owner'
  mocks.getSchedule.mockResolvedValue(data)
  mocks.saveWorkingHours.mockResolvedValue(undefined)
  mocks.saveBlockedPeriod.mockResolvedValue({})
  mocks.deleteBlockedPeriod.mockResolvedValue({})
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)

it('mostra semana e dias sem horário a employee sem ações de escrita', async () => {
  mocks.role = 'employee'
  setup()
  await screen.findByText('Horário de Ana.')
  expect(screen.getByText('09:00 — 12:00')).toBeTruthy()
  expect(screen.getAllByText('Sem horário')).toHaveLength(6)
  expect(screen.queryByText('Europe/Lisbon')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Editar semana' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Adicionar bloqueio' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Remover bloqueio' })).toBeNull()
})
it('guarda semana completa e invalida só o horário do colaborador', async () => {
  const client = setup()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  fireEvent.click(await screen.findByRole('button', { name: 'Editar semana' }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(dialog.getByLabelText('Fim 1'), { target: { value: '13:00' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar semana' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(mocks.saveWorkingHours).toHaveBeenCalledWith(scope, { periods: [{ weekday: 1, start: '09:00', end: '13:00' }] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['schedule', scope.businessId, scope.employeeId] })
})
it('rejeita sobreposição antes da API e conserva os dados após falha remota', async () => {
  mocks.saveWorkingHours.mockRejectedValue(new Error('network'))
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar semana' }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.click(dialog.getByRole('button', { name: 'Adicionar período' }))
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar semana' }))
  await dialog.findByText('Este período sobrepõe-se a outro do mesmo dia.')
  expect(mocks.saveWorkingHours).not.toHaveBeenCalled()
  fireEvent.change(dialog.getByLabelText('Início 2'), { target: { value: '14:00' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar semana' }))
  await dialog.findByText('Não foi possível guardar a semana. Verifique os períodos e tente novamente.')
  expect((dialog.getByLabelText('Início 2') as HTMLInputElement).value).toBe('14:00')
})
it('permite limpar a semana', async () => {
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar semana' }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.click(dialog.getByRole('button', { name: 'Remover período 1' }))
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar semana' }))
  await waitFor(() => expect(mocks.saveWorkingHours).toHaveBeenCalledWith(scope, { periods: [] }))
})
it('cria bloqueio convertendo a hora da empresa para UTC', async () => {
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar bloqueio' }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(dialog.getByLabelText('Descrição'), { target: { value: ' Ausência ' } })
  fireEvent.change(dialog.getByLabelText('Início'), { target: { value: '2026-07-01T09:00' } })
  fireEvent.change(dialog.getByLabelText('Fim'), { target: { value: '2026-07-01T12:00' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar bloqueio' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(mocks.saveBlockedPeriod).toHaveBeenCalledWith(scope, { id: undefined, label: 'Ausência', starts_at: '2026-07-01T08:00:00Z', ends_at: '2026-07-01T11:00:00Z' })
})
it('preenche edição em hora local e mantém dados em erro', async () => {
  mocks.saveBlockedPeriod.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({})
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar bloqueio' }))
  const dialog = within(screen.getByRole('dialog'))
  expect((dialog.getByLabelText('Início') as HTMLInputElement).value).toBe('2026-07-01T09:00')
  fireEvent.change(dialog.getByLabelText('Descrição'), { target: { value: 'Atualizado' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar bloqueio' }))
  await dialog.findByRole('alert')
  expect((dialog.getByLabelText('Descrição') as HTMLInputElement).value).toBe('Atualizado')
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar bloqueio' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(mocks.saveBlockedPeriod.mock.calls[1][1].id).toBe('block')
})
it('rejeita hora ambígua antes de guardar o bloqueio', async () => {
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar bloqueio' }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(dialog.getByLabelText('Descrição'), { target: { value: 'Ausência' } })
  fireEvent.change(dialog.getByLabelText('Início'), { target: { value: '2026-10-25T01:30' } })
  fireEvent.change(dialog.getByLabelText('Fim'), { target: { value: '2026-10-25T03:00' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar bloqueio' }))
  expect((await dialog.findByRole('alert')).textContent).toContain('ambígua')
  expect(mocks.saveBlockedPeriod).not.toHaveBeenCalled()
})
it('confirma remoção, impede fechar durante pedido e permite repetir falha', async () => {
  let resolve!: () => void
  mocks.deleteBlockedPeriod.mockRejectedValueOnce(new Error('network')).mockImplementationOnce(() => new Promise<void>((r) => { resolve = r }))
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Remover bloqueio' }))
  const dialogElement = screen.getByRole('dialog')
  const dialog = within(dialogElement)
  expect(mocks.deleteBlockedPeriod).not.toHaveBeenCalled()
  fireEvent.click(dialog.getByRole('button', { name: 'Confirmar remoção' }))
  await dialog.findByRole('alert')
  fireEvent.click(dialog.getByRole('button', { name: 'Confirmar remoção' }))
  await waitFor(() => expect(mocks.deleteBlockedPeriod).toHaveBeenCalledTimes(2))
  expect((dialog.getByRole('button', { name: 'Fechar' }) as HTMLButtonElement).disabled).toBe(true)
  const cancel = new Event('cancel', { bubbles: true, cancelable: true })
  fireEvent(dialogElement, cancel)
  expect(cancel.defaultPrevented).toBe(true)
  await act(async () => resolve())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(mocks.deleteBlockedPeriod).toHaveBeenCalledWith(scope, 'block')
})
it('não mostra controlos de um colaborador indisponível', async () => {
  mocks.getSchedule.mockResolvedValue({ employee: null, hours: [], blocks: [] })
  setup()
  await screen.findByText('Este colaborador não está disponível para a sua conta.')
  expect(screen.queryByRole('button', { name: 'Editar semana' })).toBeNull()
})
