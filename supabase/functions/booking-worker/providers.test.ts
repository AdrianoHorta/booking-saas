import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { seal } from '../google-calendar/crypto'
import { emailContent, sendBookingEmail, syncCalendar, Superseded, type Delivery } from './providers'

const remote = vi.fn()
const key = btoa('a'.repeat(32))
const env = (name: string) => ({ CALENDAR_ENCRYPTION_KEY: key, GOOGLE_CALENDAR_CLIENT_ID: 'client', GOOGLE_CALENDAR_CLIENT_SECRET: 'secret',
  RESEND_API_KEY: 'email-secret', BOOKING_EMAIL_FROM: 'Booking <booking@example.test>', BOOKING_APP_ORIGIN: 'https://booking.example.test' }[name])
const job: Delivery = { id: '42', channel: 'calendar', event: 'confirmed', calendar_id: 'team@example.test', credentials: null, cancellation_token: 'a'.repeat(64),
  payload: { booking_id: 'e6000000-0000-4000-8000-000000000001', business_name: 'Empresa', timezone: 'Europe/Lisbon',
    service_name: 'Corte', employee_name: 'Miguel', starts_at: '2099-07-02T12:00:00Z', ends_at: '2099-07-02T12:30:00Z',
    status: 'confirmed', price_cents: 1500, currency: 'EUR', cancellation_notice_hours: 12, email: 'client@example.test' } }
const event = { etag: 'etag-1', extendedProperties: { private: { booking_id: job.payload.booking_id, revision: '41' } } }
beforeEach(async () => { vi.resetAllMocks(); vi.stubGlobal('fetch', remote); job.credentials = await seal({ refreshToken: 'refresh-secret', canWriteEvents: true }, key) })
afterEach(() => vi.unstubAllGlobals())
function oauth() { remote.mockResolvedValueOnce(Response.json({ access_token: 'access-secret' })) }
it('creates a deterministic event without contacts, attendees or provider emails', async () => {
  oauth(); remote.mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(Response.json({ id: 'event' }))
  await syncCalendar(job, env, async () => true)
  const [url, options] = remote.mock.calls[2]
  expect(url).toContain('team%40example.test/events?sendUpdates=none')
  expect(options.method).toBe('POST')
  expect(JSON.parse(options.body)).toMatchObject({ id: 'be6000000000040008000000000000001', summary: 'Corte',
    start: { dateTime: job.payload.starts_at, timeZone: 'Europe/Lisbon' } })
  expect(options.body).not.toContain('client@example.test')
  expect(options.body).not.toContain('attendees')
})
it('retry after an uncertain insert updates the same event with an ETag', async () => {
  oauth(); remote.mockResolvedValueOnce(Response.json(event)).mockResolvedValueOnce(Response.json({ id: 'same-event' }))
  await syncCalendar(job, env, async () => true)
  expect(remote.mock.calls[2][0]).toContain('/be6000000000040008000000000000001?')
  expect(remote.mock.calls[2][1]).toMatchObject({ method: 'PATCH', headers: { 'If-Match': 'etag-1' } })
})
it('cannot overwrite an event from a newer delivery', async () => {
  oauth(); remote.mockResolvedValueOnce(Response.json({ ...event, extendedProperties: { private: { booking_id: job.payload.booking_id, revision: '43' } } }))
  await syncCalendar(job, env, async () => true)
  expect(remote).toHaveBeenCalledTimes(2)
})
it('never edits an event without the expected booking identity', async () => {
  oauth(); remote.mockResolvedValueOnce(Response.json({ ...event, extendedProperties: { private: { booking_id: 'another-booking', revision: '1' } } }))
  await expect(syncCalendar(job, env, async () => true)).rejects.toMatchObject({ code: 'provider_rejected', retry: false })
  expect(remote).toHaveBeenCalledTimes(2)
})
it('revalidates connection and lease before mutating Google', async () => {
  oauth(); remote.mockResolvedValueOnce(new Response(null, { status: 404 }))
  await expect(syncCalendar(job, env, async () => false)).rejects.toBeInstanceOf(Superseded)
  expect(remote).toHaveBeenCalledTimes(2)
})
it('deletes cancelled events conditionally and accepts an already removed event', async () => {
  const cancelled = { ...job, payload: { ...job.payload, status: 'cancelled' } }
  oauth(); remote.mockResolvedValueOnce(Response.json(event)).mockResolvedValueOnce(new Response(null, { status: 410 }))
  await syncCalendar(cancelled, env, async () => true)
  expect(remote.mock.calls[2][1]).toMatchObject({ method: 'DELETE', headers: { 'If-Match': 'etag-1' } })
})
it('a cancellation for a missing event does not create one', async () => {
  oauth(); remote.mockResolvedValueOnce(new Response(null, { status: 404 }))
  await syncCalendar({ ...job, payload: { ...job.payload, status: 'cancelled' } }, env, async () => true)
  expect(remote).toHaveBeenCalledTimes(2)
})
it('legacy read-only consent requires reconnect without contacting Google', async () => {
  const legacy = { ...job, credentials: await seal({ refreshToken: 'old' }, key) }
  await expect(syncCalendar(legacy, env, async () => true)).rejects.toMatchObject({ code: 'reconnect', retry: false })
  expect(remote).not.toHaveBeenCalled()
})
it.each([409, 412, 429, 503])('retries provider concurrency and transient response %s', async (status) => {
  oauth(); remote.mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(null, { status }))
  await expect(syncCalendar(job, env, async () => true)).rejects.toMatchObject({ code: 'provider_unavailable', retry: true })
})
it('revoked Google consent fails without exposing the token or response', async () => {
  remote.mockResolvedValueOnce(Response.json({ error: 'private-provider-detail' }, { status: 400 }))
  await expect(syncCalendar(job, env, async () => true)).rejects.toThrow('reconnect')
})
it('email uses stable idempotency and private fragment link in plain text', async () => {
  remote.mockResolvedValue(Response.json({ id: 'email-id' }))
  await sendBookingEmail(job, env, async () => true)
  const [url, options] = remote.mock.calls[0]
  expect(url).toBe('https://api.resend.com/emails')
  expect(options.headers['Idempotency-Key']).toBe(`booking-email-${job.payload.booking_id}-42`)
  const body = JSON.parse(options.body)
  expect(body.to).toEqual(['client@example.test'])
  expect(body.text).toContain(`/booking/manage/${job.payload.booking_id}#token=${job.cancellation_token}`)
  expect(body.text).toContain('13:00')
  expect(body.html).toBeUndefined()
})
it('email timeout remains retryable; a lost response does not change its idempotency key', async () => {
  remote.mockRejectedValueOnce(new TypeError('network secret')).mockResolvedValueOnce(Response.json({ id: 'email-id' }))
  await expect(sendBookingEmail(job, env, async () => true)).rejects.toMatchObject({ retry: true })
  await sendBookingEmail(job, env, async () => true)
  expect(remote.mock.calls[0][1].body).toBe(remote.mock.calls[1][1].body)
  expect(remote.mock.calls[0][1].headers['Idempotency-Key']).toBe(remote.mock.calls[1][1].headers['Idempotency-Key'])
})
it('disabled email job does not send and invalid origins are rejected', async () => {
  await expect(sendBookingEmail(job, env, async () => false)).rejects.toBeInstanceOf(Superseded)
  expect(remote).not.toHaveBeenCalled()
  expect(() => emailContent(job, 'http://example.test')).toThrow('configuration')
  expect(() => emailContent(job, 'https://example.test/redirect')).toThrow('configuration')
})
