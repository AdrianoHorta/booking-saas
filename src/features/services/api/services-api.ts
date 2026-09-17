import { getSupabase } from '../../../lib/supabase/client'


export async function getServices(businessId: string) {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', businessId)
    .order('name')

  if (error) {
    throw error
  }

  return data
}

type CreateServiceInput = {
  businessId: string
  name: string
  description?: string
  durationMinutes: number
  priceCents: number
}

export async function createService(input: CreateServiceInput) {
    const supabase = getSupabase()
    const { data, error } = await supabase
    .from('services')
    .insert({
      business_id: input.businessId,
      name: input.name,
      description: input.description || null,
      duration_minutes: input.durationMinutes,
      price_cents: input.priceCents,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

type UpdateServiceInput = {
  id: string
  name?: string
  description?: string | null
  durationMinutes?: number
  priceCents?: number
  isActive?: boolean
}

export async function updateService(input: UpdateServiceInput) {
  const { id, ...changes } = input

  const updateData = {
    ...(changes.name !== undefined && { name: changes.name }),
    ...(changes.description !== undefined && {
      description: changes.description,
    }),
    ...(changes.durationMinutes !== undefined && {
      duration_minutes: changes.durationMinutes,
    }),
    ...(changes.priceCents !== undefined && {
      price_cents: changes.priceCents,
    }),
    ...(changes.isActive !== undefined && {
      is_active: changes.isActive,
    }),
  }

  const supabase = getSupabase()
    const { data, error } = await supabase
    .from('services')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}