import { z } from 'zod'
import { getSupabase } from '../../lib/supabase/client'
const instant = z.iso.datetime({ offset: true })
const requestSchema = z.object({ businessId: z.uuid(), bookingId: z.uuid(), expectedStart: instant, requestedStart: instant })
export type RescheduleRequest = z.infer<typeof requestSchema>
export async function getRescheduleSlots(businessId: string, bookingId: string, date: string, signal: AbortSignal) {
  const { data, error } = await getSupabase().rpc('get_reschedule_slots', { target_business_id: businessId, target_booking_id: bookingId, target_date: date }).abortSignal(signal)
  if (error) throw new Error('Não foi possível consultar novas vagas. Verifique se a reserva ainda pode ser alterada.')
  return z.object({ expected_start: instant, slots: z.array(z.object({ starts_at: instant, ends_at: instant })) }).parse(data)
}
export class RescheduleError extends Error {
  readonly uncertain: boolean
  constructor(message: string, uncertain = false) { super(message); this.uncertain = uncertain }
}
export async function rescheduleReservation(input: RescheduleRequest) {
  const request = requestSchema.parse(input)
  try {
    const { data, error } = await getSupabase().rpc('reschedule_booking', { target_business_id: request.businessId, target_booking_id: request.bookingId,
      expected_start: request.expectedStart, requested_start: request.requestedStart })
    if (error?.code === '23P01') throw new RescheduleError('Esta vaga já não está disponível. A reserva original foi mantida.')
    if (error?.code === '40001') throw new RescheduleError('A reserva foi alterada entretanto. Atualize os horários antes de tentar novamente.')
    if (error?.code === '42501' || error?.code === '22023') throw new RescheduleError('Esta alteração não é permitida. Atualize a reserva e verifique os dados.')
    if (error) throw error
    return z.object({ id: z.uuid(), starts_at: instant, ends_at: instant }).parse(data)
  } catch (error) {
    if (error instanceof RescheduleError) throw error
    throw new RescheduleError('Resultado incerto. Verifique o mesmo pedido para evitar substituir uma alteração já guardada.', true)
  }
}
