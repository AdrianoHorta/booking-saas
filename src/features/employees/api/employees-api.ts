import { getSupabase } from '../../../lib/supabase/client'
import type { EmployeeFormValues } from '../schemas/employee-schema'
import { listBusinessMembers } from '../../businesses/api/members-api'

export async function getEmployees(businessId: string, signal?: AbortSignal) {
  let query = getSupabase().from('employees')
    .select('*,employee_services(service_id)')
    .eq('business_id', businessId).order('name')
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw error
  return data
}

export type Employee = Awaited<ReturnType<typeof getEmployees>>[number]

export async function getEmployeeMembers(businessId: string, signal?: AbortSignal) {
  return listBusinessMembers(businessId, signal)
}

export async function saveEmployee(businessId: string, values: EmployeeFormValues, id?: string) {
  const { data, error } = await getSupabase().rpc('save_employee', {
    target_business_id: businessId,
    target_employee_id: id,
    employee_name: values.name,
    linked_user_id: values.userId || undefined,
    service_ids: values.serviceIds,
  })
  if (error) throw error
  return data
}

export async function setEmployeeActive(businessId: string, id: string, isActive: boolean) {
  const { data, error } = await getSupabase().from('employees')
    .update({ is_active: isActive }).eq('business_id', businessId).eq('id', id)
    .select().single()
  if (error) throw error
  return data
}
