import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { businessIdSchema } from '../../businesses/schemas/business-schema'
import { deleteBlockedPeriod, getSchedule, saveBlockedPeriod, saveWorkingHours, type SaveBlockInput, type ScheduleScope } from '../api/schedules-api'
import type { WeekValues } from '../schemas/schedule-schema'

export const scheduleKey = (scope: ScheduleScope) => ['schedule', scope.businessId, scope.employeeId] as const
export function useSchedule(scope: ScheduleScope) {
  return useQuery({ queryKey: scheduleKey(scope),
    enabled: businessIdSchema.safeParse(scope.businessId).success && businessIdSchema.safeParse(scope.employeeId).success,
    queryFn: ({ signal }) => getSchedule(scope, signal) })
}
export function useSaveWorkingHours(scope: ScheduleScope) {
  const client = useQueryClient()
  return useMutation({ mutationKey: scheduleKey(scope), mutationFn: (values: WeekValues) => saveWorkingHours(scope, values),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: scheduleKey(scope) }),
      client.invalidateQueries({ queryKey: ['availability', scope.businessId, scope.employeeId] }),
    ]) })
}
export function useSaveBlockedPeriod(scope: ScheduleScope) {
  const client = useQueryClient()
  return useMutation({ mutationKey: scheduleKey(scope), mutationFn: (values: SaveBlockInput) => saveBlockedPeriod(scope, values),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: scheduleKey(scope) }),
      client.invalidateQueries({ queryKey: ['availability', scope.businessId, scope.employeeId] }),
    ]) })
}
export function useDeleteBlockedPeriod(scope: ScheduleScope) {
  const client = useQueryClient()
  return useMutation({ mutationKey: scheduleKey(scope), mutationFn: (id: string) => deleteBlockedPeriod(scope, id),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: scheduleKey(scope) }),
      client.invalidateQueries({ queryKey: ['availability', scope.businessId, scope.employeeId] }),
    ]) })
}
