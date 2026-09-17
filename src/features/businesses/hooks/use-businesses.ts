import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/auth-context'
import { createBusiness, getBusiness, listBusinesses } from '../api/business-api'
import { businessIdSchema } from '../schemas/business-schema'

export function useBusinesses() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['businesses', userId],
    enabled: Boolean(userId),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error('Authentication required')
      return listBusinesses(userId, signal)
    },
  })
}

export function useBusiness(businessId: string) {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['business', userId, businessId],
    enabled: Boolean(userId) && businessIdSchema.safeParse(businessId).success,
    queryFn: ({ signal }) => {
      if (!userId) throw new Error('Authentication required')
      return getBusiness(userId, businessId, signal)
    },
  })
}

export function useCreateBusiness() {
  const { session } = useAuth()
  const client = useQueryClient()
  return useMutation({
    mutationFn: createBusiness,
    onSuccess: () => client.invalidateQueries({ queryKey: ['businesses', session?.user.id] }),
  })
}
