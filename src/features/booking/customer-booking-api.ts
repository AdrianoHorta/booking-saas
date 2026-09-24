import { z } from 'zod'
import { getSupabase } from '../../lib/supabase/client'
const schema = z.object({ id: z.uuid(), status: z.enum(['confirmed','cancelled']), business_name: z.string(), timezone: z.string(),
  service_name: z.string(), employee_name: z.string(), starts_at: z.iso.datetime({ offset: true }), ends_at: z.iso.datetime({ offset: true }),
  cancellation_notice_hours: z.number().int().nonnegative(), cancellation_deadline: z.iso.datetime({ offset: true }), can_cancel: z.boolean() })
export async function customerBooking(id: string, token: string, cancel = false) {
  if (!z.uuid().safeParse(id).success || !/^[0-9a-f]{64}$/.test(token)) throw new Error('Esta ligação não é válida. Use a ligação privada recebida na confirmação.')
  const { data, error } = await getSupabase().rpc(cancel ? 'cancel_customer_booking' : 'get_customer_booking', { target_booking_id: id, cancellation_token: token })
  if (error?.code === '42501') throw new Error('Esta ligação não é válida ou a reserva não está disponível.')
  if (error?.code === '22023') throw new Error('O prazo de cancelamento terminou. Contacte a empresa.')
  if (error) throw new Error('Não foi possível verificar o resultado. Pode atualizar ou repetir o mesmo pedido.')
  return schema.parse(data)
}
