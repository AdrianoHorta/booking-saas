import { z } from 'zod'
import { getSupabase } from '../../lib/supabase/client'
import { dayBounds, parseLocalDate } from '../availability/expand-working-hours'

export const PAGE_SIZE = 25
export async function cancelReservation(businessId: string, bookingId: string) {
  const { data, error } = await getSupabase().rpc('cancel_booking', {
    target_business_id: z.uuid().parse(businessId), target_booking_id: z.uuid().parse(bookingId),
  })
  if (error?.code === '42501') throw new Error('Não tem permissão para cancelar esta reserva, ou a reserva já não está disponível.')
  if (error?.code === '22023') throw new Error('O prazo de cancelamento desta reserva terminou.')
  if (error) throw new Error('Não foi possível confirmar o cancelamento. Pode repetir o pedido ou atualizar as reservas para verificar o estado.')
  return z.object({ id: z.uuid(), status: z.literal('cancelled'), cancelled_at: z.string().nullable() }).parse(data)
}
export type ReservationFilters = { businessId: string; timezone: string; from: string; to: string; status: 'all' | 'confirmed' | 'cancelled'; page: number; employeeId?: string }
export function reservationBounds(input: ReservationFilters) {
  z.uuid().parse(input.businessId)
  if (input.employeeId) z.uuid().parse(input.employeeId)
  z.enum(['all', 'confirmed', 'cancelled']).parse(input.status)
  z.number().int().nonnegative().parse(input.page)
  const first = parseLocalDate(input.from)
  const last = parseLocalDate(input.to)
  const days = first.until(last).days
  if (first.year < 1 || last.year > 9998 || days < 0 || days > 30) throw new RangeError('Escolha um período de 1 a 31 dias, com o fim igual ou posterior ao início.')
  return { start: new Date(dayBounds(input.from, input.timezone).start).toISOString(), end: new Date(dayBounds(input.to, input.timezone).end).toISOString() }
}
export async function getReservations(input: ReservationFilters, signal: AbortSignal) {
  const bounds = reservationBounds(input)
  let query = getSupabase().from('bookings')
    .select('id,starts_at,ends_at,status,service_name,employee_name,duration_minutes,price_cents,currency,cancellation_notice_hours,customer:customers!bookings_customer_fkey(name,email,phone)')
    .eq('business_id', input.businessId).lt('starts_at', bounds.end).gt('ends_at', bounds.start)
    .order('starts_at').order('id')
  if (input.status !== 'all') query = query.eq('status', input.status)
  if (input.employeeId) query = query.eq('employee_id', input.employeeId)
  const { data, error } = await query.range(input.page * PAGE_SIZE, (input.page + 1) * PAGE_SIZE).abortSignal(signal)
  if (error) throw new Error('Não foi possível carregar as reservas. Verifique a ligação e tente novamente.')
  if (!data) throw new Error('A resposta das reservas está incompleta. Tente novamente.')
  return { reservations: data.slice(0, PAGE_SIZE), hasMore: data.length > PAGE_SIZE }
}
export async function getOwnProfessional(businessId: string, userId: string, signal: AbortSignal) {
  const { data, error } = await getSupabase().from('employees').select('id,name')
    .eq('business_id', businessId).eq('user_id', userId).abortSignal(signal).maybeSingle()
  if (error) throw new Error('Não foi possível verificar a associação ao profissional.')
  return data
}
