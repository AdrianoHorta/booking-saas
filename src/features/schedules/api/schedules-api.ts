import { getSupabase } from '../../../lib/supabase/client'
import type { Database } from '../../../lib/supabase/database.types'
import type { WeekValues } from '../schemas/schedule-schema'
import { timeMinutes } from '../schedule-time'

export type WorkingHours = Database['public']['Tables']['employee_working_hours']['Row']
export type BlockedPeriod = Database['public']['Tables']['employee_blocked_periods']['Row']
export type ScheduleScope = { businessId: string; employeeId: string }

export async function getSchedule({ businessId, employeeId }: ScheduleScope, signal: AbortSignal) {
  const db = getSupabase()
  const [employee, hours, blocks] = await Promise.all([
    db.from('employees').select('*').eq('business_id', businessId).eq('id', employeeId).abortSignal(signal).maybeSingle(),
    db.from('employee_working_hours').select('*').eq('business_id', businessId).eq('employee_id', employeeId)
      .order('weekday').order('start_minute').abortSignal(signal),
    db.from('employee_blocked_periods').select('*').eq('business_id', businessId).eq('employee_id', employeeId)
      .order('starts_at').abortSignal(signal),
  ])
  if (employee.error) throw employee.error
  if (hours.error) throw hours.error
  if (blocks.error) throw blocks.error
  return { employee: employee.data, hours: hours.data, blocks: blocks.data }
}

export async function saveWorkingHours(scope: ScheduleScope, values: WeekValues) {
  const { error } = await getSupabase().rpc('save_employee_working_hours', {
    target_business_id: scope.businessId, target_employee_id: scope.employeeId,
    periods: values.periods.map((period) => ({ weekday: period.weekday, start_minute: timeMinutes(period.start), end_minute: timeMinutes(period.end) })),
  })
  if (error) throw error
}

export type SaveBlockInput = { id?: string; label: string; starts_at: string; ends_at: string }
export async function saveBlockedPeriod(scope: ScheduleScope, { id, ...values }: SaveBlockInput) {
  const table = getSupabase().from('employee_blocked_periods')
  const query = id ? table.update(values).eq('business_id', scope.businessId).eq('employee_id', scope.employeeId).eq('id', id)
    : table.insert({ ...values, business_id: scope.businessId, employee_id: scope.employeeId })
  const { data, error } = await query.select().single()
  if (error) throw error
  return data
}

export async function deleteBlockedPeriod(scope: ScheduleScope, id: string) {
  const { data, error } = await getSupabase().from('employee_blocked_periods').delete()
    .eq('business_id', scope.businessId).eq('employee_id', scope.employeeId).eq('id', id).select('id').single()
  if (error) throw error
  return data
}
