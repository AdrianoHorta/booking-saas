import { z } from 'zod'
import { getSupabase } from '../../../lib/supabase/client'
import { businessIdSchema } from '../schemas/business-schema'
import type { BusinessSummary } from '../business.types'
import type { BusinessFormValues } from '../schemas/business-schema'

const membershipSelection = 'role,business:businesses!inner(id,name,slug,timezone,is_active,public_booking_enabled,cancellation_notice_hours)' as const

export async function setPublicBookingEnabled(input: { businessId: string; enabled: boolean }) {
  const request = z.object({ businessId: businessIdSchema, enabled: z.boolean() }).parse(input)
  const { data, error } = await getSupabase().rpc('set_public_booking_enabled', {
    target_business_id: request.businessId, enabled: request.enabled,
  })
  if (error?.code === '42501') throw new Error('Não tem permissão para alterar a publicação desta empresa.')
  if (error?.code === '22023') throw new Error('Uma empresa inativa não pode ativar reservas públicas.')
  if (error) throw new Error('Não foi possível guardar a publicação. Verifique a ligação e tente novamente.')
  return z.boolean().parse(data)
}

export async function listBusinesses(userId: string, signal: AbortSignal): Promise<BusinessSummary[]> {
  const { data, error } = await getSupabase().from('business_members')
    .select(membershipSelection).eq('user_id', userId)
    .order('created_at', { ascending: true }).abortSignal(signal)
  if (error) throw error
  return data.map(({ business, role }) => ({ ...business, role }))
}

export async function getBusiness(userId: string, businessId: string, signal: AbortSignal): Promise<BusinessSummary | null> {
  const { data, error } = await getSupabase().from('business_members')
    .select(membershipSelection).eq('user_id', userId).eq('business_id', businessId)
    .abortSignal(signal).maybeSingle()
  if (error) throw error
  return data ? { ...data.business, role: data.role } : null
}

export async function createBusiness(values: BusinessFormValues) {
  const { data, error } = await getSupabase().rpc('create_business', {
    business_name: values.name,
    business_slug: values.slug,
    business_timezone: values.timezone,
  })
  if (error) throw error
  return data
}
