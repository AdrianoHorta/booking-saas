// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CancellationSettings } from './cancellation-settings'
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: () => ({ rpc }) }))
function setup() { render(<QueryClientProvider client={new QueryClient()}><CancellationSettings businessId="business" initialHours={12} /></QueryClientProvider>) }
beforeEach(() => { vi.resetAllMocks(); rpc.mockResolvedValue({ error: null }) })
afterEach(cleanup)
it('mostra 12 horas e guarda a escolha da empresa', async () => {
  setup(); expect((screen.getByLabelText('Antecedência mínima (horas)') as HTMLInputElement).value).toBe('12')
  fireEvent.change(screen.getByLabelText('Antecedência mínima (horas)'), { target: { value: '24' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar prazo' }))
  await screen.findByText('Prazo de cancelamento guardado.')
  expect(rpc).toHaveBeenCalledWith('set_cancellation_policy', { target_business_id: 'business', notice_hours: 24 })
})
it('valor inválido não permite guardar', () => {
  setup(); fireEvent.change(screen.getByLabelText('Antecedência mínima (horas)'), { target: { value: '-1' } })
  expect((screen.getByRole('button', { name: 'Guardar prazo' }) as HTMLButtonElement).disabled).toBe(true)
  expect(rpc).not.toHaveBeenCalled()
})
it('falha não confirma alteração', async () => {
  rpc.mockResolvedValue({ error: { code: '42501' } }); setup()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar prazo' }))
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  expect(screen.queryByText('Prazo de cancelamento guardado.')).toBeNull()
})
