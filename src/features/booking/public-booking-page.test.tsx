// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PublicBookingPage } from './public-booking-page'
import { BookingError, loadPendingBooking, savePendingBooking } from './booking-api'
const mocks = vi.hoisted(() => ({ catalog: vi.fn(), availability: vi.fn(), confirm: vi.fn() }))
vi.mock('./booking-api', async (original) => ({ ...await original<typeof import('./booking-api')>(), getBookingCatalog: mocks.catalog, confirmBooking: mocks.confirm }))
vi.mock('../availability/api/public-availability-api', () => ({ getPublicAvailability: mocks.availability }))
const employeeId = '63000000-0000-4000-8000-000000000001'
const serviceId = '64000000-0000-4000-8000-000000000001'
const receipt = { id: '66000000-0000-4000-8000-000000000001', status: 'confirmed', starts_at: '2099-01-05T09:00:00Z', ends_at: '2099-01-05T09:30:00Z',
  service_name: 'Corte', employee_name: 'Maria', duration_minutes: 30, price_cents: 1500, currency: 'EUR' }
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/book/salao-ana']}><Routes>
    <Route path="/book/:slug" element={<PublicBookingPage />} />
  </Routes></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear()
  mocks.catalog.mockResolvedValue({ business: { name: 'Salão Ana', slug: 'salao-ana', timezone: 'Europe/Lisbon' },
    services: [{ id: serviceId, name: 'Corte', duration_minutes: 30, price_cents: 1500, currency: 'EUR', employees: [{ id: employeeId, name: 'Maria' }] }] })
  mocks.availability.mockResolvedValue({ slots: [{ start: Date.parse(receipt.starts_at), end: Date.parse(receipt.ends_at) }] })
  mocks.confirm.mockResolvedValue(receipt)
})
afterEach(cleanup)
async function review() {
  await screen.findByLabelText('Serviço')
  fireEvent.change(screen.getByLabelText('Serviço'), { target: { value: serviceId } })
  fireEvent.change(screen.getByLabelText('Profissional'), { target: { value: employeeId } })
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2099-01-05' } })
  fireEvent.click(await screen.findByRole('radio'))
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Cliente' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'cliente@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Rever reserva' }))
  await screen.findByRole('button', { name: 'Confirmar reserva' })
}
it('percurso sem login: escolhe, revê e só anuncia sucesso após resposta', async () => {
  let finish!: (value: typeof receipt) => void
  mocks.confirm.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  setup(); await review()
  expect(mocks.confirm).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }))
  await screen.findByRole('button', { name: 'A confirmar…' })
  expect(screen.queryByText('Reserva confirmada.')).toBeNull()
  expect(loadPendingBooking('salao-ana')).not.toBeNull()
  await act(async () => finish(receipt))
  await screen.findByText('Reserva confirmada.')
  expect(loadPendingBooking('salao-ana')).toBeNull()
})
it('resultado incerto mantém pedido e contactos, sem permitir outra submissão diferente', async () => {
  mocks.confirm.mockRejectedValueOnce(new BookingError('uncertain', 'Resultado incerto')).mockResolvedValueOnce(receipt)
  setup(); await review(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Verificar reserva' }))
  await screen.findByText('Reserva confirmada.')
  expect(mocks.confirm.mock.calls[0]).toEqual(mocks.confirm.mock.calls[1])
})
it('pedido guardado pode recuperar mesmo com publicação entretanto fechada', async () => {
  savePendingBooking({ slug: 'salao-ana', employeeId, serviceId, startsAt: receipt.starts_at, requestKey: crypto.randomUUID(), contacts: { name: 'Cliente', email: 'cliente@example.test', phone: '' } })
  mocks.catalog.mockRejectedValue(new Error('Fechada'))
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Verificar reserva' }))
  await screen.findByText('Reserva confirmada.')
  expect(mocks.catalog).not.toHaveBeenCalled()
})
it('conflito limpa o pedido e permite escolher novamente', async () => {
  mocks.confirm.mockRejectedValue(new BookingError('conflict', 'Vaga ocupada'))
  setup(); await review(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }))
  await screen.findByText('Vaga ocupada')
  await screen.findByLabelText('Serviço')
  expect(loadPendingBooking('salao-ana')).toBeNull()
})
it('mudar a data limpa a vaga selecionada', async () => {
  setup(); await review(); fireEvent.click(screen.getByRole('button', { name: 'Editar dados' }))
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2099-01-06' } })
  await waitFor(() => expect((screen.getByRole('button', { name: 'Rever reserva' }) as HTMLButtonElement).disabled).toBe(true))
})
it('empresa indisponível não apresenta formulário', async () => {
  mocks.catalog.mockRejectedValue(new BookingError('unavailable', 'Empresa indisponível'))
  setup(); await screen.findByText('Empresa indisponível')
  expect(screen.queryByLabelText('Nome')).toBeNull()
})
it('ausência de vagas tem mensagem e impede revisão', async () => {
  mocks.availability.mockResolvedValue({ slots: [] })
  setup(); await screen.findByLabelText('Serviço')
  fireEvent.change(screen.getByLabelText('Serviço'), { target: { value: serviceId } })
  fireEvent.change(screen.getByLabelText('Profissional'), { target: { value: employeeId } })
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2099-01-05' } })
  await screen.findByText('Não existem vagas nesta data. Experimente outro dia.')
  expect((screen.getByRole('button', { name: 'Rever reserva' }) as HTMLButtonElement).disabled).toBe(true)
})
it('resposta antiga não substitui vagas da nova data', async () => {
  let finishOld!: (value: { slots: { start: number; end: number }[] }) => void
  mocks.availability.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve }))
    .mockResolvedValueOnce({ slots: [] })
  setup(); await screen.findByLabelText('Serviço')
  fireEvent.change(screen.getByLabelText('Serviço'), { target: { value: serviceId } })
  fireEvent.change(screen.getByLabelText('Profissional'), { target: { value: employeeId } })
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2099-01-05' } })
  await waitFor(() => expect(mocks.availability).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2099-01-06' } })
  await screen.findByText('Não existem vagas nesta data. Experimente outro dia.')
  await act(async () => finishOld({ slots: [{ start: Date.parse(receipt.starts_at), end: Date.parse(receipt.ends_at) }] }))
  expect(screen.queryByRole('radio')).toBeNull()
})
it('editar antes de enviar usa os contactos corrigidos numa única submissão', async () => {
  setup(); await review()
  fireEvent.click(screen.getByRole('button', { name: 'Editar dados' }))
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Nome corrigido' } })
  await waitFor(() => expect((screen.getByRole('button', { name: 'Rever reserva' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Rever reserva' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar reserva' }))
  await screen.findByText('Reserva confirmada.')
  expect(mocks.confirm).toHaveBeenCalledTimes(1)
  expect(mocks.confirm.mock.calls[0][0].contacts.name).toBe('Nome corrigido')
})
it('recibo cancelado não anuncia reserva confirmada', async () => {
  mocks.confirm.mockResolvedValue({ ...receipt, status: 'cancelled' })
  setup(); await review(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }))
  await screen.findByText('Reserva cancelada.')
  expect(screen.queryByText('Reserva confirmada.')).toBeNull()
})
