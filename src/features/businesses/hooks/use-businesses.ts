import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/auth-context'
import { createBusiness, getBusiness, listBusinesses, setPublicBookingEnabled } from '../api/business-api'
import type { BusinessSummary } from '../business.types'
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

export function useSetPublicBookingEnabled() {
  const { session } = useAuth()
  const userId = session?.user.id
  const client = useQueryClient()
  return useMutation({
    mutationFn: setPublicBookingEnabled,
    onSuccess: async (enabled, { businessId }) => {
      // Só atualizar após confirmação do servidor; cancelar leituras antigas primeiro.
      await client.cancelQueries({ queryKey: ['business', userId, businessId] })
      client.setQueryData<BusinessSummary>(['business', userId, businessId], (current) =>
        current ? { ...current, public_booking_enabled: enabled } : current)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['business', userId, businessId] }),
        client.invalidateQueries({ queryKey: ['businesses', userId] }),
      ])
    },
  })
}
