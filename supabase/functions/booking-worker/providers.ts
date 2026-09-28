import { unseal } from '../google-calendar/crypto.ts'

export type Delivery = {
  id: string; channel: 'calendar' | 'email'; event: 'confirmed' | 'rescheduled' | 'cancelled';
  calendar_id: string | null; credentials: string | null; cancellation_token: string | null;
  payload: { booking_id: string; business_name: string; timezone: string; service_name: string;
    employee_name: string; starts_at: string; ends_at: string; status: string; price_cents: number;
    currency: string; cancellation_notice_hours: number; email?: string };
}
export class DeliveryError extends Error {
  constructor(public code: 'provider_unavailable' | 'provider_rejected' | 'configuration' | 'reconnect', public retry = false) { super(code) }
}
export class Superseded extends Error {}
export type Env = (name: string) => string | undefined
const required = (env: Env, key: string) => { const value = env(key); if (!value) throw new DeliveryError('configuration'); return value }
async function request(url: string, init: RequestInit) {
  try { return await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) }) }
  catch { throw new DeliveryError('provider_unavailable', true) }
}
function check(result: Response) {
  if (!result.ok) throw new DeliveryError(result.status === 401 || result.status === 403 ? 'reconnect'
    : result.status === 429 || result.status >= 500 || result.status === 412 || result.status === 409 ? 'provider_unavailable' : 'provider_rejected',
  result.status === 429 || result.status >= 500 || result.status === 412 || result.status === 409)
}

export async function syncCalendar(job: Delivery, env: Env, stillCurrent: () => Promise<boolean>) {
  let stored: { refreshToken: string; canWriteEvents?: boolean }
  try { stored = await unseal(job.credentials!, required(env, 'CALENDAR_ENCRYPTION_KEY')) }
  catch { throw new DeliveryError('configuration') }
  if (!stored.canWriteEvents) throw new DeliveryError('reconnect')
  const refreshed = await request('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: stored.refreshToken,
    client_id: required(env, 'GOOGLE_CALENDAR_CLIENT_ID'), client_secret: required(env, 'GOOGLE_CALENDAR_CLIENT_SECRET'),
  }) })
  if (refreshed.status === 400) throw new DeliveryError('reconnect')
  check(refreshed)
  const { access_token: token } = await refreshed.json()
  if (typeof token !== 'string') throw new DeliveryError('provider_unavailable', true)
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const id = `b${job.payload.booking_id.replaceAll('-', '')}`
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(job.calendar_id!)}/events`
  const url = `${base}/${id}`
  const existing = await request(url, { headers })
  const absent = existing.status === 404 || existing.status === 410
  let event: { etag?: string; status?: string; extendedProperties?: { private?: Record<string, string> } } | null = null
  if (!absent) { check(existing); event = await existing.json() }
  if (event && event.status !== 'cancelled') {
    const metadata = event.extendedProperties?.private
    if (metadata?.booking_id !== job.payload.booking_id || !/^\d+$/.test(metadata.revision ?? '')) throw new DeliveryError('provider_rejected')
    if (BigInt(metadata.revision) > BigInt(job.id)) return
    if (!event.etag) throw new DeliveryError('provider_rejected')
    headers['If-Match'] = event.etag
  }
  if (!await stillCurrent()) throw new Superseded()
  if (job.payload.status === 'cancelled') {
    if (absent || event?.status === 'cancelled') return
    const removed = await request(`${url}?sendUpdates=none`, { method: 'DELETE', headers })
    if (removed.status !== 404 && removed.status !== 410) check(removed)
    return
  }
  // A manually deleted event is not recreated under a different ID on retries.
  if (existing.status === 410 || event?.status === 'cancelled') throw new DeliveryError('provider_rejected')
  const body = { ...(absent ? { id } : {}), summary: job.payload.service_name,
    description: `Reserva ${job.payload.booking_id} · ${job.payload.business_name}`,
    start: { dateTime: job.payload.starts_at, timeZone: job.payload.timezone },
    end: { dateTime: job.payload.ends_at, timeZone: job.payload.timezone },
    extendedProperties: { private: { booking_id: job.payload.booking_id, revision: job.id } },
  }
  check(await request(`${absent ? base : url}?sendUpdates=none`, {
    method: absent ? 'POST' : 'PATCH', headers, body: JSON.stringify(body),
  }))
}

export function emailContent(job: Delivery, appOrigin: string) {
  const origin = new URL(appOrigin)
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new DeliveryError('configuration')
  const title = { confirmed: 'Reserva confirmada', rescheduled: 'Reserva reagendada', cancelled: 'Reserva cancelada' }[job.event]
  const p = job.payload
  const date = new Intl.DateTimeFormat('pt-PT', { timeZone: p.timezone, dateStyle: 'long', timeStyle: 'short' }).format(new Date(p.starts_at))
  const price = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: p.currency }).format(p.price_cents / 100)
  const link = `${origin.origin}/booking/manage/${p.booking_id}#token=${job.cancellation_token}`
  const text = `${title}\n\n${p.business_name}\nServiço: ${p.service_name}\nProfissional: ${p.employee_name}\nData: ${date} (${p.timezone})\nValor da marcação: ${price}\n\n${job.event === 'cancelled' ? 'Esta reserva foi cancelada.' : `Cancelamento permitido até ${p.cancellation_notice_hours} horas antes do início.`}\n\nConsultar a reserva: ${link}\nGuarde esta ligação privada e não a partilhe.\n\nReferência: ${p.booking_id}`
  return { subject: `${title} · ${p.business_name.replace(/[\r\n]/g, ' ')}`, text }
}

export async function sendBookingEmail(job: Delivery, env: Env, stillCurrent: () => Promise<boolean>) {
  const apiKey = required(env, 'RESEND_API_KEY')
  const from = required(env, 'BOOKING_EMAIL_FROM')
  const content = emailContent(job, required(env, 'BOOKING_APP_ORIGIN'))
  if (!job.payload.email || !job.cancellation_token) throw new DeliveryError('configuration')
  if (!await stillCurrent()) throw new Superseded()
  const result = await request('https://api.resend.com/emails', { method: 'POST', headers: {
    Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `booking-email-${job.payload.booking_id}-${job.id}`,
  }, body: JSON.stringify({ from, to: [job.payload.email], ...content }) })
  check(result)
  const receipt = await result.json()
  if (typeof receipt.id !== 'string') throw new DeliveryError('provider_unavailable', true)
}
