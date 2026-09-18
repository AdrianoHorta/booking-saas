import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { businessIdSchema } from '../../businesses/schemas/business-schema'
import { getEmployees, getEmployeeMembers, saveEmployee, setEmployeeActive } from '../api/employees-api'
import type { EmployeeFormValues } from '../schemas/employee-schema'

export function useEmployees(businessId: string) {
  return useQuery({
    queryKey: ['employees', businessId],
    enabled: businessIdSchema.safeParse(businessId).success,
    queryFn: ({ signal }) => getEmployees(businessId, signal),
  })
}

export function useEmployeeMembers(businessId: string) {
  return useQuery({
    queryKey: ['employee-members', businessId],
    enabled: businessIdSchema.safeParse(businessId).success,
    queryFn: ({ signal }) => getEmployeeMembers(businessId, signal),
  })
}

export function useSaveEmployee(businessId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ values, id }: { values: EmployeeFormValues; id?: string }) => saveEmployee(businessId, values, id),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['employees', businessId] }),
      client.invalidateQueries({ queryKey: ['availability', businessId] }),
    ]),
  })
}

export function useSetEmployeeActive(businessId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setEmployeeActive(businessId, id, isActive),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['employees', businessId] }),
      client.invalidateQueries({ queryKey: ['availability', businessId] }),
    ]),
  })
}
