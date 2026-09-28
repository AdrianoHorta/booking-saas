import { beforeEach, expect, it, vi } from 'vitest'
import { createWorkerHandler } from './handler'

const mocks = vi.hoisted(() => ({ email: vi.fn(), calendar: vi.fn() }))
vi.mock('./providers.ts', async (original) => ({ ...await original<typeof import('./providers')>(), sendBookingEmail: mocks.email, syncCalendar: mocks.calendar }))
const rpc = vi.fn()
const secret = 'x'.repeat(40)
const env = (key: string) => ({ BOOKING_WORKER_SECRET: secret, RESEND_API_KEY: 'key', BOOKING_EMAIL_FROM: 'from', BOOKING_APP_ORIGIN: 'https://app.example.test' }[key])
const handler = createWorkerHandler(env, () => ({ rpc }))
const request = (token = secret) => new Request('https://example.test', { method: 'POST', headers: { authorization: `Bearer ${token}` } })
beforeEach(() => vi.resetAllMocks())
it('rejects browser JWTs before creating a backend client', async () => {
  expect((await handler(request('user-jwt'))).status).toBe(401)
  expect(rpc).not.toHaveBeenCalled()
})
it('claims only configured channels and skips invalidated jobs', async () => {
  rpc.mockResolvedValueOnce({ data: { id: '1', lease: 'lease', channel: 'email' } })
    .mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({ data: true }).mockResolvedValueOnce({ data: null })
  expect(await (await handler(request())).json()).toEqual({ processed: 1 })
  expect(rpc.mock.calls[0]).toEqual(['claim_booking_delivery', { channels: ['email'] }])
  expect(rpc.mock.calls[2][1]).toMatchObject({ outcome: 'skipped' })
  expect(mocks.email).not.toHaveBeenCalled()
})
it('keeps Calendar jobs queued even when Google credentials are configured', async () => {
  const configured = createWorkerHandler((key) => ({
    GOOGLE_CALENDAR_CLIENT_ID: 'client', GOOGLE_CALENDAR_CLIENT_SECRET: 'secret', CALENDAR_ENCRYPTION_KEY: 'key',
  }[key] ?? env(key)), () => ({ rpc }))
  rpc.mockResolvedValue({ data: null })
  expect(await (await configured(request())).json()).toEqual({ processed: 0 })
  expect(rpc).toHaveBeenCalledExactlyOnceWith('claim_booking_delivery', { channels: ['email'] })
  expect(mocks.calendar).not.toHaveBeenCalled()
})
it('does not acknowledge success after provider timeout', async () => {
  rpc.mockResolvedValueOnce({ data: { id: '1', lease: 'lease', channel: 'email' } })
    .mockResolvedValueOnce({ data: { id: '1', channel: 'email' } }).mockResolvedValueOnce({ data: true }).mockResolvedValueOnce({ data: null })
  mocks.email.mockRejectedValue(new Error('secret provider detail'))
  expect((await handler(request())).status).toBe(200)
  expect(rpc.mock.calls[2][1]).toMatchObject({ outcome: 'retry', failure_code: 'provider_unavailable' })
  expect(JSON.stringify(rpc.mock.calls)).not.toContain('secret provider detail')
})
it('database failures stop the worker without exposing request or secrets', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'private database details' } })
  const response = await handler(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('private database details')
})
