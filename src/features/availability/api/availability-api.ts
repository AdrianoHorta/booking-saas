import { z } from 'zod'
import { getSupabase } from '../../../lib/supabase/client'
import { calculateDailyAvailability } from '../availability-engine'
import { parseLocalDate } from '../expand-working-hours'

export const availabilityRequestSchema = z.object({
  businessId: z.uuid(), employeeId: z.uuid(), serviceId: z.uuid(),
  date: z.string().refine((value) => {
    try { const date = parseLocalDate(value); return date.year >= 1 && date.year <= 9998 } catch { return false }
  }, 'Indique uma data válida.'),
})
export type AvailabilityRequest = z.infer<typeof availabilityRequestSchema>
const instant = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Invalid timestamp')
const contextSchema = z.object({
  server_now: instant, timezone: z.string(), slot_interval_minutes: z.number().int().positive(), duration_minutes: z.number().int().positive(),
  business_active: z.boolean(), employee_active: z.boolean(), service_active: z.boolean(), assigned: z.boolean(),
  working_hours: z.array(z.object({ weekday: z.number().int(), start_minute: z.number().int(), end_minute: z.number().int() })),
  blocked_periods: z.array(z.object({ starts_at: instant, ends_at: instant })),
  booking_periods: z.array(z.object({ starts_at: instant, ends_at: instant })),
})
export type AvailabilityContext = z.infer<typeof contextSchema>
export type UnavailableReason = 'business_inactive' | 'employee_inactive' | 'service_inactive' | 'unassigned' | null

export function availabilityFromContext(date: string, raw: unknown) {
  const context = contextSchema.parse(raw)
  const reason: UnavailableReason = !context.business_active ? 'business_inactive'
    : !context.employee_active ? 'employee_inactive' : !context.service_active ? 'service_inactive'
      : !context.assigned ? 'unassigned' : null
  const slots = reason ? [] : calculateDailyAvailability({ date, timezone: context.timezone,
    durationMinutes: context.duration_minutes, slotIntervalMinutes: context.slot_interval_minutes,
    now: Date.parse(context.server_now), workingHours: context.working_hours,
    blockedPeriods: context.blocked_periods.map((period) => ({ start: Date.parse(period.starts_at), end: Date.parse(period.ends_at) })),
    bookingPeriods: context.booking_periods.map((period) => ({ start: Date.parse(period.starts_at), end: Date.parse(period.ends_at) })),
    // Google Calendar ainda não está ligado.
    externalBusyPeriods: [],
  })
  return { slots, reason, timezone: context.timezone, serverNow: context.server_now, durationMinutes: context.duration_minutes }
}

export async function getAvailability(input: AvailabilityRequest, signal: AbortSignal) {
  const request = availabilityRequestSchema.parse(input)
  const { data, error } = await getSupabase().rpc('get_availability_context', {
    target_business_id: request.businessId, target_employee_id: request.employeeId,
    target_service_id: request.serviceId, target_date: request.date,
  }).abortSignal(signal)
  if (error?.code === '22023') throw new RangeError('Verifique a data e a duração do serviço. A consulta suporta serviços até 31 dias.')
  if (error) throw error
  return availabilityFromContext(request.date, data)
}
