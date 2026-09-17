// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServicesPage } from './services-page'

const mocks = vi.hoisted(() => ({
  role: 'owner', getServices: vi.fn(), createService: vi.fn(), updateService: vi.fn(),
}))
vi.mock('../../businesses/hooks/use-businesses', () => ({
  useBusiness: () => ({ data: { role: mocks.role }, isPending: false, isError: false }),
}))
vi.mock('../api/services-api', () => ({
  getServices: mocks.getServices, createService: mocks.createService, updateService: mocks.updateService,
}))
const businessId = '51000000-0000-4000-8000-000000000001'
const services = [
  { id: 'a', name: 'Corte', description: 'Descrição', duration_minutes: 30, price_cents: 1234, is_active: true },
  { id: 'b', name: 'Barba', description: null, duration_minutes: 15, price_cents: 500, is_active: false },
]
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/dashboard/${businessId}/services`]}>
    <Routes><Route path="/dashboard/:businessId/services" element={<ServicesPage />} /></Routes>
  </MemoryRouter></QueryClientProvider>)
  return client
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.role = 'owner'
  mocks.getServices.mockResolvedValue(services)
  mocks.createService.mockResolvedValue({})
  mocks.updateService.mockResolvedValue({})
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)
describe('ServicesPage', () => {
  it('mantém loading separado em duas alterações concorrentes e invalida o catálogo', async () => {
    let finishA!: () => void
    let finishB!: () => void
    mocks.updateService.mockImplementation(({ id }) => new Promise<void>((resolve) => {
      if (id === 'a') finishA = resolve
      else finishB = resolve
    }))
    const client = setup()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const a = await screen.findByRole('button', { name: 'Desativar' }) as HTMLButtonElement
    const b = screen.getByRole('button', { name: 'Ativar' }) as HTMLButtonElement
    fireEvent.click(a)
    expect(a.disabled).toBe(true)
    expect(b.disabled).toBe(false)
    fireEvent.click(b)
    expect(a.disabled && b.disabled).toBe(true)
    await waitFor(() => expect(mocks.updateService).toHaveBeenCalledTimes(2))
    await act(async () => finishA())
    await waitFor(() => expect(a.disabled).toBe(false))
    expect(b.disabled).toBe(true)
    await act(async () => finishB())
    await waitFor(() => expect(b.disabled).toBe(false))
    expect(mocks.updateService.mock.calls.map(([input]) => input)).toEqual([
      { id: 'a', businessId, isActive: false }, { id: 'b', businessId, isActive: true },
    ])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['services', businessId] })
  })
  it('employee lê sem controlos de escrita', async () => {
    mocks.role = 'employee'
    setup()
    await screen.findByText('Corte')
    expect(screen.queryByRole('button', { name: 'Adicionar serviço' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Desativar' })).toBeNull()
  })
  it('mostra falhas de ativação e permite repetir', async () => {
    mocks.updateService.mockRejectedValue(new Error('network'))
    setup()
    const button = await screen.findByRole('button', { name: 'Desativar' }) as HTMLButtonElement
    fireEvent.click(button)
    expect((await screen.findByRole('alert')).textContent).toContain('Corte')
    expect(button.disabled).toBe(false)
  })
  it('admin cria através do modal, converte euros e fecha após sucesso', async () => {
    mocks.role = 'admin'
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar serviço' }))
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.change(dialog.getByLabelText('Nome'), { target: { value: ' Novo ' } })
    fireEvent.change(dialog.getByLabelText('Preço'), { target: { value: '12.34' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Criar serviço' }))
    await waitFor(() => expect(mocks.createService).toHaveBeenCalled())
    expect(mocks.createService.mock.calls[0][0]).toEqual({ businessId, name: 'Novo', description: '', durationMinutes: 30, priceCents: 1234 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
  it('preenche edição, preserva dados após erro e permite guardar novamente', async () => {
    mocks.updateService.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({})
    setup()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0])
    const dialog = within(screen.getByRole('dialog'))
    expect((dialog.getByLabelText('Preço') as HTMLInputElement).value).toBe('12.34')
    fireEvent.change(dialog.getByLabelText('Nome'), { target: { value: 'Editado' } })
    fireEvent.change(dialog.getByLabelText('Descrição'), { target: { value: '' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar alterações' }))
    await screen.findByText('Não foi possível guardar o serviço.')
    expect((dialog.getByLabelText('Nome') as HTMLInputElement).value).toBe('Editado')
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar alterações' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.updateService.mock.calls[1][0]).toEqual({ businessId, id: 'a', name: 'Editado', description: null, durationMinutes: 30, priceCents: 1234 })
  })
})
