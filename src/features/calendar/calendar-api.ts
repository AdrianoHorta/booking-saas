import { z } from 'zod'
import { getSupabase } from '../../lib/supabase/client'

export const connectionSchema = z.object({ employee_id: z.string().uuid(), employee_name: z.string(),
  connected: z.boolean(), calendar_id: z.string().nullable(), calendar_name: z.string().nullable() })
export const calendarsSchema = z.object({ calendars: z.array(z.object({ id: z.string(), summary: z.string(), accessRole: z.enum(['owner', 'writer']) })) })
export async function getCalendarConnection(businessId: string) {
  const { data, error } = await getSupabase().rpc('calendar_connection_status', { target_business_id: businessId })
  if (error) throw new Error('Não foi possível consultar a ligação ao Google.')
  return data === null ? null : connectionSchema.parse(data)
}
export async function calendarAction(businessId: string, action: string, fields: Record<string, string> = {}) {
  const { data, error } = await getSupabase().functions.invoke('google-calendar', { body: { ...fields, businessId, action } })
  if (error) {
    const details = error.context instanceof Response ? await error.context.json().catch(() => null) : null
    throw new Error(typeof details?.error === 'string' ? details.error : 'Não foi possível contactar a integração Google. Confirme a configuração e tente novamente.')
  }
  return data
}
export const pendingCalendarKey = 'calendar-authorization'
export const pendingSchema = z.object({ businessId: z.string().uuid(), userId: z.string().uuid(), state: z.string().regex(/^[a-f0-9]{64}$/) })
export async function startCalendarConnection(businessId: string, userId: string) {
  const result = z.object({ url: z.string().url(), state: z.string().regex(/^[a-f0-9]{64}$/) }).parse(await calendarAction(businessId, 'start'))
  const url = new URL(result.url)
  if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth') throw new Error('Endereço de autorização inválido.')
  sessionStorage.setItem(pendingCalendarKey, JSON.stringify({ businessId, userId, state: result.state }))
  window.location.assign(url.toString())
}
