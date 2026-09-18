import type { Database } from '../../lib/supabase/database.types'

export type Business = Database['public']['Tables']['businesses']['Row']
export type BusinessRole = Database['public']['Enums']['business_role']
export type BusinessSummary = Pick<Business, 'id' | 'name' | 'slug' | 'timezone' | 'is_active' | 'public_booking_enabled'> & {
  role: BusinessRole
}

export const businessRoleLabels: Record<BusinessRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  employee: 'Colaborador',
}
