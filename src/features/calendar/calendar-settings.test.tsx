// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CalendarSettings } from './calendar-settings'
const mocks = vi.hoisted(() => ({ status: vi.fn(), action: vi.fn(), start: vi.fn() }))
vi.mock('../auth/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'user-a' } } }) }))
vi.mock('./calendar-api', async (original) => ({ ...await original<typeof import('./calendar-api')>(),
  getCalendarConnection: mocks.status, calendarAction: mocks.action, startCalendarConnection: mocks.start }))
vi.mock('../../lib/supabase/client', () => ({ getSupabase: vi.fn() }))
const clients: QueryClient[] = []
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client)
  render(<QueryClientProvider client={client}><CalendarSettings businessId="business-a" /></QueryClientProvider>)
}
beforeEach(() => { vi.resetAllMocks(); mocks.status.mockResolvedValue({ employee_name: 'Miguel', connected: false, calendar_name: null }) })
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()) })
it('explains association requirement without offering a connection for another professional', async () => {
  mocks.status.mockResolvedValue(null); setup()
  await screen.findByText(/associada a um colaborador ativo/)
  expect(screen.queryByRole('button', { name: 'Ligar Google Calendar' })).toBeNull()
})
it('starts OAuth for the authenticated professional', async () => {
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Ligar Google Calendar' }))
  await waitFor(() => expect(mocks.start).toHaveBeenCalledWith('business-a', 'user-a'))
})
it('shows configuration errors', async () => {
  mocks.start.mockRejectedValue(new Error('A integração Google ainda não está configurada.'))
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Ligar Google Calendar' }))
  await screen.findByText('A integração Google ainda não está configurada.')
})
it('requires explicit confirmation before disconnecting', async () => {
  mocks.status.mockResolvedValue({ employee_name: 'Miguel', connected: true, calendar_name: 'Trabalho' })
  mocks.action.mockResolvedValue({ calendars: [] })
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Desligar Google Calendar' }))
  expect(mocks.action).not.toHaveBeenCalledWith('business-a', 'disconnect', {})
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar desconexão' }))
  await waitFor(() => expect(mocks.action).toHaveBeenCalledWith('business-a', 'disconnect', {}))
})
