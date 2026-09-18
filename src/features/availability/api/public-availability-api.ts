import { z } from 'zod'
import { getSupabase } from '../../../lib/supabase/client'
import { availabilityRequestSchema } from './availability-api'

export const publicAvailabilityRequestSchema = availabilityRequestSchema.omit({ businessId: true }).extend({
  businessSlug: z.string().trim().min(1).max(100),
})
export type PublicAvailabilityRequest = z.infer<typeof publicAvailabilityRequestSchema>
const instant = z.iso.datetime({ offset: true })
const responseSchema = z.object({
  server_now: instant,
  timezone: z.string().min(1),
  duration_minutes: z.number().int().min(1).max(44640),
  slots: z.array(z.object({ starts_at: instant, ends_at: instant })),
}).superRefine((value, context) => {
  if (value.slots.some((slot) => Date.parse(slot.starts_at) < Date.parse(value.server_now)
    || Date.parse(slot.ends_at) - Date.parse(slot.starts_at) !== value.duration_minutes * 60_000)) {
    context.addIssue({ code: 'custom', message: 'Invalid availability slots' })
  }
})

export async function getPublicAvailability(input: PublicAvailabilityRequest, signal: AbortSignal) {
  const request = publicAvailabilityRequestSchema.parse(input)
  const { data, error } = await getSupabase().rpc('get_public_booking_availability', {
    target_business_slug: request.businessSlug, target_employee_id: request.employeeId,
    target_service_id: request.serviceId, target_date: request.date,
  }).abortSignal(signal)
  if (error?.code === '42501') throw new Error('Esta seleção não está disponível para reservas públicas.')
  if (error?.code === '22023') throw new RangeError('Não foi possível consultar esta data. Verifique a data, a duração e os horários do serviço.')
  if (error) throw error
  const result = responseSchema.parse(data)
  return {
    slots: result.slots.map((slot) => ({ start: Date.parse(slot.starts_at), end: Date.parse(slot.ends_at) })),
    timezone: result.timezone, serverNow: result.server_now, durationMinutes: result.duration_minutes,
  }
}
