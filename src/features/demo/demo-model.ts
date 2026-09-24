import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'
export const professionals = [{ id: 'miguel', name: 'Miguel' }, { id: 'ana', name: 'Ana' }] as const
export const services = [{ id: 'corte', name: 'Corte', minutes: 30, cents: 1500 }, { id: 'corte-barba', name: 'Corte e barba', minutes: 60, cents: 2500 }] as const
const bookingSchema = z.object({ id: z.string().min(1), professional: z.enum(['miguel', 'ana']), service: z.enum(['corte', 'corte-barba']),
  client: z.string().trim().min(1).max(80), start: z.number().int().min(0).max(253402214400000), minutes: z.number().int().positive(), cents: z.number().int().nonnegative(), status: z.enum(['confirmed', 'cancelled']) })
const stateSchema = z.object({ version: z.literal(1), day: z.string(), bookings: z.array(bookingSchema).max(200), clientBookingId: z.string().nullable() })
export type DemoBooking = z.infer<typeof bookingSchema>
export type DemoState = z.infer<typeof stateSchema>
export const storageKey = 'booking-demo-v1'
export function today(now = Date.now()) { return Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO('Europe/Lisbon').toPlainDate() }
export function dates(now = Date.now()) { return Array.from({ length: 7 }, (_, i) => today(now).add({ days: i + 1 }).toString()) }
function instant(date: string, minutes: number) {
  return Temporal.PlainDate.from(date).toZonedDateTime({ timeZone: 'Europe/Lisbon', plainTime: { hour: Math.floor(minutes / 60), minute: minutes % 60 } }).epochMilliseconds
}
export function seed(now = Date.now()): DemoState {
  const date = dates(now)[0]
  return { version: 1, day: today(now).toString(), clientBookingId: null, bookings: [
    { id: 'exemplo-miguel', professional: 'miguel', service: 'corte', client: 'João (exemplo)', start: instant(date, 600), minutes: 30, cents: 1500, status: 'confirmed' },
    { id: 'exemplo-ana', professional: 'ana', service: 'corte-barba', client: 'Rita (exemplo)', start: instant(date, 660), minutes: 60, cents: 2500, status: 'confirmed' },
  ] }
}
export function restore(raw: string | null, now = Date.now()): DemoState {
  try { const state = stateSchema.parse(JSON.parse(raw ?? 'null')); if (state.day === today(now).toString()) return state } catch { /* Reset malformed demo data. */ }
  return seed(now)
}
export function slots(state: DemoState, professional: DemoBooking['professional'], serviceId: DemoBooking['service'], date: string, excludeId?: string, now = Date.now()) {
  if (!dates(now).includes(date)) return []
  const duration = services.find((service) => service.id === serviceId)!.minutes
  return Array.from({ length: 16 }, (_, i) => instant(date, 600 + i * 30)).filter((start) => {
    const end = start + duration * 60_000
    return start > now && end <= instant(date, 1080) && !state.bookings.some((booking) => booking.id !== excludeId &&
      booking.professional === professional && booking.status === 'confirmed' && booking.start < end && booking.start + booking.minutes * 60_000 > start)
  })
}
export function reserve(state: DemoState, input: { professional: DemoBooking['professional']; service: DemoBooking['service']; date: string; start: number; client: string }, now = Date.now()): DemoState {
  const client = input.client.trim()
  if (!client || client.length > 80) throw new Error('Indique um nome fictício com até 80 caracteres.')
  if (state.bookings.length >= 200) throw new Error('Reponha os exemplos para continuar a demonstração.')
  if (!slots(state, input.professional, input.service, input.date, undefined, now).includes(input.start)) throw new Error('Escolha um horário disponível.')
  const service = services.find((item) => item.id === input.service)!
  const booking: DemoBooking = { id: crypto.randomUUID(), professional: input.professional, service: input.service, client, start: input.start, minutes: service.minutes, cents: service.cents, status: 'confirmed' }
  return { ...state, clientBookingId: booking.id, bookings: [...state.bookings, booking] }
}
export function canCancel(booking: DemoBooking, now = Date.now()) { return booking.status === 'confirmed' && now <= booking.start - 12 * 3600_000 }
export function cancel(state: DemoState, id: string, now = Date.now()): DemoState {
  const booking = state.bookings.find((item) => item.id === id)
  if (!booking || !canCancel(booking, now)) throw new Error('O prazo de cancelamento terminou. São necessárias 12 horas de antecedência.')
  return { ...state, bookings: state.bookings.map((item) => item.id === id ? { ...item, status: 'cancelled' } : item) }
}
export function move(state: DemoState, id: string, date: string, start: number, now = Date.now()): DemoState {
  const booking = state.bookings.find((item) => item.id === id)
  if (!booking || booking.status !== 'confirmed' || booking.start <= now || !slots(state, booking.professional, booking.service, date, id, now).includes(start)) throw new Error('Esta alteração não está disponível. Escolha outra vaga.')
  return { ...state, bookings: state.bookings.map((item) => item.id === id ? { ...item, start } : item) }
}
