import { DeliveryError, Superseded, sendBookingEmail, syncCalendar, type Delivery, type Env } from './providers.ts'
import { hash } from '../google-calendar/crypto.ts'

export type Backend = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }
export function createWorkerHandler(env: Env, backend: () => Backend) {
  return async (request: Request) => {
    const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
    if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
    const secret = env('BOOKING_WORKER_SECRET')
    if (!secret || secret.length < 32) return reply({ error: 'Worker not configured' }, 503)
    // Compare fixed-length digests; neither the secret nor request data is logged.
    const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
    const [a, b] = await Promise.all([hash(secret), hash(supplied)])
    let mismatch = 0
    for (let index = 0; index < a.length; index++) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
    if (mismatch) return reply({ error: 'Unauthorized' }, 401)
    const channels = []
    // Google Calendar temporariamente desativado para o lançamento; preservar tarefas na fila.
    // if (env('GOOGLE_CALENDAR_CLIENT_ID') && env('GOOGLE_CALENDAR_CLIENT_SECRET') && env('CALENDAR_ENCRYPTION_KEY')) channels.push('calendar')
    if (env('RESEND_API_KEY') && env('BOOKING_EMAIL_FROM') && env('BOOKING_APP_ORIGIN')) channels.push('email')
    if (!channels.length) return reply({ error: 'No provider configured' }, 503)
    try {
      const client = backend()
      const rpc = async (name: string, args: Record<string, unknown>) => {
        const result = await client.rpc(name, args)
        if (result.error) throw new Error('database')
        return result.data
      }
      const started = Date.now()
      let processed = 0
      while (processed < 5 && Date.now() - started < 40_000) {
        const claim = await rpc('claim_booking_delivery', { channels }) as { id: string; lease: string; channel: string } | null
        if (!claim) break
        const args = { delivery_id: claim.id, lease_id: claim.lease }
        let outcome = 'done'
        let failure: string | null = null
        try {
          const job = await rpc('prepare_booking_delivery', args) as Delivery | null
          if (!job) outcome = 'skipped'
          else {
            const current = async () => Boolean(await rpc('prepare_booking_delivery', args))
            if (job.channel === 'calendar') await syncCalendar(job, env, current)
            else await sendBookingEmail(job, env, current)
          }
        } catch (error) {
          if (error instanceof Superseded) outcome = 'skipped'
          else {
            outcome = error instanceof DeliveryError && !error.retry ? 'failed' : 'retry'
            failure = error instanceof DeliveryError ? error.code : 'provider_unavailable'
          }
        }
        if (!await rpc('finish_booking_delivery', { ...args, outcome, failure_code: failure })) throw new Error('lease_lost')
        processed++
      }
      return reply({ processed })
    } catch { return reply({ error: 'Processing interrupted; pending jobs remain queued' }, 503) }
  }
}
