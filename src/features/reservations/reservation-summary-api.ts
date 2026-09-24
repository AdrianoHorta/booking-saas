import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'
import { getSupabase } from '../../lib/supabase/client'

export function summaryPeriod(timezone: string, now = Temporal.Now.instant()) {
  const today = now.toZonedDateTimeISO(timezone).toPlainDate()
  const midnight = (days: number) => today.add({ days }).toZonedDateTime(timezone).toInstant().toString()
  return { start: midnight(0), tomorrow: midnight(1), end: midnight(7), now: now.toString() }
}

export async function getReservationSummary(businessId: string, timezone: string, signal: AbortSignal) {
  z.uuid().parse(businessId)
  const period = summaryPeriod(timezone)
  // Exact counts are independent of the API's row limit. RLS applies to every query.
  const count = (end: string) => getSupabase().from('bookings')
    .select('id', { count: 'exact', head: true }).eq('business_id', businessId)
    .eq('status', 'confirmed').gte('starts_at', period.start).lt('starts_at', end).abortSignal(signal)
  const [today, week, upcoming] = await Promise.all([
    count(period.tomorrow), count(period.end),
    getSupabase().from('bookings').select('id,starts_at,service_name,employee_name')
      .eq('business_id', businessId).eq('status', 'confirmed')
      .gte('starts_at', period.now).lt('starts_at', period.end)
      .order('starts_at').order('id').limit(5).abortSignal(signal),
  ])
  if (today.error || week.error || upcoming.error || today.count === null || week.count === null || !upcoming.data) {
    throw new Error('Não foi possível carregar o resumo das reservas.')
  }
  return { today: today.count, week: week.count, upcoming: upcoming.data }
}
