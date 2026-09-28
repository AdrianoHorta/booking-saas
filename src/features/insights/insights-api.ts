import { z } from 'zod'
import { Temporal } from '@js-temporal/polyfill'
import { getSupabase } from '../../lib/supabase/client'

const count = z.number().int().nonnegative()
export const analyticsSchema = z.object({ confirmed: count, cancelled: count, booked_value_cents: count, booked_minutes: count,
  daily: z.array(z.object({ date: z.string(), confirmed: count, cancelled: count })),
  services: z.array(z.object({ name: z.string(), confirmed: count, booked_value_cents: count })),
})
export const integrationSchema = z.object({ emails_enabled: z.boolean(), deliveries: z.array(z.object({
  id: z.string(), channel: z.enum(['calendar', 'email']), event: z.enum(['confirmed', 'rescheduled', 'cancelled']),
  state: z.enum(['pending', 'processing', 'done', 'skipped', 'failed']), attempts: count,
  error_code: z.string().nullable(), created_at: z.string(), finished_at: z.string().nullable(),
})) })
export function validatePeriod(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error('invalid_period')
  const first = Temporal.PlainDate.from(from, { overflow: 'reject' })
  const last = Temporal.PlainDate.from(to, { overflow: 'reject' })
  const days = first.until(last).days
  if (first.year < 1 || last.year > 9998 || days < 0 || days > 365) throw new Error('invalid_period')
}
export async function getAnalytics(businessId: string, from: string, to: string, signal: AbortSignal) {
  validatePeriod(from, to)
  const { data, error } = await getSupabase().rpc('booking_analytics', {
    target_business_id: z.uuid().parse(businessId), date_from: from, date_to: to,
  }).abortSignal(signal)
  if (error) throw new Error('Não foi possível carregar os indicadores.')
  return analyticsSchema.parse(data)
}
export async function getIntegrationStatus(businessId: string, signal: AbortSignal) {
  const { data, error } = await getSupabase().rpc('booking_integration_status', { target_business_id: z.uuid().parse(businessId) }).abortSignal(signal)
  if (error) throw new Error('Não foi possível consultar os envios.')
  return integrationSchema.parse(data)
}
export async function setBookingEmails(businessId: string, enabled: boolean) {
  const { data, error } = await getSupabase().rpc('set_booking_emails_enabled', { target_business_id: z.uuid().parse(businessId), enabled })
  if (error) throw new Error('Não foi possível guardar a definição de emails.')
  return z.boolean().parse(data)
}
