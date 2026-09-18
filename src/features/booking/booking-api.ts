import { z } from 'zod'
import { getSupabase } from '../../lib/supabase/client'

const slugSchema = z.string().min(3).max(63).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
const employeeSchema = z.object({ id: z.uuid(), name: z.string().min(1) })
const catalogSchema = z.object({
  business: z.object({ name: z.string().min(1), slug: slugSchema, timezone: z.string().min(1) }),
  services: z.array(z.object({ id: z.uuid(), name: z.string().min(1), duration_minutes: z.number().int().min(1).max(44640),
    price_cents: z.number().int().nonnegative(), currency: z.literal('EUR'), employees: z.array(employeeSchema).min(1) })),
})
export type BookingCatalog = z.infer<typeof catalogSchema>
export const contactsSchema = z.object({
  name: z.string().trim().min(1, 'Indique o seu nome.').max(120, 'Use até 120 caracteres.'),
  email: z.string().trim().toLowerCase().pipe(z.email('Indique um email válido.').max(254)),
  phone: z.string().trim().max(40, 'Use até 40 caracteres.'),
})
export type BookingContacts = z.infer<typeof contactsSchema>
export const bookingRequestSchema = z.object({
  timezone: z.string().refine((value) => { try { new Intl.DateTimeFormat('pt-PT', { timeZone: value }); return true } catch { return false } }).optional(),
  slug: slugSchema, employeeId: z.uuid(), serviceId: z.uuid(), startsAt: z.iso.datetime({ offset: true }),
  requestKey: z.uuid(), contacts: contactsSchema,
})
export type BookingRequest = z.infer<typeof bookingRequestSchema>
const receiptSchema = z.object({ id: z.uuid(), status: z.enum(['confirmed', 'cancelled']),
  starts_at: z.iso.datetime({ offset: true }), ends_at: z.iso.datetime({ offset: true }),
  service_name: z.string(), employee_name: z.string(), duration_minutes: z.number().int().positive(),
  price_cents: z.number().int().nonnegative(), currency: z.literal('EUR'),
})
export type BookingReceipt = z.infer<typeof receiptSchema>
export class BookingError extends Error {
  readonly kind: 'conflict' | 'unavailable' | 'invalid' | 'uncertain'
  constructor(kind: BookingError['kind'], message: string) { super(message); this.kind = kind }
}
export async function getBookingCatalog(slug: string, signal: AbortSignal) {
  if (!slugSchema.safeParse(slug).success) throw new BookingError('unavailable', 'Esta página de reservas não está disponível.')
  const { data, error } = await getSupabase().rpc('get_public_booking_catalog', { target_business_slug: slug }).abortSignal(signal)
  if (error?.code === '42501') throw new BookingError('unavailable', 'Esta empresa não tem reservas públicas disponíveis.')
  if (error) throw new Error('Não foi possível carregar os serviços. Tente novamente.')
  return catalogSchema.parse(data)
}
export async function confirmBooking(input: BookingRequest): Promise<BookingReceipt> {
  const request = bookingRequestSchema.parse(input)
  try {
    const { data, error } = await getSupabase().rpc('confirm_booking', {
      business_slug: request.slug, target_employee_id: request.employeeId, target_service_id: request.serviceId,
      requested_start: request.startsAt, request_key: request.requestKey,
      customer_name: request.contacts.name, customer_email: request.contacts.email, customer_phone: request.contacts.phone || undefined,
    })
    if (error?.code === '23P01') throw new BookingError('conflict', 'Este horário deixou de estar disponível. Escolha outra vaga.')
    if (error?.code === '42501') throw new BookingError('unavailable', 'Esta seleção deixou de aceitar reservas públicas.')
    if (error?.code === '22023') throw new BookingError('invalid', 'Não foi possível aceitar estes dados. Reveja o pedido.')
    if (error) throw error
    return receiptSchema.parse(data)
  } catch (error) {
    if (error instanceof BookingError) throw error
    throw new BookingError('uncertain', 'Não conseguimos confirmar o resultado. Verifique novamente o mesmo pedido para evitar uma reserva duplicada.')
  }
}

// Só persiste um pedido submetido nesta aba, para recuperar após atualização.
const pendingKey = (slug: string) => `booking-pending:${slug}`
export function loadPendingBooking(slug: string): BookingRequest | null {
  try {
    const raw = sessionStorage.getItem(pendingKey(slug))
    if (!raw) return null
    const parsed = bookingRequestSchema.safeParse(JSON.parse(raw))
    return parsed.success && parsed.data.slug === slug ? parsed.data : null
  } catch { return null }
}
export function savePendingBooking(request: BookingRequest) {
  sessionStorage.setItem(pendingKey(request.slug), JSON.stringify(request))
}
export function clearPendingBooking(slug: string) { sessionStorage.removeItem(pendingKey(slug)) }
